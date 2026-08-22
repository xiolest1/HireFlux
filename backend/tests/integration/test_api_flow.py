from datetime import UTC, date, datetime, timedelta
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
        "source": "COMPANY_WEBSITE",
        "source_detail": "Company site",
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


def test_workspace_export_is_owner_scoped_and_contains_resources(client: TestClient) -> None:
    application = client.post("/api/v1/applications", json=draft_payload("Export Labs")).json()
    application_id = application["application_id"]
    note = client.post(
        f"/api/v1/applications/{application_id}/notes", json={"content": "Export this note."}
    )
    assert note.status_code == 201
    interview = client.post(
        f"/api/v1/applications/{application_id}/interviews",
        json={
            "interview_type": "RECRUITER_CALL",
            "scheduled_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        },
    )
    assert interview.status_code == 201

    response = client.get("/api/v1/me/export")
    assert response.status_code == 200
    payload = response.json()
    assert payload["export_version"] == 1
    assert payload["profile"]["user_id"] == "00000000-0000-4000-8000-000000000001"
    assert [item["application_id"] for item in payload["applications"]] == [application_id]
    assert payload["notes"][0]["application_id"] == application_id
    assert payload["interviews"][0]["application_id"] == application_id
    assert all(
        item["owner_user_id"] == payload["profile"]["user_id"] for item in payload["applications"]
    )
    assert payload["counts"]["applications"] == len(payload["applications"])
    assert payload["counts"]["activities"] == len(payload["activities"])


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
    future_date = draft_payload("Future") | {
        "status": "APPLIED",
        "applied_date": (date.today() + timedelta(days=7)).isoformat(),
    }
    future_response = client.post("/api/v1/applications", json=future_date)
    assert future_response.status_code == 422
    assert "future" in future_response.json()["error"]["message"]

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

    tampered = f"{'A' if cursor[0] != 'A' else 'B'}{cursor[1:]}"
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
    assert list(activity.json()) == ["items", "next_cursor"]
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
    active_ids = {
        item["application_id"] for item in client.get("/api/v1/applications").json()["items"]
    }
    assert created["application_id"] not in active_ids
    archived_items = client.get("/api/v1/applications", params={"status": "ARCHIVED"}).json()[
        "items"
    ]
    assert [item["application_id"] for item in archived_items] == [created["application_id"]]
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


def test_archived_later_stage_cannot_clear_its_required_applied_date(client: TestClient) -> None:
    created = client.post("/api/v1/applications", json=draft_payload("Restorable")).json()
    path = f"/api/v1/applications/{created['application_id']}"

    applied = client.post(
        f"{path}/status",
        json={
            "status": "APPLIED",
            "expected_version": created["version"],
            "applied_date": "2026-08-10",
        },
    ).json()
    interview = client.post(
        f"{path}/status",
        json={"status": "INTERVIEW", "expected_version": applied["version"]},
    ).json()
    archived = client.post(
        f"{path}/status",
        json={"status": "ARCHIVED", "expected_version": interview["version"]},
    ).json()
    assert archived["allowed_transitions"] == ["INTERVIEW"]

    cleared = client.patch(
        path,
        json={"expected_version": archived["version"], "applied_date": None},
    )
    assert cleared.status_code == 422
    assert "applied_date" in cleared.json()["error"]["message"]

    restored = client.post(
        f"{path}/status",
        json={"status": "INTERVIEW", "expected_version": archived["version"]},
    )
    assert restored.status_code == 200
    assert restored.json()["status"] == "INTERVIEW"
    assert restored.json()["applied_date"] == "2026-08-10"


def test_delete_alias_archives(client: TestClient) -> None:
    created = client.post("/api/v1/applications", json=draft_payload()).json()
    response = client.delete(
        f"/api/v1/applications/{created['application_id']}",
        params={"expected_version": created["version"]},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ARCHIVED"
    assert response.json()["allowed_transitions"] == ["DRAFT"]


def test_follow_up_actions_are_versioned_and_append_activity(client: TestClient) -> None:
    payload = draft_payload() | {"follow_up_date": "2026-08-14"}
    created = client.post("/api/v1/applications", json=payload).json()
    path = f"/api/v1/applications/{created['application_id']}"

    rescheduled = client.post(
        f"{path}/follow-up/reschedule",
        json={"expected_version": 1, "follow_up_date": "2026-08-20"},
    )
    assert rescheduled.status_code == 200
    assert rescheduled.json()["follow_up_date"] == "2026-08-20"
    assert rescheduled.json()["version"] == 2

    stale = client.post(f"{path}/follow-up/complete", json={"expected_version": 1})
    assert stale.status_code == 409
    completed = client.post(f"{path}/follow-up/complete", json={"expected_version": 2})
    assert completed.status_code == 200
    assert completed.json()["follow_up_date"] is None
    assert completed.json()["version"] == 3
    activity_types = [
        item["activity_type"] for item in client.get(f"{path}/activity").json()["items"]
    ]
    assert activity_types[-2:] == ["FOLLOW_UP_RESCHEDULED", "FOLLOW_UP_COMPLETED"]


def test_application_list_search_filters_sort_and_cursor_scope(client: TestClient) -> None:
    first = draft_payload("Alpha Systems") | {
        "source": "LINKEDIN",
        "source_detail": "Recruiter post",
        "work_mode": "REMOTE",
    }
    second = draft_payload("Beta Health") | {
        "source": "REFERRAL",
        "source_detail": "Former colleague",
        "work_mode": "HYBRID",
    }
    client.post("/api/v1/applications", json=first)
    client.post("/api/v1/applications", json=second)

    filtered = client.get(
        "/api/v1/applications",
        params={"q": "alpha", "source": "LINKEDIN", "work_mode": "REMOTE"},
    )
    assert filtered.status_code == 200
    assert [item["company_name"] for item in filtered.json()["items"]] == ["Alpha Systems"]

    ascending = client.get("/api/v1/applications", params={"sort": "updated_asc", "limit": 1})
    assert ascending.status_code == 200
    cursor = ascending.json()["next_cursor"]
    assert cursor
    wrong_scope = client.get(
        "/api/v1/applications",
        params={"sort": "updated_desc", "limit": 1, "cursor": cursor},
    )
    assert wrong_scope.status_code == 400
    assert wrong_scope.json()["error"]["code"] == "INVALID_CURSOR"


def test_application_list_views_are_server_owned_complete_and_cursor_bound(
    client: TestClient,
) -> None:
    created: dict[str, dict[str, Any]] = {}
    for company in ("Draft One", "Draft Two"):
        created[company] = client.post("/api/v1/applications", json=draft_payload(company)).json()

    for company, status in (
        ("Applied", "APPLIED"),
        ("Screening", "SCREENING"),
        ("Interview", "INTERVIEW"),
        ("Offer", "OFFER"),
        ("Rejected", "REJECTED"),
    ):
        application = client.post("/api/v1/applications", json=draft_payload(company)).json()
        path = f"/api/v1/applications/{application['application_id']}/status"
        application = client.post(
            path,
            json={
                "status": "APPLIED",
                "expected_version": application["version"],
                "applied_date": "2026-08-10",
            },
        ).json()
        if status != "APPLIED":
            application = client.post(
                path,
                json={"status": status, "expected_version": application["version"]},
            ).json()
        created[company] = application

    archived = client.post("/api/v1/applications", json=draft_payload("Archived")).json()
    archived = client.post(
        f"/api/v1/applications/{archived['application_id']}/status",
        json={"status": "ARCHIVED", "expected_version": archived["version"]},
    ).json()
    created["Archived"] = archived

    active = client.get("/api/v1/applications", params={"view": "ACTIVE", "limit": 2})
    assert active.status_code == 200
    active_page_one = active.json()
    assert len(active_page_one["items"]) == 2
    assert active_page_one["next_cursor"] is not None
    active_page_two = client.get(
        "/api/v1/applications",
        params={
            "view": "ACTIVE",
            "limit": 2,
            "cursor": active_page_one["next_cursor"],
        },
    )
    assert active_page_two.status_code == 200
    assert active_page_two.json()["next_cursor"] is None
    assert {
        item["status"] for item in active_page_one["items"] + active_page_two.json()["items"]
    } == {"APPLIED", "SCREENING", "INTERVIEW", "OFFER"}

    all_items = client.get("/api/v1/applications", params={"view": "ALL", "limit": 100})
    assert all_items.status_code == 200
    assert {item["application_id"] for item in all_items.json()["items"]} == {
        item["application_id"] for item in created.values()
    }
    assert any(item["status"] == "ARCHIVED" for item in all_items.json()["items"])

    archived_items = client.get("/api/v1/applications", params={"view": "ARCHIVED"})
    assert [item["application_id"] for item in archived_items.json()["items"]] == [
        created["Archived"]["application_id"]
    ]

    explicit_status = client.get(
        "/api/v1/applications",
        params={"view": "ARCHIVED", "status": "DRAFT"},
    )
    assert {item["status"] for item in explicit_status.json()["items"]} == {"DRAFT"}

    wrong_view = client.get(
        "/api/v1/applications",
        params={
            "view": "ALL",
            "limit": 2,
            "cursor": active_page_one["next_cursor"],
        },
    )
    assert wrong_view.status_code == 400
    assert wrong_view.json()["error"]["code"] == "INVALID_CURSOR"


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
