import base64
import binascii
import hashlib
import hmac
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from hireflux_backend.application.errors import (
    DemoSessionExpiredError,
    DemoSessionRequiredError,
)
from hireflux_backend.domain.enums import UserRole
from hireflux_backend.domain.models import CurrentIdentity


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class DemoSessionClaims:
    workspace_id: str
    issued_at: datetime
    expires_at: datetime


class DemoSessionCodec:
    def __init__(
        self,
        signing_key: str,
        *,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._key = signing_key.encode("utf-8")
        self._clock = clock

    def issue(
        self,
        *,
        workspace_id: str,
        issued_at: datetime,
        expires_at: datetime,
    ) -> str:
        payload = {
            "exp": _timestamp(expires_at),
            "iat": _timestamp(issued_at),
            "kind": "demo_session",
            "sub": str(UUID(workspace_id)),
            "v": 1,
        }
        encoded_payload = _base64url(
            json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        )
        signature = hmac.new(self._key, encoded_payload.encode("ascii"), hashlib.sha256).digest()
        return f"{encoded_payload}.{_base64url(signature)}"

    def verify(self, token: str) -> DemoSessionClaims:
        try:
            encoded_payload, encoded_signature = token.split(".")
            supplied_signature = _decode_base64url(encoded_signature)
            expected_signature = hmac.new(
                self._key, encoded_payload.encode("ascii"), hashlib.sha256
            ).digest()
            if not hmac.compare_digest(supplied_signature, expected_signature):
                raise ValueError("signature mismatch")
            payload = json.loads(_decode_base64url(encoded_payload))
            if not isinstance(payload, dict):
                raise ValueError("payload is not an object")
            if payload.get("v") != 1 or payload.get("kind") != "demo_session":
                raise ValueError("unsupported token")
            workspace_id = str(UUID(payload["sub"]))
            issued_timestamp = payload["iat"]
            expiry_timestamp = payload["exp"]
            if not isinstance(issued_timestamp, int) or not isinstance(expiry_timestamp, int):
                raise ValueError("invalid timestamps")
            issued_at = datetime.fromtimestamp(issued_timestamp, UTC)
            expires_at = datetime.fromtimestamp(expiry_timestamp, UTC)
            if expires_at <= issued_at:
                raise ValueError("invalid lifetime")
        except (
            binascii.Error,
            KeyError,
            TypeError,
            ValueError,
            OverflowError,
            OSError,
            UnicodeDecodeError,
            json.JSONDecodeError,
        ) as error:
            raise DemoSessionRequiredError("A valid demo session is required.") from error

        if self._clock().astimezone(UTC) >= expires_at:
            raise DemoSessionExpiredError("Your demo workspace has expired.")
        return DemoSessionClaims(
            workspace_id=workspace_id,
            issued_at=issued_at,
            expires_at=expires_at,
        )


def identity_from_claims(claims: DemoSessionClaims) -> CurrentIdentity:
    short_id = claims.workspace_id.split("-")[0]
    return CurrentIdentity(
        user_id=claims.workspace_id,
        name="Demo Workspace",
        email=f"demo-{short_id}@example.invalid",
        role=UserRole.STANDARD_USER,
        expires_at=int(claims.expires_at.timestamp()),
        is_demo=True,
    )


def _timestamp(value: datetime) -> int:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Demo-session timestamps must be timezone-aware.")
    return int(value.astimezone(UTC).timestamp())


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode_base64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.b64decode(value + padding, altchars=b"-_", validate=True)
