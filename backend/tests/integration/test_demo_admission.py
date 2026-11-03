"""Admission protocol checks against Moto with deterministic datastore fault injection.

Locks serialize only Moto's complete transaction, never concurrent preliminary reads.
This does not simulate AWS conflict timing or SDK wire-level retry behavior.
"""

import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from threading import Barrier, Lock
from typing import Any

import pytest
from botocore.exceptions import ClientError, ReadTimeoutError

from hireflux_backend.application.demo_admission import (
    COUNTER_RETENTION_SECONDS,
    DemoAdmission,
    DemoIssuancePolicy,
)
from hireflux_backend.application.errors import (
    ConflictError,
    DemoAdmissionUnavailableError,
    DemoAdmissionUncertainError,
    DemoIssuancePausedError,
    DemoProvisioningInProgressError,
    DemoQuotaExhaustedError,
    PersistenceError,
)
from hireflux_backend.application.ports import DemoWorkspaceReservation
from hireflux_backend.infrastructure.dynamodb.demo_workspace_repository import (
    POLICY_KEY,
    DynamoDemoWorkspaceRepository,
    counter_key,
)
from hireflux_backend.infrastructure.dynamodb.mapping import deserialize_item, serialize_item

TABLE = "HireFluxTest"
NOW = datetime(2026, 11, 3, 12, 0, 10, tzinfo=UTC)
KEY_A = "fictional-admission-idempotency-key-A"
KEY_B = "fictional-admission-idempotency-key-B"


def owner(number: int) -> str:
    return f"00000000-0000-4000-8000-{number:012d}"


def policy_record(**changes: object) -> dict[str, object]:
    return {
        **POLICY_KEY,
        "entity_type": "DEMO_ISSUANCE_POLICY",
        "schema_version": 1,
        "enabled": True,
        "version": 1,
        "daily_limit": 10,
        "minute_limit": 2,
        **changes,
    }


def put(client: Any, item: dict[str, object]) -> None:
    client.put_item(TableName=TABLE, Item=serialize_item(item))


def get(client: Any, key: dict[str, str]) -> dict[str, Any] | None:
    response = client.get_item(TableName=TABLE, Key=serialize_item(key), ConsistentRead=True)
    return deserialize_item(response["Item"]) if response.get("Item") else None


def configured(
    client: Any, **changes: object
) -> tuple[DynamoDemoWorkspaceRepository, DemoAdmission]:
    put(client, policy_record(**changes))
    repository = DynamoDemoWorkspaceRepository(client, TABLE)
    record = repository.read_issuance_policy()
    assert record is not None
    return repository, DemoAdmission.at(DemoIssuancePolicy.from_record(record), NOW)


def reserve(
    repository: DynamoDemoWorkspaceRepository,
    admission: DemoAdmission,
    number: int = 1,
    key: str = KEY_A,
) -> DemoWorkspaceReservation:
    timestamp = datetime.fromtimestamp(admission.now, UTC)
    return repository.reserve(
        owner(number),
        issued_at=timestamp,
        expires_at=admission.now + 86_400,
        idempotency_key=key,
        admission=admission,
    )


def counter(client: Any, admission: DemoAdmission, period: str = "DAY") -> dict[str, Any] | None:
    return get(
        client,
        counter_key(period, admission.day_start if period == "DAY" else admission.minute_start),
    )


def no_reservation(client: Any, admission: DemoAdmission, number: int = 1) -> None:
    assert get(client, {"PK": f"USER#{owner(number)}", "SK": "WORKSPACE"}) is None
    assert counter(client, admission) is None
    assert counter(client, admission, "MINUTE") is None


