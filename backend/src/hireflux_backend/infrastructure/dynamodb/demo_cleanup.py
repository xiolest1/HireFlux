"""Conservative cleanup of a proved failed temporary reservation.

Inventory discovery is deliberately incomplete: GSI lag and bounded work can leave
temporary remnants for TTL. Neither a key prefix nor a prior read authorizes an
unconditional delete from a table that also contains durable account data.
"""

from decimal import Decimal
from time import monotonic
from typing import Any, TypeGuard

from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.errors import PersistenceError
from hireflux_backend.domain.enums import ApplicationStatus, DemoWorkspaceState
from hireflux_backend.domain.models import DemoWorkspace
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    format_timestamp,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import GSI2_NAME

_MAX_QUERY_CALLS = 64
_MAX_INVENTORY_ITEMS = 500
_MAX_APPLICATIONS = 30
_MAX_DELETIONS = 250
_MAX_CLEANUP_SECONDS = 3
_DURABLE_MARKERS = (
    "identity_kind",
    "bootstrap_version",
    "application_manifest_version",
    "deletion_started_at",
    "deletion_completed_at",
    "provider_finalization",
    "provider_finalized_at",
)
_OWNERSHIP_MARKERS = ("owner_user_id", "user_id", "reservation_id", "data_expires_at")
_APPLICATION_ENTITIES = {"APPLICATION", "ACTIVITY", "NOTE", "INTERVIEW", "WORKSPACE_CONTEXT"}


def cleanup_failed_demo(
    client: Any,
    table_name: str,
    workspace: DemoWorkspace,
    *,
    application_ids: tuple[str, ...] = (),
) -> None:
    """Delete only unchanged, owned temporary items under the exact FAILED marker.

    ``workspace`` is the original reservation object, before its failure-marker
    TTL was shortened. Legacy markers without immutable data expiry are retained.
    One transaction per item keeps both action count and aggregate item size far
    below DynamoDB transaction limits. Failure never widens the deletion criteria.
    """
    if workspace.state is not DemoWorkspaceState.PROVISIONING:
        raise PersistenceError("Failed demo cleanup requires its original reservation.")
    inspector = _Cleanup(client, table_name, workspace)
    marker = inspector.marker()
    candidates = inspector.inventory(application_ids)
    eligible = [item for item in candidates if _temporary_item(item, workspace)]
    for item in eligible[:_MAX_DELETIONS]:
        inspector.delete(marker, item)
    if len(eligible) > _MAX_DELETIONS:
        raise PersistenceError("Failed demo cleanup reached its bounded work limit.")


class _Cleanup:
    def __init__(self, client: Any, table_name: str, workspace: DemoWorkspace) -> None:
        self.client = client
        self.table_name = table_name
        self.workspace = workspace
        self.query_calls = 0
        self.inventory_items = 0
        self.deadline = monotonic() + _MAX_CLEANUP_SECONDS

    def assert_within_deadline(self) -> None:
        # A request already in flight is still bounded by the client's timeout.
        # Never start more cleanup I/O once this short best-effort budget expires.
        if monotonic() >= self.deadline:
            raise PersistenceError("Failed demo cleanup reached its bounded work limit.")

    def marker(self) -> dict[str, Any]:
        self.assert_within_deadline()
        try:
            response = self.client.get_item(
                TableName=self.table_name,
                Key=serialize_item(
                    {"PK": user_partition(self.workspace.workspace_id), "SK": "WORKSPACE"}
                ),
                ConsistentRead=True,
            )
            marker = deserialize_item(response.get("Item", {}))
            valid = (
                marker.get("PK") == user_partition(self.workspace.workspace_id)
                and marker.get("SK") == "WORKSPACE"
                and marker.get("entity_type") == "DEMO_WORKSPACE"
                and marker.get("workspace_id") == self.workspace.workspace_id
                and self.workspace.reservation_id is not None
                and marker.get("reservation_id") == self.workspace.reservation_id
                and marker.get("state") == DemoWorkspaceState.FAILED.value
                and marker.get("issued_at") == format_timestamp(self.workspace.issued_at)
                and marker.get("idempotency_key_hash") == self.workspace.idempotency_key_hash
                and _positive_integer(marker.get("expires_at"))
                and _positive_integer(marker.get("data_expires_at"))
                and marker["data_expires_at"] == self.workspace.expires_at
                and not any(name in marker for name in _DURABLE_MARKERS)
                and "owner_user_id" not in marker
                and "user_id" not in marker
            )
        except (ClientError, BotoCoreError, KeyError, TypeError, ValueError) as error:
            raise PersistenceError("Unable to establish failed demo cleanup ownership.") from error
        if not valid:
            raise PersistenceError("Failed demo cleanup ownership could not be established.")
        return marker

    def inventory(self, application_ids: tuple[str, ...]) -> list[dict[str, Any]]:
        user_items = self.query(partition=user_partition(self.workspace.workspace_id))
        discovered = set(application_ids)
        if any(not _identifier(value) for value in discovered):
            raise PersistenceError("Invalid failed demo cleanup inventory.")
        # A GSI is only a source of candidate IDs. Every deletion uses an owned
        # primary-table snapshot and a write-time condition, never the GSI copy.
        for status in ApplicationStatus:
            for item in self.query(
                partition=f"USER#{self.workspace.workspace_id}#STATUS#{status.value}",
                index=GSI2_NAME,
            ):
                if (
                    item.get("entity_type") == "APPLICATION"
                    and item.get("owner_user_id") == self.workspace.workspace_id
                    and _identifier(item.get("application_id"))
                ):
                    discovered.add(item["application_id"])
        if len(discovered) > _MAX_APPLICATIONS:
            raise PersistenceError("Failed demo cleanup reached its bounded work limit.")
        items = list(user_items)
        for application_id in sorted(discovered):
            items.extend(
                self.query(
                    partition=application_partition(self.workspace.workspace_id, application_id)
                )
            )
        return items

    def query(self, *, partition: str, index: str | None = None) -> list[dict[str, Any]]:
        arguments: dict[str, Any] = {
            "TableName": self.table_name,
            "KeyConditionExpression": "#pk = :pk",
            "ExpressionAttributeNames": {"#pk": "GSI2PK" if index else "PK"},
            "ExpressionAttributeValues": serialize_item({":pk": partition}),
            "Limit": 100,
        }
        if index:
            arguments["IndexName"] = index
        else:
            arguments["ConsistentRead"] = True
        items: list[dict[str, Any]] = []
        while True:
            self.assert_within_deadline()
            if self.query_calls >= _MAX_QUERY_CALLS:
                raise PersistenceError("Failed demo cleanup reached its bounded work limit.")
            self.query_calls += 1
            try:
                response = self.client.query(**arguments)
                batch = response["Items"]
                self.inventory_items += len(batch)
                if self.inventory_items > _MAX_INVENTORY_ITEMS:
                    raise PersistenceError("Failed demo cleanup reached its bounded work limit.")
                items.extend(deserialize_item(item) for item in batch)
                last_key = response.get("LastEvaluatedKey")
            except (ClientError, BotoCoreError, KeyError, TypeError, ValueError) as error:
                raise PersistenceError(
                    "Unable to inspect failed demo cleanup inventory."
                ) from error
            if not last_key:
                return items
            arguments["ExclusiveStartKey"] = last_key

    def delete(self, marker: dict[str, Any], item: dict[str, Any]) -> None:
        self.assert_within_deadline()
        try:
            self.client.transact_write_items(
                TransactItems=[
                    {"ConditionCheck": {"TableName": self.table_name, **_unchanged(marker)}},
                    {"Delete": {"TableName": self.table_name, **_unchanged(item)}},
                ]
            )
        except (ClientError, BotoCoreError) as error:
            raise PersistenceError("Unable to safely complete failed demo cleanup.") from error


