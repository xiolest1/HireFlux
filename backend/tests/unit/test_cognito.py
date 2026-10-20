import base64
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import jwt
import pytest
from cognito_fixtures import Harness, Provider
from cryptography.hazmat.primitives.asymmetric import rsa

from hireflux_backend.application.errors import (
    AccountNotVerifiedError,
    AuthenticationRequiredError,
    AuthenticationUnavailableError,
    SessionExpiredError,
)
from hireflux_backend.auth.provider import ProviderResponse
from hireflux_backend.domain.enums import UserRole
from hireflux_backend.domain.models import IdentityKind


def test_verified_principal_preserves_opaque_subject_and_never_trusts_roles(
    cognito_harness: Harness,
) -> None:
    h = cognito_harness
    token = h.token(
        sub="MixedCase-NotAnRfcUuid", **{"cognito:groups": ["ADMIN"], "custom:role": "ADMIN"}
    )
    assert not h.provider.calls
    result = h.verifier.authenticate(token)
    assert result.identity.user_id == "MixedCase-NotAnRfcUuid"
    assert result.identity.role is UserRole.STANDARD_USER
    assert result.identity.kind is IdentityKind.PERSISTENT
    assert result.identity.data_expires_at is None
    assert result.profile.email == "tester@example.com"
    assert not hasattr(result, "token")
    assert token not in repr(result)
    assert len(h.provider.calls) == 2


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("iss", "https://attacker.invalid/pool"),
        ("iss", None),
        ("client_id", "other"),
        ("token_use", "id"),
        ("token_use", None),
        ("token_use", True),
        ("aud", "testonlypublicclient"),
        ("sub", "unsafe#owner"),
        ("sub", "two words"),
        ("sub", "a\x00b"),
        ("sub", "a\u200bb"),
        ("sub", ""),
        ("sub", "a" * 129),
        ("sub", 7),
        ("sub", None),
        ("username", None),
        ("username", []),
        ("username", "unsafe#name"),
        ("scope", "openid email"),
        ("scope", ["openid", "email", "profile"]),
        ("scope", "openid  email profile"),
        ("scope", "openid\temail profile"),
        ("scope", "openid email profile\n"),
        ("scope", None),
        ("scope", "a" * 2049),
        ("exp", True),
        ("exp", 1.2),
        ("exp", "1900003600"),
        ("exp", None),
        ("iat", False),
        ("iat", 1900000000.0),
        ("iat", None),
        ("auth_time", "1900000000"),
        ("auth_time", True),
        ("auth_time", None),
        ("nbf", True),
        ("nbf", "1900000000"),
        ("nbf", 1900003600),
        ("iat", 1900000061),
        ("auth_time", 1900000001),
        ("nbf", 1900000061),
        ("exp", 1900003601),
        ("exp", 1900000000),
        ("iat", -1),
    ],
)
def test_invalid_claims_never_reach_admission(
    cognito_harness: Harness, name: str, value: Any
) -> None:
    h = cognito_harness
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(h.token(**{name: value}))
    assert not h.provider.token_hashes


def test_expiration_and_clock_skew(cognito_harness: Harness) -> None:
    h = cognito_harness
    token = h.token(iat=1900000000 - 3600, exp=1900000000, auth_time=1900000000 - 3610)
    h.clock.advance(59)
    assert h.verifier.authenticate(token).identity.data_expires_at is None
    h.clock.advance(1)
    with pytest.raises(SessionExpiredError):
        h.verifier.authenticate(token)
    future = h.token(
        iat=int(h.clock.now) + 60, auth_time=int(h.clock.now), exp=int(h.clock.now) + 3600
    )
    h.verifier.authenticate(future)


@pytest.mark.parametrize(
    "headers",
    [
        {"kid": "unknown"},
        {"kid": ""},
        {"kid": "a" * 257},
        {"jku": "https://attacker.invalid/jwks"},
        {"x5u": "https://attacker.invalid/key"},
        {"jwk": {}},
        {"crit": []},
        {"typ": "other"},
    ],
)
def test_untrusted_jwt_headers(cognito_harness: Harness, headers: dict[str, Any]) -> None:
    with pytest.raises(AuthenticationRequiredError):
        cognito_harness.verifier.authenticate(cognito_harness.token(headers=headers))
    assert not cognito_harness.provider.token_hashes