def test_admission_transaction_has_distinct_small_actions_and_atomic_counters(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository, admission = configured(dynamodb_client)
    original = dynamodb_client.transact_write_items
    calls: list[dict[str, Any]] = []

    def inspect(**arguments: Any) -> Any:
        calls.append(arguments)
        actions = arguments["TransactItems"]
        keys = []
        for action in actions:
            operation = next(iter(action.values()))
            item = deserialize_item(operation.get("Key", operation.get("Item")))
            keys.append((item["PK"], item["SK"]))
        assert len(keys) == len(set(keys)) < 100
        assert len(str(actions).encode("utf-8")) < 64_000
        assert len(arguments["ClientRequestToken"]) <= 36
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", inspect)
    result = reserve(repository, admission)
    assert result.is_new
    assert len(calls) == 1
    assert counter(dynamodb_client, admission)["used"] == 1
    assert counter(dynamodb_client, admission, "MINUTE")["used"] == 1
    assert counter(dynamodb_client, admission)["expires_at"] == (
        admission.day_start + 86_400 + COUNTER_RETENTION_SECONDS
    )
    assert counter(dynamodb_client, admission, "MINUTE")["expires_at"] == (
        admission.minute_start + 60 + COUNTER_RETENTION_SECONDS
    )


@pytest.mark.parametrize("mode", ["pause", "new-version", "changed-limit", "disappear"])
def test_policy_change_before_commit_cancels_every_admission_write(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    repository, admission = configured(dynamodb_client)
    original = dynamodb_client.transact_write_items

    def race(**arguments: Any) -> Any:
        if mode == "disappear":
            dynamodb_client.delete_item(TableName=TABLE, Key=serialize_item(POLICY_KEY))
        else:
            changes = (
                {"enabled": False, "version": 2}
                if mode == "pause"
                else {"version": 2}
                if mode == "new-version"
                else {"daily_limit": 9}
            )
            put(dynamodb_client, policy_record(**changes))
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", race)
    expected = (
        DemoIssuancePausedError if mode in {"pause", "disappear"} else DemoAdmissionUnavailableError
    )
    with pytest.raises(expected):
        reserve(repository, admission)
    no_reservation(dynamodb_client, admission)
    assert repository.find_reservation(KEY_A, now=NOW) is None


@pytest.mark.parametrize(
    "corruption",
    [
        {"used": -1},
        {"used": Decimal("0.5")},
        {"used": True},
        {"used": "1"},
        {"used": 1001},
        {"window_start": 1},
        {"window_seconds": 1},
        {"expires_at": 1},
        {"entity_type": "DURABLE_WORKSPACE"},
        {"unexpected": "retain-me"},
    ],
)
def test_corrupt_counter_fails_closed_without_mutation(
    dynamodb_client: Any, corruption: dict[str, object]
) -> None:
    repository, admission = configured(dynamodb_client)
    item = {
        **counter_key("DAY", admission.day_start),
        "entity_type": "DEMO_ADMISSION_COUNTER",
        "window_start": admission.day_start,
        "window_seconds": 86_400,
        "expires_at": admission.day_start + 86_400 + COUNTER_RETENTION_SECONDS,
        "used": 0,
        **corruption,
    }
    put(dynamodb_client, item)
    before = get(dynamodb_client, counter_key("DAY", admission.day_start))
    with pytest.raises(DemoAdmissionUnavailableError):
        reserve(repository, admission)
    assert get(dynamodb_client, counter_key("DAY", admission.day_start)) == before
    assert counter(dynamodb_client, admission, "MINUTE") is None
    assert repository.find_reservation(KEY_A, now=NOW) is None


@pytest.mark.parametrize("daily,minute", [(1, 2), (10, 1), (1, 1)])
def test_daily_and_minute_quotas_are_joint_and_retry_after_is_window_bound(
    dynamodb_client: Any, daily: int, minute: int
) -> None:
    repository, admission = configured(dynamodb_client, daily_limit=daily, minute_limit=minute)
    reserve(repository, admission)
    before = (counter(dynamodb_client, admission), counter(dynamodb_client, admission, "MINUTE"))
    with pytest.raises(DemoQuotaExhaustedError) as denial:
        reserve(repository, admission, 2, KEY_B)
    expected = (
        admission.day_start + 86_400 if daily == 1 else admission.minute_start + 60
    ) - admission.now
    assert denial.value.retry_after_seconds == expected
    assert (
        counter(dynamodb_client, admission),
        counter(dynamodb_client, admission, "MINUTE"),
    ) == before
    assert repository.find_reservation(KEY_B, now=NOW) is None


def test_utc_rollovers_create_new_buckets_without_extending_old_ttls(dynamodb_client: Any) -> None:
    repository, initial = configured(dynamodb_client)
    first = DemoAdmission.at(initial.policy, datetime(2026, 11, 3, 23, 59, 59, tzinfo=UTC))
    reserve(repository, first, 1, KEY_A)
    before_day = counter(dynamodb_client, first)
    before_minute = counter(dynamodb_client, first, "MINUTE")
    second = DemoAdmission.at(initial.policy, datetime(2026, 11, 4, 0, 0, 0, tzinfo=UTC))
    reserve(repository, second, 2, KEY_B)
    assert second.day_start == first.day_start + 86_400
    assert second.minute_start == first.minute_start + 60
    assert counter(dynamodb_client, second)["used"] == 1
    assert counter(dynamodb_client, second, "MINUTE")["used"] == 1
    assert counter(dynamodb_client, first) == before_day
    assert counter(dynamodb_client, first, "MINUTE") == before_minute


def test_minute_boundary_allows_adjacent_bursts_but_retains_daily_total(
    dynamodb_client: Any,
) -> None:
    repository, initial = configured(dynamodb_client)
    first = DemoAdmission.at(initial.policy, NOW.replace(second=59))
    for number in (1, 2):
        reserve(repository, first, number, f"fictional-first-minute-key-{number}")
    second = DemoAdmission.at(initial.policy, NOW.replace(second=0) + timedelta(minutes=1))
    for number in (3, 4):
        reserve(repository, second, number, f"fictional-second-minute-key-{number}")
    assert counter(dynamodb_client, second)["used"] == 4
    assert counter(dynamodb_client, first, "MINUTE")["used"] == 2
    assert counter(dynamodb_client, second, "MINUTE")["used"] == 2


@pytest.mark.parametrize("same_key", [False, True], ids=["distinct-last-slot", "same-key"])
def test_concurrent_transactions_do_not_oversubscribe_or_duplicate_reservation(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, same_key: bool
) -> None:
    repository, admission = configured(dynamodb_client)
    if not same_key:
        reserve(repository, admission, 10, "fictional-prior-committed-key")
    original = dynamodb_client.transact_write_items
    transaction_lock = Lock()
    both_read = Barrier(2)

    def atomic_transaction(**arguments: Any) -> Any:
        # Both callers complete policy/counter/namespace reads before either commits.
        both_read.wait(timeout=5)
        with transaction_lock:
            return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", atomic_transaction)

    def attempt(number: int) -> DemoWorkspaceReservation | Exception:
        try:
            return reserve(
                repository, admission, number, KEY_A if same_key else f"fictional-race-key-{number}"
            )
        except Exception as error:
            return error

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, (1, 2)))
    winners = [result for result in results if isinstance(result, DemoWorkspaceReservation)]
    losers = [result for result in results if isinstance(result, Exception)]
    assert len(winners) == len(losers) == 1, results
    assert winners[0].is_new
    expected = DemoProvisioningInProgressError if same_key else DemoQuotaExhaustedError
    assert isinstance(losers[0], expected), results
    assert counter(dynamodb_client, admission)["used"] == (1 if same_key else 2)
    assert counter(dynamodb_client, admission, "MINUTE")["used"] == (1 if same_key else 2)
    existing_owners = [
        number
        for number in (1, 2)
        if get(dynamodb_client, {"PK": f"USER#{owner(number)}", "SK": "WORKSPACE"})
    ]
    assert len(existing_owners) == 1


