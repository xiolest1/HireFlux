from datetime import UTC, date, datetime

from hireflux_backend.application.source_strategy import build_source_strategy
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus
from hireflux_backend.domain.models import Application


def application(
    identifier: int,
    source: ApplicationSource,
    *,
    responded: bool = False,
    interviewed: bool = False,
) -> Application:
    instant = datetime(2026, 8, 20, tzinfo=UTC)
    return Application(
        application_id=f"00000000-0000-4000-8000-{identifier:012d}",
        owner_user_id="owner",
        company_name=f"Company {identifier}",
        job_title="Engineer",
        status=ApplicationStatus.APPLIED,
        applied_date=date(2026, 8, 20),
        follow_up_date=None,
        job_url=None,
        location=None,
        work_mode=None,
        source=source,
        salary_text=None,
        description=None,
        created_at=instant,
        updated_at=instant,
        version=1,
        submitted_at=instant,
        stage_entered_at=instant,
        first_response_at=instant if responded else None,
        first_interview_at=instant if interviewed else None,
    )


def test_source_strategy_calculates_shares_deltas_and_a_strong_source() -> None:
    applications = tuple(
        [application(index, ApplicationSource.REFERRAL, responded=True) for index in range(1, 6)]
        + [application(index, ApplicationSource.LINKEDIN) for index in range(6, 11)]
    )

    rows, summary, signal = build_source_strategy(
        applications,
        recent_applications=applications,
        previous_applications=applications,
    )

    referral = next(row for row in rows if row["source"] is ApplicationSource.REFERRAL)
    linkedin = next(row for row in rows if row["source"] is ApplicationSource.LINKEDIN)
    assert referral["application_share"] == 0.5
    assert linkedin["application_share"] == 0.5
    assert referral["response_rate_delta_vs_overall"] == 0.5
    assert referral["signal"] == "STRONG_PERFORMER"
    assert linkedin["signal"] == "HIGH_VOLUME_LOW_RESPONSE"
    assert summary["strongest_response"] == {
        "source": ApplicationSource.REFERRAL,
        "submitted_count": 5,
        "application_share": 0.5,
        "response_rate": 1.0,
        "response_rate_delta_vs_overall": 0.5,
    }
    assert signal is not None
    assert signal.code == "HIGH_VOLUME_LOW_RESPONSE"


def test_source_strategy_marks_early_results_and_concentrated_mix() -> None:
    applications = tuple(
        [application(index, ApplicationSource.REFERRAL) for index in range(1, 3)]
        + [application(3, ApplicationSource.LINKEDIN)]
    )

    rows, summary, signal = build_source_strategy(
        applications,
        recent_applications=applications,
        previous_applications=(),
    )

    referral = next(row for row in rows if row["source"] is ApplicationSource.REFERRAL)
    assert referral["signal"] == "CONCENTRATED_MIX"
    assert summary["concentration"]["flagged"] is True
    assert summary["sufficient_for_strategy"] is False
    assert signal is not None
    assert signal.code == "CONCENTRATED_MIX"


def test_source_strategy_requires_comparable_recent_samples_for_movement() -> None:
    recent = tuple(
        application(index, ApplicationSource.REFERRAL, responded=True) for index in range(1, 4)
    )
    previous = tuple(application(index, ApplicationSource.REFERRAL) for index in range(4, 7))

    _, summary, _ = build_source_strategy(
        recent,
        recent_applications=recent,
        previous_applications=previous,
    )

    movement = summary["recent_movement"]
    assert movement == {
        "source": ApplicationSource.REFERRAL,
        "submitted_count": 3,
        "response_rate": 1.0,
        "response_rate_delta": 1.0,
        "direction": "IMPROVING",
    }
