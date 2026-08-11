import base64
import binascii
import hashlib
import hmac
import json
from dataclasses import dataclass

from hireflux_backend.application.errors import InvalidCursorError


@dataclass(frozen=True, slots=True)
class CursorPosition:
    timestamp: str
    item_id: str


class CursorCodec:
    _VERSION = 1
    _MAX_TOKEN_LENGTH = 2048

    def __init__(self, signing_key: str) -> None:
        self._signing_key = signing_key.encode("utf-8")

    def encode(
        self,
        *,
        kind: str,
        owner_user_id: str,
        scope: str,
        timestamp: str,
        item_id: str,
    ) -> str:
        payload = {
            "id": item_id,
            "kind": kind,
            "owner": self._owner_fingerprint(owner_user_id),
            "scope": scope,
            "ts": timestamp,
            "v": self._VERSION,
        }
        canonical = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        encoded_payload = self._encode_bytes(canonical)
        signature = hmac.new(
            self._signing_key,
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        return f"{encoded_payload}.{self._encode_bytes(signature)}"

    def decode(
        self,
        token: str,
        *,
        kind: str,
        owner_user_id: str,
        scope: str,
    ) -> CursorPosition:
        try:
            if len(token) > self._MAX_TOKEN_LENGTH:
                raise ValueError("Cursor is too long.")
            encoded_payload, encoded_signature = token.split(".", maxsplit=1)
            supplied_signature = self._decode_bytes(encoded_signature)
            expected_signature = hmac.new(
                self._signing_key,
                encoded_payload.encode("ascii"),
                hashlib.sha256,
            ).digest()
            if not hmac.compare_digest(supplied_signature, expected_signature):
                raise ValueError("Invalid signature.")

            payload = json.loads(self._decode_bytes(encoded_payload))
            if not isinstance(payload, dict) or set(payload) != {
                "id",
                "kind",
                "owner",
                "scope",
                "ts",
                "v",
            }:
                raise ValueError("Invalid payload shape.")
            if payload["v"] != self._VERSION:
                raise ValueError("Unsupported cursor version.")
            if payload["kind"] != kind or payload["scope"] != scope:
                raise ValueError("Cursor query scope does not match.")
            if payload["owner"] != self._owner_fingerprint(owner_user_id):
                raise ValueError("Cursor owner does not match.")
            if not isinstance(payload["id"], str) or not isinstance(payload["ts"], str):
                raise ValueError("Invalid continuation values.")
            return CursorPosition(timestamp=payload["ts"], item_id=payload["id"])
        except (ValueError, KeyError, TypeError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise InvalidCursorError("The pagination cursor is invalid or expired.") from error

    @staticmethod
    def _owner_fingerprint(owner_user_id: str) -> str:
        return hashlib.sha256(owner_user_id.encode("utf-8")).hexdigest()[:24]

    @staticmethod
    def _encode_bytes(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")

    @staticmethod
    def _decode_bytes(value: str) -> bytes:
        padding = "=" * (-len(value) % 4)
        try:
            return base64.b64decode(value + padding, altchars=b"-_", validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("Invalid base64.") from error
