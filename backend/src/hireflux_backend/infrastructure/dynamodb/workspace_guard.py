"""Commit-time durable lifecycle checks; temporary writes keep their original path."""

from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.errors import (
    PersistenceError,
    WorkspaceBootstrapRequiredError,
    WorkspaceDeletedError,
    WorkspaceDeletingError,
)
from hireflux_backend.infrastructure.dynamodb.mapping import (
    deserialize_item,
    serialize_item,
    user_partition,
)


def active_condition(table: str, owner: str) -> dict[str, Any]:
    return {
        "ConditionCheck": {
            "TableName": table,
            "Key": serialize_item({"PK": user_partition(owner), "SK": "WORKSPACE"}),
            "ConditionExpression": (
                "#state = :active AND entity_type = :type AND owner_user_id = :owner "
                "AND identity_kind IN (:local, :persistent) AND bootstrap_version = :version "
                "AND attribute_not_exists(expires_at)"
            ),
            "ExpressionAttributeNames": {"#state": "state"},
            "ExpressionAttributeValues": serialize_item(
                {
                    ":active": "ACTIVE",
                    ":type": "DURABLE_WORKSPACE",
                    ":owner": owner,
                    ":local": "LOCAL",
                    ":persistent": "PERSISTENT",
                    ":version": 1,
                }
            ),
        }
    }


def guarded_transact(
    client: Any, table: str, owner: str, expires_at: int | None, transactions: list[dict[str, Any]]
) -> None:
    if expires_at is None:
        transactions = [active_condition(table, owner), *transactions]
    try:
        client.transact_write_items(TransactItems=transactions)
    except ClientError as error:
        if expires_at is None and error.response.get("Error", {}).get("Code") in {
            "TransactionCanceledException",
            "TransactionConflictException",
        }:
            response = client.get_item(
                TableName=table,
                Key=serialize_item({"PK": user_partition(owner), "SK": "WORKSPACE"}),
                ConsistentRead=True,
            )
            item = deserialize_item(response["Item"]) if response.get("Item") else {}
            if item.get("state") == "DELETING":
                raise WorkspaceDeletingError("Workspace erasure is in progress.") from error
            if item.get("state") == "DELETED":
                raise WorkspaceDeletedError("This workspace has been erased.") from error
            if item.get("state") != "ACTIVE":
                raise WorkspaceBootstrapRequiredError(
                    "Initialize this workspace before continuing."
                ) from error
        raise
    except BotoCoreError as error:
        raise PersistenceError("Unable to commit workspace data.") from error


def guarded_put(
    client: Any, table: str, owner: str, expires_at: int | None, **arguments: Any
) -> None:
    if expires_at is not None:
        client.put_item(TableName=table, **arguments)
    else:
        guarded_transact(
            client, table, owner, expires_at, [{"Put": {"TableName": table, **arguments}}]
        )


def application_ref(table: str, owner: str, application_id: str) -> dict[str, Any]:
    return {
        "Put": {
            "TableName": table,
            "Item": serialize_item(
                {
                    "PK": user_partition(owner),
                    "SK": f"APPLICATION_REF#{application_id}",
                    "entity_type": "APPLICATION_REF",
                    "owner_user_id": owner,
                    "application_id": application_id,
                }
            ),
            "ConditionExpression": "attribute_not_exists(PK)",
        }
    }
