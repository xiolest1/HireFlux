"""Credential metadata stays outside the domain identity and its data lifetime."""

from dataclasses import dataclass
from typing import Protocol

from hireflux_backend.domain.models import CurrentIdentity, TrustedProfileAttributes


@dataclass(frozen=True, slots=True)
class VerifiedPrincipal:
    identity: CurrentIdentity
    profile: TrustedProfileAttributes
    issuer: str
    client_id: str
    auth_time: int
    expires_at: int
    provider_username: str


class CognitoAuthentication(Protocol):
    def authenticate(
        self, token: str, *, fresh: bool = False, remaining_seconds: float | None = None
    ) -> VerifiedPrincipal:
        """Fresh bypasses admission cache; no credentials are retained in the result."""
        ...
