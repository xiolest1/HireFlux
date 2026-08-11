from typing import Any

from botocore.exceptions import ClientError

from hireflux_backend.application.errors import (
    ConflictError,
    InvalidCursorError,
    PersistenceError,
)
from hireflux_backend.application.ports import ApplicationPage
from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity, UserProfile
from hireflux_backend.infrastructure.dynamodb.cursor import CursorCodec
from hireflux_backend.infrastructure.dynamodb.mapping import (
    activity_from_item,
    activity_to_item,
    application_from_item,
    application_partition,
    application_sort_key,
    application_to_item,
    deserialize_item,
    format_timestamp,
    owner_applications_key,
    owner_status_key,
    parse_timestamp,
    profile_from_item,
    profile_to_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import GSI1_NAME, GSI2_NAME


class DynamoUserRepository:
    def __init__(self, client: Any, table_name: str) -> None:
        self._client = client
        self._table_name = table_name

    def get_or_create(self, identity: CurrentIdentity, *, now_iso: str) -> UserProfile:
        now = parse_timestamp(now_iso)
        proposed = UserProfile(
            user_id=identity.user_id,
            name=identity.name,
            email=identity.email,
            role=identity.role,
            created_at=now,
            last_login_at=now,
        )
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(profile_to_item(proposed)),
                ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
            )
            return proposed
        except ClientError as error:
            if _error_code(error) != "ConditionalCheckFailedException":
                raise PersistenceError("Unable to initialize the user profile.") from error

        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item({"PK": user_partition(identity.user_id), "SK": "PROFILE"}),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read the user profile.") from error
        item = response.get("Item")
        if item is None:
            raise PersistenceError("The user profile could not be initialized.")
        return profile_from_item(deserialize_item(item))


class DynamoApplicationRepository:
    def __init__(self, client: Any, table_name: str, cursor_codec: CursorCodec) -> None:
        self._client = client
        self._table_name = table_name
        self._cursor_codec = cursor_codec

    def create(self, application: Application, activity: Activity) -> None:
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(application_to_item(application)),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(activity_to_item(activity)),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    "The application could not be created because it already exists."
                ) from error
            raise PersistenceError("Unable to create the application.") from error

    def get(self, owner_user_id: str, application_id: str) -> Application | None:
        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item(
                    {
                        "PK": application_partition(owner_user_id, application_id),
                        "SK": "METADATA",
                    }
                ),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read the application.") from error
        item = response.get("Item")
        return application_from_item(deserialize_item(item)) if item else None

    def list(
        self,
        owner_user_id: str,
        *,
        status: ApplicationStatus | None,
        limit: int,
        cursor: str | None,
    ) -> ApplicationPage:
        scope = status.value if status else "ALL"
        index_name = GSI2_NAME if status else GSI1_NAME
        partition_name = "GSI2PK" if status else "GSI1PK"
        sort_name = "GSI2SK" if status else "GSI1SK"
        partition_value = (
            owner_status_key(owner_user_id, status)
            if status
            else owner_applications_key(owner_user_id)
        )
        arguments: dict[str, Any] = {
            "TableName": self._table_name,
            "IndexName": index_name,
            "KeyConditionExpression": f"{partition_name} = :partition",
            "ExpressionAttributeValues": serialize_item({":partition": partition_value}),
            "ScanIndexForward": False,
            "Limit": limit,
        }
        if cursor:
            position = self._cursor_codec.decode(
                cursor,
                kind="applications",
                owner_user_id=owner_user_id,
                scope=scope,
            )
            arguments["ExclusiveStartKey"] = serialize_item(
                {
                    "PK": application_partition(owner_user_id, position.item_id),
                    "SK": "METADATA",
                    partition_name: partition_value,
                    sort_name: application_sort_key(position.timestamp, position.item_id),
                }
            )

        try:
            response = self._client.query(**arguments)
        except ClientError as error:
            if cursor and _error_code(error) == "ValidationException":
                raise InvalidCursorError("The pagination cursor is no longer valid.") from error
            raise PersistenceError("Unable to list applications.") from error

        applications = tuple(
            application_from_item(deserialize_item(item)) for item in response.get("Items", [])
        )
        next_cursor: str | None = None
        if response.get("LastEvaluatedKey") and applications:
            last = applications[-1]
            next_cursor = self._cursor_codec.encode(
                kind="applications",
                owner_user_id=owner_user_id,
                scope=scope,
                timestamp=format_timestamp(last.updated_at),
                item_id=last.application_id,
            )
        return ApplicationPage(items=applications, next_cursor=next_cursor)

    def replace_details(self, application: Application, *, expected_version: int) -> None:
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(application_to_item(application)),
                ConditionExpression="attribute_exists(PK) AND #version = :expected_version",
                ExpressionAttributeNames={"#version": "version"},
                ExpressionAttributeValues=serialize_item({":expected_version": expected_version}),
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ConflictError(
                    "The application was changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError("Unable to update the application.") from error

    def replace_with_activity(
        self,
        application: Application,
        *,
        prior_status: ApplicationStatus,
        expected_version: int,
        activity: Activity,
    ) -> None:
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(application_to_item(application)),
                            "ConditionExpression": (
                                "attribute_exists(PK) AND #version = :expected_version "
                                "AND #status = :prior_status"
                            ),
                            "ExpressionAttributeNames": {
                                "#version": "version",
                                "#status": "status",
                            },
                            "ExpressionAttributeValues": serialize_item(
                                {
                                    ":expected_version": expected_version,
                                    ":prior_status": prior_status.value,
                                }
                            ),
                        }
                    },
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(activity_to_item(activity)),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    "The application was changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError("Unable to change the application status.") from error

    def list_activity(self, owner_user_id: str, application_id: str) -> tuple[Activity, ...]:
        arguments: dict[str, Any] = {
            "TableName": self._table_name,
            "KeyConditionExpression": "PK = :partition AND begins_with(SK, :prefix)",
            "ExpressionAttributeValues": serialize_item(
                {
                    ":partition": application_partition(owner_user_id, application_id),
                    ":prefix": "ACTIVITY#",
                }
            ),
            "ScanIndexForward": True,
        }
        activities: list[Activity] = []
        try:
            while True:
                response = self._client.query(**arguments)
                activities.extend(
                    activity_from_item(deserialize_item(item)) for item in response.get("Items", [])
                )
                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    break
                arguments["ExclusiveStartKey"] = last_key
        except ClientError as error:
            raise PersistenceError("Unable to list application activity.") from error
        return tuple(activities)


def _error_code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", ""))
