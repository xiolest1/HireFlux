import hashlib
from datetime import UTC, datetime
from typing import Any

from conftest import test_settings as build_test_settings
from fastapi.testclient import TestClient

from hireflux_backend.application.services import CreateApplicationCommand
from hireflux_backend.domain.enums import DemoWorkspaceState
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.main import create_app


def authorization(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_demo_sessions_are_seeded_temporary_and_owner_isolated(
    dynamodb_client: Any,
) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as client:
        unauthenticated = client.get("/api/v1/applications")
        assert unauthenticated.status_code == 401
        assert unauthenticated.json()["error"]["code"] == "DEMO_SESSION_REQUIRED"

        first_session = client.post("/api/v1/demo-sessions")
        assert first_session.status_code == 201
        first_token = first_session.json()["access_token"]
        first_headers = authorization(first_token)

        profile = client.get("/api/v1/me", headers=first_headers)
        assert profile.status_code == 200
        assert profile.json()["name"] == "Demo Workspace"
        dynamodb_client.update_item(
            TableName="HireFluxTest",
            Key=serialize_item({"PK": user_partition(profile.json()["user_id"]), "SK": "PROFILE"}),
            UpdateExpression="SET #name = :name",
            ExpressionAttributeNames={"#name": "name"},
            ExpressionAttributeValues=serialize_item({":name": "Demo Recruiter"}),
        )
        migrated_profile = client.get("/api/v1/me", headers=first_headers)
        assert migrated_profile.status_code == 200
        assert migrated_profile.json()["name"] == "Demo Workspace"

        first_list = client.get(
            "/api/v1/applications", params={"limit": 100}, headers=first_headers
        )
        assert first_list.status_code == 200
        first_items = first_list.json()["items"]
        assert len(first_items) == 29
        assert {item["status"] for item in first_items} == {
            "DRAFT",
            "APPLIED",
            "SCREENING",
            "INTERVIEW",
            "OFFER",
            "ACCEPTED",
            "REJECTED",
            "WITHDRAWN",
        }

        interview = next(item for item in first_items if item["company_name"] == "Orbit Systems")
        activity = client.get(
            f"/api/v1/applications/{interview['application_id']}/activity",
            headers=first_headers,
        )
        activity_types = [item["activity_type"] for item in activity.json()["items"]]
        assert activity_types[:2] == ["APPLICATION_CREATED", "STATUS_CHANGED"]
        assert "INTERVIEW_SCHEDULED" in activity_types

        second_session = client.post("/api/v1/demo-sessions")
        second_token = second_session.json()["access_token"]
        second_headers = authorization(second_token)
        foreign_get = client.get(
            f"/api/v1/applications/{interview['application_id']}",
            headers=second_headers,
        )
        assert foreign_get.status_code == 404

        owner_id = first_items[0]["owner_user_id"]
        profile_item = dynamodb_client.get_item(
            TableName="HireFluxTest",
            Key=serialize_item({"PK": user_partition(owner_id), "SK": "PROFILE"}),
        )["Item"]
        application_item = dynamodb_client.get_item(
            TableName="HireFluxTest",
            Key=serialize_item(
                {
                    "PK": application_partition(owner_id, first_items[0]["application_id"]),
                    "SK": "METADATA",
                }
            ),
        )["Item"]
        workspace_item = dynamodb_client.get_item(
            TableName="HireFluxTest",
            Key=serialize_item({"PK": user_partition(owner_id), "SK": "WORKSPACE"}),
            ConsistentRead=True,
        )["Item"]
        assert int(deserialize_item(profile_item)["expires_at"]) > 0
        assert int(deserialize_item(application_item)["expires_at"]) > 0
        assert deserialize_item(workspace_item)["state"] == DemoWorkspaceState.READY.value


def test_demo_session_can_export_csv_but_not_full_account_data(
    dynamodb_client: Any,
) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as client:
        token = client.post("/api/v1/demo-sessions").json()["access_token"]
        headers = authorization(token)
        full_export = client.get("/api/v1/me/export", headers=headers)
        applications_export = client.get("/api/v1/me/applications/export", headers=headers)

    assert full_export.status_code == 403
    assert full_export.json()["error"]["code"] == "FORBIDDEN"
    assert applications_export.status_code == 200
    assert applications_export.headers["content-type"].startswith("text/csv")
    assert applications_export.text.splitlines()[0].startswith("Company,Job Title,Status")


def test_demo_session_rejects_a_tampered_bearer_token(dynamodb_client: Any) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as client:
        token = client.post("/api/v1/demo-sessions").json()["access_token"]
        payload, signature = token.split(".")
        tampered = f"{payload[:-1]}A.{signature}"
        response = client.get("/api/v1/me", headers=authorization(tampered))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "DEMO_SESSION_REQUIRED"


def test_demo_session_idempotency_replays_the_original_ready_workspace(
    dynamodb_client: Any,
) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    idempotency_key = "demo-session-idempotency-key-123456"
    with TestClient(app) as client:
        first = client.post("/api/v1/demo-sessions", headers={"Idempotency-Key": idempotency_key})
        second = client.post("/api/v1/demo-sessions", headers={"Idempotency-Key": idempotency_key})

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json() == first.json()


def test_demo_session_idempotency_header_is_allowed_by_cors(dynamodb_client: Any) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/demo-sessions",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "idempotency-key",
            },
        )

    assert response.status_code == 200
    assert "idempotency-key" in response.headers["access-control-allow-headers"].lower()


