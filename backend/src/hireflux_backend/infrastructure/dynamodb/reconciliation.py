from collections import Counter, defaultdict
from typing import Any

from botocore.exceptions import ClientError

from hireflux_backend.application.errors import PersistenceError
from hireflux_backend.config import Settings
from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Application
from hireflux_backend.domain.resources import Interview
from hireflux_backend.infrastructure.dynamodb.client import build_dynamodb_client
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_from_item,
    application_to_item,
    deserialize_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.resource_mapping import (
    interview_from_item,
    interview_to_item,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import (
    UnsafeTableTargetError,
    assert_safe_local_target,
)


def reconcile_local_projections(
    settings: Settings,
    *,
    confirmation: str,
    client: Any | None = None,
) -> int:
    """Rebuild derived application indexes/counters in an explicitly selected local table."""
    assert_safe_local_target(settings)
    if confirmation != settings.dynamodb_table_name:
        raise UnsafeTableTargetError(
            "Projection reconciliation confirmation must exactly match DYNAMODB_TABLE_NAME."
        )
    dynamodb = client or build_dynamodb_client(settings)
    applications = _load_applications(dynamodb, settings.dynamodb_table_name)
    interviews = _load_interviews(dynamodb, settings.dynamodb_table_name)
    grouped: defaultdict[str, list[Application]] = defaultdict(list)
    try:
        for application in applications:
            dynamodb.put_item(
                TableName=settings.dynamodb_table_name,
                Item=serialize_item(application_to_item(application)),
                ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
            )
            grouped[application.owner_user_id].append(application)
        for interview in interviews:
            dynamodb.put_item(
                TableName=settings.dynamodb_table_name,
                Item=serialize_item(interview_to_item(interview)),
                ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
            )
        for owner_user_id, owner_applications in grouped.items():
            _write_counters(
                dynamodb,
                settings.dynamodb_table_name,
                owner_user_id,
                owner_applications,
            )
    except ClientError as error:
        raise PersistenceError("Unable to reconcile local projections.") from error
    return len(applications)


def _load_applications(client: Any, table_name: str) -> tuple[Application, ...]:
    arguments: dict[str, Any] = {
        "TableName": table_name,
        "FilterExpression": "entity_type = :application",
        "ExpressionAttributeValues": serialize_item({":application": "APPLICATION"}),
    }
    applications: list[Application] = []
    try:
        while True:
            response = client.scan(**arguments)
            applications.extend(
                application_from_item(deserialize_item(item)) for item in response.get("Items", [])
            )
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            arguments["ExclusiveStartKey"] = last_key
    except ClientError as error:
        raise PersistenceError("Unable to read local applications for reconciliation.") from error
    return tuple(applications)


def _load_interviews(client: Any, table_name: str) -> tuple[Interview, ...]:
    arguments: dict[str, Any] = {
        "TableName": table_name,
        "FilterExpression": "entity_type = :interview",
        "ExpressionAttributeValues": serialize_item({":interview": "INTERVIEW"}),
    }
    interviews: list[Interview] = []
    try:
        while True:
            response = client.scan(**arguments)
            interviews.extend(
                interview_from_item(deserialize_item(item)) for item in response.get("Items", [])
            )
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            arguments["ExclusiveStartKey"] = last_key
    except ClientError as error:
        raise PersistenceError("Unable to read local interviews for reconciliation.") from error
    return tuple(interviews)


def _write_counters(
    client: Any,
    table_name: str,
    owner_user_id: str,
    applications: list[Application],
) -> None:
    counts = Counter(application.status for application in applications)
    expires_at = next(
        (application.expires_at for application in applications if application.expires_at), None
    )
    for status in ApplicationStatus:
        client.put_item(
            TableName=table_name,
            Item=serialize_item(
                {
                    "PK": user_partition(owner_user_id),
                    "SK": f"COUNTER#STATUS#{status.value}",
                    "entity_type": "STATUS_COUNTER",
                    "count": counts[status],
                    "expires_at": expires_at,
                }
            ),
        )
    client.put_item(
        TableName=table_name,
        Item=serialize_item(
            {
                "PK": user_partition(owner_user_id),
                "SK": "COUNTER#FUNNEL",
                "entity_type": "FUNNEL_COUNTER",
                "total_tracked": len(applications),
                "submitted_count": sum(item.submitted_at is not None for item in applications),
                "response_count": sum(item.first_response_at is not None for item in applications),
                "screening_count": sum(
                    item.first_screening_at is not None for item in applications
                ),
                "interview_count": sum(
                    item.first_interview_at is not None for item in applications
                ),
                "offer_count": sum(item.first_offer_at is not None for item in applications),
                "acceptance_count": sum(
                    item.first_acceptance_at is not None for item in applications
                ),
                "expires_at": expires_at,
            }
        ),
    )
