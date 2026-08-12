from typing import Any

import pytest

from hireflux_backend.config import Settings
from hireflux_backend.infrastructure.dynamodb.table_schema import (
    TableInitializationResult,
    TableSchemaMismatchError,
    UnsafeTableTargetError,
    initialize_local_table,
    reset_local_table,
)


def local_settings(table_name: str) -> Settings:
    return Settings(
        _env_file=None,
        environment="local",
        auth_mode="local",
        cursor_signing_key="test-signing-key-that-is-at-least-32-bytes",
        dynamodb_table_name=table_name,
        dynamodb_endpoint_url="http://127.0.0.1:8001",
        aws_access_key_id="LOCALTESTACCESSKEY",
        aws_secret_access_key="LOCALTESTSECRETKEY",
    )


def test_initializer_creates_then_validates_idempotently(dynamodb_client: Any) -> None:
    configured = local_settings("InitializerTest")
    assert (
        initialize_local_table(configured, client=dynamodb_client)
        is TableInitializationResult.CREATED
    )
    assert (
        initialize_local_table(configured, client=dynamodb_client)
        is TableInitializationResult.ALREADY_VALID
    )
    ttl = dynamodb_client.describe_time_to_live(TableName="InitializerTest")
    assert ttl["TimeToLiveDescription"]["AttributeName"] == "expires_at"


def test_initializer_refuses_schema_drift(dynamodb_client: Any) -> None:
    dynamodb_client.create_table(
        TableName="DriftedTable",
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
    )
    with pytest.raises(TableSchemaMismatchError, match="incompatible"):
        initialize_local_table(local_settings("DriftedTable"), client=dynamodb_client)


def test_explicit_reset_requires_exact_table_confirmation(dynamodb_client: Any) -> None:
    configured = local_settings("ResetTest")
    initialize_local_table(configured, client=dynamodb_client)
    with pytest.raises(UnsafeTableTargetError, match="exactly match"):
        reset_local_table(configured, confirmation="wrong", client=dynamodb_client)
    assert (
        reset_local_table(configured, confirmation="ResetTest", client=dynamodb_client)
        is TableInitializationResult.CREATED
    )
    assert (
        initialize_local_table(configured, client=dynamodb_client)
        is TableInitializationResult.ALREADY_VALID
    )
