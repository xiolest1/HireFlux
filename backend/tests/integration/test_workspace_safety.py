from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest
from botocore.exceptions import EndpointConnectionError
from conftest import test_settings as build_settings
from fastapi.testclient import TestClient

from hireflux_backend.api.dependencies import get_current_identity
from hireflux_backend.application.errors import (
    ConflictError,
    HireFluxError,
    PersistenceError,
    WorkspaceManifestIncompleteError,
)
from hireflux_backend.auth.local import identity_from_settings
from hireflux_backend.config import Settings
from hireflux_backend.domain.enums import UserRole
from hireflux_backend.domain.models import CurrentIdentity, IdentityKind
from hireflux_backend.infrastructure.dynamodb.manifest_backfill import backfill_local_manifest
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.reconciliation import reconcile_local_projections
from hireflux_backend.infrastructure.dynamodb.workspace_safety_repository import (
    DynamoWorkspaceSafetyRepository,
)
from hireflux_backend.main import create_app

OWNER = "00000000-0000-4000-8000-000000000001"


def put(db: Any, item: dict[str, Any]) -> None:
    db.put_item(TableName="HireFluxTest", Item=serialize_item(item))


def items(db: Any, pk: str | None = None) -> list[dict[str, Any]]:
    if pk is None:
        return sorted(
            [deserialize_item(raw) for raw in db.scan(TableName="HireFluxTest")["Items"]],
            key=lambda x: (x["PK"], x["SK"]),
        )
    return [
        deserialize_item(raw)
        for raw in db.query(
            TableName="HireFluxTest",
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues=serialize_item({":pk": pk}),
            ConsistentRead=True,
        )["Items"]
    ]


def create(client: TestClient, *, active: bool = False) -> dict[str, Any]:
    payload: dict[str, Any] = {"company_name": "Fictional Safety Labs", "job_title": "Engineer"}
    if active:
        payload.update(status="APPLIED", applied_date="2026-10-05", follow_up_date="2030-01-01")
    response = client.post("/api/v1/applications", json=payload)
    assert response.status_code == 201, response.text
    return dict(response.json())


def freeze(client: TestClient) -> None:
    service = client.app.state.workspace_erasure_service
    identity = identity_from_settings(client.app.state.settings)
    workspace = service.status(identity).workspace
    service._repository.freeze(workspace, datetime.now(UTC))


def local_settings() -> Settings:
    return build_settings(
        environment="local",
        dynamodb_endpoint_url="http://127.0.0.1:8001",
        aws_access_key_id="LOCALTESTACCESSKEY",
        aws_secret_access_key="LOCALTESTSECRETKEY",
    )


def make_legacy(db: Any) -> None:
    for item in items(db, user_partition(OWNER)):
        if item["SK"].startswith("APPLICATION_REF#"):
            db.delete_item(
                TableName="HireFluxTest", Key=serialize_item({"PK": item["PK"], "SK": item["SK"]})
            )
        if item["SK"] == "WORKSPACE":
            item.pop("application_manifest_version", None)
            put(db, item)


def test_manifest_atomicity_lifecycle_and_duplicate_conflict(
    client: TestClient, dynamodb_client: Any
) -> None:
    app = create(client)
    application_id = app["application_id"]
    ref = next(
        item
        for item in items(dynamodb_client, user_partition(OWNER))
        if item["SK"].startswith("APPLICATION_REF#")
    )
    assert set(ref) == {"PK", "SK", "entity_type", "owner_user_id", "application_id"}
    path = f"/api/v1/applications/{application_id}"
    archived = client.delete(path, params={"expected_version": app["version"]})
    assert archived.status_code == 200
    restored = client.post(
        path + "/status", json={"status": "DRAFT", "expected_version": archived.json()["version"]}
    )
    assert restored.status_code == 200
    assert ref in items(dynamodb_client, user_partition(OWNER))
    client.post(path + "/notes", json={"content": "Fictional"})
    assert (
        sum(
            item["SK"].startswith("APPLICATION_REF#")
            for item in items(dynamodb_client, user_partition(OWNER))
        )
        == 1
    )
    repository = client.app.state.application_service._repository
    canonical = repository.get(OWNER, application_id)
    activity = client.app.state.application_service.list_activity(
        identity_from_settings(client.app.state.settings), application_id, limit=10, cursor=None
    ).items[0]
    before = items(dynamodb_client)
    with pytest.raises(ConflictError):
        repository.create(canonical, activity)
    assert items(dynamodb_client) == before


