from datetime import UTC, datetime, timedelta

import pytest

from hireflux_backend.application.errors import (
    DemoSessionExpiredError,
    DemoSessionRequiredError,
)
from hireflux_backend.auth.demo import DemoSessionCodec, identity_from_claims

KEY = "demo-test-signing-key-that-is-at-least-32-bytes"
NOW = datetime(2026, 8, 11, 12, tzinfo=UTC)
WORKSPACE_ID = "11111111-1111-4111-8111-111111111111"


def test_demo_session_round_trip_builds_temporary_identity() -> None:
    codec = DemoSessionCodec(KEY, clock=lambda: NOW)
    token = codec.issue(
        workspace_id=WORKSPACE_ID,
        issued_at=NOW,
        expires_at=NOW + timedelta(hours=24),
    )

    claims = codec.verify(token)
    identity = identity_from_claims(claims)

    assert claims.workspace_id == WORKSPACE_ID
    assert identity.user_id == WORKSPACE_ID
    assert identity.name == "Demo Workspace"
    assert identity.expires_at == int((NOW + timedelta(hours=24)).timestamp())


def test_demo_session_rejects_tampering_and_malformed_values() -> None:
    codec = DemoSessionCodec(KEY, clock=lambda: NOW)
    token = codec.issue(
        workspace_id=WORKSPACE_ID,
        issued_at=NOW,
        expires_at=NOW + timedelta(hours=24),
    )
    payload, signature = token.split(".")
    tampered = f"{payload[:-1]}A.{signature}"

    with pytest.raises(DemoSessionRequiredError):
        codec.verify(tampered)
    with pytest.raises(DemoSessionRequiredError):
        codec.verify("not-a-token")


def test_demo_session_reports_expiration_separately() -> None:
    issuer = DemoSessionCodec(KEY, clock=lambda: NOW)
    token = issuer.issue(
        workspace_id=WORKSPACE_ID,
        issued_at=NOW,
        expires_at=NOW + timedelta(hours=24),
    )
    verifier = DemoSessionCodec(KEY, clock=lambda: NOW + timedelta(hours=24))

    with pytest.raises(DemoSessionExpiredError):
        verifier.verify(token)
