from typing import Annotated

from fastapi import Depends, Header, Request

from hireflux_backend.application.demo_sessions import DemoSessionService
from hireflux_backend.application.errors import (
    AuthenticationUnavailableError,
    DemoSessionRequiredError,
)
from hireflux_backend.application.services import ApplicationService, UserService
from hireflux_backend.auth.demo import identity_from_claims
from hireflux_backend.auth.local import identity_from_settings
from hireflux_backend.config import AuthMode, Settings
from hireflux_backend.domain.models import CurrentIdentity


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_current_identity(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentIdentity:
    if settings.auth_mode is AuthMode.LOCAL:
        return identity_from_settings(settings)
    if settings.auth_mode is AuthMode.DEMO:
        if authorization is None:
            raise DemoSessionRequiredError("Start a demo workspace to continue.")
        scheme, separator, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not separator or not token.strip() or len(token) > 2_048:
            raise DemoSessionRequiredError("A valid demo session is required.")
        claims = request.app.state.demo_session_codec.verify(token.strip())
        return identity_from_claims(claims)
    raise AuthenticationUnavailableError("Cognito authentication is not configured yet.")


def get_user_service(request: Request) -> UserService:
    return request.app.state.user_service


def get_application_service(request: Request) -> ApplicationService:
    return request.app.state.application_service


def get_demo_session_service(request: Request) -> DemoSessionService:
    return request.app.state.demo_session_service


IdentityDependency = Annotated[CurrentIdentity, Depends(get_current_identity)]
UserServiceDependency = Annotated[UserService, Depends(get_user_service)]
ApplicationServiceDependency = Annotated[ApplicationService, Depends(get_application_service)]
DemoSessionServiceDependency = Annotated[DemoSessionService, Depends(get_demo_session_service)]
SettingsDependency = Annotated[Settings, Depends(get_settings)]