@pytest.mark.parametrize(
    "committed", [False, True], ids=["before-commit", "lost-committed-response"]
)
def test_timeout_reconciliation_never_grants_a_new_seeder(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, committed: bool
) -> None:
    repository, admission = configured(dynamodb_client)
    original = dynamodb_client.transact_write_items
    attempts = 0

    def ambiguous(**arguments: Any) -> Any:
        nonlocal attempts
        attempts += 1
        if committed:
            original(**arguments)
        raise ReadTimeoutError(endpoint_url="https://dynamodb.synthetic.invalid")

    monkeypatch.setattr(dynamodb_client, "transact_write_items", ambiguous)
    expected = DemoProvisioningInProgressError if committed else DemoAdmissionUncertainError
    with pytest.raises(expected):
        reserve(repository, admission)
    assert attempts == 1
    if committed:
        with pytest.raises(DemoProvisioningInProgressError):
            repository.find_reservation(KEY_A, now=NOW)
        assert counter(dynamodb_client, admission)["used"] == 1
        assert counter(dynamodb_client, admission, "MINUTE")["used"] == 1
    else:
        no_reservation(dynamodb_client, admission)
        assert repository.find_reservation(KEY_A, now=NOW) is None


@pytest.mark.parametrize(
    "code,expected",
    [
        ("TransactionCanceledException", DemoAdmissionUnavailableError),
        ("TransactionConflictException", DemoAdmissionUncertainError),
        ("ProvisionedThroughputExceededException", DemoAdmissionUnavailableError),
        ("ThrottlingException", DemoAdmissionUnavailableError),
        ("AccessDeniedException", DemoAdmissionUnavailableError),
        ("InternalServerError", DemoAdmissionUncertainError),
    ],
)
def test_transaction_errors_without_cancellation_reasons_fail_closed_once(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
    code: str,
    expected: type[Exception],
) -> None:
    repository, admission = configured(dynamodb_client)
    attempts = 0

    def failure(**arguments: Any) -> Any:
        nonlocal attempts
        attempts += 1
        raise ClientError(
            {"Error": {"Code": code, "Message": "private-upstream-fixture"}}, "TransactWriteItems"
        )

    monkeypatch.setattr(dynamodb_client, "transact_write_items", failure)
    with pytest.raises(expected) as denial:
        reserve(repository, admission)
    assert attempts == 1
    assert "private-upstream-fixture" not in str(denial.value)
    no_reservation(dynamodb_client, admission)


