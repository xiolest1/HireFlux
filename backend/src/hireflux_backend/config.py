import os
from enum import StrEnum
from functools import lru_cache
from ipaddress import ip_address
from urllib.parse import urlparse
from uuid import UUID

from pydantic import EmailStr, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from hireflux_backend.domain.enums import UserRole


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    STAGING = "staging"
    PRODUCTION = "production"


class AuthMode(StrEnum):
    LOCAL = "local"
    DEMO = "demo"
    COGNITO = "cognito"


def is_loopback_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return False
    if parsed.hostname.lower() == "localhost":
        return True
    try:
        return ip_address(parsed.hostname).is_loopback
    except ValueError:
        return False


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Environment
    auth_mode: AuthMode
    cursor_signing_key: SecretStr
    demo_session_signing_key: SecretStr = SecretStr(
        "local-only-demo-session-signing-key-change-before-deployment"
    )
    demo_session_ttl_hours: int = Field(default=24, ge=1, le=168)
    max_applications_per_workspace: int = Field(default=100, ge=5, le=500)

    local_user_id: UUID = UUID("00000000-0000-4000-8000-000000000001")
    local_user_name: str = "Local Demo User"
    local_user_email: EmailStr = "local.user@example.com"
    local_user_role: UserRole = UserRole.STANDARD_USER

    aws_region: str = "us-east-1"
    dynamodb_table_name: str = "HireFluxLocal"
    dynamodb_endpoint_url: str | None = None
    aws_access_key_id: SecretStr | None = None
    aws_secret_access_key: SecretStr | None = None

    cors_allowed_origins: str = "http://localhost:5173"

    @field_validator("cors_allowed_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        if not origins:
            raise ValueError("At least one CORS origin is required.")
        if "*" in origins:
            raise ValueError("Wildcard CORS origins are forbidden.")
        for origin in origins:
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"Invalid CORS origin: {origin}")
            if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
                raise ValueError(f"CORS origins cannot include paths or query strings: {origin}")
        return ",".join(origins)

    @model_validator(mode="after")
    def validate_security_boundaries(self) -> "Settings":
        local_environments = {Environment.LOCAL, Environment.TEST}
        if self.auth_mode is AuthMode.LOCAL and self.environment not in local_environments:
            raise ValueError("AUTH_MODE=local is forbidden outside local/test environments.")
        if self.auth_mode is AuthMode.LOCAL and (
            os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("AWS_EXECUTION_ENV")
        ):
            raise ValueError("AUTH_MODE=local is forbidden inside an AWS Lambda runtime.")
        if (
            self.auth_mode is AuthMode.LOCAL
            and self.environment is Environment.LOCAL
            and self.dynamodb_endpoint_url is None
        ):
            raise ValueError("Local auth requires an explicit loopback DynamoDB endpoint.")

        if self.dynamodb_endpoint_url is not None:
            if self.environment not in local_environments:
                raise ValueError("A custom DynamoDB endpoint is forbidden outside local/test.")
            if not is_loopback_url(self.dynamodb_endpoint_url):
                raise ValueError("The local DynamoDB endpoint must resolve to a loopback host.")
            if self.aws_access_key_id is None or self.aws_secret_access_key is None:
                raise ValueError("DynamoDB Local requires explicit fake credential-shaped values.")

        signing_key = self.cursor_signing_key.get_secret_value()
        if len(signing_key.encode("utf-8")) < 32:
            raise ValueError("CURSOR_SIGNING_KEY must contain at least 32 bytes.")
        if self.environment not in local_environments and signing_key.startswith("local-only-"):
            raise ValueError("The local cursor signing key is forbidden in deployed environments.")

        if self.auth_mode is AuthMode.DEMO:
            if self.max_applications_per_workspace < 16:
                raise ValueError(
                    "Demo authentication requires capacity for the 16-application seed."
                )
            demo_signing_key = self.demo_session_signing_key.get_secret_value()
            if len(demo_signing_key.encode("utf-8")) < 32:
                raise ValueError("DEMO_SESSION_SIGNING_KEY must contain at least 32 bytes.")
            if self.environment not in local_environments and demo_signing_key.startswith(
                "local-only-"
            ):
                raise ValueError(
                    "The local demo-session signing key is forbidden in deployed environments."
                )
        return self

    @property
    def cors_origins(self) -> tuple[str, ...]:
        return tuple(self.cors_allowed_origins.split(","))


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
