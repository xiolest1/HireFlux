from typing import Any

from hireflux_backend.infrastructure.dynamodb.mapping import serialize_item
from hireflux_backend.infrastructure.dynamodb.resource_mapping import resource_quota_key


def resource_quota_update(
    table_name: str,
    *,
    owner_user_id: str,
    application_id: str,
    expires_at: int | None,
    max_activity: int,
    note_limit: int | None = None,
    interview_limit: int | None = None,
    note_delta: int = 0,
    expected_interview_count: int | None = None,
) -> dict[str, Any]:
    values: dict[str, object] = {
        ":entity_type": "RESOURCE_QUOTA",
        ":one": 1,
        ":zero": 0,
        ":activity_limit": max_activity,
    }
    assignments = [
        "entity_type = :entity_type",
        "activity_count = if_not_exists(activity_count, :zero) + :one",
    ]
    conditions = [
        "attribute_not_exists(activity_count) OR activity_count < :activity_limit",
    ]
    if note_limit is not None:
        values[":note_limit"] = note_limit
        assignments.append("note_count = if_not_exists(note_count, :zero) + :one")
        conditions.append("attribute_not_exists(note_count) OR note_count < :note_limit")
    elif note_delta < 0:
        assignments.append("note_count = note_count - :one")
        conditions.append("note_count >= :one")
    if interview_limit is not None:
        values[":interview_limit"] = interview_limit
        assignments.append("interview_count = if_not_exists(interview_count, :zero) + :one")
        conditions.append(
            "attribute_not_exists(interview_count) OR interview_count < :interview_limit"
        )
    if expected_interview_count is not None:
        values[":expected_interview_count"] = expected_interview_count
        conditions.append(
            "(attribute_not_exists(interview_count) AND :expected_interview_count = :zero) "
            "OR interview_count = :expected_interview_count"
        )
    if expires_at is not None:
        values[":expires_at"] = expires_at
        assignments.append("expires_at = :expires_at")

    update: dict[str, Any] = {
        "TableName": table_name,
        "Key": serialize_item(resource_quota_key(owner_user_id, application_id)),
        "UpdateExpression": "SET " + ", ".join(assignments),
        "ConditionExpression": " AND ".join(f"({condition})" for condition in conditions),
        "ExpressionAttributeValues": serialize_item(values),
    }
    return {"Update": update}