def test_control_read_denial_is_sanitized_and_does_not_write(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository = DynamoDemoWorkspaceRepository(dynamodb_client, TABLE)

    def fail_read(**arguments: Any) -> Any:
        raise ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "private-policy"}}, "GetItem"
        )

    monkeypatch.setattr(dynamodb_client, "get_item", fail_read)
    with pytest.raises(DemoAdmissionUnavailableError) as denial:
        repository.read_issuance_policy()
    assert "private-policy" not in str(denial.value)


def test_disappearing_counter_cancels_other_writes_and_does_not_recreate_it(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository, admission = configured(dynamodb_client)
    reserve(repository, admission, 1, KEY_A)
    original = dynamodb_client.transact_write_items
    day_before = counter(dynamodb_client, admission)

    def disappear(**arguments: Any) -> Any:
        dynamodb_client.delete_item(
            TableName=TABLE, Key=serialize_item(counter_key("MINUTE", admission.minute_start))
        )
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", disappear)
    with pytest.raises(DemoAdmissionUnavailableError):
        reserve(repository, admission, 2, KEY_B)
    assert counter(dynamodb_client, admission) == day_before
    assert counter(dynamodb_client, admission, "MINUTE") is None
    assert repository.find_reservation(KEY_B, now=NOW) is None


@pytest.mark.parametrize("reply", [None, {"unexpected": "shape"}])
def test_unknown_transaction_reply_cannot_grant_new_seeding(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, reply: object
) -> None:
    repository, admission = configured(dynamodb_client)
    monkeypatch.setattr(dynamodb_client, "transact_write_items", lambda **arguments: reply)
    with pytest.raises(DemoAdmissionUncertainError):
        reserve(repository, admission)
    no_reservation(dynamodb_client, admission)


def test_ready_reuse_preserves_identity_deadline_and_budget_after_pause(
    dynamodb_client: Any,
) -> None:
    repository, admission = configured(dynamodb_client)
    result = reserve(repository, admission)
    repository.mark_ready(result.workspace)
    before = (counter(dynamodb_client, admission), counter(dynamodb_client, admission, "MINUTE"))
    put(dynamodb_client, policy_record(enabled=False, version=2))
    reused = repository.find_reservation(KEY_A, now=NOW + timedelta(minutes=1))
    assert reused is not None and not reused.is_new
    assert reused.workspace.workspace_id == result.workspace.workspace_id
    assert reused.workspace.issued_at == result.workspace.issued_at
    assert reused.workspace.expires_at == result.workspace.expires_at
    assert (
        counter(dynamodb_client, admission),
        counter(dynamodb_client, admission, "MINUTE"),
    ) == before


def test_failed_and_expired_replays_do_not_grant_new_reservations(dynamodb_client: Any) -> None:
    repository, admission = configured(dynamodb_client)
    result = reserve(repository, admission)
    repository.mark_failed(result.workspace, expires_at=admission.now + 900)
    with pytest.raises(ConflictError):
        repository.find_reservation(KEY_A, now=NOW + timedelta(minutes=1))
    with pytest.raises(ConflictError):
        repository.find_reservation(KEY_A, now=NOW + timedelta(days=1))
    assert counter(dynamodb_client, admission)["used"] == 1


@pytest.mark.parametrize("fault", ["missing", "stale-state", "wrong-reservation", "wrong-deadline"])
def test_missing_or_inconsistent_idempotency_after_lost_response_never_grants_seeding(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, fault: str
) -> None:
    repository, admission = configured(dynamodb_client)
    original_transaction = dynamodb_client.transact_write_items
    original_get = dynamodb_client.get_item

    def corrupted_read(**arguments: Any) -> Any:
        response = original_get(**arguments)
        key = deserialize_item(arguments["Key"])
        if key["PK"].startswith("DEMO_IDEMPOTENCY#") and response.get("Item"):
            if fault == "missing":
                return {"ResponseMetadata": {"HTTPStatusCode": 200}}
            item = deserialize_item(response["Item"])
            item.update(
                {"state": "READY"}
                if fault == "stale-state"
                else {"reservation_id": "different-reservation"}
                if fault == "wrong-reservation"
                else {"session_expires_at": admission.now + 1}
            )
            return {**response, "Item": serialize_item(item)}
        return response

    def committed_then_lost(**arguments: Any) -> Any:
        original_transaction(**arguments)
        raise ReadTimeoutError(endpoint_url="https://dynamodb.synthetic.invalid")

    monkeypatch.setattr(dynamodb_client, "get_item", corrupted_read)
    monkeypatch.setattr(dynamodb_client, "transact_write_items", committed_then_lost)
    # A lost transaction response plus failed reconciliation is uncertainty, even
    # when the read fault itself would normally be reported as unavailability.
    with pytest.raises(DemoAdmissionUncertainError):
        reserve(repository, admission)
    monkeypatch.setattr(dynamodb_client, "get_item", original_get)
    with pytest.raises(DemoProvisioningInProgressError):
        repository.find_reservation(KEY_A, now=NOW)
    assert counter(dynamodb_client, admission)["used"] == 1
    assert counter(dynamodb_client, admission, "MINUTE")["used"] == 1


@pytest.mark.parametrize(
    "reply",
    [
        None,
        {},
        {"ResponseMetadata": {"HTTPStatusCode": 503}},
        {"ResponseMetadata": {"HTTPStatusCode": 200}, "Item": {}},
        {"ResponseMetadata": {"HTTPStatusCode": 200}, "Item": "not-an-item"},
        {"ResponseMetadata": {"HTTPStatusCode": 200}, "Item": {"PK": "not-encoded"}},
    ],
)
def test_malformed_control_read_response_fails_closed(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, reply: object
) -> None:
    repository = DynamoDemoWorkspaceRepository(dynamodb_client, TABLE)
    monkeypatch.setattr(dynamodb_client, "get_item", lambda **arguments: reply)
    with pytest.raises(DemoAdmissionUnavailableError):
        repository.read_issuance_policy()


@pytest.mark.parametrize("method", ["ready", "failed"])
@pytest.mark.parametrize(
    "field,value",
    [
        ("workspace_id", "other-owner"),
        ("idempotency_key_hash", "other-key-hash"),
        ("reservation_id", "other-reservation"),
        ("issued_at", "2020-01-01T00:00:00Z"),
        ("data_expires_at", 1),
        ("expires_at", 1),
        ("identity_kind", "PERSISTENT"),
        ("owner_user_id", "other-owner"),
        ("provider_finalized_at", "2020-01-01T00:00:00Z"),
    ],
)
def test_state_update_never_mutates_incompatible_reservation(
    dynamodb_client: Any, method: str, field: str, value: object
) -> None:
    repository, admission = configured(dynamodb_client)
    result = reserve(repository, admission)
    workspace_key = {"PK": f"USER#{owner(1)}", "SK": "WORKSPACE"}
    record = get(dynamodb_client, workspace_key)
    assert record is not None
    record[field] = value
    put(dynamodb_client, record)
    before = get(dynamodb_client, workspace_key)
    idempotency_key = {
        "PK": f"DEMO_IDEMPOTENCY#{hashlib.sha256(KEY_A.encode()).hexdigest()}",
        "SK": "SESSION",
    }
    idempotency_before = get(dynamodb_client, idempotency_key)
    with pytest.raises((PersistenceError, DemoAdmissionUnavailableError)):
        if method == "ready":
            repository.mark_ready(result.workspace)
        else:
            repository.mark_failed(result.workspace, expires_at=admission.now + 900)
    assert get(dynamodb_client, workspace_key) == before
    assert get(dynamodb_client, idempotency_key) == idempotency_before


@pytest.mark.parametrize("method", ["ready", "failed"])
def test_state_update_never_mutates_idempotency_record_for_a_different_owner(
    dynamodb_client: Any, method: str
) -> None:
    repository, admission = configured(dynamodb_client)
    result = reserve(repository, admission)
    idempotency_key = {
        "PK": f"DEMO_IDEMPOTENCY#{hashlib.sha256(KEY_A.encode()).hexdigest()}",
        "SK": "SESSION",
    }
    record = get(dynamodb_client, idempotency_key)
    assert record is not None
    record["workspace_id"] = "other-owner"
    put(dynamodb_client, record)
    before = get(dynamodb_client, idempotency_key)
    workspace_key = {"PK": f"USER#{owner(1)}", "SK": "WORKSPACE"}
    workspace_before = get(dynamodb_client, workspace_key)
    with pytest.raises((PersistenceError, DemoAdmissionUnavailableError)):
        if method == "ready":
            repository.mark_ready(result.workspace)
        else:
            repository.mark_failed(result.workspace, expires_at=admission.now + 900)
    assert get(dynamodb_client, workspace_key) == workspace_before
    assert get(dynamodb_client, idempotency_key) == before


@pytest.mark.parametrize("committed", [False, True])
@pytest.mark.parametrize("method", ["ready", "failed"])
def test_state_update_reconciles_lost_response_once_without_mutation_retry(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, method: str, committed: bool
) -> None:
    repository, admission = configured(dynamodb_client)
    result = reserve(repository, admission)
    original = dynamodb_client.transact_write_items
    attempts = 0

    def uncertain(**arguments: Any) -> Any:
        nonlocal attempts
        attempts += 1
        if committed:
            original(**arguments)
        raise ReadTimeoutError(endpoint_url="https://dynamodb.synthetic.invalid")

    monkeypatch.setattr(dynamodb_client, "transact_write_items", uncertain)
    if committed:
        if method == "ready":
            repository.mark_ready(result.workspace)
        else:
            repository.mark_failed(result.workspace, expires_at=admission.now + 900)
    else:
        with pytest.raises(PersistenceError):
            if method == "ready":
                repository.mark_ready(result.workspace)
            else:
                repository.mark_failed(result.workspace, expires_at=admission.now + 900)
    assert attempts == 1
    actual = get(dynamodb_client, {"PK": f"USER#{owner(1)}", "SK": "WORKSPACE"})
    assert actual is not None
    assert actual["state"] == (method.upper() if committed else "PROVISIONING")
