from typing import Any

from conftest import test_settings as build_test_settings
from fastapi.testclient import TestClient

from hireflux_backend.main import create_app


def _headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/demo-sessions")
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_seeded_dashboard_answers_core_questions(dynamodb_client: Any) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as client:
        headers = _headers(client)
        dashboard = client.get("/api/v1/dashboard", headers=headers)
        assert dashboard.status_code == 200
        payload = dashboard.json()
        assert payload["summary"] == {
            "total_tracked": 16,
            "active_pursuits": 8,
            "drafts": 2,
            "accepted": 1,
            "rejected": 3,
            "withdrawn": 1,
            "archived": 1,
        }
        assert payload["rates"]["submitted_count"] > 0
        assert payload["rates"]["response_count"] > 0
        assert len(payload["upcoming_interviews"]) == 2
        assert all(item["status"] == "SCHEDULED" for item in payload["upcoming_interviews"])
        priorities = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        action_priorities = [priorities[item["priority"]] for item in payload["actions"]]
        assert action_priorities == sorted(action_priorities)
        assert len(payload["recent_applications"]) == 5
        assert len(payload["submission_trend"]) == 8


def test_analytics_ranges_filters_denominators_and_thresholds(dynamodb_client: Any) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    with TestClient(app) as client:
        headers = _headers(client)
        all_time = client.get("/api/v1/analytics", params={"range": "all"}, headers=headers)
        assert all_time.status_code == 200
        payload = all_time.json()
        assert payload["summary"]["total_tracked"] == 16
        assert sum(item["count"] for item in payload["status_breakdown"]) == 16
        rates = payload["rates"]
        assert rates["submitted_count"] == 14
        assert rates["response_rate"] == round(
            rates["response_count"] / rates["submitted_count"], 4
        )
        assert rates["interview_rate"] == round(
            rates["interview_count"] / rates["submitted_count"], 4
        )
        assert payload["funnel"][0] == {
            "stage": "SUBMITTED",
            "count": 14,
            "rate": 1.0,
        }
        linkedin = next(
            item for item in payload["source_performance"] if item["source"] == "LINKEDIN"
        )
        assert linkedin["sample_sufficient"] is True
        referral = next(
            item for item in payload["source_performance"] if item["source"] == "REFERRAL"
        )
        assert referral["sample_sufficient"] is False
        assert payload["period_comparison"] == {
            "available": False,
            "current_start": None,
            "current_end": None,
            "previous_start": None,
            "previous_end": None,
            "current": None,
            "previous": None,
            "deltas": None,
        }
        coverage = payload["follow_up_coverage"]
        assert coverage["active_count"] == payload["summary"]["active_pursuits"]
        assert coverage["scheduled_count"] + coverage["missing_count"] == coverage["active_count"]
        assert payload["insights"]
        assert all("evidence" in insight for insight in payload["insights"])
        assert all("evidence_summary" in insight for insight in payload["insights"])
        assert all(
            insight["evidence_strength"] in {"LIMITED", "MODERATE", "STRONG"}
            for insight in payload["insights"]
        )
        assert all("category" in insight for insight in payload["insights"])
        assert all("semantic_type" in insight for insight in payload["insights"])
        assert len(payload["insights"]) <= 4
        assert sum(insight["tone"] == "ACTION_NEEDED" for insight in payload["insights"]) <= 1
        assert [insight["priority"] for insight in payload["insights"]] == sorted(
            (insight["priority"] for insight in payload["insights"]), reverse=True
        )

        thirty_days = client.get("/api/v1/analytics", params={"range": "30d"}, headers=headers)
        assert thirty_days.status_code == 200
        thirty_payload = thirty_days.json()
        assert thirty_payload["summary"]["drafts"] == 2
        assert thirty_payload["summary"]["total_tracked"] < 16
        assert (
            sum(item["count"] for item in thirty_payload["status_breakdown"])
            == thirty_payload["summary"]["total_tracked"]
        )
        assert (
            sum(item["count"] for item in thirty_payload["stage_aging"])
            == (thirty_payload["summary"]["active_pursuits"])
        )
        assert thirty_payload["rates"]["submitted_count"] == (
            thirty_payload["summary"]["total_tracked"] - thirty_payload["summary"]["drafts"]
        )
        comparison = thirty_payload["period_comparison"]
        assert comparison["available"] is True
        assert (
            comparison["current"]["submitted_count"] == thirty_payload["rates"]["submitted_count"]
        )
        assert comparison["previous_end"] < comparison["current_start"]

        draft_only = client.get(
            "/api/v1/analytics",
            params={"range": "30d", "status": "DRAFT"},
            headers=headers,
        )
        assert draft_only.status_code == 200
        assert draft_only.json()["summary"]["total_tracked"] == 2
        assert draft_only.json()["rates"]["submitted_count"] == 0

        filtered = client.get(
            "/api/v1/analytics",
            params={"range": "90d", "source": "LINKEDIN", "work_mode": "REMOTE"},
            headers=headers,
        )
        assert filtered.status_code == 200
        assert filtered.json()["filters"] == {
            "status": None,
            "source": "LINKEDIN",
            "work_mode": "REMOTE",
        }
        assert (
            client.get("/api/v1/analytics", params={"range": "7d"}, headers=headers).status_code
            == 422
        )


def test_dashboard_due_follow_ups_query_owner_schedule_index(
    dynamodb_client: Any, monkeypatch: Any
) -> None:
    app = create_app(
        build_test_settings(
            auth_mode="demo",
            demo_session_signing_key="demo-test-signing-key-that-is-at-least-32-bytes",
        ),
        dynamodb_client=dynamodb_client,
    )
    observed: list[dict[str, Any]] = []
    original_query = dynamodb_client.query

    def query_spy(**kwargs: Any) -> dict[str, Any]:
        if kwargs.get("IndexName") == "GSI3" and "BETWEEN" in kwargs.get(
            "KeyConditionExpression", ""
        ):
            observed.append(kwargs)
        return original_query(**kwargs)

    monkeypatch.setattr(dynamodb_client, "query", query_spy)
    with TestClient(app) as client:
        headers = _headers(client)
        assert client.get("/api/v1/dashboard", headers=headers).status_code == 200

    assert len(observed) == 1
    request = observed[0]
    assert request["IndexName"] == "GSI3"
    assert request["KeyConditionExpression"] == (
        "GSI3PK = :partition AND GSI3SK BETWEEN :lower_bound AND :upper_bound"
    )
    assert request["Limit"] == 100
