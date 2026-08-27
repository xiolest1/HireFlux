from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from hireflux_backend.application.errors import InvalidCursorError
from hireflux_backend.application.opportunity_workspace import (
    OpportunityAction,
    OpportunityContext,
    OpportunityGroup,
    OpportunityReason,
    OpportunityWorkspaceItem,
    OpportunityWorkspaceService,
    classify_opportunity,
    order_workspace_items,
)
from hireflux_backend.domain.enums import (
    ApplicationStatus,
    NextStepResponsibility,
    UserRole,
)
from hireflux_backend.domain.models import Application, CurrentIdentity
from hireflux_backend.infrastructure.dynamodb.cursor import CursorCodec

NOW = datetime(2026, 8, 27, 14, tzinfo=UTC)
TODAY = date(2026, 8, 27)


def application(**changes: object) -> Application:
    base = Application(
        application_id="11111111-1111-4111-8111-111111111111",
        owner_user_id="owner",
        company_name="Example",
        job_title="Engineer",
        status=ApplicationStatus.APPLIED,
        applied_date=date(2026, 8, 20),
        follow_up_date=None,
        job_url=None,
        location=None,
        work_mode=None,
        source=None,
        salary_text=None,
        description=None,
        created_at=NOW - timedelta(days=7),
        updated_at=NOW,
        version=1,
        stage_entered_at=NOW - timedelta(days=7),
    )
    return replace(base, **changes)


def context(*, hours: float = 48, prepared: bool = False, version: int = 1) -> OpportunityContext:
    return OpportunityContext(
        application_id="11111111-1111-4111-8111-111111111111",
        owner_user_id="owner",
        next_interview_id="22222222-2222-4222-8222-222222222222",
        scheduled_at=NOW + timedelta(hours=hours),
        preparation_essentials_complete=prepared,
        version=version,
    )


@pytest.mark.parametrize(
    ("item", "projection", "group", "reason", "action"),
    [
        (
            application(),
            context(hours=-1),
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.MISSED_INTERVIEW,
            OpportunityAction.RESOLVE_INTERVIEW,
        ),
        (
            application(follow_up_date=TODAY - timedelta(days=1)),
            None,
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.FOLLOW_UP_OVERDUE,
            OpportunityAction.REVIEW_FOLLOW_UP,
        ),
        (
            application(follow_up_date=TODAY),
            None,
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.FOLLOW_UP_DUE_TODAY,
            OpportunityAction.REVIEW_FOLLOW_UP,
        ),
        (
            application(),
            context(hours=24),
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.INTERVIEW_PREPARATION_DUE,
            OpportunityAction.PREPARE_INTERVIEW,
        ),
        (
            application(status=ApplicationStatus.OFFER),
            None,
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.OFFER_DECISION,
            OpportunityAction.REVIEW_OFFER,
        ),
        (
            application(
                next_step_responsibility=NextStepResponsibility.CANDIDATE,
                follow_up_date=TODAY + timedelta(days=3),
            ),
            None,
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.CANDIDATE_ACTION_UPCOMING,
            OpportunityAction.OPEN_OPPORTUNITY,
        ),
        (
            application(),
            context(hours=25),
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.INTERVIEW_PREPARATION_UPCOMING,
            OpportunityAction.PREPARE_INTERVIEW,
        ),
        (
            application(next_step_responsibility=NextStepResponsibility.CANDIDATE),
            None,
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.CANDIDATE_ACTION_UNSCHEDULED,
            OpportunityAction.OPEN_OPPORTUNITY,
        ),
        (
            application(),
            context(hours=1, prepared=True),
            OpportunityGroup.MOVING_FORWARD,
            OpportunityReason.INTERVIEW_SCHEDULED,
            OpportunityAction.OPEN_OPPORTUNITY,
        ),
        (
            application(status=ApplicationStatus.SCREENING),
            None,
            OpportunityGroup.MOVING_FORWARD,
            OpportunityReason.PROCESS_PROGRESSING,
            OpportunityAction.OPEN_OPPORTUNITY,
        ),
        (
            application(
                next_step_responsibility=NextStepResponsibility.CANDIDATE,
                follow_up_date=TODAY + timedelta(days=4),
            ),
            None,
            OpportunityGroup.MOVING_FORWARD,
            OpportunityReason.CANDIDATE_ACTION_PLANNED,
            OpportunityAction.OPEN_OPPORTUNITY,
        ),
        (
            application(next_step_responsibility=NextStepResponsibility.EMPLOYER),
            None,
            OpportunityGroup.WAITING,
            OpportunityReason.WAITING_FOR_EMPLOYER,
            OpportunityAction.OPEN_OPPORTUNITY,
        ),
        (
            application(),
            None,
            OpportunityGroup.WAITING,
            OpportunityReason.RECENTLY_APPLIED,
            OpportunityAction.OPEN_OPPORTUNITY,
        ),
    ],
)
def test_classifier_decision_table(
    item: Application,
    projection: OpportunityContext | None,
    group: OpportunityGroup,
    reason: OpportunityReason,
    action: OpportunityAction,
) -> None:
    result = classify_opportunity(item, projection, today=TODAY, now=NOW)
    assert (result.group, result.reason_code, result.action_type) == (group, reason, action)


