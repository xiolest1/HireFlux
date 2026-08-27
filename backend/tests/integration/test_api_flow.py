import csv
import io
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from conftest import test_settings as build_test_settings
from fastapi import FastAPI
from fastapi.testclient import TestClient

from hireflux_backend.api.dependencies import get_current_identity
from hireflux_backend.domain.enums import ApplicationStatus, UserRole
from hireflux_backend.domain.models import Application, CurrentIdentity
from hireflux_backend.infrastructure.dynamodb.mapping import application_to_item, serialize_item
from hireflux_backend.main import create_app


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


def _identity(user_id: str, name: str) -> CurrentIdentity:
    return CurrentIdentity(
        user_id=user_id,
        name=name,
        email=f"{user_id}@example.invalid",
        role=UserRole.STANDARD_USER,
    )


def _use_identity(app: FastAPI, identity: CurrentIdentity) -> None:
    app.dependency_overrides[get_current_identity] = lambda: identity


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
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Pragma"] == "no-cache"
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


def test_application_csv_export_is_escaped_and_owner_scoped(client: TestClient) -> None:
    response = client.post(
        "/api/v1/applications",
        json=draft_payload('Comma, "quoted" employer')
        | {
            "source_detail": "Referral\nfrom a friend",
            "description": "Line one\nLine two",
        },
    )
    assert response.status_code == 201

    export = client.get("/api/v1/me/applications/export")

    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert export.headers["cache-control"] == "no-store"
    assert export.headers["pragma"] == "no-cache"
    assert export.headers["content-disposition"].startswith(
        'attachment; filename="hireflux-applications-'
    )
    rows = list(csv.DictReader(io.StringIO(export.text)))
    assert len(rows) == 1
    assert rows[0]["Company"] == 'Comma, "quoted" employer'
    assert rows[0]["Source Detail"] == "Referral\nfrom a friend"
    assert rows[0]["Description"] == "Line one\nLine two"
    assert "owner_user_id" not in export.text


