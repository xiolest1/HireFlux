from datetime import UTC, datetime
from time import monotonic

from fastapi import APIRouter, Response

from hireflux_backend.api.bootstrap_schemas import BootstrapRequest, BootstrapResponse
from hireflux_backend.api.deletion_schemas import DeletionResponse
from hireflux_backend.api.dependencies import (
    AuthenticatedIdentityDependency,
    IdentityDependency,
    SettingsDependency,
    UserServiceDependency,
    WorkspaceBootstrapServiceDependency,
    WorkspaceErasureServiceDependency,
    WorkspaceExportServiceDependency,
)
from hireflux_backend.api.export_schemas import WorkspaceExportResponse
from hireflux_backend.api.schemas import UserResponse
from hireflux_backend.application.errors import ForbiddenError
from hireflux_backend.auth.local import profile_attributes_from_settings

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
    response: Response,
    body: BootstrapRequest | None = None,
) -> DeletionResponse:
    result = service.delete(identity)
    response.status_code = 200 if result.workspace.state.value == "DELETED" else 202
    response.headers["Cache-Control"] = "no-store"
    return DeletionResponse.from_domain(result)


@router.post("/me/bootstrap", response_model=BootstrapResponse)
def bootstrap_workspace(
    identity: AuthenticatedIdentityDependency,
    service: WorkspaceBootstrapServiceDependency,
    settings: SettingsDependency,
    response: Response,
    body: BootstrapRequest | None = None,
) -> BootstrapResponse:
    if identity.is_demo:
        raise ForbiddenError("Demo workspaces cannot be initialized as durable workspaces.")
    response.headers["Cache-Control"] = "no-store"
    return BootstrapResponse.from_domain(
        service.bootstrap(identity, profile_attributes_from_settings(settings))
    )


@router.get("/me", response_model=UserResponse)
def get_me(identity: IdentityDependency, service: UserServiceDependency) -> UserResponse:
    return UserResponse.from_domain(service.get_profile(identity))


@router.get("/me/export", response_model=WorkspaceExportResponse)
def export_workspace(
    identity: IdentityDependency,
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
