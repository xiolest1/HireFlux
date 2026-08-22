from collections.abc import Callable
from datetime import datetime
from typing import Any

from botocore.exceptions import ClientError

from hireflux_backend.application.errors import ConflictError, InvalidCursorError, PersistenceError
from hireflux_backend.application.resource_ports import ResourcePage
from hireflux_backend.domain.models import Activity
from hireflux_backend.domain.resources import Interview, Note, WorkspaceSettings
from hireflux_backend.infrastructure.dynamodb.cursor import CursorCodec
from hireflux_backend.infrastructure.dynamodb.mapping import (
    activity_to_item,
    application_partition,
    deserialize_item,
    format_timestamp,
    serialize_item,
)
from hireflux_backend.infrastructure.dynamodb.resource_mapping import (
    interview_from_item,
    interview_key,
    interview_to_item,
    note_from_item,
    note_key,
    note_to_item,
    owner_schedule_key,
    settings_from_item,
    settings_key,
    settings_to_item,
)
from hireflux_backend.infrastructure.dynamodb.resource_quota import resource_quota_update
from hireflux_backend.infrastructure.dynamodb.table_schema import GSI3_NAME


class DynamoWorkspaceResourceRepository:
    def __init__(
        self,
        client: Any,
        table_name: str,
        cursor_codec: CursorCodec,
        *,
        max_notes_per_application: int = 100,
        max_interviews_per_application: int = 25,
        max_activity_per_application: int = 500,
    ) -> None:
        self._client = client
        self._table_name = table_name
        self._cursor_codec = cursor_codec
        self._max_notes = max_notes_per_application
        self._max_interviews = max_interviews_per_application
        self._max_activity = max_activity_per_application

    def get_settings(self, owner_user_id: str) -> WorkspaceSettings | None:
        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item(settings_key(owner_user_id)),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read workspace settings.") from error
        item = response.get("Item")
        return settings_from_item(deserialize_item(item)) if item else None

    def create_settings(self, settings: WorkspaceSettings) -> WorkspaceSettings:
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(settings_to_item(settings)),
                ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
            )
            return settings
        except ClientError as error:
            if _error_code(error) != "ConditionalCheckFailedException":
                raise PersistenceError("Unable to initialize workspace settings.") from error
        concurrent = self.get_settings(settings.owner_user_id)
        if concurrent is None:
            raise PersistenceError("Workspace settings could not be initialized.")
        return concurrent

    def replace_settings(self, settings: WorkspaceSettings, *, expected_version: int) -> None:
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(settings_to_item(settings)),
                ConditionExpression="attribute_exists(PK) AND #version = :expected_version",
                ExpressionAttributeNames={"#version": "version"},
                ExpressionAttributeValues=serialize_item({":expected_version": expected_version}),
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ConflictError(
                    "The settings were changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError("Unable to update workspace settings.") from error

    def create_note(self, note: Note, activity: Activity) -> None:
        self._create_child(
            note.owner_user_id,
            note.application_id,
            note_to_item(note),
            activity,
            resource_name="note",
        )

    def get_note(self, owner_user_id: str, application_id: str, note_id: str) -> Note | None:
        item = self._get_child(
            note_key(owner_user_id, application_id, note_id), resource_name="note"
        )
        return note_from_item(item) if item is not None else None

    def list_notes(
        self,
        owner_user_id: str,
        application_id: str,
        *,
        limit: int,
        cursor: str | None,
    ) -> ResourcePage[Note]:
        items, next_cursor = self._query_child_page(
            owner_user_id,
            application_id,
            prefix="NOTE#",
            resource_name="notes",
            kind="application-notes",
            limit=limit,
            cursor=cursor,
            key_factory=lambda item_id: note_key(owner_user_id, application_id, item_id),
            item_id_field="note_id",
        )
        return ResourcePage(
            items=tuple(note_from_item(item) for item in items),
            next_cursor=next_cursor,
        )

    def replace_note(self, note: Note, *, expected_version: int, activity: Activity) -> None:
        self._replace_child(
            note_to_item(note),
            expected_version=expected_version,
            activity=activity,
            resource_name="note",
        )

    def delete_note(
        self,
        owner_user_id: str,
        application_id: str,
        note_id: str,
        *,
        expected_version: int,
        activity: Activity,
    ) -> None:
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Delete": {
                            "TableName": self._table_name,
                            "Key": serialize_item(note_key(owner_user_id, application_id, note_id)),
                            "ConditionExpression": (
                                "attribute_exists(PK) AND #version = :expected_version"
                            ),
                            "ExpressionAttributeNames": {"#version": "version"},
                            "ExpressionAttributeValues": serialize_item(
                                {":expected_version": expected_version}
                            ),
                        }
                    },
                    resource_quota_update(
                        self._table_name,
                        owner_user_id=owner_user_id,
                        application_id=application_id,
                        expires_at=activity.expires_at,
                        max_activity=self._max_activity,
                        note_delta=-1,
                    ),
                    self._activity_put(activity),
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    "The note was changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError("Unable to delete the note.") from error

    def create_interview(self, interview: Interview, activity: Activity) -> None:
        self._create_child(
            interview.owner_user_id,
            interview.application_id,
            interview_to_item(interview),
            activity,
            resource_name="interview",
        )

    def get_interview(
        self, owner_user_id: str, application_id: str, interview_id: str
    ) -> Interview | None:
        item = self._get_child(
            interview_key(owner_user_id, application_id, interview_id),
            resource_name="interview",
        )
        return interview_from_item(item) if item is not None else None

    def list_interviews(
        self,
        owner_user_id: str,
        application_id: str,
        *,
        limit: int,
        cursor: str | None,
    ) -> ResourcePage[Interview]:
        items, next_cursor = self._query_child_page(
            owner_user_id,
            application_id,
            prefix="INTERVIEW#",
            resource_name="interviews",
            kind="application-interviews",
            limit=limit,
            cursor=cursor,
            key_factory=lambda item_id: interview_key(owner_user_id, application_id, item_id),
            item_id_field="interview_id",
        )
        return ResourcePage(
            items=tuple(interview_from_item(item) for item in items),
            next_cursor=next_cursor,
        )

    def list_owner_interviews(
        self,
        owner_user_id: str,
        *,
        scheduled_after: datetime,
        limit: int,
        cursor: str | None = None,
    ) -> ResourcePage[Interview]:
        arguments: dict[str, Any] = {
            "TableName": self._table_name,
            "IndexName": GSI3_NAME,
            "KeyConditionExpression": "GSI3PK = :partition AND GSI3SK >= :lower_bound",
            "ExpressionAttributeValues": serialize_item(
                {
                    ":partition": owner_schedule_key(owner_user_id),
                    ":lower_bound": f"INTERVIEW#{format_timestamp(scheduled_after)}",
                }
            ),
            "ScanIndexForward": True,
            "Limit": limit + 1,
        }
        if cursor:
            position = self._cursor_codec.decode(
                cursor,
                kind="workspace-interviews",
                owner_user_id=owner_user_id,
                scope="workspace",
            )
            try:
                application_id, interview_id = position.item_id.split(":", maxsplit=1)
            except ValueError as error:
                raise InvalidCursorError("The pagination cursor is invalid or expired.") from error
            arguments["ExclusiveStartKey"] = serialize_item(
                {
                    "PK": application_partition(owner_user_id, application_id),
                    "SK": f"INTERVIEW#{interview_id}",
                    "GSI3PK": owner_schedule_key(owner_user_id),
                    "GSI3SK": f"INTERVIEW#{position.timestamp}#{interview_id}",
                }
            )
        try:
            response = self._client.query(**arguments)
        except ClientError as error:
            raise PersistenceError("Unable to list workspace interviews.") from error
        raw_items = [deserialize_item(item) for item in response.get("Items", [])]
        page_items = raw_items[:limit]
        next_cursor = None
        if page_items and (len(raw_items) > limit or response.get("LastEvaluatedKey")):
            last = interview_from_item(page_items[-1])
            next_cursor = self._cursor_codec.encode(
                kind="workspace-interviews",
                owner_user_id=owner_user_id,
                scope="workspace",
                timestamp=format_timestamp(last.scheduled_at),
                item_id=f"{last.application_id}:{last.interview_id}",
            )
        return ResourcePage(
            items=tuple(interview_from_item(item) for item in page_items),
            next_cursor=next_cursor,
        )

    def replace_interview(
        self, interview: Interview, *, expected_version: int, activity: Activity
    ) -> None:
        self._replace_child(
            interview_to_item(interview),
            expected_version=expected_version,
            activity=activity,
            resource_name="interview",
        )

    def _create_child(
        self,
        owner_user_id: str,
        application_id: str,
        item: dict[str, Any],
        activity: Activity,
        *,
        resource_name: str,
    ) -> None:
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "ConditionCheck": {
                            "TableName": self._table_name,
                            "Key": serialize_item(
                                {
                                    "PK": application_partition(owner_user_id, application_id),
                                    "SK": "METADATA",
                                }
                            ),
                            "ConditionExpression": "attribute_exists(PK)",
                        }
                    },
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(item),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                    resource_quota_update(
                        self._table_name,
                        owner_user_id=owner_user_id,
                        application_id=application_id,
                        expires_at=item.get("expires_at"),
                        max_activity=self._max_activity,
                        note_limit=self._max_notes if resource_name == "note" else None,
                        interview_limit=(
                            self._max_interviews if resource_name == "interview" else None
                        ),
                    ),
                    self._activity_put(activity),
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    f"The {resource_name} could not be created. Refresh and try again."
                ) from error
            raise PersistenceError(f"Unable to create the {resource_name}.") from error

    def _replace_child(
        self,
        item: dict[str, Any],
        *,
        expected_version: int,
        activity: Activity,
        resource_name: str,
    ) -> None:
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(item),
                            "ConditionExpression": (
                                "attribute_exists(PK) AND #version = :expected_version"
                            ),
                            "ExpressionAttributeNames": {"#version": "version"},
                            "ExpressionAttributeValues": serialize_item(
                                {":expected_version": expected_version}
                            ),
                        }
                    },
                    resource_quota_update(
                        self._table_name,
                        owner_user_id=str(item["owner_user_id"]),
                        application_id=str(item["application_id"]),
                        expires_at=(
                            int(item["expires_at"]) if item.get("expires_at") is not None else None
                        ),
                        max_activity=self._max_activity,
                    ),
                    self._activity_put(activity),
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    f"The {resource_name} was changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError(f"Unable to update the {resource_name}.") from error

    def _get_child(self, key: dict[str, str], *, resource_name: str) -> dict[str, Any] | None:
        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item(key),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError(f"Unable to read the {resource_name}.") from error
        item = response.get("Item")
        return deserialize_item(item) if item else None

    def _query_child_page(
        self,
        owner_user_id: str,
        application_id: str,
        *,
        prefix: str,
        resource_name: str,
        kind: str,
        limit: int,
        cursor: str | None,
        key_factory: Callable[[str], dict[str, str]],
        item_id_field: str,
    ) -> tuple[list[dict[str, Any]], str | None]:
        arguments: dict[str, Any] = {
            "TableName": self._table_name,
            "KeyConditionExpression": "PK = :partition AND begins_with(SK, :prefix)",
            "ExpressionAttributeValues": serialize_item(
                {
                    ":partition": application_partition(owner_user_id, application_id),
                    ":prefix": prefix,
                }
            ),
            "Limit": limit + 1,
        }
        if cursor:
            position = self._cursor_codec.decode(
                cursor,
                kind=kind,
                owner_user_id=owner_user_id,
                scope=application_id,
            )
            arguments["ExclusiveStartKey"] = serialize_item(key_factory(position.item_id))
        try:
            response = self._client.query(**arguments)
        except ClientError as error:
            raise PersistenceError(f"Unable to list {resource_name}.") from error
        raw_items = [deserialize_item(item) for item in response.get("Items", [])]
        page_items = raw_items[:limit]
        next_cursor = None
        if page_items and (len(raw_items) > limit or response.get("LastEvaluatedKey")):
            next_cursor = self._cursor_codec.encode(
                kind=kind,
                owner_user_id=owner_user_id,
                scope=application_id,
                timestamp="",
                item_id=str(page_items[-1][item_id_field]),
            )
        return page_items, next_cursor

    def _activity_put(self, activity: Activity) -> dict[str, Any]:
        return {
            "Put": {
                "TableName": self._table_name,
                "Item": serialize_item(activity_to_item(activity)),
                "ConditionExpression": "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            }
        }


def _error_code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", ""))