def test_failed_demo_provisioning_is_marked_and_cleaned_up(
    dynamodb_client: Any,
    monkeypatch: Any,
) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    service = app.state.demo_session_service
    workspace_id = "00000000-0000-4000-8000-000000000099"
    idempotency_key = "demo-session-failure-key-123456"
    monkeypatch.setattr(service, "_id_factory", lambda: workspace_id)

    def fail_after_one_application(identity: Any, now: Any, created: list[Any]) -> None:
        service._application_service.create(
            identity,
            CreateApplicationCommand(company_name="Partial Seed", job_title="Unfinished role"),
        )
        raise RuntimeError("simulated seed failure")

    monkeypatch.setattr(service, "_seed_workspace", fail_after_one_application)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/demo-sessions", headers={"Idempotency-Key": idempotency_key}
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "PERSISTENCE_UNAVAILABLE"
    workspace_item = dynamodb_client.get_item(
        TableName="HireFluxTest",
        Key=serialize_item({"PK": user_partition(workspace_id), "SK": "WORKSPACE"}),
        ConsistentRead=True,
    )["Item"]
    workspace = deserialize_item(workspace_item)
    assert workspace["state"] == DemoWorkspaceState.FAILED.value
    assert int(workspace["expires_at"]) <= int(datetime.now(UTC).timestamp()) + 15 * 60 + 1

    user_items = dynamodb_client.query(
        TableName="HireFluxTest",
        KeyConditionExpression="PK = :partition",
        ExpressionAttributeValues=serialize_item({":partition": user_partition(workspace_id)}),
    )["Items"]
    assert [deserialize_item(item)["SK"] for item in user_items] == ["WORKSPACE"]

    idempotency_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
    idempotency_item = dynamodb_client.get_item(
        TableName="HireFluxTest",
        Key=serialize_item({"PK": f"DEMO_IDEMPOTENCY#{idempotency_hash}", "SK": "SESSION"}),
        ConsistentRead=True,
    )["Item"]
    assert deserialize_item(idempotency_item)["state"] == DemoWorkspaceState.FAILED.value

    with TestClient(app) as client:
        retry = client.post("/api/v1/demo-sessions", headers={"Idempotency-Key": idempotency_key})
    assert retry.status_code == 409


def test_demo_workspace_requires_capacity_for_its_seed() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="30-application seed"):
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
            max_applications_per_workspace=5,
        )
