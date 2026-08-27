from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from hireflux_backend.domain.enums import (
    ApplicationStatus,
    NextStepResponsibility,
)
from hireflux_backend.domain.models import Application, CurrentIdentity

CLASSIFIER_VERSION = "1"


class OpportunityGroup(StrEnum):
    NEEDS_ACTION = "needs_action"
    MOVING_FORWARD = "moving_forward"
    WAITING = "waiting"


class OpportunityReason(StrEnum):
    MISSED_INTERVIEW = "MISSED_INTERVIEW"
    FOLLOW_UP_OVERDUE = "FOLLOW_UP_OVERDUE"
    FOLLOW_UP_DUE_TODAY = "FOLLOW_UP_DUE_TODAY"
    INTERVIEW_PREPARATION_DUE = "INTERVIEW_PREPARATION_DUE"
    OFFER_DECISION = "OFFER_DECISION"
    CANDIDATE_ACTION_UPCOMING = "CANDIDATE_ACTION_UPCOMING"
    INTERVIEW_PREPARATION_UPCOMING = "INTERVIEW_PREPARATION_UPCOMING"
    CANDIDATE_ACTION_UNSCHEDULED = "CANDIDATE_ACTION_UNSCHEDULED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    PROCESS_PROGRESSING = "PROCESS_PROGRESSING"
    CANDIDATE_ACTION_PLANNED = "CANDIDATE_ACTION_PLANNED"
    WAITING_FOR_EMPLOYER = "WAITING_FOR_EMPLOYER"
    RECENTLY_APPLIED = "RECENTLY_APPLIED"


class OpportunityAction(StrEnum):
    RESOLVE_INTERVIEW = "RESOLVE_INTERVIEW"
    REVIEW_FOLLOW_UP = "REVIEW_FOLLOW_UP"
    PREPARE_INTERVIEW = "PREPARE_INTERVIEW"
    REVIEW_OFFER = "REVIEW_OFFER"
    OPEN_OPPORTUNITY = "OPEN_OPPORTUNITY"


@dataclass(frozen=True, slots=True)
class OpportunityContext:
    application_id: str
    owner_user_id: str
    next_interview_id: str
    scheduled_at: datetime
    preparation_essentials_complete: bool
    version: int
    expires_at: int | None = None


@dataclass(frozen=True, slots=True)
class OpportunityClassification:
    group: OpportunityGroup
    reason_code: OpportunityReason
    action_type: OpportunityAction
    relevant_date: date | None = None
    relevant_at: datetime | None = None
    interview_id: str | None = None
    next_interview: OpportunityContext | None = None


@dataclass(frozen=True, slots=True)
class OpportunityWorkspaceItem:
    application: Application
    classification: OpportunityClassification


@dataclass(frozen=True, slots=True)
class OpportunityGroupPage:
    total_count: int
    items: tuple[OpportunityWorkspaceItem, ...]
    next_cursor: str | None


@dataclass(frozen=True, slots=True)
class OpportunityWorkspace:
    generated_at: datetime
    groups: dict[OpportunityGroup, OpportunityGroupPage]


class WorkspaceApplicationReader(Protocol):
    def list_active_for_workspace(self, owner_user_id: str) -> tuple[Application, ...]: ...


class WorkspaceContextReader(Protocol):
    def list_opportunity_contexts(self, owner_user_id: str) -> tuple[OpportunityContext, ...]: ...


class WorkspaceCursorCodec(Protocol):
    def encode(
        self, *, kind: str, owner_user_id: str, scope: str, timestamp: str, item_id: str
    ) -> str: ...

    def decode(self, token: str, *, kind: str, owner_user_id: str, scope: str) -> Any: ...


