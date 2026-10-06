"""Run ONLY inside the isolated Linux artifact-validation container."""

from __future__ import annotations

import base64
import importlib
import importlib.metadata
import io
import json
import logging
import os
import platform
import socket
import sys
import zipfile
from pathlib import Path
from types import SimpleNamespace
from typing import Any

PACKAGE = Path("/tmp/hireflux-package")
NETWORK_ATTEMPTS: list[str] = []


def event(path: str = "/health", method: str = "GET", **overrides: Any) -> dict[str, Any]:
    fixture: dict[str, Any] = {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {
            "host": "artifact.example.invalid",
            "x-forwarded-proto": "https",
            "x-request-id": "artifact-request-1",
            "origin": "https://demo.example.invalid",
        },
        "requestContext": {
            "accountId": "000000000000",
            "apiId": "fixture",
            "domainName": "example.invalid",
            "domainPrefix": "fixture",
            "requestId": "gateway-request-1",
            "routeKey": "$default",
            "stage": "$default",
            "time": "06/Oct/2026:00:00:00 +0000",
            "timeEpoch": 1791244800000,
            "http": {
                "method": method,
                "path": path,
                "protocol": "HTTP/1.1",
                "sourceIp": "192.0.2.1",
                "userAgent": "artifact-probe",
            },
        },
        "body": None,
        "isBase64Encoded": False,
    }
    fixture.update(overrides)
    return fixture


def configure() -> None:
    for name in list(os.environ):
        if name.startswith("AWS_") or name in {"DYNAMODB_ENDPOINT_URL", "PYTHONPATH"}:
            os.environ.pop(name)
    os.environ.update(
        {
            "ENVIRONMENT": "staging",
            "AUTH_MODE": "demo",
            "AWS_REGION": "us-east-1",
            "AWS_DEFAULT_REGION": "us-east-1",
            "DYNAMODB_TABLE_NAME": "ArtifactOnlyFixture",
            "CORS_ALLOWED_ORIGINS": "https://demo.example.invalid",
            "CURSOR_SIGNING_KEY": "synthetic-artifact-cursor-key-never-deploy-0000",
            "DEMO_SESSION_SIGNING_KEY": "synthetic-artifact-demo-key-never-deploy-0000",
            "AWS_EXECUTION_ENV": "AWS_Lambda_python3.14",
            "AWS_LAMBDA_FUNCTION_NAME": "artifact-only-fixture",
            "AWS_EC2_METADATA_DISABLED": "true",
            "AWS_CONFIG_FILE": "/tmp/no-aws-config",
            "AWS_SHARED_CREDENTIALS_FILE": "/tmp/no-aws-credentials",
        }
    )


def block_network() -> None:
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex

    def connect(connection: socket.socket, address: Any) -> Any:
        if connection.family in {socket.AF_INET, socket.AF_INET6}:
            NETWORK_ATTEMPTS.append("connect")
            raise AssertionError("Network access is forbidden in artifact validation.")
        return original_connect(connection, address)

    def connect_ex(connection: socket.socket, address: Any) -> Any:
        if connection.family in {socket.AF_INET, socket.AF_INET6}:
            NETWORK_ATTEMPTS.append("connect_ex")
            raise AssertionError("Network access is forbidden in artifact validation.")
        return original_connect_ex(connection, address)

    def resolve(*args: Any, **kwargs: Any) -> Any:
        NETWORK_ATTEMPTS.append("dns")
        raise AssertionError("DNS access is forbidden in artifact validation.")

    socket.socket.connect = connect  # type: ignore[method-assign]
    socket.socket.connect_ex = connect_ex  # type: ignore[method-assign]
    socket.getaddrinfo = resolve


