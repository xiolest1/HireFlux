from copy import deepcopy
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from botocore.exceptions import ClientError, ReadTimeoutError

from hireflux_backend.application.errors import PersistenceError
from hireflux_backend.domain.enums import ApplicationStatus, DemoWorkspaceState
from hireflux_backend.domain.models import DemoWorkspace
from hireflux_backend.infrastructure.dynamodb.demo_cleanup import cleanup_failed_demo
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    format_timestamp,
    serialize_item,
    user_partition,
)

OWNER = "00000000-0000-4000-8000-000000000099"
APPLICATION = "00000000-0000-4000-8000-000000000088"
NOW = datetime(2026, 10, 1, 12, tzinfo=UTC)
EXPIRY = int((NOW + timedelta(hours=24)).timestamp())
TABLE = "HireFluxTest"


def reservation() -> DemoWorkspace:
    return DemoWorkspace(
        workspace_id=OWNER,
        state=DemoWorkspaceState.PROVISIONING,
        issued_at=NOW,
        updated_at=NOW,
        expires_at=EXPIRY,
        idempotency_key_hash="f" * 64,
        reservation_id="00000000-0000-4000-8000-000000000077",
    )


def marker() -> dict[str, Any]:
    return {
        "PK": user_partition(OWNER),
        "SK": "WORKSPACE",
        "entity_type": "DEMO_WORKSPACE",
        "workspace_id": OWNER,
        "reservation_id": reservation().reservation_id,
        "state": "FAILED",
        "issued_at": format_timestamp(NOW),
        "updated_at": format_timestamp(NOW + timedelta(seconds=1)),
        "expires_at": int((NOW + timedelta(minutes=15)).timestamp()),
        "data_expires_at": EXPIRY,
        "idempotency_key_hash": "f" * 64,
    }


def profile() -> dict[str, Any]:
    return {
        "PK": user_partition(OWNER),
        "SK": "PROFILE",
        "entity_type": "USER_PROFILE",
        "user_id": OWNER,
        "name": "Fictional Demo",
        "email": "fictional@example.invalid",
        "role": "STANDARD_USER",
        "created_at": format_timestamp(NOW),
        "expires_at": EXPIRY,
    }


def settings() -> dict[str, Any]:
    return {
        "PK": user_partition(OWNER),
        "SK": "SETTINGS",
        "entity_type": "WORKSPACE_SETTINGS",
        "owner_user_id": OWNER,
        "time_zone": "UTC",
        "version": 1,
        "updated_at": format_timestamp(NOW),
        "expires_at": EXPIRY,
    }


def application() -> dict[str, Any]:
    return {
        "PK": application_partition(OWNER, APPLICATION),
        "SK": "METADATA",
        "entity_type": "APPLICATION",
        "owner_user_id": OWNER,
        "application_id": APPLICATION,
        "company_name": "Fictional Seed",
        "version": 1,
        "expires_at": EXPIRY,
        "GSI2PK": f"USER#{OWNER}#STATUS#{ApplicationStatus.DRAFT.value}",
        "GSI2SK": "fictional-sort-key",
    }


def put(client: Any, item: dict[str, Any]) -> None:
    client.put_item(TableName=TABLE, Item=serialize_item(item))


def item(client: Any, value: dict[str, Any]) -> dict[str, Any] | None:
    return client.get_item(
        TableName=TABLE,
        Key=serialize_item({"PK": value["PK"], "SK": value["SK"]}),
        ConsistentRead=True,
    ).get("Item")


def snapshot(client: Any, values: list[dict[str, Any]]) -> list[dict[str, Any] | None]:
    return [deepcopy(item(client, value)) for value in values]


def error(code: str = "TransactionCanceledException") -> ClientError:
    return ClientError(
        {"Error": {"Code": code, "Message": "private fixture failure"}}, "TransactWriteItems"
    )


