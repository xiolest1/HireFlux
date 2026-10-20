"""Synthetic keys and an in-memory provider; never contacts Cognito or AWS."""

import hashlib
import json
from dataclasses import dataclass
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from hireflux_backend.application.errors import AuthenticationUnavailableError
from hireflux_backend.auth.cognito import CognitoVerifier
from hireflux_backend.auth.provider import AuthBudget, ProviderResponse
from hireflux_backend.config import Settings

COGNITO_CONFIG = {
    "cognito_user_pool_id": "us-east-1_TESTONLY",
    "cognito_app_client_id": "testonlypublicclient",
    "cognito_domain": "https://hireflux-test-only.auth.us-east-1.amazoncognito.com",
}


@dataclass
class Clock:
    now: float = 1_900_000_000
    ticks: float = 1000

    def advance(self, seconds: float) -> None:
        self.now += seconds
        self.ticks += seconds


class Provider:
    def __init__(self, key: rsa.RSAPrivateKey) -> None:
        self.jwks: object = {"keys": [self.jwk(key, "key1")]}
        self.key_status = 200
        self.user_status = 200
        self.key_failure = False
        self.user_failure = False
        self.profile: dict[str, object] = {
            "email": "tester@example.com",
            "email_verified": "true",
            "name": "Trusted tester",
        }
        self.calls: list[str] = []
        self.token_hashes: list[str] = []

    @staticmethod
    def jwk(key: rsa.RSAPrivateKey, kid: str) -> dict[str, Any]:
        return {
            **jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key(), as_dict=True),
            "kid": kid,
            "alg": "RS256",
            "use": "sig",
        }

    def get(
        self, url: str, *, bearer: str | None, max_bytes: int, budget: AuthBudget
    ) -> ProviderResponse:
        budget.remaining()
        self.calls.append(url)
        if url.endswith("/.well-known/jwks.json"):
            assert bearer is None
            if self.key_failure:
                raise AuthenticationUnavailableError("Synthetic provider outage.")
            return ProviderResponse(self.key_status, json.dumps(self.jwks).encode())
        assert url.endswith("/oauth2/userInfo") and bearer is not None
        if self.user_failure:
            raise AuthenticationUnavailableError("Synthetic provider outage.")
        self.token_hashes.append(hashlib.sha256(bearer.encode()).hexdigest())
        # This is the fake provider, not the application verifier.
        sub = jwt.decode(bearer, options={"verify_signature": False})["sub"]
        return ProviderResponse(self.user_status, json.dumps({"sub": sub, **self.profile}).encode())


class Harness:
    def __init__(self, settings: Settings, key: rsa.RSAPrivateKey) -> None:
        self.settings = settings
        self.key = key
        self.clock = Clock()
        self.provider = Provider(key)
        self.verifier = CognitoVerifier(
            settings,
            transport=self.provider,
            clock=lambda: self.clock.now,
            monotonic_clock=lambda: self.clock.ticks,
        )

    def token(
        self,
        *,
        headers: dict[str, Any] | None = None,
        key: rsa.RSAPrivateKey | None = None,
        **overrides: Any,
    ) -> str:
        claims: dict[str, Any] = {
            "iss": self.settings.cognito_issuer,
            "client_id": self.settings.cognito_app_client_id,
            "sub": "CaseSensitive-Opaque-Subject",
            "username": "provider-username",
            "token_use": "access",
            "iat": int(self.clock.now),
            "auth_time": int(self.clock.now) - 10,
            "exp": int(self.clock.now) + 3600,
            "scope": "openid email profile",
        }
        claims.update(overrides)
        for name in [name for name, value in claims.items() if value is None]:
            del claims[name]
        return jwt.encode(
            claims, key or self.key, algorithm="RS256", headers={"kid": "key1", **(headers or {})}
        )
