import importlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from hireflux_backend.lambda_settings import REQUIRED_VARIABLES, get_lambda_settings

CURSOR_ARN = "arn:aws:secretsmanager:us-east-1:111111111111:secret:fixture-cursor-Ab1234"
DEMO_ARN = "arn:aws:secretsmanager:us-east-1:111111111111:secret:fixture-demo-Cd5678"
CORS = {
    "allow_methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Accept", "Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
    "expose_headers": ["X-Request-ID", "Content-Disposition"],
    "allow_credentials": False,
}


class FakeSecrets:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def get_secret_value(self, *, SecretId: str) -> dict[str, str]:
        self.calls.append(SecretId)
        return {"ARN": SecretId, "SecretString": ("C" if SecretId == CURSOR_ARN else "D") * 64}


@pytest.fixture
def lambda_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    values = {
        "ENVIRONMENT": "staging",
        "AUTH_MODE": "demo",
        "AWS_REGION": "us-east-1",
        "DYNAMODB_TABLE_NAME": "SyntheticLambdaTable",
        "CORS_ALLOWED_ORIGINS": "https://demo.example.invalid",
        "LAMBDA_CORS_POLICY": json.dumps(CORS),
        "CURSOR_SIGNING_SECRET_ARN": CURSOR_ARN,
        "DEMO_SESSION_SIGNING_SECRET_ARN": DEMO_ARN,
        "AWS_EXECUTION_ENV": "AWS_Lambda_python3.14",
        "AWS_LAMBDA_FUNCTION_NAME": "fixture",
    }
    monkeypatch.setattr(
        "hireflux_backend.lambda_settings.boto3.client", lambda *args, **kwargs: FakeSecrets()
    )
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    for name in (
        "DYNAMODB_ENDPOINT_URL",
        "AWS_ENDPOINT_URL",
        "AWS_ENDPOINT_URL_DYNAMODB",
        "CURSOR_SIGNING_KEY",
        "DEMO_SESSION_SIGNING_KEY",
        "AWS_ENDPOINT_URL_SECRETS_MANAGER",
    ):
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
        secrets = FakeSecrets()
        with (
            patch("hireflux_backend.lambda_settings.boto3.client", return_value=secrets),
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
            assert secrets.calls == [CURSOR_ARN, DEMO_ARN]
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


@pytest.mark.usefixtures("lambda_environment")
def test_both_signing_secrets_resolve_without_persisting_environment_values() -> None:
    client = FakeSecrets()
    configured = get_lambda_settings(secrets_client=client)
    assert client.calls == [CURSOR_ARN, DEMO_ARN]
    assert configured.cursor_signing_key.get_secret_value() == "C" * 64
    assert configured.demo_session_signing_key.get_secret_value() == "D" * 64
    import os

    assert "CURSOR_SIGNING_KEY" not in os.environ
    assert "DEMO_SESSION_SIGNING_KEY" not in os.environ


@pytest.mark.usefixtures("lambda_environment")
@pytest.mark.parametrize(
    "reference",
    [
        "wrong",
        CURSOR_ARN.replace("us-east-1", "eu-west-1"),
        DEMO_ARN,
        CURSOR_ARN.replace("111111111111", "222222222222"),
    ],
)
def test_invalid_secret_references_fail_before_sdk(
    monkeypatch: pytest.MonkeyPatch, reference: str
) -> None:
    monkeypatch.setenv("CURSOR_SIGNING_SECRET_ARN", reference)
    client = FakeSecrets()
    with pytest.raises(RuntimeError, match="references"):
        get_lambda_settings(secrets_client=client)
    assert not client.calls


@pytest.mark.usefixtures("lambda_environment")
@pytest.mark.parametrize(
    "value",
    [
        "",
        "weak-private-value",
        '{"key":"' + "X" * 64 + '"}',
        None,
        b"binary",
        "local-only-" + "X" * 53,
    ],
)
def test_invalid_secret_material_fails_closed_and_is_not_logged(
    value: object, caplog: pytest.LogCaptureFixture
) -> None:
    from unittest.mock import Mock

    client = Mock()
    client.get_secret_value.return_value = {"ARN": CURSOR_ARN, "SecretString": value}
    with pytest.raises(RuntimeError, match="cursor signing secret") as failure:
        get_lambda_settings(secrets_client=client)
    assert failure.value.__cause__ is None
    assert str(value) not in str(failure.value) if value else True
    assert not caplog.records


@pytest.mark.usefixtures("lambda_environment")
def test_secret_read_failure_is_sanitized(caplog: pytest.LogCaptureFixture) -> None:
    from unittest.mock import Mock

    client = Mock()
    client.get_secret_value.side_effect = RuntimeError("synthetic-private-provider-error")
    with pytest.raises(RuntimeError) as failure:
        get_lambda_settings(secrets_client=client)
    assert "synthetic-private" not in str(failure.value)
    assert not caplog.records


@pytest.mark.usefixtures("lambda_environment")
def test_unexpected_secret_arn_and_binary_fail() -> None:
    from unittest.mock import Mock

    client = Mock()
    for payload in (
        {"ARN": DEMO_ARN, "SecretString": "X" * 64},
        {"ARN": CURSOR_ARN, "SecretBinary": b"X" * 64},
    ):
        client.get_secret_value.return_value = payload
        with pytest.raises(RuntimeError):
            get_lambda_settings(secrets_client=client)


@pytest.mark.usefixtures("lambda_environment")
def test_production_auth_remains_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient

    from hireflux_backend.app_factory import create_app
    from hireflux_backend.lambda_settings import get_lambda_cors_policy

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("AUTH_MODE", "cognito")
    app = create_app(
        get_lambda_settings(), dynamodb_client=object(), cors_policy=get_lambda_cors_policy()
    )
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert (
            client.get("/api/v1/me", headers={"Authorization": "Bearer untrusted"}).status_code
            == 503
        )
        assert client.post("/api/v1/demo-sessions").status_code == 503


@pytest.mark.usefixtures("lambda_environment")
@pytest.mark.parametrize(
    "change",
    [
        {"allow_credentials": True},
        {"allow_headers": ["*"]},
        {"allow_methods": ["*"]},
        {"expose_headers": ["*"]},
        {"unexpected": True},
    ],
)
def test_deployed_cors_rejects_permissive_or_malformed_policy(
    monkeypatch: pytest.MonkeyPatch, change: dict[str, object]
) -> None:
    monkeypatch.setenv("LAMBDA_CORS_POLICY", json.dumps(CORS | change))
    with pytest.raises(RuntimeError, match="CORS"):
        get_lambda_settings()


def test_local_configuration_needs_no_secret_provider() -> None:
    from conftest import test_settings

    from hireflux_backend.app_factory import create_app

    with patch("hireflux_backend.lambda_settings.boto3.client") as provider:
        create_app(test_settings(), dynamodb_client=object())
    provider.assert_not_called()


@pytest.mark.usefixtures("lambda_environment")
def test_deployed_preflight_and_response_headers_match_gateway_contract() -> None:
    from fastapi.testclient import TestClient

    from hireflux_backend.app_factory import create_app
    from hireflux_backend.lambda_settings import get_lambda_cors_policy

    app = create_app(
        get_lambda_settings(), dynamodb_client=object(), cors_policy=get_lambda_cors_policy()
    )
    with TestClient(app) as client:
        headers = {
            "Origin": "https://demo.example.invalid",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": (
                "Authorization,Content-Type,Idempotency-Key,X-Request-ID"
            ),
        }
        preflight = client.options("/api/v1/demo-sessions", headers=headers)
        assert preflight.status_code == 200
        assert "access-control-allow-credentials" not in preflight.headers
        headers["Origin"] = "https://untrusted.invalid"
        assert client.options("/api/v1/demo-sessions", headers=headers).status_code == 400
        response = client.get("/health", headers={"Origin": "https://demo.example.invalid"})
        assert (
            response.headers["access-control-expose-headers"] == "X-Request-ID, Content-Disposition"
        )
        assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize("content", ['"', "\\", "\x01", "😀", "a"])
