from datetime import UTC, date, datetime

import pytest

from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Application
from hireflux_backend.domain.status_policy import (
    StatusPolicyError,
    allowed_transitions,
    decide_transition,
    validate_initial_status,
)

ALLOWED = {
    ApplicationStatus.DRAFT: {ApplicationStatus.APPLIED, ApplicationStatus.ARCHIVED},
    ApplicationStatus.APPLIED: {
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.REJECTED,
        ApplicationStatus.ARCHIVED,
    },
    ApplicationStatus.INTERVIEW: {
        ApplicationStatus.OFFER,
        ApplicationStatus.REJECTED,
        ApplicationStatus.ARCHIVED,
    },
    ApplicationStatus.OFFER: {ApplicationStatus.REJECTED, ApplicationStatus.ARCHIVED},
    ApplicationStatus.REJECTED: {ApplicationStatus.ARCHIVED},
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
        decision = decide_transition(current, target, date(2026, 8, 1))
        assert decision.changed is (source is not target)
        assert decision.status is target
    else:
        with pytest.raises(StatusPolicyError):
            decide_transition(current, target, date(2026, 8, 1))


def test_rejected_to_interview_is_explicitly_forbidden() -> None:
    with pytest.raises(StatusPolicyError, match="forbidden"):
        decide_transition(application(ApplicationStatus.REJECTED), ApplicationStatus.INTERVIEW)


def test_draft_to_applied_requires_a_date() -> None:
    with pytest.raises(StatusPolicyError, match="applied_date"):
        decide_transition(application(ApplicationStatus.DRAFT), ApplicationStatus.APPLIED)


def test_archive_restore_is_limited_to_prior_status() -> None:
    archived = application(ApplicationStatus.ARCHIVED)
    assert allowed_transitions(archived) == (ApplicationStatus.APPLIED,)
    restored = decide_transition(archived, ApplicationStatus.APPLIED)
    assert restored.archived_from_status is None


def test_initial_status_is_draft_or_applied_only() -> None:
    validate_initial_status(ApplicationStatus.DRAFT, None)
    validate_initial_status(ApplicationStatus.APPLIED, date(2026, 8, 1))
    with pytest.raises(StatusPolicyError):
        validate_initial_status(ApplicationStatus.INTERVIEW, date(2026, 8, 1))
    with pytest.raises(StatusPolicyError, match="applied_date"):
        validate_initial_status(ApplicationStatus.APPLIED, None)
