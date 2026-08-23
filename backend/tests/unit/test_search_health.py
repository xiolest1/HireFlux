from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from hireflux_backend.application.search_health import build_search_health
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus
from hireflux_backend.domain.models import Application

TODAY = date(2026, 8, 23)
UTC_ZONE = ZoneInfo("UTC")


def application(
    identifier: int,
    submitted_on: date | None,
    *,
    status: ApplicationStatus = ApplicationStatus.REJECTED,
    responded: bool = False,
    interviewed: bool = False,
    source: ApplicationSource | None = None,
    follow_up: date | None = None,
    stage_age: int | None = None,
) -> Application:
    instant = datetime.combine(submitted_on or TODAY, datetime.min.time(), tzinfo=UTC)
    entered = (
        instant
        if stage_age is None
        else datetime.combine(TODAY - timedelta(days=stage_age), datetime.min.time(), tzinfo=UTC)
    )
    return Application(
        application_id=f"00000000-0000-4000-8000-{identifier:012d}",
        owner_user_id="owner",
        company_name=f"Company {identifier}",
        job_title="Engineer",
        status=status,
        applied_date=submitted_on,
        follow_up_date=follow_up,
        job_url=None,
        location=None,
        work_mode=None,
        source=source,
        salary_text=None,
        description=None,
        created_at=instant,
        updated_at=instant,
        version=1,
        submitted_at=instant if submitted_on else None,
        stage_entered_at=entered
        if status
        in {
            ApplicationStatus.APPLIED,
            ApplicationStatus.SCREENING,
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.OFFER,
        }
        else None,
        first_response_at=instant + timedelta(days=2) if responded else None,
        first_interview_at=instant + timedelta(days=5) if interviewed else None,
    )


def comparison(
    current_count: int = 0,
    previous_count: int = 0,
    *,
    current_response: float = 0,
    previous_response: float = 0,
    current_interview: float = 0,
    previous_interview: float = 0,
) -> dict[str, object]:
    metric = {
        "offer_rate": 0.0,
        "acceptance_rate": 0.0,
        "average_days_to_first_response": None,
    }
    return {
        "available": True,
        "current": {
            **metric,
            "submitted_count": current_count,
            "response_rate": current_response,
            "interview_rate": current_interview,
        },
        "previous": {
            **metric,
            "submitted_count": previous_count,
            "response_rate": previous_response,
            "interview_rate": previous_interview,
        },
    }


def health(
    applications: tuple[Application, ...], period: dict[str, object] | None = None
) -> list[dict[str, object]]:
    return build_search_health(
        applications,
        local_today=TODAY,
        time_zone=UTC_ZONE,
        period_comparison=period or {"available": False},
    )


def codes(insights: list[dict[str, object]]) -> list[str]:
    return [str(item["code"]) for item in insights]


def test_small_sample_is_explicit_without_exaggerated_momentum() -> None:
    insights = health((application(1, TODAY - timedelta(days=8)),))
    assert codes(insights) == ["BUILD_SAMPLE"]
    assert "Based on 1 submitted application" in str(insights[0]["evidence"])


def test_meaningful_seven_day_momentum_decline_uses_absolute_counts() -> None:
    items = tuple(
        application(index, TODAY - timedelta(days=7 + index % 7)) for index in range(1, 9)
    ) + tuple(application(100 + index, TODAY - timedelta(days=index)) for index in range(3))
    insight = next(item for item in health(items) if item["code"] == "MOMENTUM_DOWN")
    assert "3 submissions in the last 7 days" in str(insight["evidence"])
    assert "%" not in str(insight["evidence"])


def test_momentum_windows_include_exact_six_seven_and_thirteen_day_boundaries() -> None:
    items = (
        application(1, TODAY),
        application(2, TODAY - timedelta(days=6)),
        application(3, TODAY - timedelta(days=7)),
        application(4, TODAY - timedelta(days=8)),
        application(5, TODAY - timedelta(days=9)),
        application(6, TODAY - timedelta(days=10)),
        application(7, TODAY - timedelta(days=13)),
        application(8, TODAY - timedelta(days=14)),
    )
    insight = next(item for item in health(items) if item["code"] == "MOMENTUM_DOWN")
    assert "2 submissions in the last 7 days" in str(insight["evidence"])
    assert "5 in the previous 7 days" in str(insight["evidence"])


def test_recent_response_improvement_requires_two_meaningful_samples() -> None:
    recent = tuple(
        application(index, TODAY - timedelta(days=20 + index), responded=True) for index in range(5)
    )
    historical = tuple(
        application(100 + index, TODAY - timedelta(days=40 + index)) for index in range(5)
    )
    insights = health(recent + historical)
    assert "RESPONSE_IMPROVING" in codes(insights)

    insufficient = health(recent + historical[:4])
    assert "RESPONSE_IMPROVING" not in codes(insufficient)