class OpportunityWorkspaceService:
    def __init__(
        self,
        applications: WorkspaceApplicationReader,
        contexts: WorkspaceContextReader,
        cursor_codec: WorkspaceCursorCodec,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        workspace_time_zone: Callable[[CurrentIdentity], str] = lambda _identity: "UTC",
    ) -> None:
        self._applications = applications
        self._contexts = contexts
        self._cursor_codec = cursor_codec
        self._clock = clock
        self._workspace_time_zone = workspace_time_zone

    def get(self, identity: CurrentIdentity, *, preview_limit: int) -> OpportunityWorkspace:
        now = self._clock()
        owner_user_id = identity.user_id
        grouped = self._classified(identity, now)
        return OpportunityWorkspace(
            generated_at=now,
            groups={
                group: self._page(owner_user_id, group, items, limit=preview_limit, cursor=None)
                for group, items in grouped.items()
            },
        )

    def get_group(
        self,
        identity: CurrentIdentity,
        group: OpportunityGroup,
        *,
        limit: int,
        cursor: str | None,
    ) -> OpportunityGroupPage:
        now = self._clock()
        owner_user_id = identity.user_id
        return self._page(
            owner_user_id,
            group,
            self._classified(identity, now)[group],
            limit=limit,
            cursor=cursor,
        )

    def _classified(
        self, identity: CurrentIdentity, now: datetime
    ) -> dict[OpportunityGroup, list[OpportunityWorkspaceItem]]:
        owner_user_id = identity.user_id
        contexts = {
            context.application_id: context
            for context in self._contexts.list_opportunity_contexts(owner_user_id)
        }
        today = now.astimezone(ZoneInfo(self._workspace_time_zone(identity))).date()
        grouped: dict[OpportunityGroup, list[OpportunityWorkspaceItem]] = {
            group: [] for group in OpportunityGroup
        }
        for application in self._applications.list_active_for_workspace(owner_user_id):
            classification = classify_opportunity(
                application, contexts.get(application.application_id), today=today, now=now
            )
            grouped[classification.group].append(
                OpportunityWorkspaceItem(application=application, classification=classification)
            )
        return {group: order_workspace_items(items, group) for group, items in grouped.items()}

    def _page(
        self,
        owner_user_id: str,
        group: OpportunityGroup,
        items: list[OpportunityWorkspaceItem],
        *,
        limit: int,
        cursor: str | None,
    ) -> OpportunityGroupPage:
        start = 0
        scope = f"{group.value}#{CLASSIFIER_VERSION}"
        if cursor:
            position = self._cursor_codec.decode(
                cursor,
                kind="opportunity-workspace",
                owner_user_id=owner_user_id,
                scope=scope,
            )
            cursor_id = position.item_id
            try:
                start = next(
                    index + 1
                    for index, item in enumerate(items)
                    if item.application.application_id == cursor_id
                )
            except StopIteration as error:
                from hireflux_backend.application.errors import InvalidCursorError

                raise InvalidCursorError("The pagination cursor is no longer valid.") from error
        page_items = items[start : start + limit]
        next_cursor = None
        if start + limit < len(items) and page_items:
            next_cursor = self._cursor_codec.encode(
                kind="opportunity-workspace",
                owner_user_id=owner_user_id,
                scope=scope,
                timestamp="",
                item_id=page_items[-1].application.application_id,
            )
        return OpportunityGroupPage(
            total_count=len(items), items=tuple(page_items), next_cursor=next_cursor
        )