def test_precedence_prefers_missed_interview_over_overdue_follow_up() -> None:
    result = classify_opportunity(
        application(follow_up_date=TODAY - timedelta(days=10)),
        context(hours=-1),
        today=TODAY,
        now=NOW,
    )
    assert result.reason_code is OpportunityReason.MISSED_INTERVIEW


def test_age_alone_never_creates_priority() -> None:
    result = classify_opportunity(
        application(updated_at=NOW - timedelta(days=200)), None, today=TODAY, now=NOW
    )
    assert result.group is OpportunityGroup.WAITING


@pytest.mark.parametrize(
    "status",
    [
        ApplicationStatus.DRAFT,
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
        ApplicationStatus.ARCHIVED,
    ],
)
def test_terminal_and_non_active_statuses_are_rejected(status: ApplicationStatus) -> None:
    with pytest.raises(ValueError, match="Only active"):
        classify_opportunity(application(status=status), None, today=TODAY, now=NOW)


def test_ordering_is_deterministic_with_uuid_tie_breaker() -> None:
    first = application(application_id="11111111-1111-4111-8111-111111111111")
    second = application(application_id="22222222-2222-4222-8222-222222222222")
    items = [
        OpportunityWorkspaceItem(second, classify_opportunity(second, None, today=TODAY, now=NOW)),
        OpportunityWorkspaceItem(first, classify_opportunity(first, None, today=TODAY, now=NOW)),
    ]
    ordered = order_workspace_items(items, OpportunityGroup.WAITING)
    assert [item.application.application_id for item in ordered] == [
        first.application_id,
        second.application_id,
    ]


class CountingApplications:
    def __init__(self, items: tuple[Application, ...]) -> None:
        self.items = items
        self.calls = 0

    def list_active_for_workspace(self, owner_user_id: str) -> tuple[Application, ...]:
        assert owner_user_id
        self.calls += 1
        return self.items


class CountingContexts:
    def __init__(self) -> None:
        self.calls = 0

    def list_opportunity_contexts(self, owner_user_id: str) -> tuple[OpportunityContext, ...]:
        assert owner_user_id
        self.calls += 1
        return ()


def test_workspace_preview_has_exact_counts_without_read_path_n_plus_one() -> None:
    items = tuple(
        application(application_id=f"00000000-0000-4000-8000-{index:012d}") for index in range(25)
    )
    applications = CountingApplications(items)
    contexts = CountingContexts()
    service = OpportunityWorkspaceService(
        applications,
        contexts,
        CursorCodec("test-signing-key-that-is-at-least-32-bytes"),
        clock=lambda: NOW,
    )
    identity = CurrentIdentity(
        user_id="owner",
        name="Owner",
        email="owner@example.test",
        role=UserRole.STANDARD_USER,
    )

    workspace = service.get(identity, preview_limit=4)

    waiting = workspace.groups[OpportunityGroup.WAITING]
    assert waiting.total_count == 25
    assert len(waiting.items) == 4
    assert waiting.next_cursor is not None
    assert applications.calls == 1
    assert contexts.calls == 1


def test_workspace_cursor_is_isolated_by_group_and_owner() -> None:
    items = tuple(
        application(application_id=f"00000000-0000-4000-8000-{index:012d}") for index in range(3)
    )
    service = OpportunityWorkspaceService(
        CountingApplications(items),
        CountingContexts(),
        CursorCodec("test-signing-key-that-is-at-least-32-bytes"),
        clock=lambda: NOW,
    )
    identity = CurrentIdentity(
        user_id="owner",
        name="Owner",
        email="owner@example.test",
        role=UserRole.STANDARD_USER,
    )
    first_page = service.get_group(identity, OpportunityGroup.WAITING, limit=1, cursor=None)
    assert first_page.next_cursor is not None

    with pytest.raises(InvalidCursorError):
        service.get_group(
            identity,
            OpportunityGroup.MOVING_FORWARD,
            limit=1,
            cursor=first_page.next_cursor,
        )

    foreign_identity = replace(identity, user_id="foreign-owner")
    with pytest.raises(InvalidCursorError):
        service.get_group(
            foreign_identity,
            OpportunityGroup.WAITING,
            limit=1,
            cursor=first_page.next_cursor,
        )
