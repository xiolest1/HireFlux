"""Bounded API/service contracts over Moto, with deterministic failure injection."""

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError, ReadTimeoutError
from cognito_fixtures import COGNITO_CONFIG, Harness
from conftest import test_settings as build_settings
from fastapi.testclient import TestClient

from hireflux_backend.app_factory import create_app
from hireflux_backend.application.errors import PersistenceError
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import DurableWorkspace, DurableWorkspaceState
from hireflux_backend.infrastructure.dynamodb.demo_workspace_repository import (
    POLICY_KEY,
    counter_key,
)
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.workspace_bootstrap_repository import (
    workspace_to_item,
)

TABLE = "HireFluxTest"
API = "/api/v1"
OWNER = "00000000-0000-4000-8000-000000000099"
KEY = "synthetic-admission-idempotency-key"


def policy(db: Any, *, enabled: bool = True, daily: int = 10, minute: int = 2) -> None:
    db.put_item(
        TableName=TABLE,
        Item=serialize_item(
            {
                **POLICY_KEY,
                "entity_type": "DEMO_ISSUANCE_POLICY",
                "schema_version": 1,
                "version": 1 if enabled else 2,
                "enabled": enabled,
                "daily_limit": daily,
                "minute_limit": minute,
            }
        ),
    )


def make_app(db: Any, monkeypatch: pytest.MonkeyPatch, environment: str = "test") -> Any:
    settings: dict[str, Any] = {
        "environment": environment,
        "auth_mode": "demo",
        "cursor_signing_key": "C" * 64,
        "demo_session_signing_key": "D" * 64,
    }
    if environment == "production":
        settings.update(auth_mode="cognito", auth_capabilities="demo,cognito", **COGNITO_CONFIG)
    app = create_app(build_settings(**settings), dynamodb_client=db)
    # Admission tests need the real reservation/profile/state flow, not 30 seed records.
    monkeypatch.setattr(app.state.demo_session_service, "_seed_workspace", Mock())
    return app


def counter(db: Any, period: str, at: datetime) -> dict[str, Any]:
    seconds = 86_400 if period == "DAY" else 60
    stamp = int(at.timestamp())
    result = db.get_item(
        TableName=TABLE,
        Key=serialize_item(counter_key(period, stamp - stamp % seconds)),
        ConsistentRead=True,
    )
    return deserialize_item(result["Item"]) if result.get("Item") else {}


def partition(db: Any, pk: str) -> list[dict[str, Any]]:
    # Preserve full serialized DynamoDB items; counts alone cannot prove safe cleanup.
    return db.query(
        TableName=TABLE,
        KeyConditionExpression="PK = :pk",
        ExpressionAttributeValues=serialize_item({":pk": pk}),
        ConsistentRead=True,
    )["Items"]


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_deployed_missing_policy_is_paused_and_requires_idempotency(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, environment: str
) -> None:
    app = make_app(dynamodb_client, monkeypatch, environment)
    with TestClient(app) as client:
        missing_key = client.post(API + "/demo-sessions")
        paused = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
    assert missing_key.status_code == 422
    assert paused.status_code == 429
    assert paused.json()["error"]["code"] == "DEMO_ISSUANCE_PAUSED"
    assert "Retry-After" not in paused.headers
    assert "details" not in paused.json()["error"]
    app.state.demo_session_service._seed_workspace.assert_not_called()


