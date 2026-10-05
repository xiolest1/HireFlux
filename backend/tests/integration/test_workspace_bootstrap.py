import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from threading import Barrier, Lock
from typing import Any

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from conftest import test_settings as build_test_settings
from fastapi.testclient import TestClient

from hireflux_backend.application.workspace_bootstrap import WorkspaceBootstrapService
from hireflux_backend.auth.local import identity_from_settings, profile_attributes_from_settings
from hireflux_backend.domain.models import IdentityKind, UserProfile
from hireflux_backend.domain.workspace import (
    BOOTSTRAP_VERSION,
    DurableWorkspace,
    DurableWorkspaceState,
    WorkspaceSnapshot,
    default_workspace_settings,
)
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    profile_to_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.resource_mapping import settings_to_item
from hireflux_backend.infrastructure.dynamodb.workspace_bootstrap_repository import (
    DynamoWorkspaceBootstrapRepository,
    workspace_to_item,
)
from hireflux_backend.main import create_app

OWNER = "00000000-0000-4000-8000-000000000001"
NOW = datetime(2026, 9, 1, tzinfo=UTC)


def owner_items(client: Any, owner: str = OWNER) -> list[dict[str, Any]]:
    return partition_items(client, user_partition(owner))


def partition_items(client: Any, partition: str) -> list[dict[str, Any]]:
    return [
        deserialize_item(item)
        for item in client.query(
            TableName="HireFluxTest",
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues=serialize_item({":pk": partition}),
            ConsistentRead=True,
        )["Items"]
    ]


def put(client: Any, item: dict[str, Any]) -> None:
    client.put_item(TableName="HireFluxTest", Item=serialize_item(item))


def delete_component(client: Any, component: str) -> None:
    client.delete_item(
        TableName="HireFluxTest", Key=serialize_item({"PK": user_partition(OWNER), "SK": component})
    )


def legacy_profile() -> UserProfile:
    return UserProfile(
        OWNER,
        "Demo Recruiter",
        "legacy@example.invalid",
        build_test_settings().local_user_role,
        NOW,
        NOW,
    )


def provisioning_record() -> DurableWorkspace:
    return DurableWorkspace(
        OWNER, IdentityKind.LOCAL, DurableWorkspaceState.PROVISIONING, BOOTSTRAP_VERSION, NOW, NOW
    )


def test_every_ordinary_route_requires_bootstrap_before_any_side_effect(
    dynamodb_client: Any,
) -> None:
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    checked = 0
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        for route_path, operations in app.openapi()["paths"].items():
            if not route_path.startswith("/api/v1/"):
                continue
            if route_path in {"/api/v1/me/bootstrap", "/api/v1/demo-sessions"}:
                continue
            path = re.sub(r"\{[^}]+\}", OWNER, route_path)
            for method in operations:
                response = client.request(method, path, json={})
                assert response.status_code == 409, (method, path, response.text)
                assert response.json()["error"]["code"] == "WORKSPACE_BOOTSTRAP_REQUIRED"
                assert response.json()["error"]["request_id"]
                checked += 1
        assert checked >= 30
    assert owner_items(dynamodb_client) == []


def test_empty_bootstrap_is_read_only_on_retry_and_survives_new_app(dynamodb_client: Any) -> None:
    settings = build_test_settings()
    first_app = create_app(settings, dynamodb_client=dynamodb_client)
    with TestClient(first_app) as client:
        first = client.post("/api/v1/me/bootstrap", json={})
        assert first.status_code == 200
        assert first.headers["Cache-Control"] == "no-store"
        payload = first.json()
        assert payload["state"] == "ACTIVE"
        assert payload["identity_kind"] == "LOCAL"
        assert payload["bootstrap_version"] == 1
        assert payload["settings"]["time_zone"] == "UTC"
        assert payload["profile"]["last_login_at"] is None
        stored = owner_items(dynamodb_client)
        assert {item["SK"] for item in stored} == {"WORKSPACE", "PROFILE", "SETTINGS"}
        assert all("expires_at" not in item for item in stored)
        assert client.get("/api/v1/applications").json()["items"] == []
        for path in ("/api/v1/dashboard", "/api/v1/analytics", "/api/v1/pipeline"):
            assert client.get(path).status_code == 200
        assert client.post("/api/v1/me/bootstrap").json() == payload
        assert client.get("/api/v1/me").json() == payload["profile"]
        assert owner_items(dynamodb_client) == stored
    restarted = create_app(settings, dynamodb_client=dynamodb_client)
    with TestClient(restarted) as client:
        assert client.get("/api/v1/me").json() == payload["profile"]
        assert client.post("/api/v1/me/bootstrap").json() == payload
    assert owner_items(dynamodb_client) == stored


