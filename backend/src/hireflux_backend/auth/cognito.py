"""Cognito access-token verification and bounded, server-side account admission."""

import base64
import hashlib
import re
import unicodedata
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from threading import Lock
from time import monotonic, time
from typing import Any

import jwt
from pydantic import EmailStr, TypeAdapter, ValidationError

from hireflux_backend.application.errors import (
    AccountNotVerifiedError,
    AuthenticationRequiredError,
    AuthenticationUnavailableError,
    SessionExpiredError,
)
from hireflux_backend.auth.jwks import KEY_ID, JwksCache
from hireflux_backend.auth.principal import VerifiedPrincipal
from hireflux_backend.auth.provider import (
    AuthBudget,
    HttpsProviderTransport,
    ProviderTransport,
    json_object,
)
from hireflux_backend.config import AuthMode, Settings
from hireflux_backend.domain.enums import UserRole
from hireflux_backend.domain.models import CurrentIdentity, IdentityKind, TrustedProfileAttributes

REQUIRED_SCOPES = ("openid", "email", "profile")
MAX_CREDENTIAL_BYTES = 8192
CLOCK_SKEW_SECONDS = 60
MAX_ACCESS_LIFETIME_SECONDS = 3600
ADMISSION_FRESH_SECONDS = 60
MAX_ADMISSIONS = 128
MAX_USERINFO_BYTES = 16 * 1024
EMAIL = TypeAdapter(EmailStr)


def safe_text(value: object, maximum: int, *, key_component: bool = False) -> bool:
    return (
        isinstance(value, str)
        and 0 < len(value) <= maximum
        and value == value.strip()
        and not any(unicodedata.category(char).startswith("C") for char in value)
        and (not key_component or not any(char.isspace() or char == "#" for char in value))
    )


def _segment_object(segment: str) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", segment):
        raise ValueError("Invalid JWS segment.")
    return json_object(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))


@dataclass(frozen=True, slots=True)
class _Admission:
    profile: TrustedProfileAttributes
    expires: float


