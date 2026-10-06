from collections.abc import Callable, Iterator
from dataclasses import replace
from datetime import UTC, datetime
from time import monotonic, sleep
from typing import Any
from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.errors import (
    PersistenceError,
    WorkspaceBootstrapConflictError,
    WorkspaceManifestIncompleteError,
)
from hireflux_backend.application.workspace_safety import (
    ExportRecord,
    require_active_workspace,
    require_complete_manifest,
)
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import DurableWorkspace, DurableWorkspaceState
from hireflux_backend.infrastructure.dynamodb.mapping import (
    activity_from_item,
    application_from_item,
    application_partition,
    deserialize_item,
    parse_timestamp,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.resource_mapping import (
    interview_from_item,
    note_from_item,
)
from hireflux_backend.infrastructure.dynamodb.workspace_bootstrap_repository import (
    workspace_to_item,
)


class DynamoWorkspaceSafetyRepository:
    def __init__(
        self,
        client: Any,
        table_name: str,
        *,
        max_items: int = 250,
        max_seconds: float = 2,
        max_applications: int = 500,
        clock: Callable[[], float] = monotonic,
        pause: Callable[[float], None] = sleep,
    ) -> None:
        self._client = client
        self._table_name = table_name
        self._max_items = max_items
        self._max_seconds = max_seconds
        self._max_applications = max_applications
        self._clock = clock
        self._pause = pause

    def _get(self, pk: str, sk: str) -> dict[str, Any] | None:
        response = self._client.get_item(
            TableName=self._table_name,
            Key=serialize_item({"PK": pk, "SK": sk}),
            ConsistentRead=True,
        )
        return deserialize_item(response["Item"]) if response.get("Item") else None

    def get_workspace(self, owner: str) -> DurableWorkspace | None:
        try:
            item = self._get(user_partition(owner), "WORKSPACE")
            if item is None:
                return None
            if (
                item.get("entity_type") != "DURABLE_WORKSPACE"
                or item.get("owner_user_id") != owner
                or "expires_at" in item
                or item.get("identity_kind") not in {"LOCAL", "PERSISTENT"}
            ):
                raise WorkspaceBootstrapConflictError("This workspace is incompatible.")
            return DurableWorkspace(
                owner,
                IdentityKind(item["identity_kind"]),
                DurableWorkspaceState(item["state"]),
                int(item["bootstrap_version"]),
                parse_timestamp(item["created_at"]),
                parse_timestamp(item["updated_at"]),
                int(item["application_manifest_version"])
                if "application_manifest_version" in item
                else None,
                parse_timestamp(item["deletion_started_at"])
                if "deletion_started_at" in item
                else None,
                parse_timestamp(item["deletion_completed_at"])
                if "deletion_completed_at" in item
                else None,
            )
        except (KeyError, TypeError, ValueError) as error:
            raise WorkspaceBootstrapConflictError("This workspace is incompatible.") from error
        except (ClientError, BotoCoreError) as error:
            raise PersistenceError("Unable to read workspace lifecycle.") from error

    def freeze(self, workspace: DurableWorkspace, now: datetime) -> DurableWorkspace:
        proposed = replace(
            workspace, state=DurableWorkspaceState.DELETING, deletion_started_at=now, updated_at=now
        )
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(workspace_to_item(proposed)),
                ConditionExpression="#state = :active AND application_manifest_version = :manifest "
                "AND identity_kind = :kind AND owner_user_id = :owner "
                "AND bootstrap_version = :version "
                "AND entity_type = :type AND attribute_not_exists(expires_at)",
                ExpressionAttributeNames={"#state": "state"},
                ExpressionAttributeValues=serialize_item(
                    {
                        ":active": "ACTIVE",
                        ":manifest": 1,
                        ":kind": workspace.identity_kind.value,
                        ":owner": workspace.owner_user_id,
                        ":version": 1,
                        ":type": "DURABLE_WORKSPACE",
                    }
                ),
            )
            return proposed
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                current = self.get_workspace(workspace.owner_user_id)
                if current and current.state in {
                    DurableWorkspaceState.DELETING,
                    DurableWorkspaceState.DELETED,
                }:
                    return current
            raise PersistenceError("Unable to freeze workspace erasure.") from error
        except BotoCoreError as error:
            raise PersistenceError("Unable to freeze workspace erasure.") from error

    def _page(
        self,
        pk: str,
        *,
        prefix: str | None = None,
        limit: int = 25,
        cursor: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        values = {":pk": pk}
        condition = "PK = :pk"
        if prefix is not None:
            values[":prefix"] = prefix
            condition += " AND begins_with(SK, :prefix)"
        arguments: dict[str, Any] = {
            "TableName": self._table_name,
            "KeyConditionExpression": condition,
            "ExpressionAttributeValues": serialize_item(values),
            "ConsistentRead": True,
            "Limit": limit,
        }
        if cursor:
            arguments["ExclusiveStartKey"] = cursor
        return self._client.query(**arguments)

    @staticmethod
    def ref_id(item: dict[str, Any], owner: str) -> str:
        try:
            application_id = str(item["application_id"])
            UUID(application_id)
            if (
                item["PK"] != user_partition(owner)
                or item["SK"] != f"APPLICATION_REF#{application_id}"
                or item.get("owner_user_id") != owner
                or item.get("entity_type") != "APPLICATION_REF"
                or "expires_at" in item
            ):
                raise ValueError
            return application_id
        except (KeyError, TypeError, ValueError) as error:
            raise WorkspaceManifestIncompleteError(
                "The application inventory requires operator verification."
            ) from error

    def references(
        self, owner: str, check_work: Callable[[], None] = lambda: None
    ) -> Iterator[dict[str, Any]]:
        cursor = None
        count = 0
        while True:
            check_work()
            response = self._page(user_partition(owner), prefix="APPLICATION_REF#", cursor=cursor)
            for raw in response.get("Items", []):
                item = deserialize_item(raw)
                self.ref_id(item, owner)
                count += 1
                if count > self._max_applications:
                    raise WorkspaceManifestIncompleteError(
                        "The application inventory exceeds workspace capacity."
                    )
                yield item
            cursor = response.get("LastEvaluatedKey")
            if not cursor:
                return

    def export_records(self, owner: str, check_work: Callable[[], None]) -> Iterator[ExportRecord]:
        try:
            workspace = self.get_workspace(owner)
            if workspace is None:
                raise WorkspaceManifestIncompleteError("The application inventory is unavailable.")
            require_active_workspace(workspace)
            require_complete_manifest(workspace)
            refs = list(self.references(owner, check_work))
            quota = self._get(user_partition(owner), "WORKSPACE_QUOTA")
            if len(refs) != int(quota.get("application_count", 0) if quota else 0):
                raise WorkspaceManifestIncompleteError(
                    "The application inventory requires operator verification."
                )
            for ref in refs:
                check_work()
                application_id = self.ref_id(ref, owner)
                partition = application_partition(owner, application_id)
                metadata = self._get(partition, "METADATA")
                if metadata is None:
                    raise WorkspaceManifestIncompleteError(
                        "An inventoried application is unavailable."
                    )
                cursor = None
                while True:
                    check_work()
                    page = self._page(partition, cursor=cursor)
                    for raw in page.get("Items", []):
                        item = deserialize_item(raw)
                        if (
                            item.get("owner_user_id", owner) != owner
                            or item.get("application_id", application_id) != application_id
                            or "expires_at" in item
                        ):
                            raise WorkspaceManifestIncompleteError(
                                "An inventoried application is incompatible."
                            )
                        parsers: dict[str, Callable[[dict[str, Any]], ExportRecord]] = {
                            "APPLICATION": application_from_item,
                            "ACTIVITY": activity_from_item,
                            "NOTE": note_from_item,
                            "INTERVIEW": interview_from_item,
                        }
                        parser = parsers.get(str(item.get("entity_type")))
                        if parser:
                            yield parser(item)
                    cursor = page.get("LastEvaluatedKey")
                    if not cursor:
                        break
            # Recheck after traversal to refuse erasure that started during export.
            current = self.get_workspace(owner)
            if current:
                require_active_workspace(current)
        except (ClientError, BotoCoreError) as error:
            raise PersistenceError("Unable to read the workspace export.") from error

    def erase(self, workspace: DurableWorkspace) -> DurableWorkspace:
        if workspace.state is DurableWorkspaceState.DELETED:
            return workspace
        if workspace.state is not DurableWorkspaceState.DELETING:
            raise WorkspaceBootstrapConflictError("Workspace erasure must be frozen first.")
        deadline = self._clock() + self._max_seconds
        remaining = self._max_items
        calls = self._max_items * 4 + 16
        owner = workspace.owner_user_id
        owner_pk = user_partition(owner)

        def delete_items(items: list[dict[str, Any]]) -> bool:
            nonlocal remaining, calls
            pending = [
                {"DeleteRequest": {"Key": {"PK": raw["PK"], "SK": raw["SK"]}}} for raw in items
            ]
            for attempt in range(4):
                if not pending:
                    return True
                if self._clock() >= deadline or len(pending) > remaining or calls <= 0:
                    return False
                remaining -= len(pending)
                calls -= 1
                result = self._client.batch_write_item(RequestItems={self._table_name: pending})
                pending = result.get("UnprocessedItems", {}).get(self._table_name, [])
                if pending and attempt < 3 and self._clock() + 0.025 * 2**attempt < deadline:
                    self._pause(0.025 * 2**attempt)
            if pending:
                raise PersistenceError("Some erasure writes remain unprocessed; retry is safe.")
            return True

        try:
            while remaining > 0 and calls > 0 and self._clock() < deadline:
                calls -= 1
                refs = self._page(owner_pk, prefix="APPLICATION_REF#", limit=1).get("Items", [])
                if refs:
                    ref = deserialize_item(refs[0])
                    application_id = self.ref_id(ref, owner)
                    partition = application_partition(owner, application_id)
                    calls -= 1
                    items = self._page(partition, limit=min(25, remaining)).get("Items", [])
                    if items:
                        if not delete_items(items):
                            return workspace
                        continue
                    # Strong empty partition proof precedes removing the progress reference.
                    self._client.delete_item(
                        TableName=self._table_name,
                        Key=serialize_item({"PK": owner_pk, "SK": ref["SK"]}),
                        ConditionExpression="attribute_not_exists(PK) OR application_id = :id",
                        ExpressionAttributeValues=serialize_item({":id": application_id}),
                    )
                    remaining -= 1
                    calls -= 1
                    continue
                calls -= 1
                owner_page = self._page(owner_pk, limit=min(25, remaining + 1))
                items = [
                    raw for raw in owner_page.get("Items", []) if raw["SK"] != {"S": "WORKSPACE"}
                ]
                if items:
                    if not delete_items(items[:remaining]):
                        return workspace
                    continue
                if owner_page.get("LastEvaluatedKey"):
                    # WORKSPACE is the only excluded key, so a page size >= 2 guarantees progress.
                    continue
                now = datetime.now(UTC)
                tombstone = replace(
                    workspace,
                    state=DurableWorkspaceState.DELETED,
                    application_manifest_version=None,
                    deletion_completed_at=now,
                    updated_at=now,
                )
                self._client.put_item(
                    TableName=self._table_name,
                    Item=serialize_item(workspace_to_item(tombstone)),
                    ConditionExpression="#state = :deleting AND owner_user_id = :owner",
                    ExpressionAttributeNames={"#state": "state"},
                    ExpressionAttributeValues=serialize_item(
                        {":deleting": "DELETING", ":owner": owner}
                    ),
                )
                return tombstone
            return workspace
        except ClientError as error:
            current = self.get_workspace(owner)
            if current and current.state is DurableWorkspaceState.DELETED:
                return current
            raise PersistenceError("Workspace erasure can be retried.") from error
        except BotoCoreError as error:
            raise PersistenceError("Workspace erasure can be retried.") from error
