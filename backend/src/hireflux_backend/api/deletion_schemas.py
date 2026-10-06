from datetime import datetime

from pydantic import BaseModel

from hireflux_backend.application.workspace_safety import DeletionStatus
from hireflux_backend.domain.workspace import DurableWorkspaceState


class DeletionResponse(BaseModel):
    state: DurableWorkspaceState
    deletion_started_at: datetime | None
    deletion_completed_at: datetime | None
    retryable_failure: bool

    @classmethod
    def from_domain(cls, status: DeletionStatus) -> "DeletionResponse":
        return cls(
            state=status.workspace.state,
            deletion_started_at=status.workspace.deletion_started_at,
            deletion_completed_at=status.workspace.deletion_completed_at,
            retryable_failure=status.retryable_failure,
        )
