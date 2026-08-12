from fastapi import APIRouter

from hireflux_backend.api.dependencies import (
    IdentityDependency,
    WorkspaceResourceServiceDependency,
)
from hireflux_backend.api.resource_schemas import SettingsResponse, SettingsUpdateRequest
from hireflux_backend.application.resource_services import UpdateSettingsCommand

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
def get_settings(
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> SettingsResponse:
    return SettingsResponse.from_domain(service.get_settings(identity))


@router.patch("", response_model=SettingsResponse)
def update_settings(
    request: SettingsUpdateRequest,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> SettingsResponse:
    settings = service.update_settings(
        identity,
        UpdateSettingsCommand(
            expected_version=request.expected_version,
            changes=request.model_dump(exclude={"expected_version"}, exclude_unset=True),
        ),
    )
    return SettingsResponse.from_domain(settings)