def test_public_export_budget_fits_actual_mangum_proxy_envelope(
    content: str, lambda_environment: None
) -> None:
    from datetime import UTC, datetime

    from mangum import Mangum

    from hireflux_backend.api.resource_schemas import NoteResponse

    now = datetime(2026, 10, 6, tzinfo=UTC)
    note = NoteResponse(
        note_id="00000000-0000-4000-8000-000000000001",
        application_id="00000000-0000-4000-8000-000000000002",
        content=content * 5_000,
        created_at=now,
        updated_at=now,
        version=1,
    )
    record = note.model_dump_json().encode("utf-8")
    count = (4_000_000 - 20) // (len(record) + 1)
    body = b'{"notes":[' + b",".join([record] * count) + b"]}"
    assert 3_960_000 < len(body) <= 4_000_000

    async def public_json(scope: object, receive: object, send: object) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [[b"content-type", b"application/json"]],
            }
        )
        await send({"type": "http.response.body", "body": body})

    event = {
        "version": "2.0",
        "rawPath": "/export",
        "rawQueryString": "",
        "headers": {},
        "requestContext": {"http": {"method": "GET", "path": "/export", "sourceIp": "192.0.2.1"}},
        "isBase64Encoded": False,
    }
    response = Mangum(public_json, lifespan="off")(event, SimpleNamespace(aws_request_id="fixture"))
    import base64

    from hireflux_backend.lambda_handler import bound_proxy_response

    response = bound_proxy_response(response)
    decoded = (
        base64.b64decode(response["body"])
        if response["isBase64Encoded"]
        else response["body"].encode("utf-8")
    )
    assert decoded == body
    assert response["statusCode"] == 200
    # Python 3.14 Lambda returns Unicode directly; account for proxy JSON escaping too.
    wire = json.dumps(response, ensure_ascii=False).encode("utf-8")
    assert len(wire) < 6 * 1024 * 1024
    assert len(body) < 10 * 1024 * 1024


@pytest.mark.usefixtures("lambda_environment")
def test_transport_rejects_response_that_cannot_fit_even_with_base64() -> None:
    from hireflux_backend.lambda_handler import bound_proxy_response

    response = bound_proxy_response(
        {
            "statusCode": 200,
            "body": "private-data" * 700_000,
            "isBase64Encoded": False,
            "headers": {"x-request-id": "safe-id"},
        }
    )
    assert response["statusCode"] == 413
    assert json.loads(response["body"])["error"]["request_id"] == "safe-id"
    assert "private-data" not in response["body"]
