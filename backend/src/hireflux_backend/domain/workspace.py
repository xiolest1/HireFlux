from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from hireflux_backend.domain.models import IdentityKind, UserProfile
from hireflux_backend.domain.resources import (
    DashboardRange,
    DefaultApplicationView,
    ThemePreference,
    WorkspaceSettings,
)

BOOTSTRAP_VERSION = 1


class DurableWorkspaceState(StrEnum):
    PROVISIONING = "PROVISIONING"
    ACTIVE = "ACTIVE"


@dataclass(frozen=True, slots=True)
class DurableWorkspace:
    owner_user_id: str
    identity_kind: IdentityKind
    state: DurableWorkspaceState
    bootstrap_version: int
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class WorkspaceSnapshot:
    workspace: DurableWorkspace | None
    profile: UserProfile | None
    settings: WorkspaceSettings | None
    incompatible: bool = False


@dataclass(frozen=True, slots=True)
class BootstrapResult:
    workspace: DurableWorkspace
    profile: UserProfile
    settings: WorkspaceSettings


def default_workspace_settings(
    owner_user_id: str, now: datetime, *, data_expires_at: int | None = None
) -> WorkspaceSettings:
    return WorkspaceSettings(
        owner_user_id=owner_user_id,
        time_zone="UTC",
        default_follow_up_days=7,
        default_application_view=DefaultApplicationView.ACTIVE,
        default_dashboard_range=DashboardRange.THIRTY_DAYS,
        theme=ThemePreference.SYSTEM,
        created_at=now,
        updated_at=now,
        version=1,
        expires_at=data_expires_at,
    )
