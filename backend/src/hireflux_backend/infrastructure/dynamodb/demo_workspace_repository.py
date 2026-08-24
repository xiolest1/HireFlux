import hashlib
import time
from datetime import UTC, datetime
from typing import Any

from botocore.exceptions import ClientError

from hireflux_backend.application.errors import (
    ConflictError,
    DemoProvisioningInProgressError,
    PersistenceError,
)
from hireflux_backend.application.ports import DemoWorkspaceReservation
from hireflux_backend.domain.enums import ApplicationStatus, DemoWorkspaceState
from hireflux_backend.domain.models import DemoWorkspace
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    format_timestamp,
    parse_timestamp,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import GSI2_NAME

_WORKSPACE_SK = "WORKSPACE"
_IDEMPOTENCY_SK = "SESSION"
_IDEMPOTENCY_PREFIX = "DEMO_IDEMPOTENCY#"
_BATCH_SIZE = 25
_MAX_BATCH_RETRIES = 5


class DynamoDemoWorkspaceRepository:
    def __init__(self, client: Any, table_name: str) -> None:
        self._client = client
        self._table_name = table_name

    def reserve(
        self,
        workspace_id: str,
        *,
        issued_at: datetime,
        expires_at: int,
        idempotency_key: str | None,
    ) -> DemoWorkspaceReservation:
        idempotency_hash = _hash_idempotency_key(idempotency_key)
        workspace = DemoWorkspace(
            workspace_id=workspace_id,
            state=DemoWorkspaceState.PROVISIONING,
            issued_at=issued_at,
            updated_at=issued_at,
            expires_at=expires_at,
            idempotency_key_hash=idempotency_hash,
        )
        workspace_item = _workspace_to_item(workspace)

        try:
            if idempotency_hash is None:
                self._client.put_item(
                    TableName=self._table_name,
                    Item=serialize_item(workspace_item),
                    ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
                )
            else:
                self._client.transact_write_items(
                    TransactItems=[
                        {
                            "Put": {
                                "TableName": self._table_name,
                                "Item": serialize_item(workspace_item),
                                "ConditionExpression": (
                                    "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                                ),
                            }
                        },
                        {
                            "Put": {
                                "TableName": self._table_name,
                                "Item": serialize_item(
                                    _idempotency_to_item(
                                        idempotency_hash,
                                        workspace,
                                    )
                                ),
                                "ConditionExpression": (
                                    "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                                ),
                            }
                        },
                    ]
                )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException" and idempotency_hash:
                return self._existing_reservation(idempotency_hash)
            if _error_code(error) == "ConditionalCheckFailedException":
                raise PersistenceError("Unable to reserve the demo workspace.") from error
            raise PersistenceError("Unable to reserve the demo workspace.") from error
        return DemoWorkspaceReservation(workspace=workspace, is_new=True)

    def mark_ready(self, workspace: DemoWorkspace) -> None:
        self._update_state(workspace, DemoWorkspaceState.READY, workspace.expires_at)

    def mark_failed(self, workspace: DemoWorkspace, *, expires_at: int) -> None:
        self._update_state(workspace, DemoWorkspaceState.FAILED, expires_at)

    def cleanup(self, workspace_id: str, *, application_ids: tuple[str, ...] = ()) -> None:
        keys = self._query_partition_keys(user_partition(workspace_id))
        application_ids_to_delete = set(application_ids)
        application_ids_to_delete.update(self._query_application_ids(workspace_id))

        for application_id in application_ids_to_delete:
            keys.extend(
                self._query_partition_keys(application_partition(workspace_id, application_id))
            )

        workspace_key = {"PK": user_partition(workspace_id), "SK": _WORKSPACE_SK}
        self._delete_keys([key for key in keys if key != workspace_key])

    def _existing_reservation(self, idempotency_hash: str) -> DemoWorkspaceReservation:
        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item(_idempotency_key(idempotency_hash)),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read the demo idempotency record.") from error
        item = response.get("Item")
        if item is None:
            raise PersistenceError("The demo idempotency record could not be read.")
        record = deserialize_item(item)
        workspace_id = str(record["workspace_id"])
        workspace = self._get_workspace(workspace_id)
        if workspace is None:
            raise PersistenceError("The demo workspace lifecycle record is missing.")
        if workspace.state is DemoWorkspaceState.PROVISIONING:
            raise DemoProvisioningInProgressError(
                "Demo workspace provisioning is still in progress. Retry with the same "
                "Idempotency-Key."
            )
        if workspace.state is DemoWorkspaceState.FAILED:
            raise ConflictError(
                "The previous demo workspace provisioning attempt failed. Retry with a new "
                "Idempotency-Key."
            )
        if workspace.expires_at <= int(datetime.now(UTC).timestamp()):
            raise ConflictError("The demo workspace has expired. Retry with a new Idempotency-Key.")
        return DemoWorkspaceReservation(workspace=workspace, is_new=False)

    def _get_workspace(self, workspace_id: str) -> DemoWorkspace | None:
        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item(_workspace_key(workspace_id)),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read the demo workspace lifecycle record.") from error
        item = response.get("Item")
        return _workspace_from_item(deserialize_item(item)) if item else None

    def _update_state(
        self,
        workspace: DemoWorkspace,
        state: DemoWorkspaceState,
        expires_at: int,
    ) -> None:
        now = datetime.now(UTC)
        update = {
            "Update": {
                "TableName": self._table_name,
                "Key": serialize_item(_workspace_key(workspace.workspace_id)),
                "UpdateExpression": (
                    "SET #state = :state, updated_at = :updated_at, expires_at = :expires_at"
                ),
                "ConditionExpression": "#state = :provisioning",
                "ExpressionAttributeNames": {"#state": "state"},
                "ExpressionAttributeValues": serialize_item(
                    {
                        ":state": state.value,
                        ":provisioning": DemoWorkspaceState.PROVISIONING.value,
                        ":updated_at": format_timestamp(now),
                        ":expires_at": expires_at,
                    }
                ),
            }
        }
        transactions = [update]
        if workspace.idempotency_key_hash:
            transactions.append(
                {
                    "Update": {
                        "TableName": self._table_name,
                        "Key": serialize_item(_idempotency_key(workspace.idempotency_key_hash)),
                        "UpdateExpression": (
                            "SET #state = :state, updated_at = :updated_at, "
                            "expires_at = :expires_at"
                        ),
                        "ConditionExpression": "#state = :provisioning",
                        "ExpressionAttributeNames": {"#state": "state"},
                        "ExpressionAttributeValues": serialize_item(
                            {
                                ":state": state.value,
                                ":provisioning": DemoWorkspaceState.PROVISIONING.value,
                                ":updated_at": format_timestamp(now),
                                ":expires_at": expires_at,
                            }
                        ),
                    }
                }
            )
        try:
            self._client.transact_write_items(TransactItems=transactions)
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError("The demo workspace provisioning state changed.") from error
            raise PersistenceError("Unable to update the demo workspace state.") from error

    def _query_application_ids(self, workspace_id: str) -> set[str]:
        application_ids: set[str] = set()
        for status in ApplicationStatus:
            for item in self._query_index(
                "GSI2PK = :partition",
                {":partition": f"USER#{workspace_id}#STATUS#{status.value}"},
            ):
                decoded = deserialize_item(item)
                if decoded.get("entity_type") == "APPLICATION":
                    application_ids.add(str(decoded["application_id"]))
        return application_ids

    def _query_partition_keys(self, partition: str) -> list[dict[str, str]]:
        return [
            {"PK": str(item["PK"]["S"]), "SK": str(item["SK"]["S"])}
            for item in self._query_base(
                "PK = :partition",
                {":partition": partition},
            )
        ]

    def _query_index(
        self,
        condition_expression: str,
        expression_values: dict[str, object],
    ) -> list[dict[str, Any]]:
        return self._query(
            {
                "IndexName": GSI2_NAME,
                "KeyConditionExpression": condition_expression,
                "ExpressionAttributeValues": serialize_item(expression_values),
            }
        )

    def _query_base(
        self,
        condition_expression: str,
        expression_values: dict[str, object],
    ) -> list[dict[str, Any]]:
        return self._query(
            {
                "KeyConditionExpression": condition_expression,
                "ExpressionAttributeValues": serialize_item(expression_values),
            }
        )

    def _query(self, arguments: dict[str, Any]) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        exclusive_start_key: dict[str, Any] | None = None
        while True:
            request = {"TableName": self._table_name, **arguments}
            if exclusive_start_key:
                request["ExclusiveStartKey"] = exclusive_start_key
            try:
                response = self._client.query(**request)
            except ClientError as error:
                raise PersistenceError(
                    "Unable to inspect the demo workspace for cleanup."
                ) from error
            items.extend(response.get("Items", []))
            exclusive_start_key = response.get("LastEvaluatedKey")
            if not exclusive_start_key:
                return items

    def _delete_keys(self, keys: list[dict[str, str]]) -> None:
        for start in range(0, len(keys), _BATCH_SIZE):
            pending = [
                {"DeleteRequest": {"Key": serialize_item(key)}}
                for key in keys[start : start + _BATCH_SIZE]
            ]
            for attempt in range(_MAX_BATCH_RETRIES):
                try:
                    response = self._client.batch_write_item(
                        RequestItems={self._table_name: pending}
                    )
                except ClientError as error:
                    raise PersistenceError(
                        "Unable to clean up the failed demo workspace."
                    ) from error
                pending = response.get("UnprocessedItems", {}).get(self._table_name, [])
                if not pending:
                    break
                if attempt < _MAX_BATCH_RETRIES - 1:
                    time.sleep(0.05 * (attempt + 1))
            if pending:
                raise PersistenceError("Unable to complete failed demo workspace cleanup.")


def _workspace_key(workspace_id: str) -> dict[str, str]:
    return {"PK": user_partition(workspace_id), "SK": _WORKSPACE_SK}


def _idempotency_key(idempotency_hash: str) -> dict[str, str]:
    return {"PK": f"{_IDEMPOTENCY_PREFIX}{idempotency_hash}", "SK": _IDEMPOTENCY_SK}


def _hash_idempotency_key(idempotency_key: str | None) -> str | None:
    if idempotency_key is None:
        return None
    return hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()


def _workspace_to_item(workspace: DemoWorkspace) -> dict[str, object]:
    return {
        **_workspace_key(workspace.workspace_id),
        "entity_type": "DEMO_WORKSPACE",
        "workspace_id": workspace.workspace_id,
        "state": workspace.state.value,
        "issued_at": format_timestamp(workspace.issued_at),
        "updated_at": format_timestamp(workspace.updated_at),
        "expires_at": workspace.expires_at,
        "idempotency_key_hash": workspace.idempotency_key_hash,
    }


def _workspace_from_item(item: dict[str, Any]) -> DemoWorkspace:
    return DemoWorkspace(
        workspace_id=str(item["workspace_id"]),
        state=DemoWorkspaceState(str(item["state"])),
        issued_at=parse_timestamp(str(item["issued_at"])),
        updated_at=parse_timestamp(str(item["updated_at"])),
        expires_at=int(item["expires_at"]),
        idempotency_key_hash=(
            str(item["idempotency_key_hash"]) if item.get("idempotency_key_hash") else None
        ),
    )


def _idempotency_to_item(
    idempotency_hash: str,
    workspace: DemoWorkspace,
) -> dict[str, object]:
    return {
        **_idempotency_key(idempotency_hash),
        "entity_type": "DEMO_IDEMPOTENCY",
        "workspace_id": workspace.workspace_id,
        "state": workspace.state.value,
        "updated_at": format_timestamp(workspace.updated_at),
        "expires_at": workspace.expires_at,
    }


def _error_code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", ""))
