from datetime import datetime

from pydantic import BaseModel

from hireflux_backend.api.resource_schemas import SettingsResponse
from hireflux_backend.api.schemas import RequestModel, UserResponse
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import BootstrapResult, DurableWorkspaceState


class BootstrapRequest(RequestModel):
    """No client-owned initialization fields."""


class BootstrapResponse(BaseModel):
    state: DurableWorkspaceState
    identity_kind: IdentityKind
    bootstrap_version: int
    created_at: datetime
    updated_at: datetime
    profile: UserResponse
    settings: SettingsResponse

    @classmethod
    def from_domain(cls, result: BootstrapResult) -> "BootstrapResponse":
        return cls(
            state=result.workspace.state,
            identity_kind=result.workspace.identity_kind,
            bootstrap_version=result.workspace.bootstrap_version,
            created_at=result.workspace.created_at,
            updated_at=result.workspace.updated_at,
            profile=UserResponse.from_domain(result.profile),
            settings=SettingsResponse.from_domain(result.settings),
        )