@pytest.mark.parametrize("environment", ["local", "test"])
def test_local_compatibility_is_finite_without_initializing_control(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, environment: str
) -> None:
    app = make_app(dynamodb_client, monkeypatch, environment)
    at = datetime.now(UTC).replace(second=5, microsecond=0)
    monkeypatch.setattr(app.state.demo_session_service, "_clock", lambda: at)
    with TestClient(app) as client:
        first = client.post(API + "/demo-sessions")
        second = client.post(API + "/demo-sessions")
        third = client.post(API + "/demo-sessions")
    assert first.status_code == second.status_code == 201
    assert third.status_code == 429
    assert third.json()["error"] == {
        "code": "DEMO_QUOTA_EXHAUSTED",
        "message": "Demo creation is temporarily at capacity. Please try again later.",
        "request_id": third.json()["error"]["request_id"],
        "details": {"retry_after_seconds": 55},
    }
    assert third.headers["Retry-After"] == "55"
    assert counter(dynamodb_client, "MINUTE", at)["used"] == 2
    assert counter(dynamodb_client, "DAY", at)["used"] == 2
    assert "Item" not in dynamodb_client.get_item(TableName=TABLE, Key=serialize_item(POLICY_KEY))
    assert app.state.demo_session_service._seed_workspace.call_count == 2


