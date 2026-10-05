from datetime import UTC, datetime

from fastapi import APIRouter, Response

from hireflux_backend.api.bootstrap_schemas import BootstrapRequest, BootstrapResponse
from hireflux_backend.api.dependencies import (
    AuthenticatedIdentityDependency,
    IdentityDependency,
    SettingsDependency,
    UserServiceDependency,
    WorkspaceBootstrapServiceDependency,
    WorkspaceExportServiceDependency,
)
from hireflux_backend.api.export_schemas import WorkspaceExportResponse
from hireflux_backend.api.schemas import UserResponse
from hireflux_backend.application.errors import ForbiddenError
from hireflux_backend.auth.local import profile_attributes_from_settings

router = APIRouter(prefix="/api/v1", tags=["profile"])


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
) -> WorkspaceExportResponse:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return WorkspaceExportResponse.from_domain(service.export(identity))


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
