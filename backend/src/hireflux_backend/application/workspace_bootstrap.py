from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, datetime
from typing import Protocol

from hireflux_backend.application.errors import (
    ForbiddenError,
    PersistenceError,
    WorkspaceBootstrapConflictError,
    WorkspaceBootstrapRequiredError,
    WorkspaceDeletedError,
    WorkspaceDeletingError,
)
from hireflux_backend.domain.models import CurrentIdentity, TrustedProfileAttributes, UserProfile
from hireflux_backend.domain.workspace import (
    APPLICATION_MANIFEST_VERSION,
    BOOTSTRAP_VERSION,
    BootstrapResult,
    DurableWorkspace,
    DurableWorkspaceState,
    WorkspaceSnapshot,
    default_workspace_settings,
)


class WorkspaceBootstrapRepository(Protocol):
    def read(self, owner_user_id: str) -> WorkspaceSnapshot: ...

    def legacy_data_is_durable(self, owner_user_id: str) -> bool: ...

    def commit(self, prior: WorkspaceSnapshot, proposed: BootstrapResult) -> bool:
        """Atomically initialize missing components; False means retry a racing snapshot."""
        ...


class WorkspaceBootstrapService:
    def __init__(
        self,
        repository: WorkspaceBootstrapRepository,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repository = repository
        self._clock = clock

    def _validate(self, identity: CurrentIdentity, snapshot: WorkspaceSnapshot) -> None:
        workspace = snapshot.workspace
        if workspace is not None and workspace.owner_user_id == identity.user_id:
            if workspace.state is DurableWorkspaceState.DELETING:
                raise WorkspaceDeletingError("Workspace erasure is in progress.")
            if workspace.state is DurableWorkspaceState.DELETED:
                raise WorkspaceDeletedError("This workspace has been erased.")
        if snapshot.incompatible or (
            workspace is not None
            and (
                workspace.owner_user_id != identity.user_id
                or workspace.identity_kind is not identity.kind
                or workspace.bootstrap_version != BOOTSTRAP_VERSION
            )
        ):
            raise WorkspaceBootstrapConflictError(
                "This workspace is incompatible with durable initialization."
            )
        if snapshot.profile is not None and (
            snapshot.profile.user_id != identity.user_id or snapshot.profile.expires_at is not None
        ):
            raise WorkspaceBootstrapConflictError("The existing profile is incompatible.")
        if snapshot.settings is not None and (
            snapshot.settings.owner_user_id != identity.user_id
            or snapshot.settings.expires_at is not None
        ):
            raise WorkspaceBootstrapConflictError("The existing settings are incompatible.")

    def require_ready(self, identity: CurrentIdentity) -> None:
        if identity.is_demo:
            return
        snapshot = self._repository.read(identity.user_id)
        self._validate(identity, snapshot)
        if (
            snapshot.workspace is None
            or snapshot.workspace.state is not DurableWorkspaceState.ACTIVE
            or snapshot.profile is None
            or snapshot.settings is None
        ):
            raise WorkspaceBootstrapRequiredError("Initialize this workspace before continuing.")

    def bootstrap(
        self, identity: CurrentIdentity, attributes: TrustedProfileAttributes
    ) -> BootstrapResult:
        if identity.is_demo:
            raise ForbiddenError("Demo workspaces cannot be initialized as durable workspaces.")
        for _ in range(5):
            snapshot = self._repository.read(identity.user_id)
            self._validate(identity, snapshot)
            workspace = snapshot.workspace
            if workspace is not None and workspace.state is DurableWorkspaceState.ACTIVE:
                if snapshot.settings is None:
                    # A previously active workspace may have lost customized preferences.
                    raise WorkspaceBootstrapConflictError(
                        "Existing workspace settings are missing; operator recovery is required."
                    )
                if snapshot.profile is not None:
                    return BootstrapResult(workspace, snapshot.profile, snapshot.settings)
            if (
                workspace is None or workspace.state is DurableWorkspaceState.PROVISIONING
            ) and not self._repository.legacy_data_is_durable(identity.user_id):
                raise WorkspaceBootstrapConflictError("Existing workspace data is temporary.")
            now = self._clock().astimezone(UTC)
            workspace = (
                replace(workspace, state=DurableWorkspaceState.ACTIVE, updated_at=now)
                if workspace is not None
                else DurableWorkspace(
                    identity.user_id,
                    identity.kind,
                    DurableWorkspaceState.ACTIVE,
                    BOOTSTRAP_VERSION,
                    now,
                    now,
                    application_manifest_version=(
                        APPLICATION_MANIFEST_VERSION if not snapshot.has_owner_data else None
                    ),
                )
            )
            profile = snapshot.profile or UserProfile(
                identity.user_id,
                attributes.name,
                attributes.email,
                identity.role,
                now,
                last_login_at=None,
            )
            settings = snapshot.settings or default_workspace_settings(identity.user_id, now)
            result = BootstrapResult(workspace, profile, settings)
            if self._repository.commit(snapshot, result):
                return result
        raise PersistenceError("Workspace initialization is busy. Please retry.")