@pytest.mark.parametrize(
    "operation",
    [
        "create",
        "edit",
        "label",
        "status",
        "archive",
        "restore",
        "followup",
        "settings",
        "note_create",
        "note_edit",
        "note_delete",
        "interview_create",
        "interview_edit",
        "preparation",
    ],
)
def test_preflight_then_freeze_denies_each_write_atomically(
    client: TestClient, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, operation: str
) -> None:
    app = create(client, active=True)
    path = f"/api/v1/applications/{app['application_id']}"
    note = client.post(path + "/notes", json={"content": "Before freeze"}).json()
    interview = client.post(
        path + "/interviews",
        json={"interview_type": "TECHNICAL_SCREEN", "scheduled_at": "2030-01-02T12:00:00Z"},
    ).json()
    if operation == "restore":
        archived = client.delete(path, params={"expected_version": app["version"]})
        app = archived.json()
    calls = {
        "create": (
            "POST",
            "/api/v1/applications",
            {"company_name": "Denied", "job_title": "Engineer"},
        ),
        "edit": ("PATCH", path, {"expected_version": app["version"], "description": "Denied"}),
        "label": ("PATCH", path, {"expected_version": app["version"], "company_name": "Denied"}),
        "status": (
            "POST",
            path + "/status",
            {"expected_version": app["version"], "status": "SCREENING"},
        ),
        "archive": ("DELETE", path + f"?expected_version={app['version']}", None),
        "restore": (
            "POST",
            path + "/status",
            {"status": "APPLIED", "expected_version": app["version"]},
        ),
        "followup": ("POST", path + "/follow-up/complete", {"expected_version": app["version"]}),
        "settings": ("PATCH", "/api/v1/settings", {"expected_version": 1, "theme": "DARK"}),
        "note_create": ("POST", path + "/notes", {"content": "Denied"}),
        "note_edit": (
            "PATCH",
            path + f"/notes/{note['note_id']}",
            {"expected_version": 1, "content": "Denied"},
        ),
        "note_delete": ("DELETE", path + f"/notes/{note['note_id']}?expected_version=1", None),
        "interview_create": (
            "POST",
            path + "/interviews",
            {"interview_type": "BEHAVIORAL", "scheduled_at": "2030-01-03T12:00:00Z"},
        ),
        "interview_edit": (
            "PATCH",
            path + f"/interviews/{interview['interview_id']}",
            {"expected_version": 1, "details": "Denied"},
        ),
        "preparation": (
            "POST",
            path + f"/interviews/{interview['interview_id']}/preparation-items",
            {"expected_version": 1, "label": "Denied"},
        ),
    }
    original = dynamodb_client.transact_write_items
    snapshot: list[dict[str, Any]] = []
    intercepted = False

    def intercept(**arguments: Any) -> Any:
        nonlocal intercepted, snapshot
        if not intercepted:
            intercepted = True
            freeze(client)
            snapshot = items(dynamodb_client)
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", intercept)
    method, route, payload = calls[operation]
    response = client.request(method, route, json=payload)
    assert intercepted, (operation, response.text)
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "WORKSPACE_DELETING"
    assert items(dynamodb_client) == snapshot


