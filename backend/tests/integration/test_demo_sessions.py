from typing import Any

from conftest import test_settings as build_test_settings
from fastapi.testclient import TestClient

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
        assert profile.json()["name"] == "Demo Recruiter"

        first_list = client.get("/api/v1/applications", headers=first_headers)
        assert first_list.status_code == 200
        first_items = first_list.json()["items"]
        assert len(first_items) == 15
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

        interview = next(item for item in first_items if item["status"] == "INTERVIEW")
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
        assert int(deserialize_item(profile_item)["expires_at"]) > 0
        assert int(deserialize_item(application_item)["expires_at"]) > 0


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


def test_demo_workspace_requires_capacity_for_its_seed() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="16-application seed"):
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
            max_applications_per_workspace=5,
        )
