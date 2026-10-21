from dataclasses import replace
from datetime import UTC, datetime
from time import monotonic

from fastapi import APIRouter, Response

from hireflux_backend.api.bootstrap_schemas import BootstrapRequest, BootstrapResponse
from hireflux_backend.api.deletion_schemas import AccountDeleteRequest, DeletionResponse
from hireflux_backend.api.dependencies import (
    AccountLifecycleServiceDependency,
    AuthenticatedIdentityDependency,
    IdentityDependency,
    SensitivePrincipalDependency,
    TrustedProfileDependency,
    UserServiceDependency,
    WorkspaceBootstrapServiceDependency,
    WorkspaceErasureServiceDependency,
    WorkspaceExportServiceDependency,
)
from hireflux_backend.api.export_schemas import WorkspaceExportResponse
from hireflux_backend.api.schemas import UserResponse
from hireflux_backend.application.errors import AccountManagementUnavailableError, ForbiddenError
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import ProviderFinalizationState

router = APIRouter(prefix="/api/v1", tags=["profile"])


@router.get("/me/deletion", response_model=DeletionResponse)
def deletion_status(
    identity: AuthenticatedIdentityDependency,
    service: WorkspaceErasureServiceDependency,
    response: Response,
) -> DeletionResponse:
    response.headers["Cache-Control"] = "no-store"
    return DeletionResponse.from_domain(service.status(identity))


@router.delete("/me", response_model=DeletionResponse)
@router.post("/me/deletion/retry", response_model=DeletionResponse)
def erase_workspace(
    identity: AuthenticatedIdentityDependency,
    service: WorkspaceErasureServiceDependency,
    principal: SensitivePrincipalDependency,
    lifecycle: AccountLifecycleServiceDependency,
    response: Response,
    body: AccountDeleteRequest | None = None,
) -> DeletionResponse:
    if identity.kind is IdentityKind.PERSISTENT:
        if lifecycle is None or principal is None:
            raise AccountManagementUnavailableError("Account management is currently unavailable.")
        result = lifecycle.delete(
            principal, body.confirmation if body and body.confirmation else ""
        )
    else:
        result = service.delete(identity)
    complete = result.workspace.state.value == "DELETED" and (
        identity.kind is not IdentityKind.PERSISTENT
        or result.workspace.provider_finalization is ProviderFinalizationState.COMPLETE
    )
    response.status_code = 200 if complete else 202
    response.headers["Cache-Control"] = "no-store"
    return DeletionResponse.from_domain(result)


@router.post("/me/bootstrap", response_model=BootstrapResponse)
def bootstrap_workspace(
    identity: AuthenticatedIdentityDependency,
    service: WorkspaceBootstrapServiceDependency,
    attributes: TrustedProfileDependency,
    response: Response,
    body: BootstrapRequest | None = None,
) -> BootstrapResponse:
    if identity.is_demo:
        raise ForbiddenError("Demo workspaces cannot be initialized as durable workspaces.")
    response.headers["Cache-Control"] = "no-store"
    assert attributes is not None
    return BootstrapResponse.from_domain(service.bootstrap(identity, attributes))


@router.get("/me", response_model=UserResponse)
def get_me(
    identity: IdentityDependency,
    service: UserServiceDependency,
    attributes: TrustedProfileDependency,
) -> UserResponse:
    profile = service.get_profile(identity)
    if identity.kind is IdentityKind.PERSISTENT and attributes is not None:
        profile = replace(profile, name=attributes.name, email=attributes.email)
    return UserResponse.from_domain(profile)


@router.get("/me/export", response_model=WorkspaceExportResponse)
def export_workspace(
    identity: IdentityDependency,
    principal: SensitivePrincipalDependency,
    service: WorkspaceExportServiceDependency,
    response: Response,
) -> Response:
    started = monotonic()
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    payload = (
        WorkspaceExportResponse.from_domain(service.export(identity))
        .model_dump_json()
        .encode("utf-8")
    )
    service.validate_download(len(payload), monotonic() - started)
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


@router.get("/me/applications/export", response_class=Response)
def export_applications_csv(
    identity: IdentityDependency,
    service: WorkspaceExportServiceDependency,
) -> Response:
    today = datetime.now(UTC).date().isoformat()
    return Response(
        content=service.export_applications_csv(identity),
        media_type="text/csv",
        headers={
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "Content-Disposition": f'attachment; filename="hireflux-applications-{today}.csv"',
        },
    )