def test_bounded_partition_complete_erasure_and_tombstone(dynamodb_client: Any) -> None:
    app = create_app(
        build_settings(account_erasure_max_items_per_request=2), dynamodb_client=dynamodb_client
    )
    with TestClient(app) as client:
        client.post("/api/v1/me/bootstrap")
        application = create(client, active=True)
        path = f"/api/v1/applications/{application['application_id']}"
        client.post(path + "/notes", json={"content": "Erase this private note"})
        client.post(
            path + "/interviews",
            json={"interview_type": "TECHNICAL_SCREEN", "scheduled_at": "2030-01-02T12:00:00Z"},
        )
        second = create(client)
        assert (
            client.delete(
                f"/api/v1/applications/{second['application_id']}?expected_version=1"
            ).status_code
            == 200
        )
        put(
            dynamodb_client,
            {
                "PK": application_partition(OWNER, application["application_id"]),
                "SK": "FUTURE#PRIVATE",
                "content": "Unknown child",
            },
        )
        put(
            dynamodb_client,
            {"PK": user_partition(OWNER), "SK": "FUTURE#OWNER", "content": "Unknown owner data"},
        )
        put(
            dynamodb_client,
            {
                "PK": user_partition("foreign-owner"),
                "SK": "PROFILE",
                "content": "Keep foreign data",
            },
        )
        first = client.delete("/api/v1/me")
        assert first.status_code == 202
        assert first.json()["state"] == "DELETING"
        for route in (
            "/api/v1/me",
            "/api/v1/settings",
            "/api/v1/applications",
            "/api/v1/dashboard",
            "/api/v1/analytics",
            "/api/v1/pipeline",
            "/api/v1/me/export",
            "/api/v1/me/applications/export",
        ):
            denied = client.get(route)
            assert denied.json()["error"]["code"] == "WORKSPACE_DELETING"
        assert client.post("/api/v1/me/bootstrap").json()["error"]["code"] == "WORKSPACE_DELETING"
        for _attempt in range(100):
            result = client.post("/api/v1/me/deletion/retry")
            if result.status_code == 200:
                break
        else:
            pytest.fail("Erasure failed to converge")
        final = result.json()
        assert final["state"] == "DELETED"
        assert client.delete("/api/v1/me").json() == final
        assert client.get("/api/v1/me/deletion").json() == final
        assert client.post("/api/v1/me/bootstrap").json()["error"]["code"] == "WORKSPACE_DELETED"
        assert client.get("/api/v1/me/export").json()["error"]["code"] == "WORKSPACE_DELETED"
        retained = items(dynamodb_client, user_partition(OWNER))
        assert len(retained) == 1 and retained[0]["SK"] == "WORKSPACE"
        assert set(retained[0]) == {
            "PK",
            "SK",
            "entity_type",
            "owner_user_id",
            "identity_kind",
            "state",
            "bootstrap_version",
            "created_at",
            "updated_at",
            "deletion_started_at",
            "deletion_completed_at",
        }
        assert all(
            not item["PK"].startswith(user_partition(OWNER) + "#APPLICATION#")
            for item in items(dynamodb_client)
        )
        assert (
            items(dynamodb_client, user_partition("foreign-owner"))[0]["content"]
            == "Keep foreign data"
        )


@pytest.mark.parametrize("failure", ["unprocessed_once", "unprocessed_always", "transient"])
def test_retryable_batch_failures_keep_refs_until_partition_empty(
    client: TestClient, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    application = create(client)
    original = dynamodb_client.batch_write_item
    calls = 0

    def faulty(**arguments: Any) -> Any:
        nonlocal calls
        calls += 1
        if failure == "transient":
            raise EndpointConnectionError(endpoint_url="http://localhost:8001")
        if failure == "unprocessed_always" or calls == 1:
            return {"UnprocessedItems": arguments["RequestItems"]}
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "batch_write_item", faulty)
    result = client.delete("/api/v1/me")
    if failure == "unprocessed_once":
        assert result.json()["state"] == "DELETED"
        assert calls >= 2
    else:
        assert result.json()["state"] == "DELETING"
        assert any(
            item["SK"] == f"APPLICATION_REF#{application['application_id']}"
            for item in items(dynamodb_client, user_partition(OWNER))
        )
        assert calls <= 4
        if failure == "transient":
            assert result.json()["retryable_failure"] is True
        monkeypatch.setattr(dynamodb_client, "batch_write_item", original)
        assert client.post("/api/v1/me/deletion/retry").json()["state"] == "DELETED"


def test_legacy_manifest_adoption_is_verified_and_non_destructive(
    client: TestClient, dynamodb_client: Any
) -> None:
    first = create(client, active=True)
    second = create(client)
    client.delete(f"/api/v1/applications/{second['application_id']}?expected_version=1")
    client.post(
        f"/api/v1/applications/{first['application_id']}/notes", json={"content": "Keep note"}
    )
    client.patch(
        "/api/v1/settings",
        json={"expected_version": 1, "time_zone": "Asia/Tokyo", "theme": "LIGHT"},
    )
    make_legacy(dynamodb_client)
    before = items(dynamodb_client)
    for route in ("/api/v1/me/export",):
        assert client.get(route).json()["error"]["code"] == "WORKSPACE_MANIFEST_INCOMPLETE"
    assert client.delete("/api/v1/me").json()["error"]["code"] == "WORKSPACE_MANIFEST_INCOMPLETE"
    assert (
        backfill_local_manifest(
            local_settings(), confirmation="HireFluxTest", owner=OWNER, client=dynamodb_client
        )
        == 2
    )
    after = items(dynamodb_client)
    for item in before:
        if item["SK"] != "WORKSPACE":
            assert item in after
    assert (
        backfill_local_manifest(
            local_settings(), confirmation="HireFluxTest", owner=OWNER, client=dynamodb_client
        )
        == 2
    )
    assert after == items(dynamodb_client)
    exported = client.get("/api/v1/me/export")
    assert exported.status_code == 200, exported.text
    assert exported.json()["counts"]["applications"] == 2
    assert exported.json()["counts"]["notes"] == 1


