"""Operator-only reconciliation after independently checked canonical-user absence."""

from typing import Protocol

from hireflux_backend.application.errors import PersistenceError, WorkspaceBootstrapConflictError
from hireflux_backend.domain.workspace import DurableWorkspace, ProviderFinalizationState


class ReconciliationRepository(Protocol):
    def read(self, owner: str) -> DurableWorkspace: ...
    def reconcile_absent(self, workspace: DurableWorkspace) -> DurableWorkspace: ...


class IdentityAbsence(Protocol):
    def absent(self, owner: str) -> bool:
        """Verify pinned pool/canonical identity independently; unknown results raise."""
        ...


def reconcile_account(
    repository: ReconciliationRepository,
    provider: IdentityAbsence,
    *,
    owner: str,
    apply: bool = False,
) -> str:
    workspace = repository.read(owner)
    if workspace.provider_finalization is ProviderFinalizationState.COMPLETE:
        return "ALREADY_COMPLETE"
    if workspace.provider_finalization not in {
        ProviderFinalizationState.PENDING,
        ProviderFinalizationState.REVIEW_REQUIRED,
    }:
        raise WorkspaceBootstrapConflictError("No qualified provider-finalization record exists.")
    if not provider.absent(owner):
        return "IDENTITY_PRESENT_REVIEW_REQUIRED"
    if not apply:
        return "ABSENCE_VERIFIED_REVIEW_ONLY"
    result = repository.reconcile_absent(workspace)
    if result.provider_finalization is not ProviderFinalizationState.COMPLETE:
        raise PersistenceError("Conditional completion could not be verified.")
    return "FINALIZATION_COMPLETE"