def test_signature_and_algorithm_rejection(cognito_harness: Harness) -> None:
    h = cognito_harness
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(h.token(key=other))
    for algorithm in ("HS256", "none"):
        token = jwt.encode(
            {"sub": "fake"},
            "synthetic-test-key" * 4 if algorithm == "HS256" else None,
            algorithm=algorithm,
            headers={"kid": "key1"},
        )
        with pytest.raises(AuthenticationRequiredError):
            h.verifier.authenticate(token)
    token = h.token()
    header, payload, signature = token.split(".")
    altered = payload[:-2] + ("AA" if payload[-2:] != "AA" else "BB")
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(".".join((header, altered, signature)))


@pytest.mark.parametrize("token", ["a.b", "a.b.c.d", "...", "a.b.!!!!", "a" * 8193])
def test_malformed_jws(cognito_harness: Harness, token: str) -> None:
    with pytest.raises(AuthenticationRequiredError):
        cognito_harness.verifier.authenticate(token)
    assert not cognito_harness.provider.calls


def test_duplicate_and_deep_json_rejected_safely(cognito_harness: Harness) -> None:
    def segment(raw: bytes) -> str:
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    h = cognito_harness
    header, _, signature = h.token().split(".")
    for payload in (b'{"sub":"a","sub":"b"}', b'{"x":' + b"[" * 1500 + b"0" + b"]" * 1500 + b"}"):
        with pytest.raises(AuthenticationRequiredError):
            h.verifier.authenticate(f"{header}.{segment(payload)}.{signature}")
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(f"{segment(b'{"alg":"RS256","alg":"HS256"}')}.e30.{signature}")
    assert not h.provider.calls


def test_key_rotation_freshness_cooldown_and_negative_cache(cognito_harness: Harness) -> None:
    h = cognito_harness
    h.verifier.authenticate(h.token())
    new = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    rotated = h.token(key=new, headers={"kid": "key2"})
    h.provider.jwks = {"keys": [Provider.jwk(new, "key2")]}
    for _ in range(3):
        with pytest.raises(AuthenticationRequiredError):
            h.verifier.authenticate(rotated)
    assert len(h.provider.calls) == 2
    h.clock.advance(30)
    h.verifier.authenticate(rotated)
    assert len(h.provider.calls) == 4
    h.clock.advance(300)
    h.provider.key_failure = True
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(rotated)
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(rotated)
    assert len(h.provider.calls) == 5


def test_warm_keys_and_admission_single_flight(cognito_harness: Harness) -> None:
    h = cognito_harness
    token = h.token()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: h.verifier.authenticate(token), range(16)))
    assert all(result.identity == results[0].identity for result in results)
    assert len(h.provider.calls) == 2


@pytest.mark.parametrize(
    "mutation",
    [
        "duplicate",
        "wrong_type",
        "wrong_alg",
        "weak",
        "empty",
        "too_many",
        "oversized",
        "bad_component",
        "private",
    ],
)
def test_malformed_jwks_fails_as_provider_unavailable(
    cognito_harness: Harness, mutation: str
) -> None:
    h = cognito_harness
    key = Provider.jwk(h.key, "key1")
    if mutation == "duplicate":
        h.provider.jwks = {"keys": [key, key]}
    elif mutation == "wrong_type":
        h.provider.jwks = {"keys": [{**key, "kty": "EC"}]}
    elif mutation == "wrong_alg":
        h.provider.jwks = {"keys": [{**key, "alg": "HS256"}]}
    elif mutation == "weak":
        h.provider.jwks = {
            "keys": [
                Provider.jwk(rsa.generate_private_key(public_exponent=65537, key_size=1024), "key1")
            ]
        }
    elif mutation == "empty":
        h.provider.jwks = {"keys": []}
    elif mutation == "too_many":
        h.provider.jwks = {"keys": [key] * 17}
    elif mutation == "oversized":
        h.provider.jwks = {"keys": [key], "padding": "a" * 65536}
    elif mutation == "bad_component":
        h.provider.jwks = {"keys": [{**key, "n": "!!!!"}]}
    else:
        h.provider.jwks = {"keys": [{**key, "d": "untrusted"}]}
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(h.token())
    assert not h.provider.token_hashes


@pytest.mark.parametrize("status", [301, 302, 403, 429, 500, 503])
def test_key_provider_failures(cognito_harness: Harness, status: int) -> None:
    h = cognito_harness
    h.provider.key_status = status
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(h.token())


