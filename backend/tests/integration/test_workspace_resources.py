from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from hireflux_backend.infrastructure.dynamodb.mapping import (
    deserialize_item,
    serialize_item,
)
from hireflux_backend.infrastructure.dynamodb.resource_mapping import interview_key


def _create_application(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/applications",
        json={
            "company_name": "Browser QA Labs",
            "job_title": "Cloud Readiness Engineer",
        },
    )
    assert response.status_code == 201
    return dict(response.json())


def test_workspace_settings_defaults_update_and_concurrency(client: TestClient) -> None:
    first = client.get("/api/v1/settings")
    assert first.status_code == 200
    assert first.json() | {} == {
        "time_zone": "UTC",
        "default_follow_up_days": 7,
        "default_application_view": "ACTIVE",
        "default_dashboard_range": "30d",
        "theme": "SYSTEM",
        "created_at": first.json()["created_at"],
        "updated_at": first.json()["updated_at"],
        "version": 1,
    }
    assert client.get("/api/v1/settings").json()["created_at"] == first.json()["created_at"]

    forbidden_owner = client.patch(
        "/api/v1/settings",
        json={"expected_version": 1, "owner_user_id": "someone-else"},
    )
    assert forbidden_owner.status_code == 422

    updated = client.patch(
        "/api/v1/settings",
        json={
            "expected_version": 1,
            "time_zone": "America/New_York",
            "default_follow_up_days": 5,
            "default_application_view": "ALL",
            "default_dashboard_range": "90d",
            "theme": "DARK",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == 2
    assert updated.json()["time_zone"] == "America/New_York"
    assert updated.json()["theme"] == "DARK"

    stale = client.patch(
        "/api/v1/settings",
        json={"expected_version": 1, "theme": "LIGHT"},
    )
    assert stale.status_code == 409

    invalid_zone = client.patch(
        "/api/v1/settings",
        json={"expected_version": 2, "time_zone": "America/Definitely_Not_A_Zone"},
    )
    assert invalid_zone.status_code == 422
    assert "recognized IANA" in invalid_zone.json()["error"]["message"]


def test_notes_are_owned_versioned_and_append_activity(client: TestClient) -> None:
    application = _create_application(client)
    path = f"/api/v1/applications/{application['application_id']}"

    forbidden_owner = client.post(
        f"{path}/notes",
        json={"content": "Private", "owner_user_id": "someone-else"},
    )
    assert forbidden_owner.status_code == 422

    created = client.post(f"{path}/notes", json={"content": "  Prepare examples.  "})
    assert created.status_code == 201
    note = created.json()
    assert note["content"] == "Prepare examples."
    assert note["version"] == 1
    assert "owner_user_id" not in note
    assert client.get(f"{path}/notes").json()["items"] == [note]

    updated = client.patch(
        f"{path}/notes/{note['note_id']}",
        json={"expected_version": 1, "content": "Add system-design story."},
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == 2

    stale = client.patch(
        f"{path}/notes/{note['note_id']}",
        json={"expected_version": 1, "content": "Stale edit"},
    )
    assert stale.status_code == 409
    assert (
        client.delete(f"{path}/notes/{note['note_id']}", params={"expected_version": 1}).status_code
        == 409
    )
    deleted = client.delete(f"{path}/notes/{note['note_id']}", params={"expected_version": 2})
    assert deleted.status_code == 204
    assert client.get(f"{path}/notes").json() == {"items": []}

    activity = client.get(f"{path}/activity").json()["items"]
    assert [item["activity_type"] for item in activity][-3:] == [
        "NOTE_CREATED",
        "NOTE_UPDATED",
        "NOTE_DELETED",
    ]
    assert all("Prepare examples" not in item["summary"] for item in activity)

    missing_application = client.get(f"/api/v1/applications/{uuid4()}/notes")
    assert missing_application.status_code == 404


def test_interviews_project_to_workspace_and_remain_as_history(
    client: TestClient, dynamodb_client: Any
) -> None:
    application = _create_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    scheduled_at = (datetime.now(UTC) + timedelta(days=8)).replace(microsecond=0)
    rescheduled_at = scheduled_at + timedelta(days=1)
    payload = {
        "interview_type": "TECHNICAL_SCREEN",
        "scheduled_at": scheduled_at.isoformat(),
        "duration_minutes": 75,
        "location": "Video call",
        "meeting_url": "https://meet.example.com/hireflux",
        "details": "Architecture and API design.",
    }
    naive = client.post(
        f"{path}/interviews", json=payload | {"scheduled_at": "2030-01-01T12:00:00"}
    )
    assert naive.status_code == 422
    forbidden_projection = client.post(
        f"{path}/interviews", json=payload | {"company_name": "Untrusted"}
    )
    assert forbidden_projection.status_code == 422

    created = client.post(f"{path}/interviews", json=payload)
    assert created.status_code == 201
    interview = created.json()
    assert interview["company_name"] == application["company_name"]
    assert interview["job_title"] == application["job_title"]
    assert interview["status"] == "SCHEDULED"
    assert interview["allowed_statuses"] == ["COMPLETED", "CANCELED"]
    assert datetime.fromisoformat(interview["scheduled_at"].replace("Z", "+00:00")) == scheduled_at

    stored = dynamodb_client.get_item(
        TableName="HireFluxTest",
        Key=serialize_item(
            interview_key(
                application["owner_user_id"],
                application["application_id"],
                interview["interview_id"],
            )
        ),
        ConsistentRead=True,
    )
    item = deserialize_item(stored["Item"])
    assert item["GSI1PK"].endswith("#INTERVIEWS")
    assert item["GSI3PK"].endswith("#SCHEDULE")

    nested = client.get(f"{path}/interviews")
    assert nested.status_code == 200
    assert [item["interview_id"] for item in nested.json()["items"]] == [interview["interview_id"]]
    workspace = client.get("/api/v1/interviews")
    assert workspace.status_code == 200
    assert [item["interview_id"] for item in workspace.json()["items"]] == [
        interview["interview_id"]
    ]

    updated = client.patch(
        f"{path}/interviews/{interview['interview_id']}",
        json={
            "expected_version": 1,
            "scheduled_at": rescheduled_at.isoformat(),
            "duration_minutes": 60,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == 2
    assert (
        datetime.fromisoformat(updated.json()["scheduled_at"].replace("Z", "+00:00"))
        == rescheduled_at
    )

    completed = client.post(
        f"{path}/interviews/{interview['interview_id']}/status",
        json={"status": "COMPLETED", "expected_version": 2},
    )
    assert completed.status_code == 200
    assert completed.json()["version"] == 3
    assert completed.json()["allowed_statuses"] == []

    stored = dynamodb_client.get_item(
        TableName="HireFluxTest",
        Key=serialize_item(
            interview_key(
                application["owner_user_id"],
                application["application_id"],
                interview["interview_id"],
            )
        ),
        ConsistentRead=True,
    )
    item = deserialize_item(stored["Item"])
    assert "GSI3PK" not in item
    assert "GSI3SK" not in item
    assert client.get("/api/v1/interviews").json() == {"items": []}

    terminal_edit = client.patch(
        f"{path}/interviews/{interview['interview_id']}",
        json={"expected_version": 3, "details": "Rewrite history"},
    )
    assert terminal_edit.status_code == 409
    assert client.delete(f"{path}/interviews/{interview['interview_id']}").status_code == 405

    activity = client.get(f"{path}/activity").json()["items"]
    assert [item["activity_type"] for item in activity][-3:] == [
        "INTERVIEW_SCHEDULED",
        "INTERVIEW_UPDATED",
        "INTERVIEW_STATUS_CHANGED",
    ]


def test_foreign_or_missing_interview_and_note_are_not_found(client: TestClient) -> None:
    application = _create_application(client)
    foreign_application_id = uuid4()
    note_id = uuid4()
    interview_id = uuid4()

    assert (
        client.patch(
            f"/api/v1/applications/{foreign_application_id}/notes/{note_id}",
            json={"expected_version": 1, "content": "No access"},
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/applications/{foreign_application_id}/interviews/{interview_id}",
            json={"expected_version": 1, "details": "No access"},
        ).status_code
        == 404
    )
    assert application["application_id"]
