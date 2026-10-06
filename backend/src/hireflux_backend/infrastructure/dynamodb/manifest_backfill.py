"""Explicit local operator adoption; quota evidence is required before completeness."""

from typing import Any
from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.errors import PersistenceError, WorkspaceManifestIncompleteError
from hireflux_backend.application.workspace_safety import require_active_workspace
from hireflux_backend.config import Settings
from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.infrastructure.dynamodb.client import build_dynamodb_client
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    owner_status_key,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import (
    GSI2_NAME,
    UnsafeTableTargetError,
    assert_safe_local_target,
)
from hireflux_backend.infrastructure.dynamodb.workspace_guard import (
    active_condition,
    application_ref,
    guarded_transact,
)
from hireflux_backend.infrastructure.dynamodb.workspace_safety_repository import (
    DynamoWorkspaceSafetyRepository,
)


def backfill_local_manifest(
    settings: Settings, *, confirmation: str, owner: str, client: Any | None = None
) -> int:
    assert_safe_local_target(settings)
    if confirmation != settings.dynamodb_table_name:
        raise UnsafeTableTargetError("Manifest backfill confirmation must match the local table.")
    UUID(owner)
    dynamodb = client or build_dynamodb_client(settings)
    table = settings.dynamodb_table_name
    safety = DynamoWorkspaceSafetyRepository(
        dynamodb, table, max_applications=settings.max_applications_per_workspace
    )
    workspace = safety.get_workspace(owner)
    if workspace is None or workspace.identity_kind is not IdentityKind.LOCAL:
        raise WorkspaceManifestIncompleteError(
            "Only an initialized LOCAL workspace can be adopted."
        )
    require_active_workspace(workspace)
    if workspace.bootstrap_version != 1 or workspace.application_manifest_version not in {None, 1}:
        raise WorkspaceManifestIncompleteError("The workspace schema is incompatible.")
    try:
        # Validate owner records too; never remove TTL or repair provenance implicitly.
        cursor = None
        owner_items: list[dict[str, Any]] = []
        while True:
            page = safety._page(user_partition(owner), cursor=cursor)
            owner_items.extend(deserialize_item(raw) for raw in page.get("Items", []))
            if len(owner_items) > settings.max_applications_per_workspace + 32:
                raise WorkspaceManifestIncompleteError(
                    "Owner inventory exceeds the adoption bound."
                )
            cursor = page.get("LastEvaluatedKey")
            if not cursor:
                break
        if any(
            "expires_at" in item
            or item.get("owner_user_id", owner) != owner
            or item.get("user_id", owner) != owner
            for item in owner_items
        ):
            raise WorkspaceManifestIncompleteError("Existing owner data is incompatible.")
        quota = next((item for item in owner_items if item["SK"] == "WORKSPACE_QUOTA"), None)
        count = int(quota.get("application_count", 0) if quota else 0)
        if count < 0 or count > settings.max_applications_per_workspace:
            raise WorkspaceManifestIncompleteError("Application quota evidence is incompatible.")
        discovered: set[str] = set()
        discovery_pages = 0
        for status in ApplicationStatus:
            cursor = None
            while True:
                discovery_pages += 1
                if (
                    discovery_pages
                    > settings.max_applications_per_workspace * len(ApplicationStatus) + 16
                ):
                    raise WorkspaceManifestIncompleteError(
                        "Legacy discovery exceeded its work bound."
                    )
                arguments: dict[str, Any] = {
                    "TableName": table,
                    "IndexName": GSI2_NAME,
                    "KeyConditionExpression": "GSI2PK = :pk",
                    "ExpressionAttributeValues": serialize_item(
                        {":pk": owner_status_key(owner, status)}
                    ),
                    "Limit": 25,
                }
                if cursor:
                    arguments["ExclusiveStartKey"] = cursor
                page = dynamodb.query(**arguments)
                for raw in page.get("Items", []):
                    projected = deserialize_item(raw)
                    application_id = str(projected["application_id"])
                    UUID(application_id)
                    if projected.get("owner_user_id") != owner or "expires_at" in projected:
                        raise WorkspaceManifestIncompleteError("Legacy discovery is incompatible.")
                    discovered.add(application_id)
                    if len(discovered) > count:
                        raise WorkspaceManifestIncompleteError(
                            "Discovery exceeds lifetime quota evidence."
                        )
                cursor = page.get("LastEvaluatedKey")
                if not cursor:
                    break
        if len(discovered) != count:
            raise WorkspaceManifestIncompleteError(
                "Discovered applications do not match lifetime quota evidence."
            )
        existing_refs = {safety.ref_id(ref, owner): ref for ref in safety.references(owner)}
        if not existing_refs.keys() <= discovered:
            raise WorkspaceManifestIncompleteError("The manifest contains an orphan reference.")
        for application_id in discovered:
            partition = application_partition(owner, application_id)
            cursor = None
            item_count = 0
            metadata = None
            while True:
                page = safety._page(partition, cursor=cursor)
                for raw in page.get("Items", []):
                    item = deserialize_item(raw)
                    item_count += 1
                    if (
                        item_count
                        > settings.max_activity_per_application
                        + settings.max_notes_per_application
                        + settings.max_interviews_per_application
                        + 8
                        or "expires_at" in item
                        or item.get("owner_user_id", owner) != owner
                        or item.get("application_id", application_id) != application_id
                    ):
                        raise WorkspaceManifestIncompleteError(
                            "Canonical application data is incompatible."
                        )
                    if item["SK"] == "METADATA":
                        metadata = item
                cursor = page.get("LastEvaluatedKey")
                if not cursor:
                    break
            if (
                metadata is None
                or metadata.get("entity_type") != "APPLICATION"
                or metadata.get("owner_user_id") != owner
            ):
                raise WorkspaceManifestIncompleteError(
                    "A discovered canonical application is missing."
                )
            if application_id not in existing_refs:
                try:
                    guarded_transact(
                        dynamodb,
                        table,
                        owner,
                        None,
                        [
                            {
                                "ConditionCheck": {
                                    "TableName": table,
                                    "Key": serialize_item({"PK": partition, "SK": "METADATA"}),
                                    "ConditionExpression": (
                                        "owner_user_id = :owner AND application_id = :id "
                                        "AND attribute_not_exists(expires_at)"
                                    ),
                                    "ExpressionAttributeValues": serialize_item(
                                        {":owner": owner, ":id": application_id}
                                    ),
                                }
                            },
                            application_ref(table, owner, application_id),
                        ],
                    )
                except ClientError as error:
                    if (
                        error.response.get("Error", {}).get("Code")
                        != "TransactionCanceledException"
                    ):
                        raise
                    ref = safety._get(user_partition(owner), f"APPLICATION_REF#{application_id}")
                    if ref is None or safety.ref_id(ref, owner) != application_id:
                        raise
        verified = {safety.ref_id(ref, owner) for ref in safety.references(owner)}
        if verified != set(discovered) or len(verified) != count:
            raise WorkspaceManifestIncompleteError("The strong inventory is incomplete.")
        quota_condition: dict[str, Any] = {
            "TableName": table,
            "Key": serialize_item({"PK": user_partition(owner), "SK": "WORKSPACE_QUOTA"}),
        }
        if quota is None:
            quota_condition["ConditionExpression"] = "attribute_not_exists(PK)"
        else:
            quota_condition.update(
                {
                    "ConditionExpression": (
                        "application_count = :count AND attribute_not_exists(expires_at)"
                    ),
                    "ExpressionAttributeValues": serialize_item({":count": count}),
                }
            )
        active = active_condition(table, owner)["ConditionCheck"]
        active.pop("Key")
        active["Key"] = serialize_item({"PK": user_partition(owner), "SK": "WORKSPACE"})
        active["UpdateExpression"] = "SET application_manifest_version = :manifest"
        active["ExpressionAttributeValues"].update(serialize_item({":manifest": 1}))
        # Quota changes if a concurrent create commits; refuse the completeness marker.
        dynamodb.transact_write_items(
            TransactItems=[{"ConditionCheck": quota_condition}, {"Update": active}]
        )
        return count
    except (ClientError, BotoCoreError) as error:
        raise PersistenceError("Manifest adoption did not finish; it is safe to retry.") from error
    except (KeyError, TypeError, ValueError) as error:
        raise WorkspaceManifestIncompleteError("Legacy inventory evidence is malformed.") from error
