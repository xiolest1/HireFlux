"""Provider-neutral workspace erasure and strong export inventory contracts."""

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from hireflux_backend.application.errors import (
    ForbiddenError,
    PersistenceError,
    WorkspaceBootstrapConflictError,
    WorkspaceBootstrapRequiredError,
    WorkspaceDeletedError,
    WorkspaceDeletingError,
    WorkspaceManifestIncompleteError,
)
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity
from hireflux_backend.domain.resources import Interview, Note
from hireflux_backend.domain.workspace import (
    APPLICATION_MANIFEST_VERSION,
    BOOTSTRAP_VERSION,
    DurableWorkspace,
    DurableWorkspaceState,
)

ExportRecord = Application | Activity | Note | Interview


class WorkspaceSafetyRepository(Protocol):
    def get_workspace(self, owner: str) -> DurableWorkspace | None: ...
    def freeze(self, workspace: DurableWorkspace, now: datetime) -> DurableWorkspace: ...
    def erase(self, workspace: DurableWorkspace) -> DurableWorkspace: ...
    def export_records(
        self, owner: str, check_work: Callable[[], None]
    ) -> Iterator[ExportRecord]: ...


def require_durable_workspace(
    identity: CurrentIdentity, workspace: DurableWorkspace | None
) -> DurableWorkspace:
    if identity.is_demo:
        raise ForbiddenError("Temporary demos do not support durable workspace erasure.")
    if workspace is None:
        raise WorkspaceBootstrapRequiredError("Initialize this workspace before continuing.")
    if (
        workspace.owner_user_id != identity.user_id
        or workspace.identity_kind is not identity.kind
        or workspace.bootstrap_version != BOOTSTRAP_VERSION
    ):
        raise WorkspaceBootstrapConflictError("This workspace is incompatible.")
    return workspace


def require_complete_manifest(workspace: DurableWorkspace) -> None:
    if workspace.application_manifest_version != APPLICATION_MANIFEST_VERSION:
        raise WorkspaceManifestIncompleteError(
            "An operator must verify the application inventory before export or erasure."
        )


def require_active_workspace(workspace: DurableWorkspace) -> None:
    if workspace.state is DurableWorkspaceState.DELETING:
        raise WorkspaceDeletingError("Workspace erasure is in progress.")
    if workspace.state is DurableWorkspaceState.DELETED:
        raise WorkspaceDeletedError("This workspace has been erased.")
    if workspace.state is not DurableWorkspaceState.ACTIVE:
        raise WorkspaceBootstrapRequiredError("Initialize this workspace before continuing.")


@dataclass(frozen=True, slots=True)
class DeletionStatus:
    workspace: DurableWorkspace
    retryable_failure: bool = False


class WorkspaceErasureService:
    def __init__(self, repository: WorkspaceSafetyRepository) -> None:
        self._repository = repository

    def status(self, identity: CurrentIdentity) -> DeletionStatus:
        if identity.is_demo:
            raise ForbiddenError("Temporary demos do not support durable workspace erasure.")
        return DeletionStatus(
            require_durable_workspace(identity, self._repository.get_workspace(identity.user_id))
        )

    def delete(self, identity: CurrentIdentity) -> DeletionStatus:
        workspace = self.status(identity).workspace
        if workspace.state is DurableWorkspaceState.DELETED:
            return DeletionStatus(workspace)
        require_complete_manifest(workspace)
        if workspace.state is DurableWorkspaceState.ACTIVE:
            workspace = self._repository.freeze(workspace, datetime.now(UTC))
        elif workspace.state is not DurableWorkspaceState.DELETING:
            raise WorkspaceBootstrapRequiredError("Initialize this workspace before continuing.")
        try:
            return DeletionStatus(self._repository.erase(workspace))
        except PersistenceError:
            # A freeze is one-way. Remaining refs/keys are durable recovery state.
            return DeletionStatus(
                self._repository.get_workspace(identity.user_id) or workspace, True
            )