def test_deletes_only_known_temporary_owned_entities_and_preserves_failure_marker(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    parent = application()
    children = [
        {**parent, "SK": "NOTE#fictional-note", "entity_type": "NOTE", "note_id": "fictional-note"},
        {
            **parent,
            "SK": "INTERVIEW#fictional-interview",
            "entity_type": "INTERVIEW",
            "interview_id": "fictional-interview",
        },
        {
            **parent,
            "SK": "ACTIVITY#2026-10-01T12:00:00.000000Z#fictional-activity",
            "entity_type": "ACTIVITY",
            "activity_id": "fictional-activity",
            "created_at": format_timestamp(NOW),
        },
        {**parent, "SK": "WORKSPACE_CONTEXT", "entity_type": "WORKSPACE_CONTEXT"},
    ]
    quota = {
        "PK": parent["PK"],
        "SK": "RESOURCE_QUOTA",
        "entity_type": "RESOURCE_QUOTA",
        "expires_at": EXPIRY,
        "activity_count": 1,
    }
    owned = [profile(), settings(), parent, *children]
    for value in [marker(), *owned, quota]:
        put(dynamodb_client, value)
    original_marker = item(dynamodb_client, marker())
    original_quota = item(dynamodb_client, quota)
    writes: list[dict[str, Any]] = []
    transact = dynamodb_client.transact_write_items

    def record(**kwargs: Any) -> Any:
        writes.append(kwargs)
        return transact(**kwargs)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", record)
    monkeypatch.setattr(
        dynamodb_client,
        "batch_write_item",
        lambda **kwargs: pytest.fail("Unconditional deletion is forbidden."),
    )
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert snapshot(dynamodb_client, owned) == [None] * len(owned)
    assert item(dynamodb_client, marker()) == original_marker
    assert item(dynamodb_client, quota) == original_quota
    assert len(writes) == len(owned)
    for call in writes:
        assert list(call) == ["TransactItems"]
        assert [list(action) for action in call["TransactItems"]] == [
            ["ConditionCheck"],
            ["Delete"],
        ]
        assert all(
            "ConditionExpression" in next(iter(action.values())) for action in call["TransactItems"]
        )


@pytest.mark.parametrize(
    "change",
    [
        {"entity_type": "DURABLE_WORKSPACE", "identity_kind": "PERSISTENT"},
        {"state": "READY"},
        {"state": "PROVISIONING"},
        {"workspace_id": "foreign-owner"},
        {"reservation_id": "other-reservation"},
        {"reservation_id": None},
        {"issued_at": "2026-10-01T12:00:01.000000Z"},
        {"idempotency_key_hash": "other-hash"},
        {"data_expires_at": EXPIRY - 1},
        {"data_expires_at": None},
        {"expires_at": True},
        {"expires_at": "1234"},
        {"bootstrap_version": 1},
        {"owner_user_id": "foreign-owner"},
    ],
)
def test_incompatible_failed_marker_preserves_every_serialized_record(
    dynamodb_client: Any,
    change: dict[str, Any],
) -> None:
    values = [{**marker(), **change}, profile(), settings(), application()]
    for value in values:
        put(dynamodb_client, value)
    before = snapshot(dynamodb_client, values)
    with pytest.raises(PersistenceError, match="ownership"):
        cleanup_failed_demo(dynamodb_client, TABLE, reservation(), application_ids=(APPLICATION,))
    assert snapshot(dynamodb_client, values) == before


@pytest.mark.parametrize("root", ["absent", "profile-only", "legacy-metadata"])
def test_missing_demo_marker_never_cleans_legacy_or_durable_namespace(
    dynamodb_client: Any,
    root: str,
) -> None:
    values = [application()]
    values[0].pop("expires_at")
    if root != "absent":
        values.append(profile())
        values[-1].pop("expires_at")
    if root == "legacy-metadata":
        values.append(settings())
        values[-1].pop("expires_at")
    for value in values:
        put(dynamodb_client, value)
    before = snapshot(dynamodb_client, values)
    with pytest.raises(PersistenceError):
        cleanup_failed_demo(dynamodb_client, TABLE, reservation(), application_ids=(APPLICATION,))
    assert snapshot(dynamodb_client, values) == before


@pytest.mark.parametrize(
    "change",
    [
        {"expires_at": None},
        {"expires_at": EXPIRY + 1},
        {"expires_at": str(EXPIRY)},
        {"expires_at": True},
        {"entity_type": "DURABLE_PROFILE"},
        {"user_id": "foreign-owner"},
        {"identity_kind": "PERSISTENT"},
        {"bootstrap_version": 1},
        {"provider_finalization": "COMPLETE"},
        {"owner_user_id": "foreign-owner"},
        {"reservation_id": "foreign-reservation"},
        {"data_expires_at": EXPIRY + 1},
    ],
)
def test_incompatible_profile_is_retained_without_any_attribute_change(
    dynamodb_client: Any,
    change: dict[str, Any],
) -> None:
    value = {**profile(), **change}
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    before = item(dynamodb_client, value)
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert item(dynamodb_client, value) == before


@pytest.mark.parametrize(
    "mutation",
    [
        {"expires_at": None, "identity_kind": "PERSISTENT"},
        {"name": "Concurrent update"},
        {"bootstrap_version": 1},
        {"owner_user_id": "foreign-owner"},
        {"reservation_id": "foreign-reservation"},
    ],
)
def test_deletion_time_condition_preserves_concurrent_item_change(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
    mutation: dict[str, Any],
) -> None:
    value = profile()
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    transact = dynamodb_client.transact_write_items
    changed = {**value, **mutation}
    attempts = 0

    def mutate(**kwargs: Any) -> Any:
        nonlocal attempts
        attempts += 1
        put(dynamodb_client, changed)
        return transact(**kwargs)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", mutate)
    with pytest.raises(PersistenceError):
        cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert item(dynamodb_client, value) == serialize_item(changed)
    assert attempts == 1


def test_marker_replacement_between_read_and_delete_preserves_all_records(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    value = profile()
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    original = item(dynamodb_client, value)
    transact = dynamodb_client.transact_write_items
    replacement = {**marker(), "reservation_id": "new-reservation"}

    def mutate(**kwargs: Any) -> Any:
        put(dynamodb_client, replacement)
        return transact(**kwargs)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", mutate)
    with pytest.raises(PersistenceError):
        cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert item(dynamodb_client, value) == original
    assert item(dynamodb_client, marker()) == serialize_item(replacement)


@pytest.mark.parametrize(
    "failure", ["query-error", "malformed-page", "read-error", "conditional-delete", "throttle"]
)
def test_failure_retains_data_without_fallback_or_explicit_retry(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    value = profile()
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    before = snapshot(dynamodb_client, [marker(), value])
    attempts = 0

    def fail(**kwargs: Any) -> Any:
        nonlocal attempts
        attempts += 1
        if failure == "malformed-page":
            return {}
        raise error(
            "ProvisionedThroughputExceededException"
            if failure == "throttle"
            else "TransactionCanceledException"
        )

    target = (
        "get_item"
        if failure == "read-error"
        else "query"
        if failure in {"query-error", "malformed-page"}
        else "transact_write_items"
    )
    with monkeypatch.context() as patch:
        patch.setattr(dynamodb_client, target, fail)
        with pytest.raises(PersistenceError):
            cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert snapshot(dynamodb_client, [marker(), value]) == before
    assert attempts == 1


def test_partial_cleanup_and_lost_delete_response_leave_safe_repeatable_progress(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    values = [profile(), settings()]
    for value in [marker(), *values]:
        put(dynamodb_client, value)
    transact = dynamodb_client.transact_write_items
    attempts = 0

    def lose_response(**kwargs: Any) -> Any:
        nonlocal attempts
        attempts += 1
        transact(**kwargs)
        raise ReadTimeoutError(endpoint_url="https://fixture.invalid")

    with monkeypatch.context() as patch:
        patch.setattr(dynamodb_client, "transact_write_items", lose_response)
        with pytest.raises(PersistenceError):
            cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert attempts == 1
    assert sum(item(dynamodb_client, value) is None for value in values) == 1
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert snapshot(dynamodb_client, values) == [None, None]
    assert item(dynamodb_client, marker()) == serialize_item(marker())


def test_gsi_lag_is_not_mistaken_for_complete_inventory_and_known_ids_are_targeted(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    value = application()
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    before = item(dynamodb_client, value)
    query = dynamodb_client.query

    def lag(**kwargs: Any) -> Any:
        if "IndexName" in kwargs:
            assert "ConsistentRead" not in kwargs
            return {"Items": []}
        assert kwargs["ConsistentRead"] is True
        return query(**kwargs)

    monkeypatch.setattr(dynamodb_client, "query", lag)
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert item(dynamodb_client, value) == before
    cleanup_failed_demo(dynamodb_client, TABLE, reservation(), application_ids=(APPLICATION,))
    assert item(dynamodb_client, value) is None


def test_stale_gsi_metadata_does_not_authorize_deletion_of_current_durable_item(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    old = application()
    current = {**old, "company_name": "Persistent data", "version": 2}
    current.pop("expires_at")
    put(dynamodb_client, marker())
    put(dynamodb_client, current)
    before = item(dynamodb_client, current)
    query = dynamodb_client.query

    def stale(**kwargs: Any) -> Any:
        if "IndexName" in kwargs:
            return {"Items": [serialize_item(old)]}
        return query(**kwargs)

    monkeypatch.setattr(dynamodb_client, "query", stale)
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert item(dynamodb_client, current) == before


def test_cleanup_budget_is_finite_and_retains_safe_partial_progress(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    values = [profile(), settings()]
    for value in [marker(), *values]:
        put(dynamodb_client, value)
    monkeypatch.setattr("hireflux_backend.infrastructure.dynamodb.demo_cleanup._MAX_DELETIONS", 1)
    with pytest.raises(PersistenceError, match="bounded"):
        cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert sum(item(dynamodb_client, value) is None for value in values) == 1
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert snapshot(dynamodb_client, values) == [None, None]


def test_query_budget_exhaustion_never_deletes_from_incomplete_inventory(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    value = profile()
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    before = item(dynamodb_client, value)
    monkeypatch.setattr("hireflux_backend.infrastructure.dynamodb.demo_cleanup._MAX_QUERY_CALLS", 1)
    with pytest.raises(PersistenceError, match="bounded"):
        cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert item(dynamodb_client, value) == before


def test_ready_reservation_object_cannot_request_failed_cleanup(dynamodb_client: Any) -> None:
    value = profile()
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    before = item(dynamodb_client, value)
    with pytest.raises(PersistenceError, match="original reservation"):
        cleanup_failed_demo(
            dynamodb_client, TABLE, replace(reservation(), state=DemoWorkspaceState.READY)
        )
    assert item(dynamodb_client, value) == before


def test_elapsed_cleanup_budget_stops_after_safe_partial_progress(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    values = [profile(), settings()]
    for value in [marker(), *values]:
        put(dynamodb_client, value)
    observed = [0.0]
    monkeypatch.setattr(
        "hireflux_backend.infrastructure.dynamodb.demo_cleanup.monotonic", lambda: observed[0]
    )
    transact = dynamodb_client.transact_write_items
    attempts = 0

    def elapsed_after_delete(**kwargs: Any) -> Any:
        nonlocal attempts
        attempts += 1
        result = transact(**kwargs)
        observed[0] += 3
        return result

    with monkeypatch.context() as patch:
        patch.setattr(dynamodb_client, "transact_write_items", elapsed_after_delete)
        with pytest.raises(PersistenceError, match="bounded"):
            cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert attempts == 1
    assert sum(item(dynamodb_client, value) is None for value in values) == 1
    remaining = [value for value in values if item(dynamodb_client, value) is not None]
    assert snapshot(dynamodb_client, remaining) == [serialize_item(value) for value in remaining]
    cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert snapshot(dynamodb_client, values) == [None, None]


def test_elapsed_inventory_budget_prevents_all_deletion(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    value = profile()
    put(dynamodb_client, marker())
    put(dynamodb_client, value)
    before = snapshot(dynamodb_client, [marker(), value])
    observed = [0.0]
    monkeypatch.setattr(
        "hireflux_backend.infrastructure.dynamodb.demo_cleanup.monotonic", lambda: observed[0]
    )
    query = dynamodb_client.query
    attempts = 0

    def elapsed_after_query(**kwargs: Any) -> Any:
        nonlocal attempts
        attempts += 1
        result = query(**kwargs)
        observed[0] += 3
        return result

    monkeypatch.setattr(dynamodb_client, "query", elapsed_after_query)
    with pytest.raises(PersistenceError, match="bounded"):
        cleanup_failed_demo(dynamodb_client, TABLE, reservation())
    assert attempts == 1
    assert snapshot(dynamodb_client, [marker(), value]) == before