def main() -> None:
    assert sys.version_info[:2] == (3, 14) and platform.machine() == "x86_64"
    assert not any("site-packages" in path for path in sys.path), sys.path
    assert os.getuid() != 0, "The read-only test must run without root privileges."
    PACKAGE.mkdir()
    with zipfile.ZipFile("/input/artifact.zip") as archive:
        for member in archive.infolist():
            target = PACKAGE / member.filename
            assert target.resolve().is_relative_to(PACKAGE)
            assert member.date_time == (1980, 1, 1, 0, 0, 0)
        archive.extractall(PACKAGE)
    for path in PACKAGE.rglob("*"):
        path.chmod(0o555 if path.is_dir() else 0o444)
    PACKAGE.chmod(0o555)
    try:
        (PACKAGE / "write-must-fail").write_text("forbidden")
    except PermissionError:
        pass
    else:
        raise AssertionError("Artifact directory was writable.")
    sys.path.insert(0, str(PACKAGE))
    configure()
    block_network()
    native_modules = (
        "pydantic_core._pydantic_core",
        "httptools.parser.parser",
        "yaml._yaml",
        "uvloop.loop",
        "watchfiles._rust_notify",
        "websockets.speedups",
    )
    for name in native_modules:
        module = importlib.import_module(name)
        assert Path(module.__file__).is_relative_to(PACKAGE)
    factory = importlib.import_module("hireflux_backend.app_factory")
    assert not hasattr(factory, "app") and "hireflux_backend.main" not in sys.modules
    settings_module = importlib.import_module("hireflux_backend.lambda_settings")
    for bad_env in (
        {"AUTH_MODE": "local", "ENVIRONMENT": "local"},
        {"AUTH_MODE": "local", "ENVIRONMENT": "staging"},
        {"DYNAMODB_ENDPOINT_URL": "http://localhost:8000"},
        {"AWS_ENDPOINT_URL_DYNAMODB": "http://localhost:8000"},
        {"CURSOR_SIGNING_KEY": "short-secret-must-never-appear"},
        {"CORS_ALLOWED_ORIGINS": "*"},
        {"DYNAMODB_TABLE_NAME": ""},
    ):
        configure()
        os.environ.update(bad_env)
        try:
            settings_module.get_lambda_settings()
        except RuntimeError as error:
            assert "short-secret-must-never-appear" not in str(error)
        else:
            raise AssertionError("Invalid Lambda configuration was accepted.")
    configure()
    runtime = importlib.import_module("hireflux_backend.lambda_handler")
    assert runtime.handler.app is runtime.app and runtime.handler.lifespan == "off"
    identity = id(runtime.app)
    context = SimpleNamespace(
        function_name="artifact-only-fixture",
        function_version="$LATEST",
        memory_limit_in_mb=128,
        invoked_function_arn="arn:aws:lambda:us-east-1:000000000000:function:fixture",
        aws_request_id="lambda-request-1",
        log_group_name="fixture",
        log_stream_name="fixture",
        get_remaining_time_in_millis=lambda: 30_000,
    )
    cold = runtime.handler(event(), context)
    warm = runtime.handler(event(rawQueryString="check=warm&check=again"), context)
    for response in (cold, warm):
        assert response["statusCode"] == 200 and json.loads(response["body"]) == {"status": "ok"}
        assert response["isBase64Encoded"] is False
        assert response["headers"]["x-request-id"] == "artifact-request-1"
        assert response["headers"]["access-control-allow-origin"] == "https://demo.example.invalid"
    assert id(runtime.app) == identity
    missing = runtime.handler(event("/missing-artifact-route"), context)
    assert missing["statusCode"] == 404
    assert json.loads(missing["body"])["error"]["request_id"] == "artifact-request-1"
    unauthorized = runtime.handler(event("/api/v1/me"), context)
    assert unauthorized["statusCode"] == 401
    options = event(method="OPTIONS")
    options["headers"]["access-control-request-method"] = "GET"
    assert runtime.handler(options, context)["statusCode"] == 200
    logs = io.StringIO()
    log_handler = logging.StreamHandler(logs)
    logging.getLogger().addHandler(log_handler)

    async def safe_failure() -> None:
        raise RuntimeError("synthetic-private-exception-must-not-be-logged")

    runtime.app.add_api_route("/_artifact_failure", safe_failure)
    failure = runtime.handler(event("/_artifact_failure"), context)
    logging.getLogger().removeHandler(log_handler)
    assert failure["statusCode"] == 500
    assert json.loads(failure["body"])["error"]["code"] == "INTERNAL_ERROR"
    assert "synthetic-private-exception" not in logs.getvalue()
    assert "Traceback" not in logs.getvalue()
    try:
        runtime.handler({"private_fixture": "must-not-be-in-error"}, context)
    except RuntimeError as error:
        assert "must-not-be-in-error" not in str(error)
    else:
        raise AssertionError("Unsupported event was accepted.")
    # Exercise transport behavior without adding testing routes to the application.
    from mangum import Mangum

    async def transport_probe(scope: Any, receive: Any, send: Any) -> None:
        request = await receive()
        assert scope["method"] == "POST" and scope["path"] == "/transport"
        assert scope["query_string"] == b"label=a&label=b%20c"
        assert request["body"] == b"fixture body"
        assert [b"cookie", b"first=a; second=b"] in scope["headers"]
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    [b"content-type", b"text/csv; charset=utf-8"],
                    [b"content-disposition", b'attachment; filename="fixture.csv"'],
                    [b"set-cookie", b"one=a"],
                    [b"set-cookie", b"two=b"],
                ],
            }
        )
        await send({"type": "http.response.body", "body": b"name\r\nfixture\r\n"})

    probe_response = Mangum(transport_probe, lifespan="off")(
        event(
            "/transport",
            "POST",
            rawQueryString="label=a&label=b%20c",
            cookies=["first=a", "second=b"],
            body=base64.b64encode(b"fixture body").decode(),
            isBase64Encoded=True,
        ),
        context,
    )
    assert probe_response["body"] == "name\r\nfixture\r\n"
    assert probe_response["isBase64Encoded"] is False
    assert probe_response["cookies"] == ["one=a", "two=b"]
    assert "attachment" in probe_response["headers"]["content-disposition"]
    for name, module in tuple(sys.modules.items()):
        origin = getattr(module, "__file__", None)
        if origin and "site-packages" in origin:
            raise AssertionError(f"Runtime-provided package fallback: {name}")
    distributions = list(importlib.metadata.distributions(path=[str(PACKAGE)]))
    assert len(distributions) == 31
    assert importlib.metadata.version("boto3") == "1.43.53"
    assert importlib.metadata.version("botocore") == "1.43.78"
    assert not NETWORK_ATTEMPTS, NETWORK_ATTEMPTS
    print(
        json.dumps(
            {
                "python": platform.python_version(),
                "architecture": platform.machine(),
                "libc": platform.libc_ver(),
                "isolated_import": True,
                "read_only_package": True,
                "native_modules": list(native_modules),
                "runtime_distributions": len(distributions),
                "cold_health": cold["statusCode"],
                "warm_health": warm["statusCode"],
                "not_found": missing["statusCode"],
                "unauthenticated": unauthorized["statusCode"],
                "cors_preflight": 200,
                "transport_csv_base64_cookies": True,
                "invalid_config_rejected": True,
                "unsupported_event_rejected": True,
                "safe_500_and_logging": True,
                "network_attempts": len(NETWORK_ATTEMPTS),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