@pytest.mark.parametrize(
    "field",
    [
        "owner_user_id",
        "user_id",
        "role",
        "name",
        "email",
        "identity_kind",
        "expires_at",
        "data_expires_at",
        "password",
    ],
)
def test_bootstrap_rejects_client_authority(dynamodb_client: Any, field: str) -> None:
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    with TestClient(app) as client:
        response = client.post("/api/v1/me/bootstrap", json={field: "injected"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert owner_items(dynamodb_client) == []


@pytest.mark.parametrize(
    "existing", ["profile", "settings", "both", "marker", "marker_profile", "marker_settings"]
)
def test_partial_and_legacy_bootstrap_preserves_existing_records(
    dynamodb_client: Any,
    existing: str,
) -> None:
    profile = profile_to_item(legacy_profile())
    # Represent the old creation-only value; API must not claim it is a login event.
    profile["last_login_at"] = "2026-09-01T00:00:00.000000Z"
    preferences = settings_to_item(
        replace(
            default_workspace_settings(OWNER, NOW),
            time_zone="America/New_York",
            version=8,
        )
    )
    if "profile" in existing or existing == "both":
        put(dynamodb_client, profile)
    if "settings" in existing or existing == "both":
        put(dynamodb_client, preferences)
    if "marker" in existing:
        put(dynamodb_client, workspace_to_item(provisioning_record()))
    before = {item["SK"]: item for item in owner_items(dynamodb_client)}
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    with TestClient(app) as client:
        response = client.post("/api/v1/me/bootstrap")
        assert response.status_code == 200, response.text
        first = response.json()
        assert client.post("/api/v1/me/bootstrap").json() == first
        assert client.get("/api/v1/me").json()["last_login_at"] is None
        if "PROFILE" in before:
            assert client.get("/api/v1/me").json()["name"] == "Demo Recruiter"
    after = {item["SK"]: item for item in owner_items(dynamodb_client)}
    for key in ("PROFILE", "SETTINGS"):
        if key in before:
            assert after[key] == before[key]
    assert after["WORKSPACE"]["state"] == "ACTIVE"
    if "WORKSPACE" in before:
        assert after["WORKSPACE"]["created_at"] == before["WORKSPACE"]["created_at"]
    assert all("expires_at" not in item for item in after.values())


@pytest.mark.parametrize("component", ["PROFILE", "SETTINGS"])
def test_active_missing_component_has_explicit_recovery_policy(
    dynamodb_client: Any,
    component: str,
) -> None:
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    with TestClient(app) as client:
        assert client.post("/api/v1/me/bootstrap").status_code == 200
        delete_component(dynamodb_client, component)
        before = owner_items(dynamodb_client)
        assert client.get("/api/v1/settings").status_code == 409
        result = client.post("/api/v1/me/bootstrap")
        if component == "PROFILE":
            assert result.status_code == 200
            assert client.get("/api/v1/me").status_code == 200
        else:
            assert result.status_code == 409
            assert result.json()["error"]["code"] == "WORKSPACE_BOOTSTRAP_CONFLICT"
            assert owner_items(dynamodb_client) == before


@pytest.mark.parametrize(
    "conflict",
    [
        "ttl_profile",
        "ttl_settings",
        "demo_marker",
        "foreign_owner",
        "other_kind",
        "new_version",
        "bad_type",
    ],
)
def test_incompatible_storage_is_never_converted(dynamodb_client: Any, conflict: str) -> None:
    if conflict == "ttl_profile":
        item = profile_to_item(replace(legacy_profile(), expires_at=123))
    elif conflict == "ttl_settings":
        item = settings_to_item(replace(default_workspace_settings(OWNER, NOW), expires_at=123))
    else:
        item = workspace_to_item(provisioning_record())
        if conflict == "demo_marker":
            item.update(entity_type="DEMO_WORKSPACE", expires_at=123)
        elif conflict == "foreign_owner":
            item["owner_user_id"] = "00000000-0000-4000-8000-000000000099"
        elif conflict == "other_kind":
            item["identity_kind"] = "PERSISTENT"
        elif conflict == "new_version":
            item["bootstrap_version"] = 2
        else:
            item["entity_type"] = "UNKNOWN"
    put(dynamodb_client, item)
    before = owner_items(dynamodb_client)
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    with TestClient(app) as client:
        for response in (client.post("/api/v1/me/bootstrap"), client.get("/api/v1/me")):
            assert response.status_code == 409
            assert response.json()["error"]["code"] == "WORKSPACE_BOOTSTRAP_CONFLICT"
    assert owner_items(dynamodb_client) == before


@pytest.mark.parametrize("existing", [None, "PROFILE", "SETTINGS"])
def test_atomic_failure_and_lost_response_can_retry_without_reset(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
    existing: str | None,
) -> None:
    if existing == "PROFILE":
        put(dynamodb_client, profile_to_item(legacy_profile()))
    if existing == "SETTINGS":
        put(dynamodb_client, settings_to_item(default_workspace_settings(OWNER, NOW)))
    before = owner_items(dynamodb_client)
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    original = dynamodb_client.transact_write_items

    def fail(**arguments: Any) -> None:
        raise ClientError(
            {
                "Error": {"Code": "TransactionCanceledException", "Message": "private"},
                "CancellationReasons": [{"Code": "ProvisionedThroughputExceeded"}],
            },
            "TransactWriteItems",
        )

    with TestClient(app) as client:
        monkeypatch.setattr(dynamodb_client, "transact_write_items", fail)
        result = client.post("/api/v1/me/bootstrap")
        assert result.status_code == 503
        assert "private" not in result.text
        assert owner_items(dynamodb_client) == before

        def commit_then_lose_response(**arguments: Any) -> None:
            original(**arguments)
            raise EndpointConnectionError(endpoint_url="https://private.invalid")

        monkeypatch.setattr(dynamodb_client, "transact_write_items", commit_then_lose_response)
        assert client.post("/api/v1/me/bootstrap").status_code == 503
        after_commit = owner_items(dynamodb_client)
        assert len(after_commit) == 3
        monkeypatch.setattr(dynamodb_client, "transact_write_items", original)
        assert client.post("/api/v1/me/bootstrap").status_code == 200
        assert owner_items(dynamodb_client) == after_commit


def test_two_bootstrappers_converge_after_reading_the_same_empty_owner(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = DynamoWorkspaceBootstrapRepository(dynamodb_client, "HireFluxTest")
    service = WorkspaceBootstrapService(repository)
    settings = build_test_settings()
    barrier, lock = Barrier(2), Lock()
    reads = 0
    original = repository.read
    original_transaction = dynamodb_client.transact_write_items
    transaction_lock = Lock()

    def atomic_transaction(**arguments: Any) -> Any:
        # Moto's Python transaction rollback is not isolated across threads.
        # Serialize the atomic datastore operation, while requests/read snapshots race.
        with transaction_lock:
            return original_transaction(**arguments)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", atomic_transaction)

    def synchronized_read(owner: str) -> WorkspaceSnapshot:
        nonlocal reads
        snapshot = original(owner)
        with lock:
            reads += 1
            wait = reads <= 2
        if wait:
            barrier.wait(timeout=10)
        return snapshot

    monkeypatch.setattr(repository, "read", synchronized_read)
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(
                service.bootstrap,
                identity_from_settings(settings),
                profile_attributes_from_settings(settings),
            )
            for _ in range(2)
        ]
        results = [future.result(timeout=20) for future in futures]
    assert results[0] == results[1]
    assert len(owner_items(dynamodb_client)) == 3


def test_concurrent_settings_edit_is_preserved_when_adopting_legacy_workspace(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    preferences = default_workspace_settings(OWNER, NOW)
    put(dynamodb_client, settings_to_item(preferences))
    repository = DynamoWorkspaceBootstrapRepository(dynamodb_client, "HireFluxTest")
    original = repository.commit
    edited = replace(preferences, time_zone="America/Chicago", version=2)
    attempts = 0

    def race(prior: WorkspaceSnapshot, proposed: Any) -> bool:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            put(dynamodb_client, settings_to_item(edited))
        return original(prior, proposed)

    monkeypatch.setattr(repository, "commit", race)
    settings = build_test_settings()
    result = WorkspaceBootstrapService(repository).bootstrap(
        identity_from_settings(settings), profile_attributes_from_settings(settings)
    )
    assert result.settings == edited
    assert attempts == 2


def test_persistence_read_errors_are_safe_and_do_not_bootstrap(
    dynamodb_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)

    def unavailable(**arguments: Any) -> None:
        raise EndpointConnectionError(endpoint_url="https://internal.invalid")

    with monkeypatch.context() as patch:
        patch.setattr(dynamodb_client, "query", unavailable)
        with TestClient(app) as client:
            for response in (client.post("/api/v1/me/bootstrap"), client.get("/api/v1/settings")):
                assert response.status_code == 503
                assert response.json()["error"]["code"] == "PERSISTENCE_UNAVAILABLE"
                assert "internal" not in response.text
    assert owner_items(dynamodb_client) == []


@pytest.mark.parametrize("mode", ["local", "demo"])
def test_real_product_flows_keep_all_items_at_the_correct_data_lifetime(
    dynamodb_client: Any,
    mode: str,
) -> None:
    settings = build_test_settings(
        auth_mode=mode, demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes"
    )
    app = create_app(settings, dynamodb_client=dynamodb_client)
    headers: dict[str, str] = {}
    with TestClient(app) as client:
        if mode == "demo":
            session = client.post(
                "/api/v1/demo-sessions",
                headers={"Idempotency-Key": "lifetime-regression-session-1234"},
            )
            assert session.status_code == 201
            token = session.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            claims = app.state.demo_session_codec.verify(token)
            expected_expiry = int(claims.expires_at.timestamp())
            owner = claims.workspace_id
            assert client.post("/api/v1/me/bootstrap", headers=headers).status_code == 403

            # Verified demo tokens do not read durable readiness metadata.
            def forbidden_read(_: str) -> WorkspaceSnapshot:
                raise AssertionError("demo readiness should not query durable storage")

            app.state.workspace_bootstrap_service._repository.read = forbidden_read
        else:
            assert client.post("/api/v1/me/bootstrap").status_code == 200
            expected_expiry = None
            owner = OWNER
        assert client.get("/api/v1/me", headers=headers).status_code == 200
        application = client.post(
            "/api/v1/applications",
            headers=headers,
            json={
                "company_name": "Durability Labs",
                "job_title": "Engineer",
                "status": "DRAFT",
            },
        )
        assert application.status_code == 201, application.text
        data = application.json()
        app_id = data["application_id"]
        path = f"/api/v1/applications/{app_id}"
        updated = client.patch(
            path,
            headers=headers,
            json={
                "expected_version": data["version"],
                "location": "New York",
            },
        )
        assert updated.status_code == 200
        data = updated.json()
        stale = client.patch(
            path,
            headers=headers,
            json={
                "expected_version": 1,
                "location": "Stale edit",
            },
        )
        assert stale.status_code == 409
        for target in ("APPLIED", "INTERVIEW", "OFFER", "ARCHIVED", "OFFER"):
            payload: dict[str, Any] = {"status": target, "expected_version": data["version"]}
            if target == "APPLIED":
                payload["applied_date"] = datetime.now(UTC).date().isoformat()
            response = client.post(path + "/status", headers=headers, json=payload)
            assert response.status_code == 200, response.text
            data = response.json()
        assert data["first_offer_at"] is not None
        note = client.post(path + "/notes", headers=headers, json={"content": "Durable note"})
        assert note.status_code == 201
        note_data = note.json()
        assert (
            client.patch(
                path + f"/notes/{note_data['note_id']}",
                headers=headers,
                json={
                    "expected_version": note_data["version"],
                    "content": "Updated note",
                },
            ).status_code
            == 200
        )
        interview = client.post(
            path + "/interviews",
            headers=headers,
            json={
                "interview_type": "TECHNICAL_SCREEN",
                "scheduled_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            },
        )
        assert interview.status_code == 201, interview.text
        interview_data = interview.json()
        interview_path = path + f"/interviews/{interview_data['interview_id']}"
        response = client.patch(
            interview_path + "/workspace",
            headers=headers,
            json={
                "expected_version": interview_data["version"],
                "completed_checklist_items": [],
                "preparation_notes": "Review examples",
                "candidate_questions": ["How is success measured?"],
                "debrief_went_well": None,
                "debrief_improve": None,
                "debrief_signals": None,
                "debrief_next_step": None,
                "debrief_complete": False,
            },
        )
        assert response.status_code == 200, response.text
        preferences = client.get("/api/v1/settings", headers=headers).json()
        changed_settings = client.patch(
            "/api/v1/settings",
            headers=headers,
            json={
                "expected_version": preferences["version"],
                "time_zone": "America/Chicago",
                "theme": "DARK",
            },
        )
        assert changed_settings.status_code == 200
        for resource in (
            "/api/v1/dashboard",
            "/api/v1/analytics",
            "/api/v1/pipeline",
            "/api/v1/applications/workspace",
            "/api/v1/interviews",
            path + "/activity",
        ):
            assert client.get(resource, headers=headers).status_code == 200, resource
        if mode == "local":
            assert client.get("/api/v1/me/export").status_code == 200
            assert client.post("/api/v1/me/bootstrap").json()["settings"] == changed_settings.json()
        application_ids = [
            item["application_id"]
            for item in client.get(
                "/api/v1/applications",
                params={"view": "ALL", "limit": 100},
                headers=headers,
            ).json()["items"]
        ]
    stored = owner_items(dynamodb_client, owner)
    for application_id in application_ids:
        stored += partition_items(dynamodb_client, application_partition(owner, application_id))
    if mode == "demo":
        import hashlib

        digest = hashlib.sha256(b"lifetime-regression-session-1234").hexdigest()
        stored += partition_items(dynamodb_client, f"DEMO_IDEMPOTENCY#{digest}")
    types = {item["entity_type"] for item in stored}
    assert {
        "USER_PROFILE",
        "WORKSPACE_SETTINGS",
        "APPLICATION",
        "NOTE",
        "INTERVIEW",
        "ACTIVITY",
        "WORKSPACE_CONTEXT",
    } <= types
    # Check helper items by key as well as canonical entities, including lazy counters.
    keys = {item["SK"] for item in stored}
    assert "RESOURCE_QUOTA" in keys
    assert any("COUNTER" in key for key in keys)
    assert any("QUOTA" in key for key in keys)
    for item in stored:
        if expected_expiry is None:
            assert "expires_at" not in item, item
        else:
            assert item.get("expires_at") == expected_expiry, item
    if mode == "local":
        restarted = create_app(settings, dynamodb_client=dynamodb_client)
        with TestClient(restarted) as client:
            assert client.get(path).json() == data
            assert client.get(path + "/notes").json()["items"][0]["content"] == "Updated note"
            interviews = client.get(path + "/interviews").json()["items"]
            assert interviews[0]["preparation_notes"] == "Review examples"
            assert client.get("/api/v1/settings").json() == changed_settings.json()
            assert client.post("/api/v1/me/bootstrap").status_code == 200


@pytest.mark.parametrize("archived", [False, True])
def test_legacy_application_graph_is_adopted_without_rewrite_and_ttl_conflicts_are_rejected(
    dynamodb_client: Any,
    archived: bool,
) -> None:
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    with TestClient(app) as client:
        assert client.post("/api/v1/me/bootstrap").status_code == 200
        data = client.post(
            "/api/v1/applications",
            json={"company_name": "Legacy local data", "job_title": "Engineer"},
        ).json()
        path = f"/api/v1/applications/{data['application_id']}"
        note = client.post(path + "/notes", json={"content": "Preserve me"}).json()
        if archived:
            assert (
                client.post(
                    path + "/status",
                    json={
                        "expected_version": data["version"],
                        "status": "ARCHIVED",
                    },
                ).status_code
                == 200
            )
        app_partition = application_partition(OWNER, data["application_id"])
        before = partition_items(dynamodb_client, app_partition)
        delete_component(dynamodb_client, "WORKSPACE")
        assert client.post("/api/v1/me/bootstrap").status_code == 200
        assert partition_items(dynamodb_client, app_partition) == before
        delete_component(dynamodb_client, "WORKSPACE")
        dynamodb_client.update_item(
            TableName="HireFluxTest",
            Key=serialize_item(
                {
                    "PK": app_partition,
                    "SK": f"NOTE#{note['note_id']}",
                }
            ),
            UpdateExpression="SET expires_at = :expiry",
            ExpressionAttributeValues=serialize_item({":expiry": 123}),
        )
        conflict_before = owner_items(dynamodb_client)
        graph_before = partition_items(dynamodb_client, app_partition)
        response = client.post("/api/v1/me/bootstrap")
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "WORKSPACE_BOOTSTRAP_CONFLICT"
    assert owner_items(dynamodb_client) == conflict_before
    assert partition_items(dynamodb_client, app_partition) == graph_before
