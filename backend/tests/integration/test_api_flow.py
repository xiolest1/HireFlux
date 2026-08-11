from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient

from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Application
from hireflux_backend.infrastructure.dynamodb.mapping import application_to_item, serialize_item


def draft_payload(company: str = "Acme") -> dict[str, Any]:
    return {
        "company_name": company,
        "job_title": "Platform Engineer",
        "status": "DRAFT",
        "applied_date": None,
        "follow_up_date": None,
        "job_url": "https://example.com/jobs/123",
        "location": "New York, NY",
        "work_mode": "HYBRID",
        "source": "Company site",
        "salary_text": "$120k-$140k",
        "description": "Build reliable services.",
    }


def test_health_profile_and_request_ids(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "browser-request-1"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"] == "browser-request-1"

    profile = client.get("/api/v1/me")
    assert profile.status_code == 200
    assert profile.json()["user_id"] == "00000000-0000-4000-8000-000000000001"
    assert profile.json()["role"] == "STANDARD_USER"
    assert client.get("/api/v1/me").json()["created_at"] == profile.json()["created_at"]


def test_create_read_update_page_and_activity(client: TestClient) -> None:
    first = client.post("/api/v1/applications", json=draft_payload("Acme"))
    assert first.status_code == 201
    created = first.json()
    assert created["owner_user_id"] == "00000000-0000-4000-8000-000000000001"
    assert created["version"] == 1
    assert "APPLIED" in created["allowed_transitions"]

    forbidden_owner = draft_payload("Untrusted") | {"owner_user_id": "someone-else"}
    assert client.post("/api/v1/applications", json=forbidden_owner).status_code == 422
    missing_date = draft_payload("Applied") | {"status": "APPLIED"}
    assert client.post("/api/v1/applications", json=missing_date).status_code == 422

    second = client.post("/api/v1/applications", json=draft_payload("Beta")).json()
    third = client.post("/api/v1/applications", json=draft_payload("Gamma")).json()

    page_one = client.get("/api/v1/applications", params={"limit": 2})
    assert page_one.status_code == 200
    assert len(page_one.json()["items"]) == 2
    cursor = page_one.json()["next_cursor"]
    assert cursor
    page_two = client.get("/api/v1/applications", params={"limit": 2, "cursor": cursor})
    assert page_two.status_code == 200
    all_ids = {
        item["application_id"] for item in page_one.json()["items"] + page_two.json()["items"]
    }
    assert all_ids == {
        created["application_id"],
        second["application_id"],
        third["application_id"],
    }

    tampered = f"{cursor[:-1]}{'A' if cursor[-1] != 'A' else 'B'}"
    invalid_cursor = client.get("/api/v1/applications", params={"limit": 2, "cursor": tampered})
    assert invalid_cursor.status_code == 400
    assert invalid_cursor.json()["error"]["code"] == "INVALID_CURSOR"

    update = draft_payload("Acme Updated") | {"expected_version": 1}
    update.pop("status")
    updated_response = client.patch(
        f"/api/v1/applications/{created['application_id']}", json=update
    )
    assert updated_response.status_code == 200
    updated = updated_response.json()
    assert updated["company_name"] == "Acme Updated"
    assert updated["version"] == 2

    stale = client.patch(
        f"/api/v1/applications/{created['application_id']}",
        json={"expected_version": 1, "company_name": "Stale"},
    )
    assert stale.status_code == 409

    activity = client.get(f"/api/v1/applications/{created['application_id']}/activity")
    assert activity.status_code == 200
    assert list(activity.json()) == ["items"]
    assert activity.json()["items"][0]["activity_type"] == "APPLICATION_CREATED"


def test_status_workflow_archive_restore_and_filter(client: TestClient) -> None:
    created = client.post("/api/v1/applications", json=draft_payload()).json()
    path = f"/api/v1/applications/{created['application_id']}/status"

    missing_date = client.post(path, json={"status": "APPLIED", "expected_version": 1})
    assert missing_date.status_code == 409

    applied = client.post(
        path,
        json={"status": "APPLIED", "expected_version": 1, "applied_date": "2026-08-10"},
    ).json()
    interview = client.post(
        path, json={"status": "INTERVIEW", "expected_version": applied["version"]}
    ).json()
    offer = client.post(
        path, json={"status": "OFFER", "expected_version": interview["version"]}
    ).json()
    rejected = client.post(
        path, json={"status": "REJECTED", "expected_version": offer["version"]}
    ).json()
    forbidden = client.post(
        path, json={"status": "INTERVIEW", "expected_version": rejected["version"]}
    )
    assert forbidden.status_code == 409

    archived = client.post(
        path, json={"status": "ARCHIVED", "expected_version": rejected["version"]}
    ).json()
    assert archived["allowed_transitions"] == ["REJECTED"]
    restored = client.post(
        path, json={"status": "REJECTED", "expected_version": archived["version"]}
    ).json()
    assert restored["status"] == "REJECTED"

    filtered = client.get("/api/v1/applications", params={"status": "REJECTED"})
    assert [item["application_id"] for item in filtered.json()["items"]] == [
        created["application_id"]
    ]
    activity = client.get(f"/api/v1/applications/{created['application_id']}/activity").json()
    assert len(activity["items"]) == 7
    assert activity["items"][-1]["metadata"]["to_status"] == "REJECTED"


def test_delete_alias_archives(client: TestClient) -> None:
    created = client.post("/api/v1/applications", json=draft_payload()).json()
    response = client.delete(
        f"/api/v1/applications/{created['application_id']}",
        params={"expected_version": created["version"]},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ARCHIVED"
    assert response.json()["allowed_transitions"] == ["DRAFT"]


def test_foreign_owner_resources_are_indistinguishable_from_missing(
    client: TestClient, dynamodb_client: Any
) -> None:
    application_id = "00000000-0000-4000-8000-000000000099"
    timestamp = datetime(2026, 8, 10, 12, tzinfo=UTC)
    foreign = Application(
        application_id=application_id,
        owner_user_id="00000000-0000-4000-8000-000000000002",
        company_name="Private Company",
        job_title="Private Role",
        status=ApplicationStatus.DRAFT,
        applied_date=None,
        follow_up_date=None,
        job_url=None,
        location=None,
        work_mode=None,
        source=None,
        salary_text=None,
        description=None,
        created_at=timestamp,
        updated_at=timestamp,
        version=1,
    )
    dynamodb_client.put_item(
        TableName="HireFluxTest", Item=serialize_item(application_to_item(foreign))
    )

    path = f"/api/v1/applications/{application_id}"
    assert client.get(path).status_code == 404
    assert (
        client.patch(path, json={"expected_version": 1, "company_name": "Stolen"}).status_code
        == 404
    )
    assert (
        client.post(
            f"{path}/status", json={"status": "ARCHIVED", "expected_version": 1}
        ).status_code
        == 404
    )
    listed_ids = {
        item["application_id"] for item in client.get("/api/v1/applications").json()["items"]
    }
    assert application_id not in listed_ids
