from datetime import UTC, datetime

from fastapi import APIRouter, Response

from hireflux_backend.api.dependencies import (
    IdentityDependency,
    UserServiceDependency,
    WorkspaceExportServiceDependency,
)
from hireflux_backend.api.export_schemas import WorkspaceExportResponse
from hireflux_backend.api.schemas import UserResponse

router = APIRouter(prefix="/api/v1", tags=["profile"])


@router.get("/me", response_model=UserResponse)
def get_me(identity: IdentityDependency, service: UserServiceDependency) -> UserResponse:
    return UserResponse.from_domain(service.get_or_create_profile(identity))


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