def test_response_window_includes_day_29_and_treats_day_30_as_historical() -> None:
    recent = tuple(
        application(index, TODAY - timedelta(days=29 - index), responded=True) for index in range(5)
    )
    historical = tuple(
        application(100 + index, TODAY - timedelta(days=30 + index)) for index in range(5)
    )
    insight = next(
        item for item in health(recent + historical) if item["code"] == "RESPONSE_IMPROVING"
    )
    assert "100% across 5 recent applications" in str(insight["evidence"])


def test_stable_activity_and_healthy_follow_ups_do_not_create_warnings() -> None:
    stable = tuple(
        application(index, TODAY - timedelta(days=index % 7)) for index in range(5)
    ) + tuple(application(100 + index, TODAY - timedelta(days=7 + index % 7)) for index in range(5))
    healthy_active = application(
        999,
        TODAY - timedelta(days=2),
        status=ApplicationStatus.APPLIED,
        follow_up=TODAY + timedelta(days=4),
        stage_age=2,
    )
    result_codes = codes(health((*stable, healthy_active)))
    assert "MOMENTUM_DOWN" not in result_codes
    assert "MOMENTUM_UP" not in result_codes
    assert "FOLLOW_UP_ATTENTION" not in result_codes


def test_stage_aging_uses_status_specific_thresholds_and_ignores_terminal_states() -> None:
    items = (
        application(1, TODAY - timedelta(days=30), status=ApplicationStatus.APPLIED, stage_age=20),
        application(2, TODAY - timedelta(days=30), status=ApplicationStatus.APPLIED, stage_age=21),
        application(
            3, TODAY - timedelta(days=20), status=ApplicationStatus.SCREENING, stage_age=14
        ),
        application(4, TODAY - timedelta(days=12), status=ApplicationStatus.INTERVIEW, stage_age=9),
        application(5, TODAY - timedelta(days=10), status=ApplicationStatus.OFFER, stage_age=7),
        application(6, TODAY - timedelta(days=40), status=ApplicationStatus.REJECTED, stage_age=40),
        application(7, TODAY - timedelta(days=40), status=ApplicationStatus.ARCHIVED, stage_age=40),
    )
    insight = next(item for item in health(items) if item["code"] == "STALLED_PIPELINE")
    assert "Offer" not in str(insight["evidence"])
    assert "1 in Interview for at least 9 days" in str(insight["evidence"])
    assert "1 in Applied for at least 21 days" in str(insight["evidence"])
    assert insight["tone"] == "WATCH"
    assert insight["title"] == "3 applications haven't moved recently"
    assert insight["action"] == {
        "kind": "VIEW_APPLICATIONS",
        "label": "Review pipeline",
        "parameters": {"view": "ACTIVE"},
    }


def test_follow_up_combines_overdue_and_missing_work() -> None:
    items = (
        application(
            1,
            TODAY - timedelta(days=5),
            status=ApplicationStatus.APPLIED,
            follow_up=TODAY - timedelta(days=1),
        ),
        application(2, TODAY - timedelta(days=5), status=ApplicationStatus.SCREENING),
        application(
            3,
            TODAY - timedelta(days=5),
            status=ApplicationStatus.INTERVIEW,
            follow_up=TODAY + timedelta(days=2),
        ),
    )
    insight = next(item for item in health(items) if item["code"] == "FOLLOW_UP_ATTENTION")
    assert insight["tone"] == "ACTION_NEEDED"
    assert insight["title"] == "1 follow-up is overdue"
    assert insight["evidence_summary"] == "1 overdue · 1 due soon · 1 missing a next step"
    assert "1 follow-up overdue" in str(insight["evidence"])
    assert "1 without a next step scheduled" in str(insight["evidence"])
    assert "1 due in the next 3 days" in str(insight["evidence"])


def test_follow_up_urgency_distinguishes_due_today_missing_and_due_soon() -> None:
    due_today = health(
        (
            application(
                1,
                TODAY - timedelta(days=5),
                status=ApplicationStatus.APPLIED,
                follow_up=TODAY,
            ),
        )
    )[0]
    assert due_today["tone"] == "ACTION_NEEDED"
    assert due_today["title"] == "1 follow-up is due today"

    missing = health(
        (application(2, TODAY - timedelta(days=5), status=ApplicationStatus.SCREENING),)
    )[0]
    assert missing["tone"] == "INFO"
    assert missing["title"] == "1 active application needs a next step"

    due_soon = health(
        (
            application(
                3,
                TODAY - timedelta(days=5),
                status=ApplicationStatus.INTERVIEW,
                follow_up=TODAY + timedelta(days=2),
            ),
        )
    )[0]
    assert due_soon["tone"] == "INFO"
    assert due_soon["title"] == "1 follow-up is coming up"
    assert due_soon["action"] == {
        "kind": "VIEW_APPLICATIONS",
        "label": "Review active applications",
        "parameters": {"view": "ACTIVE"},
    }