def test_default_local_daily_quota_is_ten_and_has_known_bounded_wait(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    start = datetime.now(UTC).replace(hour=12, minute=0, second=5, microsecond=0)
    current = [start]
    monkeypatch.setattr(app.state.demo_session_service, "_clock", lambda: current[0])
    with TestClient(app) as client:
        for minute in range(10):
            current[0] = start + timedelta(minutes=minute)
            assert client.post(API + "/demo-sessions").status_code == 201
        current[0] += timedelta(minutes=1)
        limited = client.post(API + "/demo-sessions")
    assert limited.status_code == 429
    retry = limited.json()["error"]["details"]["retry_after_seconds"]
    assert 1 <= retry <= 86_400 and int(limited.headers["Retry-After"]) == retry
    assert counter(dynamodb_client, "DAY", current[0])["used"] == 10
    assert counter(dynamodb_client, "MINUTE", current[0]) == {}
    assert app.state.demo_session_service._seed_workspace.call_count == 10


@pytest.mark.parametrize("fault", ["malformed", "unavailable"])
def test_policy_errors_are_private_503_and_never_seed(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, fault: str
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    policy(dynamodb_client)
    if fault == "malformed":
        dynamodb_client.update_item(
            TableName=TABLE,
            Key=serialize_item(POLICY_KEY),
            UpdateExpression="SET minute_limit = :bad",
            ExpressionAttributeValues=serialize_item({":bad": "unbounded"}),
        )
    else:
        original = dynamodb_client.get_item

        def unavailable(**kwargs: Any) -> Any:
            if kwargs["Key"] == serialize_item(POLICY_KEY):
                raise ClientError(
                    {
                        "Error": {
                            "Code": "AccessDeniedException",
                            "Message": "raw-private-store-diagnostic",
                        }
                    },
                    "GetItem",
                )
            return original(**kwargs)

        monkeypatch.setattr(dynamodb_client, "get_item", unavailable)
    with TestClient(app) as client:
        result = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "DEMO_ADMISSION_UNAVAILABLE"
    assert "raw-private-store-diagnostic" not in result.text
    assert "DEMO_ADMISSION#" not in result.text and KEY not in result.text
    app.state.demo_session_service._seed_workspace.assert_not_called()


def test_seed_starts_only_after_atomic_reservation_and_budget_commit(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    at = datetime.now(UTC)
    monkeypatch.setattr(app.state.demo_session_service, "_clock", lambda: at)

    def inspect(identity: Any, _now: Any, _created: Any) -> None:
        root = partition(dynamodb_client, user_partition(identity.user_id))
        marker = next(deserialize_item(item) for item in root if item["SK"] == {"S": "WORKSPACE"})
        assert marker["state"] == "PROVISIONING"
        assert marker["reservation_id"]
        assert counter(dynamodb_client, "DAY", at)["used"] == 1
        assert counter(dynamodb_client, "MINUTE", at)["used"] == 1

    monkeypatch.setattr(app.state.demo_session_service, "_seed_workspace", inspect)
    with TestClient(app) as client:
        assert (
            client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY}).status_code == 201
        )


@pytest.mark.parametrize("fault", ["before-commit", "after-commit"])
def test_unknown_transaction_response_never_starts_seed_or_replacement(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, fault: str
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    service = app.state.demo_session_service
    at = datetime.now(UTC)
    monkeypatch.setattr(service, "_clock", lambda: at)
    original = dynamodb_client.transact_write_items
    attempts = 0

    def lose_response(**kwargs: Any) -> Any:
        nonlocal attempts
        attempts += 1
        if fault == "after-commit":
            original(**kwargs)
        raise ReadTimeoutError(endpoint_url="https://synthetic.invalid")

    monkeypatch.setattr(dynamodb_client, "transact_write_items", lose_response)
    with TestClient(app) as client:
        result = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
        if fault == "after-commit":
            again = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
            assert again.status_code == 409
            assert again.json()["error"]["code"] == "DEMO_PROVISIONING_IN_PROGRESS"
    assert result.status_code == (409 if fault == "after-commit" else 503)
    assert result.json()["error"]["code"] == (
        "DEMO_PROVISIONING_IN_PROGRESS" if fault == "after-commit" else "DEMO_ADMISSION_UNCERTAIN"
    )
    assert attempts == 1
    assert counter(dynamodb_client, "DAY", at).get("used", 0) == (
        1 if fault == "after-commit" else 0
    )
    service._seed_workspace.assert_not_called()


def test_failed_seed_consumes_budget_and_same_key_never_reseeds(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    service = app.state.demo_session_service
    at = datetime.now(UTC)
    monkeypatch.setattr(service, "_clock", lambda: at)
    seed = Mock(side_effect=RuntimeError("synthetic seed failure"))
    monkeypatch.setattr(service, "_seed_workspace", seed)
    with TestClient(app) as client:
        first = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
        repeated = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
    assert first.status_code == 503
    assert first.json()["error"]["code"] == "PERSISTENCE_UNAVAILABLE"
    assert repeated.status_code == 409
    assert repeated.json()["error"]["code"] == "CONFLICT"
    assert seed.call_count == 1
    assert counter(dynamodb_client, "DAY", at)["used"] == 1
    assert counter(dynamodb_client, "MINUTE", at)["used"] == 1


def test_expired_key_cannot_extend_deadline_or_start_a_second_reservation(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    service = app.state.demo_session_service
    at = datetime.now(UTC)
    current = [at]
    monkeypatch.setattr(service, "_clock", lambda: current[0])
    with TestClient(app) as client:
        first = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
        assert first.status_code == 201
        current[0] = at + timedelta(hours=24, seconds=1)
        reads = Mock(side_effect=AssertionError("Expired reconciliation must precede policy."))
        monkeypatch.setattr(service._workspace_repository, "read_issuance_policy", reads)
        expired = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
    assert expired.status_code == 409
    assert expired.json()["error"]["code"] == "CONFLICT"
    assert service._seed_workspace.call_count == 1
    reads.assert_not_called()
    assert counter(dynamodb_client, "DAY", at)["used"] == 1
    assert counter(dynamodb_client, "MINUTE", current[0]) == {}


def test_mark_failed_failure_never_grants_cleanup_authority(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    service = app.state.demo_session_service
    monkeypatch.setattr(
        service, "_seed_workspace", Mock(side_effect=RuntimeError("synthetic seed failure"))
    )
    monkeypatch.setattr(
        service._workspace_repository,
        "mark_failed",
        Mock(side_effect=PersistenceError("Synthetic failure.")),
    )
    cleanup = Mock()
    monkeypatch.setattr(service._workspace_repository, "cleanup", cleanup)
    with TestClient(app) as client:
        result = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "DEMO_ADMISSION_UNCERTAIN"
    cleanup.assert_not_called()


def test_profile_collision_inserted_after_reservation_survives_failed_cleanup(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    service = app.state.demo_session_service
    monkeypatch.setattr(service, "_id_factory", lambda: OWNER)
    ensure_profile = service._user_service.ensure_demo_profile
    app_pk = application_partition(OWNER, "00000000-0000-4000-8000-000000000088")
    durable = [
        {
            "PK": user_partition(OWNER),
            "SK": "PROFILE",
            "entity_type": "USER_PROFILE",
            "user_id": OWNER,
            "name": "Preserved durable fixture",
            "email": "fixture@example.invalid",
            "role": "STANDARD_USER",
            "created_at": "2026-10-01T00:00:00Z",
            "last_login_at": None,
            "expires_at": None,
        },
        {
            "PK": app_pk,
            "SK": "METADATA",
            "entity_type": "APPLICATION",
            "owner_user_id": OWNER,
            "application_id": "00000000-0000-4000-8000-000000000088",
            "version": 5,
            "GSI2PK": f"USER#{OWNER}#STATUS#APPLIED",
            "GSI2SK": "2026-10-01",
            "expires_at": None,
        },
        {
            "PK": app_pk,
            "SK": "NOTE#2026-10-01#preserve",
            "entity_type": "NOTE",
            "owner_user_id": OWNER,
            "body": "Unchanged durable fixture",
            "expires_at": None,
        },
    ]
    injected = [serialize_item(item) for item in durable]

    def insert_then_fail(identity: Any, attributes: Any) -> Any:
        for item in injected:
            dynamodb_client.put_item(TableName=TABLE, Item=item)
        return ensure_profile(identity, attributes)

    monkeypatch.setattr(service._user_service, "ensure_demo_profile", insert_then_fail)
    with TestClient(app) as client:
        failed = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "PERSISTENCE_UNAVAILABLE"
    for item in injected:
        key = {name: item[name] for name in ["PK", "SK"]}
        after = dynamodb_client.get_item(TableName=TABLE, Key=key, ConsistentRead=True)["Item"]
        assert after == item
    service._seed_workspace.assert_not_called()


@pytest.mark.parametrize(
    "collision", ["active", "profile", "settings", "counter", "legacy", "orphan"]
)
def test_forced_namespace_collision_preserves_full_durable_or_incompatible_items(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, collision: str
) -> None:
    app = make_app(dynamodb_client, monkeypatch)
    service = app.state.demo_session_service
    monkeypatch.setattr(service, "_id_factory", lambda: OWNER)
    root = user_partition(OWNER)
    app_pk = application_partition(OWNER, "00000000-0000-4000-8000-000000000088")
    roots: dict[str, dict[str, Any]] = {
        "active": workspace_to_item(
            DurableWorkspace(
                OWNER,
                IdentityKind.PERSISTENT,
                DurableWorkspaceState.ACTIVE,
                1,
                datetime(2026, 10, 1, tzinfo=UTC),
                datetime(2026, 10, 1, tzinfo=UTC),
                application_manifest_version=1,
            )
        ),
        "profile": {
            "PK": root,
            "SK": "PROFILE",
            "entity_type": "USER_PROFILE",
            "user_id": OWNER,
            "name": "Durable fictional owner",
        },
        "settings": {
            "PK": root,
            "SK": "SETTINGS",
            "entity_type": "WORKSPACE_SETTINGS",
            "user_id": OWNER,
            "time_zone": "Asia/Tokyo",
        },
        "counter": {
            "PK": root,
            "SK": "COUNTER#STATUS#APPLIED",
            "entity_type": "STATUS_COUNTER",
            "count": 7,
        },
        "legacy": {
            "PK": root,
            "SK": "LEGACY_METADATA",
            "entity_type": "LEGACY_ACCOUNT",
            "preserve": {"nested": [1, "unchanged"]},
        },
        "orphan": {
            "PK": app_pk,
            "SK": "METADATA",
            "entity_type": "APPLICATION",
            "owner_user_id": OWNER,
            "application_id": "00000000-0000-4000-8000-000000000088",
            "GSI2PK": f"USER#{OWNER}#STATUS#APPLIED",
            "GSI2SK": "2026-10-01",
            "version": 4,
            "company_name": "Durable fixture",
        },
    }
    initial = [roots[collision]]
    if collision in {"active", "orphan"}:
        initial.append(
            {
                "PK": app_pk,
                "SK": "NOTE#2026-10-01#1",
                "entity_type": "NOTE",
                "owner_user_id": OWNER,
                "body": "Durable fixture note",
            }
        )
    for item in initial:
        dynamodb_client.put_item(TableName=TABLE, Item=serialize_item(item))
    before = [partition(dynamodb_client, root), partition(dynamodb_client, app_pk)]
    with TestClient(app) as client:
        response = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DEMO_ADMISSION_UNAVAILABLE"
    assert [partition(dynamodb_client, root), partition(dynamodb_client, app_pk)] == before
    service._seed_workspace.assert_not_called()


def test_ready_reuse_original_deadline_and_existing_identities_ignore_pause_or_control_outage(
    dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, cognito_harness: Harness
) -> None:
    h = cognito_harness
    app = create_app(
        h.settings,
        dynamodb_client=dynamodb_client,
        cognito_authentication=h.verifier,
        account_clock=lambda: h.clock.now,
    )
    monkeypatch.setattr(app.state.demo_session_service, "_seed_workspace", Mock())
    account = {"Authorization": "Bearer " + h.token(username="CaseSensitive-Opaque-Subject")}
    with TestClient(app) as client:
        first = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
        assert first.status_code == 201
        demo_auth = {"Authorization": "Bearer " + first.json()["access_token"]}
        policy(dynamodb_client, enabled=False)
        paused = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY + "-new"})
        assert paused.status_code == 429
        assert (
            client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY}).json()
            == first.json()
        )
        original = dynamodb_client.get_item
        policy_reads = 0

        def fail_only_policy(**kwargs: Any) -> Any:
            nonlocal policy_reads
            if kwargs["Key"] == serialize_item(POLICY_KEY):
                policy_reads += 1
                raise ClientError(
                    {
                        "Error": {
                            "Code": "InternalServerError",
                            "Message": "private-control-store-failure",
                        }
                    },
                    "GetItem",
                )
            return original(**kwargs)

        monkeypatch.setattr(dynamodb_client, "get_item", fail_only_policy)
        replayed = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY})
        assert replayed.status_code == 201 and replayed.json() == first.json()
        assert client.get(API + "/me", headers=demo_auth).status_code == 200
        demo_app = client.post(
            API + "/applications",
            headers=demo_auth,
            json={"company_name": "Demo fixture", "job_title": "Fictional role"},
        )
        assert demo_app.status_code == 201
        assert client.post(API + "/me/bootstrap", headers=account, json={}).status_code == 200
        personal_app = client.post(
            API + "/applications",
            headers=account,
            json={"company_name": "Personal fixture", "job_title": "Fictional role"},
        )
        assert personal_app.status_code == 201
        assert client.get(API + "/me", headers=account).status_code == 200
        assert client.get(API + "/me/applications/export", headers=account).status_code == 200
        assert client.get(API + "/me/export", headers=account).status_code == 200
        assert (
            client.get(
                API + f"/applications/{demo_app.json()['application_id']}", headers=account
            ).status_code
            == 404
        )
        assert (
            client.get(
                API + f"/applications/{personal_app.json()['application_id']}", headers=demo_auth
            ).status_code
            == 404
        )
        assert policy_reads == 0
        denied = client.post(API + "/demo-sessions", headers={"Idempotency-Key": KEY + "-other"})
        assert (
            denied.status_code == 503
            and denied.json()["error"]["code"] == "DEMO_ADMISSION_UNAVAILABLE"
        )
        assert policy_reads == 1
        assert client.get(API + "/auth/config").json()["capabilities"] == ["demo", "cognito"]
    assert app.state.demo_session_service._seed_workspace.call_count == 1