@pytest.mark.parametrize("corruption", ["count", "orphan", "ttl", "wrong_owner", "demo", "state"])
def test_backfill_fails_closed_on_incomplete_or_incompatible_evidence(
    client: TestClient, dynamodb_client: Any, corruption: str
) -> None:
    application = create(client)
    make_legacy(dynamodb_client)
    owner_records = {item["SK"]: item for item in items(dynamodb_client, user_partition(OWNER))}
    if corruption == "count":
        put(dynamodb_client, owner_records["WORKSPACE_QUOTA"] | {"application_count": 2})
    elif corruption == "orphan":
        missing = str(uuid4())
        put(
            dynamodb_client,
            {
                "PK": user_partition(OWNER),
                "SK": f"APPLICATION_REF#{missing}",
                "entity_type": "APPLICATION_REF",
                "owner_user_id": OWNER,
                "application_id": missing,
            },
        )
    elif corruption in {"ttl", "wrong_owner"}:
        canonical = next(
            item
            for item in items(
                dynamodb_client, application_partition(OWNER, application["application_id"])
            )
            if item["SK"] == "METADATA"
        )
        put(
            dynamodb_client,
            canonical
            | (
                {"expires_at": 9999999999}
                if corruption == "ttl"
                else {"owner_user_id": str(uuid4())}
            ),
        )
    elif corruption == "demo":
        put(
            dynamodb_client,
            owner_records["WORKSPACE"] | {"identity_kind": "DEMO", "expires_at": 9999999999},
        )
    else:
        put(dynamodb_client, owner_records["WORKSPACE"] | {"state": "DELETING"})
    with pytest.raises(HireFluxError):
        backfill_local_manifest(
            local_settings(), confirmation="HireFluxTest", owner=OWNER, client=dynamodb_client
        )
    assert "application_manifest_version" not in next(
        item for item in items(dynamodb_client, user_partition(OWNER)) if item["SK"] == "WORKSPACE"
    )


@pytest.mark.parametrize("limit", ["records", "bytes", "time"])
def test_export_budget_refuses_partial_success(client: TestClient, limit: str) -> None:
    create(client)
    service = client.app.state.workspace_export_service
    if limit == "records":
        service._max_records = 1
    elif limit == "bytes":
        service._max_bytes = 1024
    else:
        ticks = iter(range(1000))
        service._clock = lambda: float(next(ticks))
        service._max_seconds = 0.1
    response = client.get("/api/v1/me/export")
    assert response.status_code == 413, response.text
    assert response.json()["error"]["code"] == "WORKSPACE_EXPORT_TOO_LARGE"


def test_durable_export_uses_no_indexes(
    client: TestClient, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    create(client)
    original = dynamodb_client.query

    def strong(**arguments: Any) -> Any:
        assert "IndexName" not in arguments
        assert arguments["ConsistentRead"] is True
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "query", strong)
    assert client.get("/api/v1/me/export").status_code == 200


def test_demo_erasure_forbidden_and_client_inventory_rejected(
    client: TestClient, dynamodb_client: Any
) -> None:
    before = items(dynamodb_client)
    for payload in (
        {"owner_user_id": str(uuid4())},
        {"application_ids": []},
        {"application_manifest_version": 1},
    ):
        assert client.request("DELETE", "/api/v1/me", json=payload).status_code == 422
    client.app.dependency_overrides[get_current_identity] = lambda: CurrentIdentity(
        str(uuid4()), UserRole.STANDARD_USER, IdentityKind.DEMO, 9999999999
    )
    for method, path in (
        ("DELETE", "/api/v1/me"),
        ("GET", "/api/v1/me/deletion"),
        ("POST", "/api/v1/me/deletion/retry"),
    ):
        assert client.request(method, path).status_code == 403
    assert items(dynamodb_client) == before