@pytest.mark.parametrize("flag", [True, "true"])
def test_only_strict_verified_email_is_accepted(cognito_harness: Harness, flag: object) -> None:
    cognito_harness.provider.profile["email_verified"] = flag
    cognito_harness.verifier.authenticate(cognito_harness.token())


@pytest.mark.parametrize("flag", [False, "false", "True", "TRUE", "yes", 1, 0, None, [], {}])
def test_unverified_email_is_forbidden(cognito_harness: Harness, flag: object) -> None:
    h = cognito_harness
    h.provider.profile["email_verified"] = flag
    with pytest.raises(AccountNotVerifiedError):
        h.verifier.authenticate(h.token())
    assert not h.verifier._admissions


def test_profile_match_types_and_fallback(cognito_harness: Harness) -> None:
    h = cognito_harness
    h.provider.profile["sub"] = "different"
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(h.token())
    del h.provider.profile["sub"]
    for field, value in (("name", []), ("email", "invalid-email")):
        prior = dict(h.provider.profile)
        h.provider.profile[field] = value
        with pytest.raises(AuthenticationUnavailableError):
            h.verifier.authenticate(h.token())
        h.provider.profile = prior
    del h.provider.profile["name"]
    assert h.verifier.authenticate(h.token()).profile.name == "HireFlux user"


def test_admission_expiry_freshness_token_isolation_and_fail_closed(
    cognito_harness: Harness,
) -> None:
    h = cognito_harness
    token = h.token()
    h.verifier.authenticate(token)
    h.provider.user_failure = True
    h.clock.advance(59)
    h.verifier.authenticate(token)
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(h.token(jti="different-token"))
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(token, fresh=True)
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(token)
    h.provider.user_failure = False
    h.verifier.authenticate(token)
    h.clock.advance(60)
    h.provider.user_status = 401
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(token)
    assert not h.verifier._admissions


def test_caches_bounded_and_no_raw_credentials(cognito_harness: Harness) -> None:
    h = cognito_harness
    tokens = [h.token(jti=str(index)) for index in range(130)]
    for token in tokens:
        h.verifier.authenticate(token)
    assert len(h.verifier._admissions) == 128
    assert all(len(key[2]) == 64 for key in h.verifier._admissions)
    assert not any(token in repr(h.verifier._admissions) for token in tokens)
    for index in range(140):
        with pytest.raises(AuthenticationRequiredError):
            h.verifier.authenticate(h.token(headers={"kid": f"unknown{index}"}))
    assert len(h.verifier._keys._negative) == 128
    assert sum(url.endswith("jwks.json") for url in h.provider.calls) == 1


def test_never_cache_beyond_token_expiry_or_begin_work_without_lambda_budget(
    cognito_harness: Harness,
) -> None:
    h = cognito_harness
    token = h.token(exp=int(h.clock.now) + 10)
    h.verifier.authenticate(token)
    h.clock.advance(10)
    h.provider.user_status = 401
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(token)
    count = len(h.provider.calls)
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(h.token(), remaining_seconds=0.9)
    assert len(h.provider.calls) == count


@pytest.mark.parametrize("body", [b"[]", b"{", b"\xff", b'{"sub":"a","sub":"b"}', b"a" * 16385])
def test_invalid_userinfo_never_admits_or_caches(
    cognito_harness: Harness, monkeypatch: pytest.MonkeyPatch, body: bytes
) -> None:
    h = cognito_harness
    original = h.provider.get

    def malformed(url: str, **kwargs: Any) -> ProviderResponse:
        return ProviderResponse(200, body) if url.endswith("userInfo") else original(url, **kwargs)

    monkeypatch.setattr(h.provider, "get", malformed)
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(h.token())
    assert not h.verifier._admissions


def test_missing_key_id_and_combined_work_budget(
    cognito_harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = cognito_harness
    no_kid = jwt.encode({"sub": "fake"}, h.key, algorithm="RS256")
    with pytest.raises(AuthenticationRequiredError):
        h.verifier.authenticate(no_kid)
    assert not h.provider.calls
    original = h.provider.get

    def slow(url: str, **kwargs: Any) -> ProviderResponse:
        result = original(url, **kwargs)
        h.clock.advance(4.1)
        return result

    monkeypatch.setattr(h.provider, "get", slow)
    with pytest.raises(AuthenticationUnavailableError):
        h.verifier.authenticate(h.token())
    assert not h.provider.token_hashes
