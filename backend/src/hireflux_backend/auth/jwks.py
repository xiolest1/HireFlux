"""Per-process, bounded trusted-key cache. No PyJWKClient discovery/key LRU."""

import re
from collections import OrderedDict
from collections.abc import Callable
from threading import Lock
from time import monotonic

import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey

from hireflux_backend.application.errors import (
    AuthenticationRequiredError,
    AuthenticationUnavailableError,
)
from hireflux_backend.auth.provider import AuthBudget, ProviderTransport, json_object

KEY_ID = re.compile(r"[A-Za-z0-9_+/=-]{1,256}\Z")
JWKS_FRESH_SECONDS = 300
REFRESH_COOLDOWN_SECONDS = 30
MAX_JWKS_BYTES = 64 * 1024
MAX_KEYS = 16


class JwksCache:
    def __init__(
        self, issuer: str, transport: ProviderTransport, *, clock: Callable[[], float] = monotonic
    ) -> None:
        self._url = issuer + "/.well-known/jwks.json"
        self._transport = transport
        self._clock = clock
        self._lock = Lock()
        self._keys: dict[str, RSAPublicKey] = {}
        self._expires = 0.0
        self._last_attempt = float("-inf")
        self._failed = False
        self._negative: OrderedDict[str, float] = OrderedDict()

    def _fetch(self, budget: AuthBudget) -> dict[str, RSAPublicKey]:
        response = self._transport.get(
            self._url, bearer=None, max_bytes=MAX_JWKS_BYTES, budget=budget
        )
        if response.status != 200 or len(response.body) > MAX_JWKS_BYTES:
            raise AuthenticationUnavailableError("Trusted signing keys unavailable.")
        try:
            document = json_object(response.body)
            raw_keys = document.get("keys")
            if not isinstance(raw_keys, list) or not 1 <= len(raw_keys) <= MAX_KEYS:
                raise ValueError("Invalid signing key set.")
            keys: dict[str, RSAPublicKey] = {}
            for raw in raw_keys:
                if not isinstance(raw, dict):
                    raise ValueError("Invalid signing key.")
                kid = raw.get("kid")
                if (
                    not isinstance(kid, str)
                    or not KEY_ID.fullmatch(kid)
                    or kid in keys
                    or raw.get("kty") != "RSA"
                    or raw.get("alg", "RS256") != "RS256"
                    or raw.get("use", "sig") != "sig"
                    or raw.get("key_ops", ["verify"]) != ["verify"]
                    or any(name in raw for name in ("d", "p", "q", "dp", "dq", "qi", "oth"))
                    or any(name in raw for name in ("jku", "x5u", "x5c"))
                ):
                    raise ValueError("Invalid signing key metadata.")
                for part in ("n", "e"):
                    value = raw.get(part)
                    if not isinstance(value, str) or not re.fullmatch(
                        r"[A-Za-z0-9_-]{1,1400}", value
                    ):
                        raise ValueError("Invalid RSA key component.")
                key = jwt.PyJWK.from_dict(raw, algorithm="RS256").key
                if not isinstance(key, RSAPublicKey) or not 2048 <= key.key_size <= 8192:
                    raise ValueError("Unsupported RSA key strength.")
                keys[kid] = key
            return keys
        except (ValueError, TypeError, KeyError, RecursionError, jwt.PyJWTError):
            raise AuthenticationUnavailableError("Trusted signing keys unavailable.") from None

    def key(self, kid: str, budget: AuthBudget) -> RSAPublicKey:
        if not self._lock.acquire(timeout=budget.remaining()):
            raise AuthenticationUnavailableError("Trusted signing keys unavailable.")
        try:
            now = self._clock()
            if now < self._expires and kid in self._keys:
                return self._keys[kid]
            fresh = now < self._expires
            if fresh and not self._failed and self._negative.get(kid, 0) > now:
                raise AuthenticationRequiredError("A valid account session is required.")
            if not fresh or now - self._last_attempt >= REFRESH_COOLDOWN_SECONDS:
                if self._failed and now - self._last_attempt < REFRESH_COOLDOWN_SECONDS:
                    raise AuthenticationUnavailableError("Trusted signing keys unavailable.")
                self._last_attempt = now
                try:
                    keys = self._fetch(budget)
                    budget.remaining()
                except AuthenticationUnavailableError:
                    self._failed = True
                    raise
                self._keys = keys
                self._expires = self._clock() + JWKS_FRESH_SECONDS
                self._failed = False
                self._negative.clear()
            elif self._failed:
                raise AuthenticationUnavailableError("Trusted signing keys unavailable.")
            if kid in self._keys:
                return self._keys[kid]
            # The global cooldown also bounds a stream of distinct attacker-selected kids.
            self._negative[kid] = now + REFRESH_COOLDOWN_SECONDS
            self._negative.move_to_end(kid)
            while len(self._negative) > 128:
                self._negative.popitem(last=False)
            raise AuthenticationRequiredError("A valid account session is required.")
        finally:
            self._lock.release()
