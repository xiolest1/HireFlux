from datetime import UTC, date, datetime

import pytest

from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Application
from hireflux_backend.domain.status_policy import (
    StatusPolicyError,
    allowed_transitions,
    decide_transition,
    validate_applied_date,
    validate_initial_status,
)

ALLOWED = {
    ApplicationStatus.DRAFT: {ApplicationStatus.APPLIED, ApplicationStatus.ARCHIVED},
    ApplicationStatus.APPLIED: {
        ApplicationStatus.DRAFT,
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
        ApplicationStatus.ARCHIVED,
    },
    ApplicationStatus.SCREENING: {
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
        ApplicationStatus.ARCHIVED,
    },
    ApplicationStatus.INTERVIEW: {
        ApplicationStatus.OFFER,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
        ApplicationStatus.ARCHIVED,
    },
    ApplicationStatus.OFFER: {
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
        ApplicationStatus.ARCHIVED,
    },
    ApplicationStatus.ACCEPTED: {ApplicationStatus.ARCHIVED},
    ApplicationStatus.REJECTED: {ApplicationStatus.OFFER, ApplicationStatus.ARCHIVED},
    ApplicationStatus.WITHDRAWN: {ApplicationStatus.ARCHIVED},
}


def application(status: ApplicationStatus) -> Application:
    timestamp = datetime(2026, 8, 10, 12, tzinfo=UTC)
    return Application(
        application_id="00000000-0000-4000-8000-000000000010",
        owner_user_id="owner",
        company_name="Example",
        job_title="Engineer",
        status=status,
        applied_date=None if status is ApplicationStatus.DRAFT else date(2026, 8, 1),
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
        archived_from_status=(
            ApplicationStatus.APPLIED if status is ApplicationStatus.ARCHIVED else None
        ),
    )


@pytest.mark.parametrize("source", list(ApplicationStatus))
@pytest.mark.parametrize("target", list(ApplicationStatus))
def test_complete_transition_matrix(source: ApplicationStatus, target: ApplicationStatus) -> None:
    current = application(source)
    should_allow = (
        source is target
        or (source is ApplicationStatus.ARCHIVED and target is ApplicationStatus.APPLIED)
        or (source is not ApplicationStatus.ARCHIVED and target in ALLOWED[source])
    )

    if should_allow:
        decision = decide_transition(
            current,
            target,
            None if target is ApplicationStatus.DRAFT else date(2026, 8, 1),
        )
        assert decision.changed is (source is not target)
        assert decision.status is target
    else:
        with pytest.raises(StatusPolicyError):
            decide_transition(current, target, date(2026, 8, 1))


def test_rejected_to_interview_is_explicitly_forbidden() -> None:
    with pytest.raises(StatusPolicyError, match="forbidden"):
        decide_transition(application(ApplicationStatus.REJECTED), ApplicationStatus.INTERVIEW)


def test_rejected_can_be_corrected_to_offer() -> None:
    decision = decide_transition(application(ApplicationStatus.REJECTED), ApplicationStatus.OFFER)

    assert decision.changed is True
    assert decision.status is ApplicationStatus.OFFER


def test_applied_can_be_corrected_to_draft_and_clears_applied_date() -> None:
    decision = decide_transition(application(ApplicationStatus.APPLIED), ApplicationStatus.DRAFT)

    assert decision.changed is True
    assert decision.status is ApplicationStatus.DRAFT
    assert decision.applied_date is None


def test_correction_to_draft_rejects_an_applied_date() -> None:
    with pytest.raises(StatusPolicyError, match="must be empty"):
        decide_transition(
            application(ApplicationStatus.APPLIED), ApplicationStatus.DRAFT, date(2026, 8, 1)
        )


def test_draft_to_applied_requires_a_date() -> None:
    with pytest.raises(StatusPolicyError, match="applied_date"):
        decide_transition(application(ApplicationStatus.DRAFT), ApplicationStatus.APPLIED)


def test_archive_restore_is_limited_to_prior_status() -> None:
    archived = application(ApplicationStatus.ARCHIVED)
    assert allowed_transitions(archived) == (ApplicationStatus.APPLIED,)
    restored = decide_transition(archived, ApplicationStatus.APPLIED)
    assert restored.archived_from_status is None


def test_initial_status_supports_saved_applied_and_interview() -> None:
    validate_initial_status(ApplicationStatus.DRAFT, None)
    validate_initial_status(ApplicationStatus.APPLIED, date(2026, 8, 1))
    validate_initial_status(ApplicationStatus.INTERVIEW, date(2026, 8, 1))
    with pytest.raises(StatusPolicyError, match="applied_date"):
        validate_initial_status(ApplicationStatus.APPLIED, None)
    with pytest.raises(StatusPolicyError, match="applied_date"):
        validate_initial_status(ApplicationStatus.INTERVIEW, None)
    with pytest.raises(StatusPolicyError, match="must be empty"):
        validate_initial_status(ApplicationStatus.DRAFT, date(2026, 8, 1))
    with pytest.raises(StatusPolicyError, match="only be created"):
        validate_initial_status(ApplicationStatus.OFFER, date(2026, 8, 1))


def test_applied_date_cannot_be_in_the_future() -> None:
    validate_applied_date(date(2026, 8, 20), today=date(2026, 8, 20))
    with pytest.raises(StatusPolicyError, match="future"):
        validate_applied_date(date(2026, 8, 21), today=date(2026, 8, 20))