def test_api_documentation_exposure_follows_environment_configuration(
    client: TestClient, dynamodb_client: Any
) -> None:
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200

    deployed = create_app(
        build_test_settings(
            environment="production",
            auth_mode="cognito",
            cursor_signing_key="production-cursor-signing-key-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(deployed) as deployed_client:
        assert deployed_client.get("/docs").status_code == 404
        assert deployed_client.get("/redoc").status_code == 404
        assert deployed_client.get("/openapi.json").status_code == 404
    assert "/api/v1/applications" in deployed.openapi()["paths"]


@pytest.mark.parametrize(
    ("company_name", "expected"),
    [
        ("=SUM(1,1)", "'=SUM(1,1)"),
        ("+1 Support Engineer", "'+1 Support Engineer"),
        ("- Remote", "'- Remote"),
        ("@mention", "'@mention"),
        ("   =SUM(1,1)", "'=SUM(1,1)"),
        ("Amazon", "Amazon"),
        ("AT&T", "AT&T"),
        ("C++ Developer", "C++ Developer"),
        ('Comma, "quoted" employer', 'Comma, "quoted" employer'),
        ("Unicode café 東京", "Unicode café 東京"),
    ],
)
def test_application_csv_export_neutralizes_formula_leading_text(
    client: TestClient, company_name: str, expected: str
) -> None:
    response = client.post(
        "/api/v1/applications",
        json=draft_payload(company_name)
        | {
            "location": None,
            "source_detail": "Line one\nLine two",
        },
    )
    assert response.status_code == 201

    export = client.get("/api/v1/me/applications/export")
    assert export.status_code == 200
    rows = list(csv.DictReader(io.StringIO(export.text)))
    row = next(item for item in rows if item["Company"] == expected)
    assert row["Company"] == expected
    assert row["Location"] == ""
    assert row["Source Detail"] == "Line one\nLine two"
    assert "version" not in export.text


def test_workspace_export_aggregates_only_the_authenticated_workspace(
    dynamodb_client: Any,
) -> None:
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    identity_a = _identity("00000000-0000-4000-8000-0000000000aa", "Owner A")
    identity_b = _identity("00000000-0000-4000-8000-0000000000bb", "Owner B")

    with TestClient(app) as client:
        _use_identity(app, identity_a)
        application_a = client.post(
            "/api/v1/applications", json=draft_payload("Export Owner A")
        ).json()
        note_a = client.post(
            f"/api/v1/applications/{application_a['application_id']}/notes",
            json={"content": "Owner A note"},
        ).json()
        interview_a = client.post(
            f"/api/v1/applications/{application_a['application_id']}/interviews",
            json={
                "interview_type": "RECRUITER_CALL",
                "scheduled_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            },
        ).json()

        _use_identity(app, identity_b)
        application_b = client.post(
            "/api/v1/applications", json=draft_payload("Export Owner B")
        ).json()
        note_b = client.post(
            f"/api/v1/applications/{application_b['application_id']}/notes",
            json={"content": "Owner B note"},
        ).json()
        interview_b = client.post(
            f"/api/v1/applications/{application_b['application_id']}/interviews",
            json={
                "interview_type": "RECRUITER_CALL",
                "scheduled_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
            },
        ).json()

        _use_identity(app, identity_a)
        response = client.get("/api/v1/me/export")
        csv_response = client.get("/api/v1/me/applications/export")

    assert response.status_code == 200
    payload = response.json()
    assert {item["application_id"] for item in payload["applications"]} == {
        application_a["application_id"]
    }
    assert {item["note_id"] for item in payload["notes"]} == {note_a["note_id"]}
    assert {item["interview_id"] for item in payload["interviews"]} == {interview_a["interview_id"]}
    assert all(
        item["application_id"] == application_a["application_id"] for item in payload["activities"]
    )
    assert application_b["application_id"] not in {
        item["application_id"] for item in payload["applications"]
    }
    assert note_b["note_id"] not in {item["note_id"] for item in payload["notes"]}
    assert interview_b["interview_id"] not in {
        item["interview_id"] for item in payload["interviews"]
    }
    assert "Owner B" not in str(payload)
    assert csv_response.status_code == 200
    assert "Export Owner A" in csv_response.text
    assert "Export Owner B" not in csv_response.text


def test_workspace_export_rejects_workspaces_above_the_sync_record_limit(
    dynamodb_client: Any,
) -> None:
    app = create_app(
        build_test_settings(max_sync_export_records=1),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as client:
        response = client.post("/api/v1/applications", json=draft_payload("Too Large"))
        assert response.status_code == 201

        export = client.get("/api/v1/me/export")

    assert export.status_code == 413
    assert export.json()["error"]["code"] == "WORKSPACE_EXPORT_TOO_LARGE"


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


def test_interview_creation_initializes_truthful_milestones_and_duplicate_advice(
    client: TestClient,
) -> None:
    applied_on = (date.today() - timedelta(days=14)).isoformat()
    response = client.post(
        "/api/v1/applications",
        json=draft_payload("Acme, Inc.")
        | {
            "status": "INTERVIEW",
            "applied_date": applied_on,
            "job_url": "https://jobs.example.com/opening?job_id=ENG-42&utm_source=email",
        },
    )

    assert response.status_code == 201
    created = response.json()
    assert created["status"] == "INTERVIEW"
    assert created["applied_date"] == applied_on
    assert created["submitted_at"] is not None
    assert created["first_response_at"] == created["submitted_at"]
    assert created["first_interview_at"] == created["submitted_at"]
    assert created["stage_entered_at"] == created["submitted_at"]

    activity = client.get(f"/api/v1/applications/{created['application_id']}/activity").json()[
        "items"
    ]
    assert len(activity) == 1
    assert activity[0]["activity_type"] == "APPLICATION_CREATED"
    assert activity[0]["summary"] == "Application added at Interview stage."
    assert activity[0]["metadata"] == {
        "status": "INTERVIEW",
        "initialization": "true",
    }

    dashboard = client.get("/api/v1/dashboard").json()
    assert {item["status"]: item["count"] for item in dashboard["status_breakdown"]}[
        "INTERVIEW"
    ] == 1
    assert dashboard["rates"]["submitted_count"] == 1
    assert dashboard["rates"]["response_count"] == 1
    assert dashboard["rates"]["interview_count"] == 1

    duplicate = client.post(
        "/api/v1/applications/duplicate-candidates",
        json={
            "company_name": "ACME",
            "job_title": "Platform Engineer",
            "job_url": "https://jobs.example.com/opening?job_id=ENG-42&fbclid=tracking",
        },
    )
    assert duplicate.status_code == 200
    candidates = duplicate.json()["candidates"]
    assert len(candidates) == 1
    assert candidates[0] == {
        "application_id": created["application_id"],
        "company_name": "Acme, Inc.",
        "job_title": "Platform Engineer",
        "status": "INTERVIEW",
        "applied_date": applied_on,
        "created_at": created["created_at"],
        "confidence": "HIGH",
        "matched_on": ["JOB_URL", "COMPANY", "TITLE"],
    }


def test_duplicate_candidates_are_owner_scoped(dynamodb_client: Any) -> None:
    app = create_app(build_test_settings(), dynamodb_client=dynamodb_client)
    owner_a = _identity("00000000-0000-4000-8000-0000000000a1", "Owner A")
    owner_b = _identity("00000000-0000-4000-8000-0000000000b2", "Owner B")

    with TestClient(app) as client:
        _use_identity(app, owner_a)
        created = client.post(
            "/api/v1/applications",
            json=draft_payload("Private Opportunity"),
        )
        assert created.status_code == 201

        _use_identity(app, owner_b)
        response = client.post(
            "/api/v1/applications/duplicate-candidates",
            json={
                "company_name": "Private Opportunity",
                "job_title": "Platform Engineer",
                "job_url": "https://example.com/jobs/123",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"candidates": []}


def test_creation_and_duplicate_candidate_validation_reject_contradictory_input(
    client: TestClient,
) -> None:
    draft_with_date = client.post(
        "/api/v1/applications",
        json=draft_payload("Contradictory") | {"applied_date": date.today().isoformat()},
    )
    assert draft_with_date.status_code == 422
    assert draft_with_date.json()["error"]["code"] == "DOMAIN_VALIDATION_ERROR"

    interview_without_date = client.post(
        "/api/v1/applications",
        json=draft_payload("Missing History") | {"status": "INTERVIEW"},
    )
    assert interview_without_date.status_code == 422

    insufficient_evidence = client.post(
        "/api/v1/applications/duplicate-candidates",
        json={"company_name": "Company only"},
    )
    assert insufficient_evidence.status_code == 422
    assert insufficient_evidence.json()["error"]["code"] == "VALIDATION_ERROR"


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


def test_next_step_command_separates_responsibility_from_check_back_timing(
    client: TestClient,
) -> None:
    created = client.post("/api/v1/applications", json=draft_payload()).json()
    path = f"/api/v1/applications/{created['application_id']}"
    active = client.post(
        f"{path}/status",
        json={
            "status": "APPLIED",
            "expected_version": created["version"],
            "applied_date": "2026-08-10",
        },
    ).json()

    missing_description = client.post(
        f"{path}/next-step",
        json={
            "expected_version": active["version"],
            "next_step_responsibility": "CANDIDATE",
            "next_step_note": None,
            "follow_up_date": None,
        },
    )
    assert missing_description.status_code == 422

    candidate = client.post(
        f"{path}/next-step",
        json={
            "expected_version": active["version"],
            "next_step_responsibility": "CANDIDATE",
            "next_step_note": "Send the requested portfolio examples.",
            "follow_up_date": "2026-08-28",
        },
    )
    assert candidate.status_code == 200
    assert candidate.json()["next_step_responsibility"] == "CANDIDATE"
    assert candidate.json()["next_step_note"] == "Send the requested portfolio examples."
    assert candidate.json()["follow_up_date"] == "2026-08-28"

    stale = client.post(
        f"{path}/next-step",
        json={
            "expected_version": active["version"],
            "next_step_responsibility": "NONE",
            "next_step_note": None,
            "follow_up_date": None,
        },
    )
    assert stale.status_code == 409

    candidate_complete = client.post(
        f"{path}/follow-up/complete",
        json={"expected_version": candidate.json()["version"]},
    )
    assert candidate_complete.status_code == 200
    assert candidate_complete.json()["next_step_responsibility"] == "NONE"
    assert candidate_complete.json()["next_step_note"] is None
    assert candidate_complete.json()["follow_up_date"] is None

    employer = client.post(
        f"{path}/next-step",
        json={
            "expected_version": candidate_complete.json()["version"],
            "next_step_responsibility": "EMPLOYER",
            "next_step_note": "Waiting for the hiring team to confirm the final round.",
            "follow_up_date": "2026-09-02",
        },
    )
    assert employer.status_code == 200
    employer_complete = client.post(
        f"{path}/follow-up/complete",
        json={"expected_version": employer.json()["version"]},
    )
    assert employer_complete.status_code == 200
    assert employer_complete.json()["next_step_responsibility"] == "EMPLOYER"
    assert employer_complete.json()["next_step_note"] == employer.json()["next_step_note"]
    assert employer_complete.json()["follow_up_date"] is None

    invalid_none = client.post(
        f"{path}/next-step",
        json={
            "expected_version": employer_complete.json()["version"],
            "next_step_responsibility": "NONE",
            "next_step_note": None,
            "follow_up_date": "2026-09-10",
        },
    )
    assert invalid_none.status_code == 422
    activity_types = [
        item["activity_type"] for item in client.get(f"{path}/activity").json()["items"]
    ]
    assert activity_types.count("NEXT_STEP_UPDATED") == 2


def test_next_step_command_rejects_terminal_and_general_update_paths(
    client: TestClient,
) -> None:
    created = client.post("/api/v1/applications", json=draft_payload()).json()
    path = f"/api/v1/applications/{created['application_id']}"
    active = client.post(
        f"{path}/status",
        json={
            "status": "APPLIED",
            "expected_version": created["version"],
            "applied_date": "2026-08-10",
        },
    ).json()
    terminal = client.post(
        f"{path}/status",
        json={"status": "REJECTED", "expected_version": active["version"]},
    ).json()

    rejected = client.post(
        f"{path}/next-step",
        json={
            "expected_version": terminal["version"],
            "next_step_responsibility": "EMPLOYER",
            "next_step_note": "Wait for reconsideration.",
            "follow_up_date": None,
        },
    )
    assert rejected.status_code == 409
    bypass = client.patch(
        path,
        json={
            "expected_version": terminal["version"],
            "next_step_responsibility": "NONE",
        },
    )
    assert bypass.status_code == 422


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

    recent_stage = client.get(
        "/api/v1/applications",
        params={"view": "ACTIVE", "stage_age": "0-7", "limit": 100},
    )
    assert recent_stage.status_code == 200
    assert {item["company_name"] for item in recent_stage.json()["items"]} == {
        "Applied",
        "Screening",
        "Interview",
        "Offer",
    }
    old_stage = client.get(
        "/api/v1/applications",
        params={"view": "ACTIVE", "stage_age": "31+", "limit": 100},
    )
    assert old_stage.status_code == 200
    assert old_stage.json()["items"] == []
    invalid_stage_age = client.get(
        "/api/v1/applications",
        params={"view": "ALL", "stage_age": "15-30"},
    )
    assert invalid_stage_age.status_code == 422
    invalid_bucket = client.get(
        "/api/v1/applications",
        params={"view": "ACTIVE", "stage_age": "1-2"},
    )
    assert invalid_bucket.status_code == 422
    bucket_cursor_scope = client.get(
        "/api/v1/applications",
        params={
            "view": "ACTIVE",
            "stage_age": "0-7",
            "limit": 1,
            "cursor": active_page_one["next_cursor"],
        },
    )
    assert bucket_cursor_scope.status_code == 400
    assert bucket_cursor_scope.json()["error"]["code"] == "INVALID_CURSOR"

    workspace_settings = client.get("/api/v1/settings")
    assert workspace_settings.status_code == 200
    workspace_zone = ZoneInfo(workspace_settings.json()["time_zone"])
    follow_up_today = datetime.now(workspace_zone).date().isoformat()
    applied = created["Applied"]
    updated_applied = client.patch(
        f"/api/v1/applications/{applied['application_id']}",
        json={"expected_version": applied["version"], "follow_up_date": follow_up_today},
    )
    assert updated_applied.status_code == 200

    follow_up_attention = client.get(
        "/api/v1/applications",
        params={"view": "ACTIVE", "follow_up": "NEEDS_ATTENTION", "limit": 100},
    )
    assert follow_up_attention.status_code == 200
    assert {item["status"] for item in follow_up_attention.json()["items"]} == {
        "APPLIED",
        "SCREENING",
        "INTERVIEW",
        "OFFER",
    }
    assert {item["follow_up_date"] for item in follow_up_attention.json()["items"]} == {
        None,
        follow_up_today,
    }
    invalid_follow_up_view = client.get(
        "/api/v1/applications",
        params={"view": "ALL", "follow_up": "NEEDS_ATTENTION"},
    )
    assert invalid_follow_up_view.status_code == 422
    follow_up_cursor_scope = client.get(
        "/api/v1/applications",
        params={
            "view": "ACTIVE",
            "follow_up": "NEEDS_ATTENTION",
            "limit": 1,
            "cursor": active_page_one["next_cursor"],
        },
    )
    assert follow_up_cursor_scope.status_code == 400
    assert follow_up_cursor_scope.json()["error"]["code"] == "INVALID_CURSOR"

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
