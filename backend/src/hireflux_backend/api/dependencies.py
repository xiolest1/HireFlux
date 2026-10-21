import re
from typing import Annotated

from fastapi import Depends, Request

from hireflux_backend.application.account_lifecycle import AccountLifecycleService, require_recent
from hireflux_backend.application.demo_sessions import DemoSessionService
from hireflux_backend.application.errors import (
    AccountManagementUnavailableError,
    AuthenticationRequiredError,
    DemoSessionRequiredError,
)
from hireflux_backend.application.opportunity_workspace import OpportunityWorkspaceService
from hireflux_backend.application.resource_services import WorkspaceResourceService
from hireflux_backend.application.services import ApplicationService, UserService
from hireflux_backend.application.workspace_bootstrap import WorkspaceBootstrapService
from hireflux_backend.application.workspace_export import WorkspaceExportService
from hireflux_backend.application.workspace_safety import WorkspaceErasureService
from hireflux_backend.auth.demo import identity_from_claims
from hireflux_backend.auth.local import identity_from_settings, profile_attributes_from_settings
from hireflux_backend.auth.principal import VerifiedPrincipal
from hireflux_backend.config import AuthMode, Settings
from hireflux_backend.domain.models import CurrentIdentity, IdentityKind, TrustedProfileAttributes


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_current_identity(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentIdentity:
    capabilities = settings.enabled_auth_capabilities
    if capabilities == (AuthMode.LOCAL,):
        return identity_from_settings(settings)
    required = (
        DemoSessionRequiredError
        if capabilities == (AuthMode.DEMO,)
        else AuthenticationRequiredError
    )
    values = request.headers.getlist("authorization")
    if len(values) != 1 or len(values[0].encode("utf-8")) > 8192:
        raise required("A valid session is required.")
    match = re.fullmatch(r"(?i:Bearer) ([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)", values[0])
    if match is None:
        raise required("A valid session is required.")
    token = match[1]
    segments = token.count(".") + 1
    if segments == 2 and AuthMode.DEMO in capabilities:
        if len(token) > 2048:
            raise DemoSessionRequiredError("A valid demo session is required.")
        return identity_from_claims(request.app.state.demo_session_codec.verify(token))
    if segments == 3 and AuthMode.COGNITO in capabilities:
        context = request.scope.get("aws.context")
        remaining = context.get_remaining_time_in_millis() / 1000 if context is not None else None
        principal: VerifiedPrincipal = request.app.state.cognito_authentication.authenticate(
            token, remaining_seconds=remaining
        )
        request.state.verified_principal = principal
        return principal.identity
    raise required("A valid session is required.")


def get_trusted_profile(
    request: Request,
    identity: Annotated[CurrentIdentity, Depends(get_current_identity)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TrustedProfileAttributes | None:
    if identity.kind is IdentityKind.LOCAL:
        return profile_attributes_from_settings(settings)
    if identity.kind is IdentityKind.PERSISTENT:
        principal: VerifiedPrincipal = request.state.verified_principal
        return principal.profile
    return None


def get_sensitive_principal(
    request: Request,
    identity: Annotated[CurrentIdentity, Depends(get_current_identity)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> VerifiedPrincipal | None:
    if identity.kind is not IdentityKind.PERSISTENT:
        return None
    if request.method != "GET" and not settings.persistent_account_management_enabled:
        raise AccountManagementUnavailableError("Account management is currently unavailable.")
    previous: VerifiedPrincipal = request.state.verified_principal
    context = request.scope.get("aws.context")
    remaining = context.get_remaining_time_in_millis() / 1000 if context is not None else None
    # get_current_identity has already rejected ambiguous headers. Fresh admission
    # deliberately bypasses the ordinary token-hashed userInfo cache.
    principal: VerifiedPrincipal = request.app.state.cognito_authentication.authenticate(
        request.headers["authorization"][7:], fresh=True, remaining_seconds=remaining
    )
    if (
        principal.identity != previous.identity
        or principal.issuer != previous.issuer
        or principal.client_id != previous.client_id
    ):
        raise AuthenticationRequiredError("The account identity could not be confirmed.")
    require_recent(
        principal,
        settings.cognito_issuer,
        str(settings.cognito_app_client_id),
        request.app.state.account_clock(),
    )
    return principal


def get_account_lifecycle_service(request: Request) -> AccountLifecycleService | None:
    return request.app.state.account_lifecycle_service


def get_user_service(request: Request) -> UserService:
    return request.app.state.user_service


def get_application_service(request: Request) -> ApplicationService:
    return request.app.state.application_service


def get_opportunity_workspace_service(request: Request) -> OpportunityWorkspaceService:
    return request.app.state.opportunity_workspace_service


def get_demo_session_service(request: Request) -> DemoSessionService:
    return request.app.state.demo_session_service


def get_workspace_resource_service(request: Request) -> WorkspaceResourceService:
    return request.app.state.workspace_resource_service


def get_workspace_export_service(request: Request) -> WorkspaceExportService:
    return request.app.state.workspace_export_service


def get_workspace_bootstrap_service(request: Request) -> WorkspaceBootstrapService:
    return request.app.state.workspace_bootstrap_service


def get_workspace_erasure_service(request: Request) -> WorkspaceErasureService:
    return request.app.state.workspace_erasure_service


def get_workspace_identity(
    identity: Annotated[CurrentIdentity, Depends(get_current_identity)],
    service: Annotated[WorkspaceBootstrapService, Depends(get_workspace_bootstrap_service)],
) -> CurrentIdentity:
    service.require_ready(identity)
    return identity


AuthenticatedIdentityDependency = Annotated[CurrentIdentity, Depends(get_current_identity)]
IdentityDependency = Annotated[CurrentIdentity, Depends(get_workspace_identity)]
WorkspaceBootstrapServiceDependency = Annotated[
    WorkspaceBootstrapService, Depends(get_workspace_bootstrap_service)
]
UserServiceDependency = Annotated[UserService, Depends(get_user_service)]
ApplicationServiceDependency = Annotated[ApplicationService, Depends(get_application_service)]
OpportunityWorkspaceServiceDependency = Annotated[
    OpportunityWorkspaceService, Depends(get_opportunity_workspace_service)
]
DemoSessionServiceDependency = Annotated[DemoSessionService, Depends(get_demo_session_service)]
SettingsDependency = Annotated[Settings, Depends(get_settings)]
TrustedProfileDependency = Annotated[TrustedProfileAttributes | None, Depends(get_trusted_profile)]
WorkspaceResourceServiceDependency = Annotated[
    WorkspaceResourceService, Depends(get_workspace_resource_service)
]
WorkspaceExportServiceDependency = Annotated[
    WorkspaceExportService, Depends(get_workspace_export_service)
]
WorkspaceErasureServiceDependency = Annotated[
    WorkspaceErasureService, Depends(get_workspace_erasure_service)
]
SensitivePrincipalDependency = Annotated[VerifiedPrincipal | None, Depends(get_sensitive_principal)]
AccountLifecycleServiceDependency = Annotated[
    AccountLifecycleService | None, Depends(get_account_lifecycle_service)
]