def _positive_integer(value: object) -> bool:
    if isinstance(value, bool) or not isinstance(value, int | Decimal):
        return False
    if isinstance(value, Decimal) and not value.is_finite():
        return False
    return value > 0 and value == int(value)


def _identifier(value: object) -> TypeGuard[str]:
    return isinstance(value, str) and 0 < len(value) <= 128 and "#" not in value


def _temporary_item(item: dict[str, Any], workspace: DemoWorkspace) -> bool:
    if (
        not _positive_integer(item.get("expires_at"))
        or item["expires_at"] != workspace.expires_at
        or any(name in item for name in _DURABLE_MARKERS)
        or ("reservation_id" in item and item["reservation_id"] != workspace.reservation_id)
        or ("data_expires_at" in item and item["data_expires_at"] != workspace.expires_at)
        or ("user_id" in item and item["user_id"] != workspace.workspace_id)
        or ("owner_user_id" in item and item["owner_user_id"] != workspace.workspace_id)
    ):
        return False
    owner = workspace.workspace_id
    kind = item.get("entity_type")
    if not isinstance(kind, str):
        return False
    if kind == "USER_PROFILE":
        return (
            item.get("PK") == user_partition(owner)
            and item.get("SK") == "PROFILE"
            and item.get("user_id") == owner
        )
    if kind == "WORKSPACE_SETTINGS":
        return (
            item.get("PK") == user_partition(owner)
            and item.get("SK") == "SETTINGS"
            and item.get("owner_user_id") == owner
        )
    if kind not in _APPLICATION_ENTITIES or item.get("owner_user_id") != owner:
        return False
    application_id = item.get("application_id")
    if not _identifier(application_id) or item.get("PK") != application_partition(
        owner, application_id
    ):
        return False
    if kind == "APPLICATION":
        return item.get("SK") == "METADATA"
    if kind == "WORKSPACE_CONTEXT":
        return item.get("SK") == "WORKSPACE_CONTEXT"
    if kind == "ACTIVITY":
        return item.get("SK") == f"ACTIVITY#{item.get('created_at')}#{item.get('activity_id')}"
    identifier = item.get("note_id" if kind == "NOTE" else "interview_id")
    return _identifier(identifier) and item.get("SK") == f"{kind}#{identifier}"


def _unchanged(item: dict[str, Any]) -> dict[str, Any]:
    # Every observed attribute is compared; absent durable lifecycle attributes
    # must stay absent. Legitimate mutable records also carry version/updated_at.
    names: dict[str, str] = {}
    values: dict[str, Any] = {}
    conditions: list[str] = []
    for index, (name, value) in enumerate(item.items()):
        if name in {"PK", "SK"}:
            continue
        alias, placeholder = f"#a{index}", f":v{index}"
        names[alias] = name
        values[placeholder] = value
        conditions.append(f"{alias} = {placeholder}")
    for index, name in enumerate((*_DURABLE_MARKERS, *_OWNERSHIP_MARKERS)):
        if name not in item:
            alias = f"#d{index}"
            names[alias] = name
            conditions.append(f"attribute_not_exists({alias})")
    return {
        "Key": serialize_item({"PK": item["PK"], "SK": item["SK"]}),
        "ConditionExpression": " AND ".join(conditions),
        "ExpressionAttributeNames": names,
        "ExpressionAttributeValues": serialize_item(values),
    }