class CognitoVerifier:
    def __init__(
        self,
        settings: Settings,
        *,
        transport: ProviderTransport | None = None,
        clock: Callable[[], float] = time,
        monotonic_clock: Callable[[], float] = monotonic,
    ) -> None:
        if AuthMode.COGNITO not in settings.enabled_auth_capabilities:
            raise ValueError("Cognito capability is disabled.")
        self._issuer = settings.cognito_issuer
        assert settings.cognito_domain is not None and settings.cognito_app_client_id is not None
        self._client = settings.cognito_app_client_id
        self._userinfo = settings.cognito_domain + "/oauth2/userInfo"
        self._transport = transport or HttpsProviderTransport(self._issuer, settings.cognito_domain)
        self._clock = clock
        self._monotonic = monotonic_clock
        self._keys = JwksCache(self._issuer, self._transport, clock=monotonic_clock)
        self._admissions: OrderedDict[tuple[str, str, str], _Admission] = OrderedDict()
        self._lock = Lock()

    def _verify(self, token: str, budget: AuthBudget) -> dict[str, Any]:
        try:
            if len(token.encode("utf-8")) > MAX_CREDENTIAL_BYTES:
                raise ValueError("Oversized credential.")
            parts = token.split(".")
            if len(parts) != 3 or not re.fullmatch(r"[A-Za-z0-9_-]+", parts[2]):
                raise ValueError("Invalid JWS.")
            header = _segment_object(parts[0])
            # Reject duplicate members even though the cryptographic library accepts JSON.
            _segment_object(parts[1])
            kid = header.get("kid")
            if (
                header.get("alg") != "RS256"
                or not isinstance(kid, str)
                or not KEY_ID.fullmatch(kid)
                or set(header) - {"alg", "kid", "typ"}
                or header.get("typ", "JWT") != "JWT"
            ):
                raise ValueError("Unsupported JWS header.")
            key = self._keys.key(kid, budget)
            claims: dict[str, Any] = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options={
                    "verify_exp": False,
                    "verify_iat": False,
                    "verify_nbf": False,
                    "verify_aud": False,
                    "verify_iss": False,
                    "verify_sub": False,
                    "verify_jti": False,
                },
            )
            if (
                claims.get("iss") != self._issuer
                or claims.get("client_id") != self._client
                or claims.get("token_use") != "access"
                or "aud" in claims
                or not safe_text(claims.get("sub"), 128, key_component=True)
                or not safe_text(claims.get("username"), 128, key_component=True)
            ):
                raise ValueError("Invalid access claims.")
            for name in ("exp", "iat", "auth_time", "nbf"):
                if name not in claims and name == "nbf":
                    continue
                if type(claims.get(name)) is not int or not 0 < claims[name] <= 2**53:
                    raise ValueError("Invalid NumericDate.")
            now = self._clock()
            exp, iat, auth_time = claims["exp"], claims["iat"], claims["auth_time"]
            if (
                not 0 < exp - iat <= MAX_ACCESS_LIFETIME_SECONDS
                or auth_time > iat
                or iat > now + CLOCK_SKEW_SECONDS
                or auth_time > now + CLOCK_SKEW_SECONDS
                or (
                    "nbf" in claims
                    and (claims["nbf"] > now + CLOCK_SKEW_SECONDS or claims["nbf"] >= exp)
                )
            ):
                raise ValueError("Invalid access chronology.")
            scope = claims.get("scope")
            if (
                not isinstance(scope, str)
                or not re.fullmatch(r"[\x21-\x7e]+(?: [\x21-\x7e]+)*", scope)
                or len(scope) > 2048
                or not set(REQUIRED_SCOPES) <= set(scope.split(" "))
            ):
                raise ValueError("Required OAuth scopes missing.")
            if exp <= now - CLOCK_SKEW_SECONDS:
                raise SessionExpiredError("This account session has expired.")
            budget.remaining()
            return claims
        except (ValueError, TypeError, KeyError, RecursionError, jwt.PyJWTError):
            raise AuthenticationRequiredError("A valid account session is required.") from None

    def _admit(
        self, token: str, claims: dict[str, Any], budget: AuthBudget, *, fresh: bool
    ) -> TrustedProfileAttributes:
        cache_key = (self._issuer, self._client, hashlib.sha256(token.encode("ascii")).hexdigest())
        if not self._lock.acquire(timeout=budget.remaining()):
            raise AuthenticationUnavailableError("Account admission temporarily unavailable.")
        try:
            now = self._clock()
            cached = self._admissions.get(cache_key)
            if (
                not fresh
                and cached is not None
                and self._monotonic() < cached.expires
                and now < claims["exp"]
            ):
                self._admissions.move_to_end(cache_key)
                return cached.profile
            self._admissions.pop(cache_key, None)
            response = self._transport.get(
                self._userinfo, bearer=token, max_bytes=MAX_USERINFO_BYTES, budget=budget
            )
            budget.remaining()
            if response.status == 401:
                raise AuthenticationRequiredError("A valid account session is required.")
            if response.status != 200 or len(response.body) > MAX_USERINFO_BYTES:
                raise AuthenticationUnavailableError("Account admission temporarily unavailable.")
            try:
                attributes = json_object(response.body)
                if attributes.get("sub") != claims["sub"]:
                    raise AuthenticationRequiredError("A valid account session is required.")
                verified = attributes.get("email_verified")
                if verified is not True and verified != "true":
                    raise AccountNotVerifiedError("A verified account is required.")
                email = attributes.get("email")
                name = attributes.get("name", "HireFlux user")
                if not safe_text(email, 254) or not safe_text(name, 200):
                    raise ValueError("Invalid profile attributes.")
                profile = TrustedProfileAttributes(str(name), str(EMAIL.validate_python(email)))
            except (ValueError, TypeError, RecursionError, ValidationError):
                raise AuthenticationUnavailableError(
                    "Account admission temporarily unavailable."
                ) from None
            self._admissions[cache_key] = _Admission(
                profile,
                self._monotonic()
                + min(ADMISSION_FRESH_SECONDS, max(0, claims["exp"] - self._clock())),
            )
            while len(self._admissions) > MAX_ADMISSIONS:
                self._admissions.popitem(last=False)
            return profile
        finally:
            self._lock.release()

    def authenticate(
        self, token: str, *, fresh: bool = False, remaining_seconds: float | None = None
    ) -> VerifiedPrincipal:
        allowance = 4.0 if remaining_seconds is None else min(4.0, remaining_seconds - 1.0)
        budget = AuthBudget(self._monotonic() + allowance, self._monotonic)
        budget.remaining()
        claims = self._verify(token, budget)
        profile = self._admit(token, claims, budget, fresh=fresh)
        return VerifiedPrincipal(
            CurrentIdentity(claims["sub"], UserRole.STANDARD_USER, IdentityKind.PERSISTENT),
            profile,
            self._issuer,
            self._client,
            claims["auth_time"],
            claims["exp"],
            claims["username"],
        )
