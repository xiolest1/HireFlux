"""Small, pinned HTTPS transport. No discovery, redirects, retries or token logging."""

import http.client
import json
import ssl
from collections.abc import Callable
from dataclasses import dataclass
from time import monotonic
from typing import Any, Protocol
from urllib.parse import urlsplit

from hireflux_backend.application.errors import AuthenticationUnavailableError


def strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON member.")
        result[key] = value
    return result


def json_object(body: bytes) -> dict[str, Any]:
    # A small depth bound also protects callers when a runner raises Python's
    # recursion limit. Quoted braces do not contribute to structural nesting.
    depth = 0
    quoted = escaped = False
    for byte in body:
        if quoted:
            if escaped:
                escaped = False
            elif byte == 92:
                escaped = True
            elif byte == 34:
                quoted = False
        elif byte == 34:
            quoted = True
        elif byte in (91, 123):
            depth += 1
            if depth > 16:
                raise ValueError("JSON nesting exceeds the provider contract.")
        elif byte in (93, 125):
            depth -= 1
    value = json.loads(body.decode("utf-8"), object_pairs_hook=strict_object)
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object.")
    return value


@dataclass(frozen=True, slots=True)
class AuthBudget:
    deadline: float
    clock: Callable[[], float] = monotonic

    def remaining(self) -> float:
        remaining = self.deadline - self.clock()
        if remaining <= 0:
            raise AuthenticationUnavailableError("Authentication temporarily unavailable.")
        return remaining


@dataclass(frozen=True, slots=True)
class ProviderResponse:
    status: int
    body: bytes


class ProviderTransport(Protocol):
    def get(
        self, url: str, *, bearer: str | None, max_bytes: int, budget: AuthBudget
    ) -> ProviderResponse: ...


class HttpsProviderTransport:
    def __init__(self, issuer: str, domain: str) -> None:
        self._urls = frozenset((issuer + "/.well-known/jwks.json", domain + "/oauth2/userInfo"))
        self._tls = ssl.create_default_context()

    def get(
        self, url: str, *, bearer: str | None, max_bytes: int, budget: AuthBudget
    ) -> ProviderResponse:
        if url not in self._urls:
            raise AuthenticationUnavailableError("Untrusted provider endpoint.")
        parsed = urlsplit(url)
        call = AuthBudget(min(budget.deadline, budget.clock() + 2), budget.clock)
        connection = http.client.HTTPSConnection(
            str(parsed.hostname), timeout=min(1.0, call.remaining()), context=self._tls
        )
        try:
            connection.connect()
            if connection.sock is None:
                raise OSError("Provider connection unavailable.")
            connection.sock.settimeout(min(1.0, call.remaining()))
            headers = {"Accept": "application/json", "Accept-Encoding": "identity"}
            if bearer is not None:
                headers["Authorization"] = "Bearer " + bearer
            connection.request("GET", parsed.path, headers=headers)
            connection.sock.settimeout(min(1.0, call.remaining()))
            response = connection.getresponse()
            if response.status != 200:
                # Error/redirect bodies may contain identifiers; never read or expose them.
                return ProviderResponse(response.status, b"")
            length = response.getheader("Content-Length")
            if length is not None and (not length.isdecimal() or int(length) > max_bytes):
                raise ValueError("Provider response too large.")
            if response.getheader("Content-Encoding", "identity") != "identity":
                raise ValueError("Unsupported provider encoding.")
            body = bytearray()
            while True:
                # read1 returns after one underlying read, permitting deadline checks
                # even when a peer dribbles data. OS/DNS calls cannot be preempted here.
                if connection.sock is not None:
                    connection.sock.settimeout(min(1.0, call.remaining()))
                chunk = response.read1(min(8192, max_bytes + 1 - len(body)))
                call.remaining()
                if not chunk:
                    return ProviderResponse(200, bytes(body))
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise ValueError("Provider response too large.")
        except (OSError, ValueError, http.client.HTTPException):
            raise AuthenticationUnavailableError(
                "Authentication temporarily unavailable."
            ) from None
        finally:
            connection.close()
