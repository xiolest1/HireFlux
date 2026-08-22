import os
from collections.abc import Iterator
from typing import Any

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

os.environ["ENVIRONMENT"] = "test"
os.environ["AUTH_MODE"] = "local"
os.environ["CURSOR_SIGNING_KEY"] = "test-signing-key-that-is-at-least-32-bytes"
os.environ["AWS_REGION"] = "us-east-1"
os.environ["AWS_ACCESS_KEY_ID"] = "LOCALTESTACCESSKEY"
os.environ["AWS_SECRET_ACCESS_KEY"] = "LOCALTESTSECRETKEY"
os.environ.pop("AWS_LAMBDA_FUNCTION_NAME", None)
os.environ.pop("AWS_EXECUTION_ENV", None)

from hireflux_backend.config import Settings
from hireflux_backend.infrastructure.dynamodb.table_schema import (
    create_table_request,
)
from hireflux_backend.main import create_app


def test_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "environment": "test",
        "auth_mode": "local",
        "cursor_signing_key": "test-signing-key-that-is-at-least-32-bytes",
        "aws_region": "us-east-1",
        "dynamodb_table_name": "HireFluxTest",
        "dynamodb_endpoint_url": None,
        "aws_access_key_id": None,
        "aws_secret_access_key": None,
        "cors_allowed_origins": "http://localhost:5173",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def dynamodb_client() -> Iterator[Any]:
    with mock_aws():
        client = boto3.client(
            "dynamodb",
            region_name="us-east-1",
            aws_access_key_id="LOCALTESTACCESSKEY",
            aws_secret_access_key="LOCALTESTSECRETKEY",
        )
        client.create_table(**create_table_request("HireFluxTest"))
        yield client


@pytest.fixture
def client(dynamodb_client: Any) -> Iterator[TestClient]:
    app = create_app(test_settings(), dynamodb_client=dynamodb_client)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def limited_client(dynamodb_client: Any) -> Iterator[TestClient]:
    app = create_app(
        test_settings(
            max_notes_per_application=2,
            max_interviews_per_application=1,
            max_activity_per_application=20,
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as test_client:
        yield test_client
