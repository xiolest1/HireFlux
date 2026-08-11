import pytest
from pydantic import ValidationError

from hireflux_backend.config import Settings

KEY = "test-signing-key-that-is-at-least-32-bytes"


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "auth_mode": "local",
        "cursor_signing_key": KEY,
        "dynamodb_endpoint_url": None,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_test_environment_supports_local_auth_without_endpoint() -> None:
    assert settings().auth_mode.value == "local"


def test_local_auth_is_rejected_in_deployed_environment() -> None:
    with pytest.raises(ValidationError, match="forbidden outside"):
        settings(environment="production")


def test_local_environment_requires_loopback_endpoint() -> None:
    with pytest.raises(ValidationError, match="requires an explicit"):
        settings(environment="local")
    with pytest.raises(ValidationError, match="loopback"):
        settings(
            environment="local",
            dynamodb_endpoint_url="https://dynamodb.us-east-1.amazonaws.com",
            aws_access_key_id="local_key",
            aws_secret_access_key="local_secret",
        )


@pytest.mark.parametrize("marker", ["AWS_LAMBDA_FUNCTION_NAME", "AWS_EXECUTION_ENV"])
def test_local_auth_is_rejected_under_lambda_markers(
    monkeypatch: pytest.MonkeyPatch, marker: str
) -> None:
    monkeypatch.setenv(marker, "present")
    with pytest.raises(ValidationError, match="Lambda"):
        settings()


def test_wildcard_cors_is_rejected() -> None:
    with pytest.raises(ValidationError, match="Wildcard"):
        settings(cors_allowed_origins="*")


def test_short_or_deployed_local_cursor_key_is_rejected() -> None:
    with pytest.raises(ValidationError, match="32 bytes"):
        settings(cursor_signing_key="too-short")
    with pytest.raises(ValidationError, match="local cursor"):
        settings(
            environment="production",
            auth_mode="cognito",
            cursor_signing_key="local-only-signing-key-change-before-deployment",
        )
