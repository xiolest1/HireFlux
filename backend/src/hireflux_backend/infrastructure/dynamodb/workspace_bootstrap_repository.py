from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.errors import PersistenceError
from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import (
    BootstrapResult,
    DurableWorkspace,
    DurableWorkspaceState,
    WorkspaceSnapshot,
)
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    format_timestamp,
    owner_status_key,
    parse_timestamp,
    profile_from_item,
    profile_to_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.resource_mapping import (
    settings_from_item,
    settings_to_item,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import GSI2_NAME


def workspace_to_item(workspace: DurableWorkspace) -> dict[str, Any]:
    item: dict[str, Any] = {
        "PK": user_partition(workspace.owner_user_id),
        "SK": "WORKSPACE",
        "entity_type": "DURABLE_WORKSPACE",
        "owner_user_id": workspace.owner_user_id,
        "identity_kind": workspace.identity_kind.value,
        "state": workspace.state.value,
        "bootstrap_version": workspace.bootstrap_version,
        "created_at": format_timestamp(workspace.created_at),
        "updated_at": format_timestamp(workspace.updated_at),
    }
    if workspace.application_manifest_version is not None:
        item["application_manifest_version"] = workspace.application_manifest_version
    if workspace.deletion_started_at is not None:
        item["deletion_started_at"] = format_timestamp(workspace.deletion_started_at)
    if workspace.deletion_completed_at is not None:
        item["deletion_completed_at"] = format_timestamp(workspace.deletion_completed_at)
    return item


class DynamoWorkspaceBootstrapRepository:
    def __init__(self, client: Any, table_name: str) -> None:
        self._client = client
        self._table_name = table_name

    def _query(self, **arguments: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        try:
            while True:
                response = self._client.query(TableName=self._table_name, **arguments)
                items.extend(deserialize_item(item) for item in response.get("Items", []))
                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    return items
                arguments["ExclusiveStartKey"] = last_key
        except (ClientError, BotoCoreError) as error:
            raise PersistenceError("Unable to read workspace readiness.") from error

    def _owner_items(self, owner_user_id: str) -> list[dict[str, Any]]:
        return self._query(
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues=serialize_item({":pk": user_partition(owner_user_id)}),
            ConsistentRead=True,
        )

    def read(self, owner_user_id: str) -> WorkspaceSnapshot:
        items = self._owner_items(owner_user_id)
        if any(
            "expires_at" in item
            or item.get("owner_user_id", owner_user_id) != owner_user_id
            or item.get("user_id", owner_user_id) != owner_user_id
            for item in items
        ):
            return WorkspaceSnapshot(None, None, None, incompatible=True)
        by_key = {item["SK"]: item for item in items}
        try:
            profile_item = by_key.get("PROFILE")
            settings_item = by_key.get("SETTINGS")
            workspace_item = by_key.get("WORKSPACE")
            for item, expected_type in (
                (profile_item, "USER_PROFILE"),
                (settings_item, "WORKSPACE_SETTINGS"),
                (workspace_item, "DURABLE_WORKSPACE"),
            ):
                if item is not None and item.get("entity_type") != expected_type:
                    return WorkspaceSnapshot(None, None, None, incompatible=True)
            workspace = None
            if workspace_item is not None:
                workspace = DurableWorkspace(
                    owner_user_id=str(workspace_item["owner_user_id"]),
                    identity_kind=IdentityKind(workspace_item["identity_kind"]),
                    state=DurableWorkspaceState(workspace_item["state"]),
                    bootstrap_version=int(workspace_item["bootstrap_version"]),
                    created_at=parse_timestamp(workspace_item["created_at"]),
                    updated_at=parse_timestamp(workspace_item["updated_at"]),
                    application_manifest_version=(
                        int(workspace_item["application_manifest_version"])
                        if "application_manifest_version" in workspace_item
                        else None
                    ),
                    deletion_started_at=(
                        parse_timestamp(workspace_item["deletion_started_at"])
                        if "deletion_started_at" in workspace_item
                        else None
                    ),
                    deletion_completed_at=(
                        parse_timestamp(workspace_item["deletion_completed_at"])
                        if "deletion_completed_at" in workspace_item
                        else None
                    ),
                )
                if workspace.identity_kind is IdentityKind.DEMO:
                    return WorkspaceSnapshot(None, None, None, incompatible=True)
            return WorkspaceSnapshot(
                workspace,
                profile_from_item(profile_item) if profile_item else None,
                settings_from_item(settings_item) if settings_item else None,
                has_owner_data=bool(items),
            )
        except (KeyError, TypeError, ValueError, OverflowError):
            # Malformed or newer storage cannot silently become a fresh workspace.
            return WorkspaceSnapshot(None, None, None, incompatible=True)

    def legacy_data_is_durable(self, owner_user_id: str) -> bool:
        # Existing GSI discovery is sufficient for compatible local adoption;
        # it is not an exhaustive deletion manifest (reserved for Phase 2C).
        applications: list[dict[str, Any]] = []
        for status in ApplicationStatus:
            applications.extend(
                self._query(
                    IndexName=GSI2_NAME,
                    KeyConditionExpression="GSI2PK = :pk",
                    ExpressionAttributeValues=serialize_item(
                        {":pk": owner_status_key(owner_user_id, status)}
                    ),
                )
            )
        for application in applications:
            if application.get("owner_user_id") != owner_user_id or "expires_at" in application:
                return False
            application_id = application.get("application_id")
            if not isinstance(application_id, str):
                return False
            items = self._query(
                KeyConditionExpression="PK = :pk",
                ExpressionAttributeValues=serialize_item(
                    {":pk": application_partition(owner_user_id, application_id)}
                ),
                ConsistentRead=True,
            )
            if any(
                "expires_at" in item or item.get("owner_user_id", owner_user_id) != owner_user_id
                for item in items
            ):
                return False
        return True

    def _existing_condition(self, item: dict[str, Any]) -> dict[str, Any]:
        # Compare all modeled attributes instead of replacing existing preferences.
        attributes = {
            key: value
            for key, value in item.items()
            if key not in {"PK", "SK", "expires_at", "last_login_at"} and value is not None
        }
        names = {f"#f{index}": key for index, key in enumerate(attributes)}
        values = {f":v{index}": value for index, value in enumerate(attributes.values())}
        expression = " AND ".join(f"#f{index} = :v{index}" for index in range(len(attributes)))
        return {
            "TableName": self._table_name,
            "Key": serialize_item({"PK": item["PK"], "SK": item["SK"]}),
            "ConditionExpression": expression + " AND attribute_not_exists(expires_at)",
            "ExpressionAttributeNames": names,
            "ExpressionAttributeValues": serialize_item(values),
        }

    def commit(self, prior: WorkspaceSnapshot, proposed: BootstrapResult) -> bool:
        transactions: list[dict[str, Any]] = []
        for previous, item in (
            (prior.profile, profile_to_item(proposed.profile)),
            (prior.settings, settings_to_item(proposed.settings)),
        ):
            if previous is None:
                transactions.append(
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(item),
                            "ConditionExpression": "attribute_not_exists(PK)",
                        }
                    }
                )
            else:
                transactions.append({"ConditionCheck": self._existing_condition(item)})
        workspace_item = workspace_to_item(proposed.workspace)
        put: dict[str, Any] = {
            "TableName": self._table_name,
            "Item": serialize_item(workspace_item),
            "ConditionExpression": "attribute_not_exists(PK)",
        }
        if prior.workspace is not None:
            condition = self._existing_condition(workspace_to_item(prior.workspace))
            put.update({key: value for key, value in condition.items() if key != "Key"})
        transactions.append({"Put": put})
        if prior.workspace is None and proposed.workspace.application_manifest_version == 1:
            transactions.append(
                {
                    "ConditionCheck": {
                        "TableName": self._table_name,
                        "Key": serialize_item(
                            {
                                "PK": user_partition(proposed.workspace.owner_user_id),
                                "SK": "WORKSPACE_QUOTA",
                            }
                        ),
                        "ConditionExpression": "attribute_not_exists(PK)",
                    }
                }
            )
        try:
            self._client.transact_write_items(TransactItems=transactions)
            return True
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code in {"TransactionConflictException", "ConditionalCheckFailedException"}:
                return False
            if code == "TransactionCanceledException":
                reasons = error.response.get("CancellationReasons", [])
                if reasons and all(
                    reason.get("Code")
                    in {
                        "None",
                        "ConditionalCheckFailed",
                        "TransactionConflict",
                    }
                    for reason in reasons
                ):
                    return False
            raise PersistenceError("Unable to initialize the workspace.") from error
        except BotoCoreError as error:
            raise PersistenceError("Unable to initialize the workspace.") from error
