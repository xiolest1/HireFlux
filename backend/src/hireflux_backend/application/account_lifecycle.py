"""Recent-authenticated orchestration over the existing bounded erasure engine."""

from collections.abc import Callable
from time import time
from typing import Protocol

from hireflux_backend.application.errors import (
    AuthenticationRequiredError,
    PersistenceError,
    RecentAuthenticationRequiredError,
    ValidationError,
    WorkspaceBootstrapConflictError,
)
from hireflux_backend.application.workspace_safety import DeletionStatus, WorkspaceErasureService
from hireflux_backend.auth.principal import VerifiedPrincipal
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import (
    DurableWorkspace,
    DurableWorkspaceState,
    ProviderFinalizationState,
)

CONFIRMATION = "DELETE_MY_ACCOUNT"
RECENT_SECONDS = 300


def require_recent(principal: VerifiedPrincipal, issuer: str, client_id: str, now: float) -> None:
    if (
        principal.identity.kind is not IdentityKind.PERSISTENT
        or principal.issuer != issuer
        or principal.client_id != client_id
        or principal.provider_username != principal.identity.user_id
    ):
        # UsernameAttributes=email makes the provider's immutable username equal
        # sub. Never send a mutable email/alias or another username to AdminDeleteUser.
        raise AuthenticationRequiredError("The account identity could not be confirmed.")
    if (
        type(principal.auth_time) is not int
        or type(principal.expires_at) is not int
        or not 0 <= now - principal.auth_time <= RECENT_SECONDS
        or principal.expires_at <= now
    ):
        raise RecentAuthenticationRequiredError(
            "Sign in again to authorize this sensitive operation."
        )


class IdentityDeletion(Protocol):
    def delete(self, username: str) -> None:
        """One attempt. Absent user is success; ambiguous failure raises PersistenceError."""
        ...


class DefiniteProviderRejection(PersistenceError):
    """The provider explicitly rejected the operation before deletion."""


class FinalizationRepository(Protocol):
    def prepare(self, workspace: DurableWorkspace) -> DurableWorkspace: ...
    def arm(self, workspace: DurableWorkspace) -> bool: ...
    def complete(self, workspace: DurableWorkspace) -> DurableWorkspace: ...
    def rejected(self, workspace: DurableWorkspace) -> DurableWorkspace: ...


class AccountLifecycleService:
    def __init__(
        self,
        erasure: WorkspaceErasureService,
        finalization: FinalizationRepository,
        provider: IdentityDeletion,
        *,
        issuer: str,
        client_id: str,
        clock: Callable[[], float] = time,
    ) -> None:
        self.erasure = erasure
        self.finalization = finalization
        self.provider = provider
        self.issuer = issuer
        self.client_id = client_id
        self.clock = clock

    def delete(self, principal: VerifiedPrincipal, confirmation: str) -> DeletionStatus:
        require_recent(principal, self.issuer, self.client_id, self.clock())
        if confirmation != CONFIRMATION:
            raise ValidationError("Type DELETE_MY_ACCOUNT exactly to confirm irreversible erasure.")
        result = self.erasure.delete(principal.identity)
        if result.workspace.state is not DurableWorkspaceState.DELETED:
            return result
        # Never infer terminal status from an earlier response or a provider result.
        workspace = self.erasure.status(principal.identity).workspace
        if (
            workspace.state is not DurableWorkspaceState.DELETED
            or workspace.deletion_started_at is None
            or workspace.deletion_completed_at is None
        ):
            raise WorkspaceBootstrapConflictError(
                "Terminal workspace erasure could not be verified."
            )
        workspace = self.finalization.prepare(workspace)
        if workspace.provider_finalization is ProviderFinalizationState.COMPLETE:
            return DeletionStatus(workspace)
        if workspace.provider_finalization is ProviderFinalizationState.REVIEW_REQUIRED:
            return DeletionStatus(workspace)
        # Recheck freshness after bounded erasure before dispatching a remote delete.
        require_recent(principal, self.issuer, self.client_id, self.clock())
        if not self.finalization.arm(workspace):
            return self.erasure.status(principal.identity)
        # REVIEW_REQUIRED is durable BEFORE dispatch: crash/lost response cannot
        # cause a later user request to blindly repeat the provider deletion.
        try:
            self.provider.delete(principal.provider_username)
        except DefiniteProviderRejection:
            try:
                return DeletionStatus(self.finalization.rejected(workspace), True)
            except PersistenceError:
                return self.erasure.status(principal.identity)
        except PersistenceError:
            return self.erasure.status(principal.identity)
        try:
            return DeletionStatus(self.finalization.complete(workspace))
        except PersistenceError:
            # A deleted user may no longer authenticate. Only independent operator
            # metadata evidence can reconcile this terminal/uncertain boundary.
            return self.erasure.status(principal.identity)