def test_source_outperformance_needs_five_applications_and_exposes_evidence() -> None:
    referrals = tuple(
        application(
            index,
            TODAY - timedelta(days=40 + index),
            source=ApplicationSource.REFERRAL,
            responded=index < 4,
        )
        for index in range(5)
    )
    baseline = tuple(
        application(100 + index, TODAY - timedelta(days=60 + index), responded=False)
        for index in range(5)
    )
    insight = next(item for item in health(referrals + baseline) if item["code"] == "STRONG_SOURCE")
    assert "4 of 5 referral applications" in str(insight["evidence"])
    assert insight["action"] == {
        "kind": "VIEW_APPLICATIONS",
        "label": "View referral applications",
        "parameters": {"view": "ALL", "source": "REFERRAL"},
    }
    assert "STRONG_SOURCE" not in codes(health(referrals[:4] + baseline))


def test_multiple_eligible_sources_choose_the_strongest_deterministically() -> None:
    referrals = tuple(
        application(
            index,
            TODAY - timedelta(days=50 + index),
            source=ApplicationSource.REFERRAL,
            responded=index < 5,
        )
        for index in range(5)
    )
    linkedin = tuple(
        application(
            100 + index,
            TODAY - timedelta(days=60 + index),
            source=ApplicationSource.LINKEDIN,
            responded=index < 4,
        )
        for index in range(5)
    )
    baseline = tuple(
        application(200 + index, TODAY - timedelta(days=80 + index)) for index in range(10)
    )
    insight = next(
        item for item in health(referrals + linkedin + baseline) if item["code"] == "STRONG_SOURCE"
    )
    assert insight["title"] == "Referral is outperforming your overall search"


def test_standalone_response_decline_is_suppressed_when_denominator_is_too_small() -> None:
    recent = tuple(application(index, TODAY - timedelta(days=20 + index)) for index in range(5))
    historical = tuple(
        application(100 + index, TODAY - timedelta(days=50 + index), responded=True)
        for index in range(5)
    )
    insight = next(
        item for item in health(recent + historical) if item["code"] == "RESPONSE_DECLINING"
    )
    assert insight["tone"] == "WATCH"
    assert insight["evidence_strength"] == "LIMITED"
    assert insight["evidence_label"] == "Early signal · Based on 10 applications"
    assert "RESPONSE_DECLINING" not in codes(health(recent[:4] + historical))


def test_stronger_response_decline_remains_worth_watching_without_early_label() -> None:
    recent = tuple(
        application(index, TODAY - timedelta(days=10 + index), responded=index < 4)
        for index in range(20)
    )
    historical = tuple(
        application(100 + index, TODAY - timedelta(days=40 + index), responded=index < 16)
        for index in range(20)
    )
    insight = next(
        item for item in health(recent + historical) if item["code"] == "RESPONSE_DECLINING"
    )
    assert insight["tone"] == "WATCH"
    assert insight["evidence_strength"] == "STRONG"
    assert insight["evidence_label"] == "Based on 40 applications"


def test_deeper_pipeline_combination_suppresses_simple_volume_warning() -> None:
    items = tuple(
        application(index, TODAY - timedelta(days=7 + index % 7)) for index in range(1, 10)
    ) + tuple(application(100 + index, TODAY - timedelta(days=index)) for index in range(4))
    insights = health(
        items,
        comparison(4, 9, current_interview=0.5, previous_interview=0.1),
    )
    assert "MOMENTUM_WITH_INTERVIEWS" in codes(insights)
    assert "MOMENTUM_DOWN" not in codes(insights)


def test_volume_up_and_response_down_combination_is_factual_and_suppresses_components() -> None:
    insights = health(
        tuple(application(index, TODAY - timedelta(days=20 + index)) for index in range(10)),
        comparison(10, 5, current_response=0.2, previous_response=0.6),
    )
    assert "VOLUME_UP_RESPONSE_DOWN" in codes(insights)
    assert "MOMENTUM_UP" not in codes(insights)
    description = str(
        next(item for item in insights if item["code"] == "VOLUME_UP_RESPONSE_DOWN")["description"]
    )
    assert "without assigning a cause" in description


def test_results_are_ranked_bounded_and_deterministic() -> None:
    active = tuple(
        application(
            index,
            TODAY - timedelta(days=40 + index),
            status=ApplicationStatus.INTERVIEW,
            stage_age=10,
            follow_up=TODAY - timedelta(days=1),
            source=ApplicationSource.REFERRAL,
            responded=True,
        )
        for index in range(6)
    )
    baseline = tuple(
        application(100 + index, TODAY - timedelta(days=80 + index)) for index in range(6)
    )
    first = health(active + baseline)
    second = health(active + baseline)
    assert first == second
    assert len(first) <= 4
    priorities = [int(item["priority"]) for item in first]
    assert priorities == sorted(priorities, reverse=True)
    assert sum(item["tone"] == "ACTION_NEEDED" for item in first) <= 1
