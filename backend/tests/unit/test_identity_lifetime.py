from datetime import UTC, datetime, timedelta

import pytest
from conftest import test_settings as build_test_settings

from hireflux_backend.auth.demo import DemoSessionClaims, identity_from_claims
from hireflux_backend.auth.local import identity_from_settings, profile_attributes_from_settings
from hireflux_backend.domain.enums import UserRole
from hireflux_backend.domain.models import CurrentIdentity, IdentityKind

OWNER = "00000000-0000-4000-8000-000000000001"


@pytest.mark.parametrize("kind", [IdentityKind.LOCAL, IdentityKind.PERSISTENT])
def test_durable_principal_needs_no_profile_or_token_expiry(kind: IdentityKind) -> None:
    identity = CurrentIdentity(OWNER, UserRole.STANDARD_USER, kind=kind)
    assert identity.data_expires_at is None
    assert not identity.is_demo
    assert not hasattr(identity, "name")
    assert not hasattr(identity, "email")
    assert not hasattr(identity, "expires_at")
    with pytest.raises(ValueError, match="cannot expire"):
        CurrentIdentity(OWNER, UserRole.STANDARD_USER, kind=kind, data_expires_at=123)


@pytest.mark.parametrize("expiry", [None, 0, -1, True, 1.5])
def test_demo_requires_valid_data_lifetime(expiry: int | None) -> None:
    with pytest.raises(ValueError, match="require a data expiry"):
        CurrentIdentity(OWNER, UserRole.STANDARD_USER, IdentityKind.DEMO, expiry)


def test_identity_kind_cannot_be_an_unvalidated_string() -> None:
    with pytest.raises(ValueError, match="validated"):
        CurrentIdentity(OWNER, UserRole.STANDARD_USER, "LOCAL")  # type: ignore[arg-type]


def test_trusted_sources_keep_profile_attributes_separate() -> None:
    settings = build_test_settings()
    local = identity_from_settings(settings)
    assert local.kind is IdentityKind.LOCAL
    assert local.data_expires_at is None
    assert profile_attributes_from_settings(settings).name == settings.local_user_name
    now = datetime.now(UTC)
    claims = DemoSessionClaims(OWNER, now, now + timedelta(hours=24))
    demo = identity_from_claims(claims)
    assert demo.kind is IdentityKind.DEMO
    assert demo.data_expires_at == int(claims.expires_at.timestamp())
