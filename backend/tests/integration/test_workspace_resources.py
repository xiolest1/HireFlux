from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from hireflux_backend.infrastructure.dynamodb.mapping import (
    deserialize_item,
    serialize_item,
)
from hireflux_backend.infrastructure.dynamodb.resource_mapping import (
    interview_key,
    opportunity_context_key,
)


def _create_application(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/applications",
        json={
            "company_name": "Browser QA Labs",
            "job_title": "Cloud Engineer",
        },
    )
    assert response.status_code == 201
    return dict(response.json())


def _create_active_application(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/v1/applications",
        json={
            "company_name": "Browser QA Labs",
            "job_title": "Cloud Engineer",
            "status": "APPLIED",
            "applied_date": datetime.now(UTC).date().isoformat(),
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
    assert client.get(f"{path}/notes").json() == {"items": [], "next_cursor": None}

    activity = client.get(f"{path}/activity").json()["items"]
    assert [item["activity_type"] for item in activity][-3:] == [
        "NOTE_CREATED",
        "NOTE_UPDATED",
        "NOTE_DELETED",
    ]
    assert all("Prepare examples" not in item["summary"] for item in activity)

    missing_application = client.get(f"/api/v1/applications/{uuid4()}/notes")
    assert missing_application.status_code == 404


def test_role_family_projects_to_interview_guidance(client: TestClient) -> None:
    application = _create_active_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    created = client.post(
        f"{path}/interviews",
        json={
            "interview_type": "BEHAVIORAL",
            "scheduled_at": "2030-01-01T12:00:00Z",
            "duration_minutes": 45,
        },
    ).json()
    assert created["guidance"]["role_context"]["source"] == "TITLE_INFERRED"
    assert created["guidance"]["role_context"]["role_family"] == "SOFTWARE_IT"

    updated_application = client.patch(
        path,
        json={
            "expected_version": application["version"],
            "role_family": "HOSPITALITY_FOOD_SERVICE",
        },
    )
    assert updated_application.status_code == 200
    assert updated_application.json()["role_family"] == "HOSPITALITY_FOOD_SERVICE"

    projected = client.get(f"{path}/interviews").json()["items"][0]
    assert projected["version"] == created["version"] + 1
    assert projected["guidance"]["role_context"] == {
        "role_family": "HOSPITALITY_FOOD_SERVICE",
        "role_family_label": "Hospitality / Food Service",
        "source": "USER_SELECTED",
        "explanation": "Chosen by you for this application: Hospitality / Food Service.",
    }
    rendered = str(projected["guidance"]).casefold()
    assert "guest" in rendered
    assert "architecture" not in rendered


def test_custom_preparation_items_are_owned_versioned_and_bounded(client: TestClient) -> None:
    application = _create_active_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    interview = client.post(
        f"{path}/interviews",
        json={
            "interview_type": "RECRUITER_CALL",
            "scheduled_at": "2030-01-01T12:00:00Z",
            "duration_minutes": 30,
        },
    ).json()
    item_path = f"{path}/interviews/{interview['interview_id']}/preparation-items"

    first = client.post(
        item_path,
        json={"expected_version": interview["version"], "label": "  Bring schedule notes  "},
    )
    assert first.status_code == 201
    first_body = first.json()
    custom = first_body["custom_preparation_items"][0]
    assert custom["label"] == "Bring schedule notes"
    assert custom["source"] == "CANDIDATE"
    assert custom["removable"] is True

    stale = client.post(
        item_path,
        json={"expected_version": interview["version"], "label": "Stale"},
    )
    assert stale.status_code == 409
    second = client.post(
        item_path,
        json={"expected_version": first_body["version"], "label": "Review uniform"},
    ).json()
    assert len(second["custom_preparation_items"]) == 2
    assert (
        client.post(
            item_path,
            json={"expected_version": second["version"], "label": "Too many"},
        ).status_code
        == 422
    )

    deleted = client.delete(
        f"{item_path}/{custom['item_id']}",
        params={"expected_version": second["version"]},
    )
    assert deleted.status_code == 200
    assert [item["label"] for item in deleted.json()["custom_preparation_items"]] == [
        "Review uniform"
    ]
    assert (
        client.delete(
            f"{item_path}/{custom['item_id']}",
            params={"expected_version": deleted.json()["version"]},
        ).status_code
        == 404
    )


def test_note_preview_is_recent_bounded_and_reports_total(client: TestClient) -> None:
    application = _create_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    first = client.post(f"{path}/notes", json={"content": "First"}).json()
    second = client.post(f"{path}/notes", json={"content": "Second"}).json()
    updated = client.patch(
        f"{path}/notes/{first['note_id']}",
        json={"expected_version": first["version"], "content": "First, updated"},
    ).json()

    preview = client.get(f"{path}/notes/preview", params={"limit": 1})
    assert preview.status_code == 200
    assert preview.json() == {"items": [updated], "total_count": 2}
    assert second["note_id"] != updated["note_id"]
    assert client.get(f"{path}/notes/preview", params={"limit": 0}).status_code == 422
    assert client.get(f"{path}/notes/preview", params={"limit": 6}).status_code == 422
    assert client.get(f"/api/v1/applications/{uuid4()}/notes/preview").status_code == 404


def test_activity_descending_order_and_cursor_scope(client: TestClient) -> None:
    application = _create_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    client.post(f"{path}/notes", json={"content": "Creates another event"})

    ascending = client.get(f"{path}/activity", params={"limit": 1, "order": "asc"}).json()
    descending = client.get(f"{path}/activity", params={"limit": 1, "order": "desc"}).json()
    assert ascending["items"][0]["activity_type"] == "APPLICATION_CREATED"
    assert descending["items"][0]["activity_type"] == "NOTE_CREATED"
    assert ascending["next_cursor"]
    assert descending["next_cursor"]
    incompatible = client.get(
        f"{path}/activity",
        params={"limit": 1, "order": "desc", "cursor": ascending["next_cursor"]},
    )
    assert incompatible.status_code == 400
    assert client.get(f"{path}/activity", params={"order": "sideways"}).status_code == 422


def test_interviews_project_to_workspace_and_remain_as_history(
    client: TestClient, dynamodb_client: Any
) -> None:
    application = _create_active_application(client)
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
    context_item = dynamodb_client.get_item(
        TableName="HireFluxTest",
        Key=serialize_item(
            opportunity_context_key(application["owner_user_id"], application["application_id"])
        ),
        ConsistentRead=True,
    )
    context = deserialize_item(context_item["Item"])
    assert context["next_interview_id"] == interview["interview_id"]
    assert context["preparation_essentials_complete"] is False
    assert context["version"] == 1

    opportunity_workspace = client.get("/api/v1/applications/workspace")
    assert opportunity_workspace.status_code == 200
    needs_action = opportunity_workspace.json()["groups"]["needs_action"]
    assert needs_action["total_count"] == 1
    assert needs_action["items"][0]["classification"]["reason_code"] == (
        "INTERVIEW_PREPARATION_UPCOMING"
    )

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
    assert "Item" not in dynamodb_client.get_item(
        TableName="HireFluxTest",
        Key=serialize_item(
            opportunity_context_key(application["owner_user_id"], application["application_id"])
        ),
        ConsistentRead=True,
    )
    assert client.get("/api/v1/interviews").json() == {"items": [], "next_cursor": None}

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


def test_workspace_interview_view_includes_history_and_server_context(client: TestClient) -> None:
    application = _create_active_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    application = client.post(
        f"{path}/next-step",
        json={
            "expected_version": application["version"],
            "next_step_responsibility": "NONE",
            "next_step_note": None,
            "follow_up_date": None,
        },
    ).json()
    now = datetime.now(UTC).replace(microsecond=0)

    future = client.post(
        f"{path}/interviews",
        json={
            "interview_type": "TECHNICAL_SCREEN",
            "scheduled_at": (now + timedelta(days=2)).isoformat(),
            "meeting_url": "https://meet.example.com/future",
        },
    )
    assert future.status_code == 201
    imminent = client.post(
        f"{path}/interviews",
        json={
            "interview_type": "RECRUITER_CALL",
            "scheduled_at": (now + timedelta(hours=2)).isoformat(),
            "meeting_url": "https://meet.example.com/imminent",
        },
    )
    assert imminent.status_code == 201
    past = client.post(
        f"{path}/interviews",
        json={
            "interview_type": "BEHAVIORAL",
            "scheduled_at": (now - timedelta(days=1)).isoformat(),
        },
    )
    assert past.status_code == 201
    completed = client.post(
        f"{path}/interviews",
        json={
            "interview_type": "FINAL",
            "scheduled_at": (now + timedelta(days=3)).isoformat(),
        },
    )
    assert completed.status_code == 201
    completed_path = f"{path}/interviews/{completed.json()['interview_id']}"
    completed_status = client.post(
        f"{completed_path}/status",
        json={"status": "COMPLETED", "expected_version": 1},
    )
    assert completed_status.status_code == 200
    canceled = client.post(
        f"{path}/interviews",
        json={
            "interview_type": "ONSITE",
            "scheduled_at": (now + timedelta(days=4)).isoformat(),
        },
    )
    assert canceled.status_code == 201
    canceled_path = f"{path}/interviews/{canceled.json()['interview_id']}"
    canceled_status = client.post(
        f"{canceled_path}/status",
        json={"status": "CANCELED", "expected_version": 1},
    )
    assert canceled_status.status_code == 200

    upcoming = client.get("/api/v1/interviews")
    assert upcoming.status_code == 200
    assert {item["interview_id"] for item in upcoming.json()["items"]} == {
        imminent.json()["interview_id"],
        future.json()["interview_id"],
    }
    upcoming_by_id = {item["interview_id"]: item for item in upcoming.json()["items"]}
    assert upcoming_by_id[future.json()["interview_id"]]["context"] == {
        "application_status": "APPLIED",
        "follow_up_date": None,
        "follow_up_state": "NONE",
        "next_step_responsibility": "NONE",
        "next_step_note": None,
        "has_later_scheduled_interview": False,
        "workflow_state": "PREPARE",
        "next_action": "PREPARE",
    }
    assert upcoming_by_id[imminent.json()["interview_id"]]["context"] == {
        "application_status": "APPLIED",
        "follow_up_date": None,
        "follow_up_state": "NONE",
        "next_step_responsibility": "NONE",
        "next_step_note": None,
        "has_later_scheduled_interview": True,
        "workflow_state": "IMMINENT",
        "next_action": "JOIN_MEETING",
    }

    all_interviews = client.get("/api/v1/interviews", params={"view": "ALL"})
    assert all_interviews.status_code == 200
    all_items = all_interviews.json()["items"]
    assert [item["scheduled_at"] for item in all_items] == sorted(
        (item["scheduled_at"] for item in all_items),
        reverse=True,
    )
    assert {item["interview_id"] for item in all_items} == {
        future.json()["interview_id"],
        imminent.json()["interview_id"],
        past.json()["interview_id"],
        completed.json()["interview_id"],
        canceled.json()["interview_id"],
    }
    by_id = {item["interview_id"]: item for item in all_items}
    assert by_id[past.json()["interview_id"]]["context"]["workflow_state"] == "MISSED"
    assert by_id[past.json()["interview_id"]]["context"]["next_action"] == "MARK_COMPLETE"
    assert by_id[completed.json()["interview_id"]]["context"]["workflow_state"] == "CAPTURE"
    assert by_id[completed.json()["interview_id"]]["context"]["next_action"] == "CAPTURE_NOTES"
    assert by_id[canceled.json()["interview_id"]]["context"]["workflow_state"] == "CANCELED"
    assert by_id[canceled.json()["interview_id"]]["context"]["next_action"] == "OPEN_APPLICATION"

    invalid_operational_only = client.patch(
        f"{completed_path}/workspace",
        json={
            "expected_version": 2,
            "completed_checklist_items": [],
            "preparation_notes": None,
            "candidate_questions": [],
            "debrief_primary_reflection": "   ",
            "debrief_went_well": None,
            "debrief_improve": None,
            "debrief_signals": None,
            "debrief_carry_forward": None,
            "debrief_next_step": "Send a concise follow-up.",
            "debrief_complete": True,
        },
    )
    assert invalid_operational_only.status_code == 422

    debrief = client.patch(
        f"{completed_path}/workspace",
        json={
            "expected_version": 2,
            "completed_checklist_items": [],
            "preparation_notes": None,
            "candidate_questions": [],
            "debrief_primary_reflection": "The team values concise tradeoff decisions.",
            "debrief_went_well": None,
            "debrief_improve": None,
            "debrief_signals": None,
            "debrief_carry_forward": "Lead the next round with the customer impact.",
            "debrief_next_step": None,
            "debrief_complete": True,
        },
    )
    assert debrief.status_code == 200
    assert debrief.json()["debrief_primary_reflection"] == (
        "The team values concise tradeoff decisions."
    )
    assert debrief.json()["debrief_carry_forward"] == (
        "Lead the next round with the customer impact."
    )
    original_completed_at = debrief.json()["debrief_completed_at"]
    revised_debrief = client.patch(
        f"{completed_path}/workspace",
        json={
            "expected_version": debrief.json()["version"],
            "completed_checklist_items": [],
            "preparation_notes": None,
            "candidate_questions": [],
            "debrief_primary_reflection": "The discussion confirmed the role's priorities.",
            "debrief_went_well": "I clarified the tradeoffs with a concrete example.",
            "debrief_improve": "Lead with the result.",
            "debrief_signals": None,
            "debrief_carry_forward": "Lead the next round with the customer impact.",
            "debrief_next_step": None,
            "debrief_complete": True,
        },
    )
    assert revised_debrief.status_code == 200
    assert revised_debrief.json()["debrief_completed_at"] == original_completed_at
    refreshed = client.get("/api/v1/interviews", params={"view": "ALL"})
    refreshed_by_id = {item["interview_id"]: item for item in refreshed.json()["items"]}
    assert (
        refreshed_by_id[completed.json()["interview_id"]]["context"]["workflow_state"] == "HISTORY"
    )
    assert (
        refreshed_by_id[completed.json()["interview_id"]]["context"]["next_action"]
        == "REVIEW_DEBRIEF"
    )

    active = client.post(
        f"{path}/next-step",
        json={
            "expected_version": application["version"],
            "next_step_responsibility": "CANDIDATE",
            "next_step_note": "Decide the next action.",
            "follow_up_date": None,
        },
    )
    assert active.status_code == 200
    active_context = client.get("/api/v1/interviews", params={"view": "ALL"}).json()["items"]
    active_by_id = {item["interview_id"]: item for item in active_context}
    assert active_by_id[completed.json()["interview_id"]]["context"]["workflow_state"] == (
        "FOLLOW_UP"
    )
    assert active_by_id[completed.json()["interview_id"]]["context"]["next_action"] == (
        "REVIEW_FOLLOW_UP"
    )

    archived = client.post(
        f"{path}/status",
        json={"status": "ARCHIVED", "expected_version": active.json()["version"]},
    )
    assert archived.status_code == 200
    archived_context = client.get("/api/v1/interviews", params={"view": "ALL"}).json()["items"]
    archived_by_id = {item["interview_id"]: item for item in archived_context}
    assert archived_by_id[completed.json()["interview_id"]]["context"]["workflow_state"] == (
        "HISTORY"
    )
    assert archived_by_id[completed.json()["interview_id"]]["context"]["next_action"] == (
        "REVIEW_DEBRIEF"
    )
    invalid_view = client.get("/api/v1/interviews", params={"view": "INVALID"})
    assert invalid_view.status_code == 422


def test_global_interviews_continue_past_the_default_page(client: TestClient) -> None:
    application = _create_active_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    now = datetime.now(UTC).replace(microsecond=0)
    created_ids: set[str] = set()

    for index in range(21):
        response = client.post(
            f"{path}/interviews",
            json={
                "interview_type": "TECHNICAL_SCREEN",
                "scheduled_at": (now + timedelta(days=index + 1)).isoformat(),
            },
        )
        assert response.status_code == 201
        created_ids.add(response.json()["interview_id"])

    first_page = client.get("/api/v1/interviews")
    assert first_page.status_code == 200
    first_payload = first_page.json()
    assert len(first_payload["items"]) == 20
    assert first_payload["next_cursor"]

    second_page = client.get(
        "/api/v1/interviews",
        params={"cursor": first_payload["next_cursor"]},
    )
    assert second_page.status_code == 200
    second_payload = second_page.json()
    assert len(second_payload["items"]) == 1
    assert second_payload["next_cursor"] is None
    assert {
        item["interview_id"] for item in first_payload["items"] + second_payload["items"]
    } == created_ids

    mismatched_view = client.get(
        "/api/v1/interviews",
        params={"view": "ALL", "cursor": first_payload["next_cursor"]},
    )
    assert mismatched_view.status_code == 400


def test_interview_scheduling_requires_an_active_application_and_quiets_terminal_records(
    client: TestClient,
) -> None:
    draft = _create_application(client)
    payload = {
        "interview_type": "FINAL",
        "scheduled_at": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
        "duration_minutes": 60,
    }
    draft_create = client.post(
        f"/api/v1/applications/{draft['application_id']}/interviews",
        json=payload,
    )
    assert draft_create.status_code == 409

    application = client.post(
        "/api/v1/applications",
        json={
            "company_name": "Offer Stage Labs",
            "job_title": "Operations Lead",
            "status": "INTERVIEW",
            "applied_date": datetime.now(UTC).date().isoformat(),
        },
    ).json()
    path = f"/api/v1/applications/{application['application_id']}"
    offer = client.post(
        f"{path}/status",
        json={"status": "OFFER", "expected_version": application["version"]},
    )
    assert offer.status_code == 200
    scheduled = client.post(f"{path}/interviews", json=payload)
    assert scheduled.status_code == 201

    accepted = client.post(
        f"{path}/status",
        json={"status": "ACCEPTED", "expected_version": offer.json()["version"]},
    )
    assert accepted.status_code == 200
    assert client.post(f"{path}/interviews", json=payload).status_code == 409

    workspace = client.get("/api/v1/interviews", params={"view": "ALL"}).json()["items"]
    context = next(
        item["context"]
        for item in workspace
        if item["interview_id"] == scheduled.json()["interview_id"]
    )
    assert context["workflow_state"] == "HISTORY"
    assert context["next_action"] == "OPEN_APPLICATION"


def test_application_rename_updates_all_interview_projections(client: TestClient) -> None:
    application = _create_active_application(client)
    path = f"/api/v1/applications/{application['application_id']}"
    now = datetime.now(UTC).replace(microsecond=0)
    interview_versions: dict[str, int] = {}
    for index in range(2):
        created = client.post(
            f"{path}/interviews",
            json={
                "interview_type": "TECHNICAL_SCREEN",
                "scheduled_at": (now + timedelta(days=index + 2)).isoformat(),
            },
        )
        assert created.status_code == 201
        interview_versions[created.json()["interview_id"]] = created.json()["version"]

    renamed = client.patch(
        path,
        json={
            "expected_version": application["version"],
            "company_name": "Amazon Web Services",
            "job_title": "Cloud Engineer",
        },
    )
    assert renamed.status_code == 200
    assert renamed.json()["company_name"] == "Amazon Web Services"
    assert renamed.json()["job_title"] == "Cloud Engineer"
    detail = client.get(path)
    assert detail.status_code == 200
    assert detail.json()["company_name"] == "Amazon Web Services"
    assert detail.json()["job_title"] == "Cloud Engineer"

    nested = client.get(f"{path}/interviews")
    assert nested.status_code == 200
    assert len(nested.json()["items"]) == 2
    assert {(item["company_name"], item["job_title"]) for item in nested.json()["items"]} == {
        ("Amazon Web Services", "Cloud Engineer")
    }
    refreshed_versions = {item["interview_id"]: item["version"] for item in nested.json()["items"]}
    assert refreshed_versions == {
        interview_id: version + 1 for interview_id, version in interview_versions.items()
    }

    stale_interview_id, stale_version = next(iter(interview_versions.items()))
    stale_edit = client.patch(
        f"{path}/interviews/{stale_interview_id}",
        json={"expected_version": stale_version, "details": "Stale client edit"},
    )
    assert stale_edit.status_code == 409

    workspace = client.get("/api/v1/interviews")
    assert workspace.status_code == 200
    projected = [
        item
        for item in workspace.json()["items"]
        if item["application_id"] == application["application_id"]
    ]
    assert len(projected) == 2
    assert {(item["company_name"], item["job_title"]) for item in projected} == {
        ("Amazon Web Services", "Cloud Engineer")
    }
    assert {item["interview_id"]: item["version"] for item in projected} == refreshed_versions


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


def test_resource_pages_reject_tampering_and_enforce_quotas(limited_client: TestClient) -> None:
    application = _create_active_application(limited_client)
    path = f"/api/v1/applications/{application['application_id']}"

    notes = []
    for content in ("First", "Second"):
        response = limited_client.post(f"{path}/notes", json={"content": content})
        assert response.status_code == 201
        notes.append(response.json())
    quota_exceeded = limited_client.post(f"{path}/notes", json={"content": "Third"})
    assert quota_exceeded.status_code == 409

    first_page = limited_client.get(f"{path}/notes", params={"limit": 1})
    assert first_page.status_code == 200
    first_payload = first_page.json()
    assert len(first_payload["items"]) == 1
    assert first_payload["next_cursor"]

    tampered = limited_client.get(
        f"{path}/notes", params={"limit": 1, "cursor": first_payload["next_cursor"] + "x"}
    )
    assert tampered.status_code == 400

    second_page = limited_client.get(
        f"{path}/notes",
        params={"limit": 1, "cursor": first_payload["next_cursor"]},
    )
    assert second_page.status_code == 200
    second_payload = second_page.json()
    assert len(second_payload["items"]) == 1
    assert second_payload["next_cursor"] is None
    assert {first_payload["items"][0]["note_id"], second_payload["items"][0]["note_id"]} == {
        note["note_id"] for note in notes
    }

    deleted = limited_client.delete(
        f"{path}/notes/{notes[0]['note_id']}", params={"expected_version": 1}
    )
    assert deleted.status_code == 204
    note_slot_reused = limited_client.post(f"{path}/notes", json={"content": "Third"})
    assert note_slot_reused.status_code == 201

    interview_payload = {
        "interview_type": "TECHNICAL_SCREEN",
        "scheduled_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
    }
    created_interview = limited_client.post(f"{path}/interviews", json=interview_payload)
    assert created_interview.status_code == 201
    interview_quota_exceeded = limited_client.post(f"{path}/interviews", json=interview_payload)
    assert interview_quota_exceeded.status_code == 409

    activity_page = limited_client.get(f"{path}/activity", params={"limit": 1})
    assert activity_page.status_code == 200
    activity_payload = activity_page.json()
    assert len(activity_payload["items"]) == 1
    assert activity_payload["next_cursor"]
    activity_next = limited_client.get(
        f"{path}/activity",
        params={"limit": 1, "cursor": activity_payload["next_cursor"]},
    )
    assert activity_next.status_code == 200
    assert len(activity_next.json()["items"]) == 1
