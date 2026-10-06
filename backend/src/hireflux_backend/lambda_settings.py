"""Environment-only Lambda composition with cold-start signing-secret resolution."""

import os
import re
from typing import Any

import boto3
from botocore.config import Config
from pydantic import SecretStr, ValidationError

from hireflux_backend.config import AuthMode, Environment, Settings
from hireflux_backend.cors_policy import CorsPolicy

REQUIRED_VARIABLES = (
    "ENVIRONMENT",
    "AUTH_MODE",
    "AWS_REGION",
    "DYNAMODB_TABLE_NAME",
    "CORS_ALLOWED_ORIGINS",
    "LAMBDA_CORS_POLICY",
    "CURSOR_SIGNING_SECRET_ARN",
    "DEMO_SESSION_SIGNING_SECRET_ARN",
)


def get_lambda_cors_policy() -> CorsPolicy:
    try:
        return CorsPolicy.model_validate_json(os.environ.get("LAMBDA_CORS_POLICY", ""))
    except ValidationError:
        raise RuntimeError("Invalid Lambda CORS policy.") from None


def _secret_references(region: str) -> tuple[str, str]:
    references = tuple(os.environ[name] for name in REQUIRED_VARIABLES[-2:])
    pattern = (
        rf"arn:aws:secretsmanager:{re.escape(region)}:(\d{{12}}):secret:"
        r"[A-Za-z0-9/_+=.@-]+-[A-Za-z0-9]{6}"
    )
    matches = [re.fullmatch(pattern, reference) for reference in references]
    if (
        not all(matches)
        or references[0] == references[1]
        or matches[0] is None
        or matches[1] is None
        or matches[0][1] != matches[1][1]
    ):
        raise RuntimeError("Invalid Lambda signing-secret references.")
    return references[0], references[1]


def _resolve_key(client: Any, reference: str, label: str) -> str:
    try:
        response = client.get_secret_value(SecretId=reference)
        value = response.get("SecretString")
        # Raw generated keys, not JSON or binary. Validate before constructing Settings.
        if (
            response.get("ARN") != reference
            or not isinstance(value, str)
            or not re.fullmatch(r"[A-Za-z0-9]{64}", value)
        ):
            raise ValueError("Unexpected signing-key shape.")
    except Exception:
        # SDK errors and validation inputs may contain sensitive material.
        raise RuntimeError(f"Unable to resolve required {label} signing secret.") from None
    return value


def get_lambda_settings(*, secrets_client: Any | None = None) -> Settings:
    missing = [name for name in REQUIRED_VARIABLES if not os.environ.get(name, "").strip()]
    if missing:
        raise RuntimeError(f"Missing Lambda configuration variables: {', '.join(missing)}")
    if any(
        os.environ.get(name)
        for name in (
            "AWS_ENDPOINT_URL",
            "AWS_ENDPOINT_URL_DYNAMODB",
            "AWS_ENDPOINT_URL_SECRETS_MANAGER",
            "DYNAMODB_ENDPOINT_URL",
            "CURSOR_SIGNING_KEY",
            "DEMO_SESSION_SIGNING_KEY",
        )
    ):
        raise RuntimeError(
            "Custom endpoints and plaintext signing-key configuration are forbidden in Lambda."
        )
    environment = os.environ["ENVIRONMENT"]
    auth_mode = os.environ["AUTH_MODE"]
    if (environment, auth_mode) not in {("staging", "demo"), ("production", "cognito")}:
        raise RuntimeError("Lambda requires staging/demo or production/cognito configuration.")
    get_lambda_cors_policy()
    region = os.environ["AWS_REGION"]
    cursor_reference, demo_reference = _secret_references(region)
    try:
        client = (
            secrets_client
            if secrets_client is not None
            else boto3.client(
                "secretsmanager",
                region_name=region,
                config=Config(
                    connect_timeout=2,
                    read_timeout=2,
                    retries={"total_max_attempts": 2},
                ),
            )
        )
    except Exception:
        raise RuntimeError("Unable to initialize Lambda signing-secret provider.") from None
    cursor_key = _resolve_key(client, cursor_reference, "cursor")
    demo_key = _resolve_key(client, demo_reference, "demo-session")
    try:
        configured = Settings(  # type: ignore[call-arg]
            _env_file=None,
            environment=Environment(environment),
            auth_mode=AuthMode(auth_mode),
            cursor_signing_key=SecretStr(cursor_key),
            demo_session_signing_key=SecretStr(demo_key),
        )
    except ValidationError:
        raise RuntimeError("Invalid Lambda configuration; check the runtime contract.") from None
    return configured