def classify_opportunity(
    application: Application,
    context: OpportunityContext | None,
    *,
    today: date,
    now: datetime,
) -> OpportunityClassification:
    """Classify one active opportunity using the product's explicit precedence rules."""
    if application.status not in {
        ApplicationStatus.APPLIED,
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    }:
        raise ValueError("Only active applications can be classified.")
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("The classifier clock must be timezone-aware.")
    now = now.astimezone(UTC)

    if context is not None and context.scheduled_at <= now:
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.MISSED_INTERVIEW,
            OpportunityAction.RESOLVE_INTERVIEW,
            relevant_at=context.scheduled_at,
            context=context,
        )

    follow_up = application.follow_up_date
    if follow_up is not None and follow_up < today:
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.FOLLOW_UP_OVERDUE,
            OpportunityAction.REVIEW_FOLLOW_UP,
            relevant_date=follow_up,
            context=context,
        )
    if follow_up == today:
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.FOLLOW_UP_DUE_TODAY,
            OpportunityAction.REVIEW_FOLLOW_UP,
            relevant_date=follow_up,
            context=context,
        )

    if (
        context is not None
        and not context.preparation_essentials_complete
        and context.scheduled_at <= now + timedelta(hours=24)
    ):
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.INTERVIEW_PREPARATION_DUE,
            OpportunityAction.PREPARE_INTERVIEW,
            relevant_at=context.scheduled_at,
            context=context,
        )
    if application.status is ApplicationStatus.OFFER:
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.OFFER_DECISION,
            OpportunityAction.REVIEW_OFFER,
            context=context,
        )

    candidate_owned = application.next_step_responsibility is NextStepResponsibility.CANDIDATE
    if candidate_owned and follow_up is not None and follow_up <= today + timedelta(days=3):
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.CANDIDATE_ACTION_UPCOMING,
            OpportunityAction.OPEN_OPPORTUNITY,
            relevant_date=follow_up,
            context=context,
        )
    if context is not None and not context.preparation_essentials_complete:
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.INTERVIEW_PREPARATION_UPCOMING,
            OpportunityAction.PREPARE_INTERVIEW,
            relevant_at=context.scheduled_at,
            context=context,
        )
    if candidate_owned and follow_up is None:
        return _classification(
            OpportunityGroup.NEEDS_ACTION,
            OpportunityReason.CANDIDATE_ACTION_UNSCHEDULED,
            OpportunityAction.OPEN_OPPORTUNITY,
            context=context,
        )
    if context is not None:
        return _classification(
            OpportunityGroup.MOVING_FORWARD,
            OpportunityReason.INTERVIEW_SCHEDULED,
            OpportunityAction.OPEN_OPPORTUNITY,
            relevant_at=context.scheduled_at,
            context=context,
        )
    if application.status in {ApplicationStatus.SCREENING, ApplicationStatus.INTERVIEW}:
        return _classification(
            OpportunityGroup.MOVING_FORWARD,
            OpportunityReason.PROCESS_PROGRESSING,
            OpportunityAction.OPEN_OPPORTUNITY,
        )
    if candidate_owned and follow_up is not None:
        return _classification(
            OpportunityGroup.MOVING_FORWARD,
            OpportunityReason.CANDIDATE_ACTION_PLANNED,
            OpportunityAction.OPEN_OPPORTUNITY,
            relevant_date=follow_up,
        )
    if application.next_step_responsibility is NextStepResponsibility.EMPLOYER:
        return _classification(
            OpportunityGroup.WAITING,
            OpportunityReason.WAITING_FOR_EMPLOYER,
            OpportunityAction.OPEN_OPPORTUNITY,
            relevant_date=follow_up,
        )
    return _classification(
        OpportunityGroup.WAITING,
        OpportunityReason.RECENTLY_APPLIED,
        OpportunityAction.OPEN_OPPORTUNITY,
    )


def order_workspace_items(
    items: list[OpportunityWorkspaceItem], group: OpportunityGroup
) -> list[OpportunityWorkspaceItem]:
    if group is OpportunityGroup.NEEDS_ACTION:
        precedence = {reason: index for index, reason in enumerate(OpportunityReason)}
        return sorted(
            items,
            key=lambda item: (
                precedence[item.classification.reason_code],
                _relevant_sort_value(item.classification),
                -item.application.updated_at.timestamp(),
                item.application.application_id,
            ),
        )
    if group is OpportunityGroup.MOVING_FORWARD:
        stage_order = {
            ApplicationStatus.INTERVIEW: 0,
            ApplicationStatus.SCREENING: 1,
            ApplicationStatus.APPLIED: 2,
            ApplicationStatus.OFFER: 3,
        }
        return sorted(
            items,
            key=lambda item: (
                0 if item.classification.next_interview else 1,
                item.classification.next_interview.scheduled_at.timestamp()
                if item.classification.next_interview
                else float("inf"),
                stage_order[item.application.status],
                -(item.application.stage_entered_at or item.application.updated_at).timestamp(),
                item.application.application_id,
            ),
        )
    return sorted(
        items,
        key=lambda item: (
            item.application.follow_up_date or date.max,
            -(item.application.applied_date or date.min).toordinal(),
            -item.application.updated_at.timestamp(),
            item.application.application_id,
        ),
    )


def _classification(
    group: OpportunityGroup,
    reason: OpportunityReason,
    action: OpportunityAction,
    *,
    relevant_date: date | None = None,
    relevant_at: datetime | None = None,
    context: OpportunityContext | None = None,
) -> OpportunityClassification:
    return OpportunityClassification(
        group=group,
        reason_code=reason,
        action_type=action,
        relevant_date=relevant_date,
        relevant_at=relevant_at,
        interview_id=context.next_interview_id if context else None,
        next_interview=context,
    )


def _relevant_sort_value(classification: OpportunityClassification) -> float:
    if classification.relevant_at is not None:
        return classification.relevant_at.timestamp()
    if classification.relevant_date is not None:
        return float(classification.relevant_date.toordinal() * 86_400)
    return float("inf")
