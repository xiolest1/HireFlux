from typing import Annotated

from fastapi import Depends, Request

from hireflux_backend.application.services import ApplicationService, UserService
from hireflux_backend.auth.local import identity_from_settings
from hireflux_backend.config import Settings
from hireflux_backend.domain.models import CurrentIdentity


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_current_identity(
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentIdentity:
    return identity_from_settings(settings)


def get_user_service(request: Request) -> UserService:
    return request.app.state.user_service


def get_application_service(request: Request) -> ApplicationService:
    return request.app.state.application_service


IdentityDependency = Annotated[CurrentIdentity, Depends(get_current_identity)]
UserServiceDependency = Annotated[UserService, Depends(get_user_service)]
ApplicationServiceDependency = Annotated[ApplicationService, Depends(get_application_service)]
