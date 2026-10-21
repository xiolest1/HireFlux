"""Public, validated configuration only; no identity, database or provider work."""

from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel

from hireflux_backend.api.dependencies import SettingsDependency
from hireflux_backend.auth.cognito import REQUIRED_SCOPES
from hireflux_backend.config import AuthMode, Environment

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


class PublicCognitoConfiguration(BaseModel):
    issuer: str
    client_id: str
    domain: str
    scopes: tuple[str, ...]
    self_registration_enabled: bool = False


class PublicAuthConfiguration(BaseModel):
    version: Literal[1] = 1
    environment: Environment
    capabilities: list[Literal["demo", "cognito"]]
    account_data_policy: Literal["local_development", "disposable_staging", "production"]
    account_management_enabled: bool = False
    cognito: PublicCognitoConfiguration | None = None


@router.get("/config", response_model=PublicAuthConfiguration, response_model_exclude_none=True)
def authentication_configuration(
    settings: SettingsDependency, response: Response
) -> PublicAuthConfiguration:
    response.headers["Cache-Control"] = "no-store"
    capabilities: list[Literal["demo", "cognito"]] = []
    if AuthMode.DEMO in settings.enabled_auth_capabilities:
        capabilities.append("demo")
    cognito = None
    if AuthMode.COGNITO in settings.enabled_auth_capabilities:
        capabilities.append("cognito")
        assert settings.cognito_app_client_id is not None and settings.cognito_domain is not None
        cognito = PublicCognitoConfiguration(
            issuer=settings.cognito_issuer,
            client_id=settings.cognito_app_client_id,
            domain=settings.cognito_domain,
            scopes=REQUIRED_SCOPES,
            self_registration_enabled=settings.cognito_self_registration_enabled,
        )
    return PublicAuthConfiguration(
        environment=settings.environment,
        capabilities=capabilities,
        account_data_policy=(
            "disposable_staging"
            if settings.environment is Environment.STAGING
            else "production"
            if settings.environment is Environment.PRODUCTION
            else "local_development"
        ),
        cognito=cognito,
        account_management_enabled=settings.persistent_account_management_enabled,
    )
