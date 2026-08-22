from fastapi import APIRouter

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
) -> WorkspaceExportResponse:
    return WorkspaceExportResponse.from_domain(service.export(identity))
