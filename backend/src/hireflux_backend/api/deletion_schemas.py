from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictStr

from hireflux_backend.application.workspace_safety import DeletionStatus
from hireflux_backend.domain.workspace import DurableWorkspaceState, ProviderFinalizationState


class AccountDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmation: StrictStr | None = Field(default=None, max_length=32)


class DeletionResponse(BaseModel):
    state: DurableWorkspaceState
    deletion_started_at: datetime | None
    deletion_completed_at: datetime | None
    retryable_failure: bool
    provider_finalization: ProviderFinalizationState | None = Field(
        default=None, exclude_if=lambda value: value is None
    )
    provider_finalized_at: datetime | None = Field(
        default=None, exclude_if=lambda value: value is None
    )

    @classmethod
    def from_domain(cls, status: DeletionStatus) -> "DeletionResponse":
        return cls(
            state=status.workspace.state,
            deletion_started_at=status.workspace.deletion_started_at,
            deletion_completed_at=status.workspace.deletion_completed_at,
            retryable_failure=status.retryable_failure,
            provider_finalization=status.workspace.provider_finalization,
            provider_finalized_at=status.workspace.provider_finalized_at,
        )
