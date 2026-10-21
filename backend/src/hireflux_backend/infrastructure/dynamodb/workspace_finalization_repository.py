"""Conditional terminal tombstone progress, without retaining provider credentials."""

from datetime import UTC, datetime
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.errors import PersistenceError, WorkspaceBootstrapConflictError
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import (
    DurableWorkspace,
    DurableWorkspaceState,
    ProviderFinalizationState,
)
from hireflux_backend.infrastructure.dynamodb.mapping import (
    format_timestamp,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.workspace_safety_repository import (
    DynamoWorkspaceSafetyRepository,
)


class DynamoFinalizationRepository:
    def __init__(self, client: Any, table_name: str) -> None:
        self.client = client
        self.table = table_name
        self.safety = DynamoWorkspaceSafetyRepository(client, table_name)

    def read(self, owner: str) -> DurableWorkspace:
        workspace = self.safety.get_workspace(owner)
        if (
            workspace is None
            or workspace.state is not DurableWorkspaceState.DELETED
            or workspace.identity_kind is not IdentityKind.PERSISTENT
            or workspace.bootstrap_version != 1
            or workspace.deletion_started_at is None
            or workspace.deletion_completed_at is None
        ):
            raise WorkspaceBootstrapConflictError("Terminal account erasure could not be verified.")
        if (workspace.provider_finalization is ProviderFinalizationState.COMPLETE) != (
            workspace.provider_finalized_at is not None
        ):
            raise WorkspaceBootstrapConflictError("Provider finalization requires operator review.")
        return workspace

    def _change(
        self,
        workspace: DurableWorkspace,
        before: ProviderFinalizationState | None,
        after: ProviderFinalizationState,
    ) -> bool:
        if (
            workspace.identity_kind is not IdentityKind.PERSISTENT
            or workspace.state is not DurableWorkspaceState.DELETED
            or workspace.deletion_completed_at is None
        ):
            raise WorkspaceBootstrapConflictError("Terminal account erasure is required.")
        values: dict[str, Any] = {
            ":owner": workspace.owner_user_id,
            ":kind": "PERSISTENT",
            ":type": "DURABLE_WORKSPACE",
            ":version": 1,
            ":deleted": "DELETED",
            ":completed": format_timestamp(workspace.deletion_completed_at),
            ":after": after.value,
        }
        condition = (
            "owner_user_id = :owner AND identity_kind = :kind AND entity_type = :type "
            "AND bootstrap_version = :version AND #state = :deleted "
            "AND deletion_completed_at = :completed AND attribute_not_exists(expires_at) "
            "AND attribute_not_exists(provider_finalized_at) AND "
        )
        condition += (
            "attribute_not_exists(provider_finalization)"
            if before is None
            else "provider_finalization = :before"
        )
        if before is not None:
            values[":before"] = before.value
        update = "SET provider_finalization = :after"
        if after is ProviderFinalizationState.COMPLETE:
            values[":now"] = format_timestamp(datetime.now(UTC))
            update += ", provider_finalized_at = :now"
        try:
            self.client.update_item(
                TableName=self.table,
                Key=serialize_item(
                    {"PK": user_partition(workspace.owner_user_id), "SK": "WORKSPACE"}
                ),
                UpdateExpression=update,
                ConditionExpression=condition,
                ExpressionAttributeNames={"#state": "state"},
                ExpressionAttributeValues=serialize_item(values),
            )
            return True
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                return False
            raise PersistenceError("Unable to record account finalization.") from None
        except BotoCoreError:
            raise PersistenceError("Unable to record account finalization.") from None

    def prepare(self, workspace: DurableWorkspace) -> DurableWorkspace:
        current = self.read(workspace.owner_user_id)
        if current.provider_finalization is None:
            self._change(current, None, ProviderFinalizationState.PENDING)
        return self.read(workspace.owner_user_id)

    def arm(self, workspace: DurableWorkspace) -> bool:
        return self._change(
            workspace, ProviderFinalizationState.PENDING, ProviderFinalizationState.REVIEW_REQUIRED
        )

    def complete(self, workspace: DurableWorkspace) -> DurableWorkspace:
        self._change(
            workspace, ProviderFinalizationState.REVIEW_REQUIRED, ProviderFinalizationState.COMPLETE
        )
        return self.read(workspace.owner_user_id)

    def rejected(self, workspace: DurableWorkspace) -> DurableWorkspace:
        self._change(
            workspace, ProviderFinalizationState.REVIEW_REQUIRED, ProviderFinalizationState.PENDING
        )
        return self.read(workspace.owner_user_id)

    def reconcile_absent(self, workspace: DurableWorkspace) -> DurableWorkspace:
        """Operator-only port after independently established canonical-user absence."""
        current = self.read(workspace.owner_user_id)
        if current.provider_finalization in {
            ProviderFinalizationState.PENDING,
            ProviderFinalizationState.REVIEW_REQUIRED,
        }:
            self._change(current, current.provider_finalization, ProviderFinalizationState.COMPLETE)
        return self.read(workspace.owner_user_id)
