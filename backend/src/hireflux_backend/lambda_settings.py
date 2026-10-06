"""Explicit environment-only configuration for the deployed Lambda boundary."""

import os

from pydantic import ValidationError

from hireflux_backend.config import Environment, Settings

REQUIRED_VARIABLES = (
    "ENVIRONMENT",
    "AUTH_MODE",
    "AWS_REGION",
    "DYNAMODB_TABLE_NAME",
    "CORS_ALLOWED_ORIGINS",
    "CURSOR_SIGNING_KEY",
    "DEMO_SESSION_SIGNING_KEY",
)


def get_lambda_settings() -> Settings:
    missing = [name for name in REQUIRED_VARIABLES if not os.environ.get(name, "").strip()]
    if missing:
        raise RuntimeError(f"Missing Lambda configuration variables: {', '.join(missing)}")
    # SDK endpoint environment variables bypass the application's endpoint setting.
    if any(os.environ.get(name) for name in ("AWS_ENDPOINT_URL", "AWS_ENDPOINT_URL_DYNAMODB")):
        raise RuntimeError("Custom SDK endpoints are forbidden in Lambda.")
    try:
        configured = Settings(_env_file=None)  # type: ignore[call-arg]
    except ValidationError:
        # Pydantic's full error can contain input values, including signing secrets.
        raise RuntimeError("Invalid Lambda configuration; check the runtime contract.") from None
    if configured.environment not in {Environment.STAGING, Environment.PRODUCTION}:
        raise RuntimeError("Lambda requires ENVIRONMENT=staging or production.")
    return configured
