from datetime import UTC, datetime, timedelta

from hireflux_backend.application.duplicate_candidates import (
    DuplicateConfidence,
    DuplicateEvidence,
    DuplicateSignal,
    find_duplicate_candidates,
)
from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Application

NOW = datetime(2026, 8, 25, 14, tzinfo=UTC)


def application(
    application_id: str,
    *,
    company: str = "Stripe, Inc.",
    title: str = "Software Engineer",
    job_url: str | None = None,
    location: str | None = "New York, NY",
    applied_days_ago: int = 7,
    status: ApplicationStatus = ApplicationStatus.APPLIED,
) -> Application:
    applied_date = NOW.date() - timedelta(days=applied_days_ago)
    return Application(
        application_id=application_id,
        owner_user_id="owner",
        company_name=company,
        job_title=title,
        status=status,
        applied_date=applied_date,
        follow_up_date=None,
        job_url=job_url,
        location=location,
        work_mode=None,
        source=None,
        salary_text=None,
        description=None,
        created_at=NOW - timedelta(days=applied_days_ago),
        updated_at=NOW - timedelta(days=applied_days_ago),
        version=1,
    )


def test_normalized_url_is_a_high_confidence_match() -> None:
    existing = application(
        "00000000-0000-4000-8000-000000000001",
        job_url="https://jobs.example.com/roles/123/?utm_source=email&gh_jid=123",
    )

    matches = find_duplicate_candidates(
        (existing,),
        DuplicateEvidence(
            job_url="https://JOBS.example.com/roles/123?gh_jid=123&utm_campaign=spring"
        ),
        today=NOW.date(),
    )

    assert matches[0].confidence is DuplicateConfidence.HIGH
    assert matches[0].matched_on == (DuplicateSignal.JOB_URL,)


def test_same_company_requisition_is_high_confidence() -> None:
    existing = application(
        "00000000-0000-4000-8000-000000000001",
        job_url="https://jobs.example.com/opening?jobId=REQ-42",
    )

    matches = find_duplicate_candidates(
        (existing,),
        DuplicateEvidence(company_name="stripe", requisition_id="req 42"),
        today=NOW.date(),
    )

    assert matches[0].confidence is DuplicateConfidence.HIGH
    assert DuplicateSignal.REQUISITION_ID in matches[0].matched_on


def test_exact_recent_company_title_and_location_is_medium_confidence() -> None:
    existing = application("00000000-0000-4000-8000-000000000001")

    matches = find_duplicate_candidates(
        (existing,),
        DuplicateEvidence(
            company_name="  STRIPE llc ",
            job_title="Software-Engineer",
            location="New York NY",
        ),
        today=NOW.date(),
    )

    assert matches[0].confidence is DuplicateConfidence.MEDIUM
    assert matches[0].matched_on == (
        DuplicateSignal.COMPANY,
        DuplicateSignal.TITLE,
        DuplicateSignal.LOCATION,
    )


def test_weak_or_conflicting_signals_are_suppressed() -> None:
    candidates = (
        application(
            "00000000-0000-4000-8000-000000000001",
            title="Senior Software Engineer",
        ),
        application(
            "00000000-0000-4000-8000-000000000002",
            location="Seattle, WA",
        ),
        application(
            "00000000-0000-4000-8000-000000000003",
            job_url="https://jobs.example.com/opening?jobId=REQ-99",
        ),
        application(
            "00000000-0000-4000-8000-000000000004",
            applied_days_ago=200,
        ),
    )

    matches = find_duplicate_candidates(
        candidates,
        DuplicateEvidence(
            company_name="Stripe",
            job_title="Software Engineer",
            location="New York, NY",
            requisition_id="REQ-42",
        ),
        today=NOW.date(),
    )

    assert matches == ()


def test_candidates_are_ranked_and_limited_deterministically() -> None:
    candidates = tuple(
        application(
            f"00000000-0000-4000-8000-{index:012d}",
            job_url=("https://jobs.example.com/opening?jobId=REQ-42" if index == 4 else None),
            applied_days_ago=index,
        )
        for index in range(1, 5)
    )

    matches = find_duplicate_candidates(
        candidates,
        DuplicateEvidence(
            company_name="Stripe",
            job_title="Software Engineer",
            location="New York, NY",
            job_url="https://jobs.example.com/opening?jobId=REQ-42",
        ),
        today=NOW.date(),
    )

    assert len(matches) == 3
    assert matches[0].confidence is DuplicateConfidence.HIGH
    assert matches[0].application.application_id.endswith("000000000004")


def test_malformed_urls_are_ignored_without_raising() -> None:
    existing = application(
        "00000000-0000-4000-8000-000000000001",
        job_url="https://jobs.example.com:invalid/role",
    )

    matches = find_duplicate_candidates(
        (existing,),
        DuplicateEvidence(job_url="https://jobs.example.com:also-invalid/role"),
        today=NOW.date(),
    )

    assert matches == ()


def test_non_tracking_query_parameters_that_identify_a_posting_are_preserved() -> None:
    existing = application(
        "00000000-0000-4000-8000-000000000001",
        job_url="https://jobs.example.com/opening?posting=123&utm_source=email",
    )

    matches = find_duplicate_candidates(
        (existing,),
        DuplicateEvidence(job_url="https://jobs.example.com/opening?posting=456&utm_source=email"),
        today=NOW.date(),
    )

    assert matches == ()


def test_archived_applications_remain_eligible_for_advisory_matching() -> None:
    existing = application(
        "00000000-0000-4000-8000-000000000001",
        job_url="https://jobs.example.com/opening/123",
        status=ApplicationStatus.ARCHIVED,
    )

    matches = find_duplicate_candidates(
        (existing,),
        DuplicateEvidence(job_url="https://jobs.example.com/opening/123#apply"),
        today=NOW.date(),
    )

    assert len(matches) == 1
    assert matches[0].application.status is ApplicationStatus.ARCHIVED
    assert matches[0].confidence is DuplicateConfidence.HIGH


def test_missing_evidence_never_produces_a_candidate() -> None:
    existing = application("00000000-0000-4000-8000-000000000001")

    assert find_duplicate_candidates((existing,), DuplicateEvidence(), today=NOW.date()) == ()
