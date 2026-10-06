import importlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from hireflux_backend.lambda_settings import REQUIRED_VARIABLES, get_lambda_settings


@pytest.fixture
def lambda_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    values = {
        "ENVIRONMENT": "staging",
        "AUTH_MODE": "demo",
        "AWS_REGION": "us-east-1",
        "DYNAMODB_TABLE_NAME": "SyntheticLambdaTable",
        "CORS_ALLOWED_ORIGINS": "https://demo.example.invalid",
        "CURSOR_SIGNING_KEY": "synthetic-lambda-cursor-key-at-least-32-bytes",
        "DEMO_SESSION_SIGNING_KEY": "synthetic-lambda-demo-key-at-least-32-bytes",
        "AWS_EXECUTION_ENV": "AWS_Lambda_python3.14",
        "AWS_LAMBDA_FUNCTION_NAME": "fixture",
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    for name in ("DYNAMODB_ENDPOINT_URL", "AWS_ENDPOINT_URL", "AWS_ENDPOINT_URL_DYNAMODB"):
        monkeypatch.delenv(name, raising=False)


@pytest.mark.usefixtures("lambda_environment")
@pytest.mark.parametrize("name", REQUIRED_VARIABLES)
def test_explicit_lambda_configuration_is_required(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
) -> None:
    monkeypatch.delenv(name)
    with pytest.raises(RuntimeError, match=name):
        get_lambda_settings()


@pytest.mark.usefixtures("lambda_environment")
@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("ENVIRONMENT", "test"),
        ("AUTH_MODE", "local"),
        ("DYNAMODB_ENDPOINT_URL", "http://localhost:8000"),
        ("AWS_ENDPOINT_URL", "http://localhost:8000"),
        ("AWS_ENDPOINT_URL_DYNAMODB", "http://localhost:8000"),
        ("CORS_ALLOWED_ORIGINS", "*"),
        ("CURSOR_SIGNING_KEY", "private-short-value"),
        ("DEMO_SESSION_SIGNING_KEY", "private-short-value"),
    ],
)
def test_invalid_lambda_settings_fail_without_echoing_inputs(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
    value: str,
) -> None:
    monkeypatch.setenv(name, value)
    with pytest.raises(RuntimeError) as failure:
        get_lambda_settings()
    assert value not in str(failure.value)


@pytest.mark.usefixtures("lambda_environment")
def test_lambda_settings_ignore_dotenv_and_allow_sdk_role_environment(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text("DYNAMODB_ENDPOINT_URL=http://localhost:8000\n")
    # AWS injects temporary execution-role credentials through these variables.
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "SYNTHETICROLEACCESS")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "synthetic-role-secret")
    configured = get_lambda_settings()
    assert configured.auth_mode.value == "demo"
    assert configured.dynamodb_endpoint_url is None
    assert configured.expose_api_docs is False
    from hireflux_backend.infrastructure.dynamodb.client import build_dynamodb_client

    with patch("hireflux_backend.infrastructure.dynamodb.client.boto3.client") as client:
        build_dynamodb_client(configured)
    client.assert_called_once_with("dynamodb", region_name="us-east-1")


@pytest.mark.usefixtures("lambda_environment")
def test_handler_constructs_once_and_reuses_app_for_health(
    caplog: pytest.LogCaptureFixture,
) -> None:
    from hireflux_backend.app_factory import create_app

    name = "hireflux_backend.lambda_handler"
    sys.modules.pop(name, None)
    try:
        with (
            patch(
                "hireflux_backend.app_factory.build_dynamodb_client", return_value=object()
            ) as sdk,
            patch("hireflux_backend.app_factory.create_app", wraps=create_app) as factory,
        ):
            runtime = importlib.import_module(name)
            event = {
                "version": "2.0",
                "rawPath": "/health",
                "rawQueryString": "a=1&a=2",
                "headers": {"host": "example.invalid", "x-request-id": "lambda-test"},
                "requestContext": {
                    "http": {
                        "method": "GET",
                        "path": "/health",
                        "sourceIp": "192.0.2.1",
                    }
                },
                "isBase64Encoded": False,
            }
            for _ in range(2):
                response = runtime.handler(event, SimpleNamespace(aws_request_id="fixture"))
                assert response["statusCode"] == 200
                assert json.loads(response["body"]) == {"status": "ok"}
                assert response["headers"]["x-request-id"] == "lambda-test"
            factory.assert_called_once()
            sdk.assert_called_once()
            assert runtime.handler.app is runtime.app
            assert runtime.handler.lifespan == "off"

            async def fail_safely() -> None:
                raise RuntimeError("synthetic-private-exception-must-not-be-logged")

            runtime.app.add_api_route("/_unit_failure", fail_safely)
            event["requestContext"]["http"]["path"] = "/_unit_failure"
            event["rawPath"] = "/_unit_failure"
            response = runtime.handler(event, SimpleNamespace(aws_request_id="fixture"))
            assert response["statusCode"] == 500
            assert json.loads(response["body"])["error"]["code"] == "INTERNAL_ERROR"
            assert "synthetic-private-exception" not in caplog.text
            assert all(record.exc_info is None for record in caplog.records)
    finally:
        sys.modules.pop(name, None)