def test_empty_and_partially_erased_application_retries(
    client: TestClient, dynamodb_client: Any
) -> None:
    application = create(client)
    partition = application_partition(OWNER, application["application_id"])
    freeze(client)
    for item in items(dynamodb_client, partition):
        dynamodb_client.delete_item(
            TableName="HireFluxTest", Key=serialize_item({"PK": item["PK"], "SK": item["SK"]})
        )
    assert client.delete("/api/v1/me").json()["state"] == "DELETED"


def test_backfill_marker_denied_when_concurrent_creation_changes_quota(
    client: TestClient, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    create(client)
    make_legacy(dynamodb_client)
    original = dynamodb_client.transact_write_items
    intercepted = False

    def competing(**arguments: Any) -> Any:
        nonlocal intercepted
        if not intercepted and any(
            "Update" in write
            and "application_manifest_version" in write["Update"].get("UpdateExpression", "")
            for write in arguments["TransactItems"]
        ):
            intercepted = True
            create(client)
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "transact_write_items", competing)
    with pytest.raises(PersistenceError):
        backfill_local_manifest(
            local_settings(), confirmation="HireFluxTest", owner=OWNER, client=dynamodb_client
        )
    assert intercepted
    assert "application_manifest_version" not in next(
        item for item in items(dynamodb_client, user_partition(OWNER)) if item["SK"] == "WORKSPACE"
    )
    assert (
        backfill_local_manifest(
            local_settings(), confirmation="HireFluxTest", owner=OWNER, client=dynamodb_client
        )
        == 2
    )


def test_gsi_lag_cannot_prove_backfill_completeness(
    client: TestClient, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    create(client)
    make_legacy(dynamodb_client)
    original = dynamodb_client.query

    def delayed(**arguments: Any) -> Any:
        if "IndexName" in arguments:
            return {"Items": []}
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "query", delayed)
    with pytest.raises(WorkspaceManifestIncompleteError):
        backfill_local_manifest(
            local_settings(), confirmation="HireFluxTest", owner=OWNER, client=dynamodb_client
        )
    assert "application_manifest_version" not in next(
        item for item in items(dynamodb_client, user_partition(OWNER)) if item["SK"] == "WORKSPACE"
    )


def test_reconciliation_cannot_write_after_freeze(client: TestClient, dynamodb_client: Any) -> None:
    create(client, active=True)
    freeze(client)
    before = items(dynamodb_client)
    with pytest.raises(PersistenceError):
        reconcile_local_projections(
            local_settings(), confirmation="HireFluxTest", client=dynamodb_client
        )
    assert items(dynamodb_client) == before


def test_erasure_time_budget_is_resumable_without_sleep(
    client: TestClient, dynamodb_client: Any
) -> None:
    create(client)
    freeze(client)
    ticks = iter(range(1000))
    repository = DynamoWorkspaceSafetyRepository(
        dynamodb_client, "HireFluxTest", max_seconds=0.1, clock=lambda: float(next(ticks))
    )
    workspace = repository.get_workspace(OWNER)
    before = items(dynamodb_client)
    assert repository.erase(workspace).state.value == "DELETING"
    assert items(dynamodb_client) == before
    assert client.delete("/api/v1/me").json()["state"] == "DELETED"


def test_export_ref_provenance_and_erasure_during_traversal_fail_closed(
    client: TestClient, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    application = create(client)
    ref = next(
        item
        for item in items(dynamodb_client, user_partition(OWNER))
        if item["SK"].startswith("APPLICATION_REF#")
    )
    put(dynamodb_client, ref | {"owner_user_id": str(uuid4())})
    assert client.get("/api/v1/me/export").json()["error"]["code"] == "WORKSPACE_BOOTSTRAP_CONFLICT"
    put(dynamodb_client, ref)
    original = dynamodb_client.query
    frozen = False

    def during(**arguments: Any) -> Any:
        nonlocal frozen
        if not frozen and arguments["ExpressionAttributeValues"].get(":pk") == {
            "S": application_partition(OWNER, application["application_id"])
        }:
            frozen = True
            freeze(client)
        return original(**arguments)

    monkeypatch.setattr(dynamodb_client, "query", during)
    response = client.get("/api/v1/me/export")
    assert frozen
    assert response.json()["error"]["code"] == "WORKSPACE_DELETING"
