import time
from enum import StrEnum
from typing import Any

from botocore.exceptions import ClientError, ConnectionClosedError, EndpointConnectionError

from hireflux_backend.config import Environment, Settings, is_loopback_url
from hireflux_backend.infrastructure.dynamodb.client import build_dynamodb_client

GSI1_NAME = "GSI1"
GSI2_NAME = "GSI2"


class TableInitializationResult(StrEnum):
    CREATED = "created"
    ALREADY_VALID = "already_valid"


class UnsafeTableTargetError(RuntimeError):
    pass


class TableSchemaMismatchError(RuntimeError):
    pass


def create_table_request(table_name: str) -> dict[str, Any]:
    return {
        "TableName": table_name,
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
            {"AttributeName": "GSI2PK", "AttributeType": "S"},
            {"AttributeName": "GSI2SK", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": GSI1_NAME,
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": GSI2_NAME,
                "KeySchema": [
                    {"AttributeName": "GSI2PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI2SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    }


def initialize_local_table(
    settings: Settings, *, client: Any | None = None
) -> TableInitializationResult:
    _assert_safe_local_target(settings)
    dynamodb = client or build_dynamodb_client(settings)
    response = _describe_with_startup_retry(dynamodb, settings.dynamodb_table_name)
    if response is not None:
        validate_table_schema(response["Table"])
        return TableInitializationResult.ALREADY_VALID

    dynamodb.create_table(**create_table_request(settings.dynamodb_table_name))
    dynamodb.get_waiter("table_exists").wait(
        TableName=settings.dynamodb_table_name,
        WaiterConfig={"Delay": 1, "MaxAttempts": 20},
    )
    description = dynamodb.describe_table(TableName=settings.dynamodb_table_name)
    validate_table_schema(description["Table"])
    return TableInitializationResult.CREATED


def _describe_with_startup_retry(
    client: Any,
    table_name: str,
    *,
    attempts: int = 10,
    delay_seconds: float = 0.5,
) -> dict[str, Any] | None:
    for attempt in range(attempts):
        try:
            return client.describe_table(TableName=table_name)
        except ClientError as error:
            if _error_code(error) == "ResourceNotFoundException":
                return None
            raise
        except (EndpointConnectionError, ConnectionClosedError):
            if attempt == attempts - 1:
                raise
            time.sleep(delay_seconds)
    return None


def validate_table_schema(table: dict[str, Any]) -> None:
    expected = create_table_request(str(table.get("TableName", "unknown")))
    problems: list[str] = []

    if _key_schema(table.get("KeySchema", [])) != _key_schema(expected["KeySchema"]):
        problems.append("primary key schema must be PK (HASH) and SK (RANGE)")

    actual_attributes = {
        (entry["AttributeName"], entry["AttributeType"])
        for entry in table.get("AttributeDefinitions", [])
    }
    expected_attributes = {
        (entry["AttributeName"], entry["AttributeType"])
        for entry in expected["AttributeDefinitions"]
    }
    if actual_attributes != expected_attributes:
        problems.append("attribute definitions differ")

    actual_indexes = {
        index["IndexName"]: index for index in table.get("GlobalSecondaryIndexes", [])
    }
    for expected_index in expected["GlobalSecondaryIndexes"]:
        name = expected_index["IndexName"]
        actual_index = actual_indexes.get(name)
        if actual_index is None:
            problems.append(f"missing {name}")
            continue
        if _key_schema(actual_index.get("KeySchema", [])) != _key_schema(
            expected_index["KeySchema"]
        ):
            problems.append(f"{name} key schema differs")
        if actual_index.get("Projection", {}).get("ProjectionType") != "ALL":
            problems.append(f"{name} projection must be ALL")
    if set(actual_indexes) != {GSI1_NAME, GSI2_NAME}:
        problems.append("unexpected global secondary indexes exist")

    if problems:
        joined = "; ".join(problems)
        raise TableSchemaMismatchError(
            f"Existing table schema is incompatible ({joined}). Choose a new local table name "
            "or recreate the local table explicitly."
        )


def _assert_safe_local_target(settings: Settings) -> None:
    endpoint = settings.dynamodb_endpoint_url
    if settings.environment is not Environment.LOCAL:
        raise UnsafeTableTargetError("The local initializer requires ENVIRONMENT=local.")
    if endpoint is None or not is_loopback_url(endpoint):
        raise UnsafeTableTargetError("The local initializer requires a loopback DynamoDB endpoint.")
    credentials = (settings.aws_access_key_id, settings.aws_secret_access_key)
    if any(value is None for value in credentials):
        raise UnsafeTableTargetError("The local initializer requires explicit fake credentials.")
    if any("local" not in value.get_secret_value().lower() for value in credentials if value):
        raise UnsafeTableTargetError(
            "The local initializer only accepts credentials visibly marked as local."
        )


def _key_schema(entries: list[dict[str, str]]) -> frozenset[tuple[str, str]]:
    return frozenset((entry["AttributeName"], entry["KeyType"]) for entry in entries)


def _error_code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", ""))
