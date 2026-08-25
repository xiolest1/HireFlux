from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from hireflux_backend.application.errors import ConflictError, NotFoundError, ValidationError
from hireflux_backend.application.ports import ApplicationRepository
from hireflux_backend.application.resource_ports import (
    NotePreview,
    ResourcePage,
    WorkspaceResourceRepository,
)
from hireflux_backend.domain.enums import ActivityType, ApplicationStatus
from hireflux_backend.domain.interview_guidance import checklist_ids_for, guidance_for
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity
from hireflux_backend.domain.resources import (
    INTERVIEW_STATUS_TRANSITIONS,
    CustomPreparationItem,
    DashboardRange,
    DefaultApplicationView,
    Interview,
    InterviewStatus,
    InterviewType,
    Note,
    ThemePreference,
    WorkspaceSettings,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class UpdateSettingsCommand:
    expected_version: int
    changes: Mapping[str, object]


@dataclass(frozen=True, slots=True)
class CreateNoteCommand:
    content: str


@dataclass(frozen=True, slots=True)
class UpdateNoteCommand:
    expected_version: int
    content: str


@dataclass(frozen=True, slots=True)
class CreateInterviewCommand:
    interview_type: InterviewType
    scheduled_at: datetime
    duration_minutes: int = 60
    location: str | None = None
    meeting_url: str | None = None
    details: str | None = None


@dataclass(frozen=True, slots=True)
class UpdateInterviewCommand:
    expected_version: int
    changes: Mapping[str, object]


@dataclass(frozen=True, slots=True)
class TransitionInterviewCommand:
    status: InterviewStatus
    expected_version: int


@dataclass(frozen=True, slots=True)
class UpdateInterviewWorkspaceCommand:
    expected_version: int
    completed_checklist_items: tuple[str, ...]
    preparation_notes: str | None
    candidate_questions: tuple[str, ...]
    debrief_went_well: str | None
    debrief_improve: str | None
    debrief_signals: str | None
    debrief_next_step: str | None
    debrief_complete: bool = False


@dataclass(frozen=True, slots=True)
class CreatePreparationItemCommand:
    expected_version: int
    label: str


InterviewWorkspaceView = Literal["UPCOMING", "ALL"]
InterviewFollowUpState = Literal["NONE", "UPCOMING", "TODAY", "OVERDUE"]
InterviewWorkflowState = Literal[
    "PREPARE",
    "UPCOMING",
    "IMMINENT",
    "MISSED",
    "CAPTURE",
    "FOLLOW_UP",
    "HISTORY",
    "CANCELED",
]
InterviewNextAction = Literal[
    "PREPARE",
    "JOIN_MEETING",
    "MARK_COMPLETE",
    "CAPTURE_NOTES",
    "REVIEW_FOLLOW_UP",
    "OPEN_APPLICATION",
]

_IMMINENT_INTERVIEW_WINDOW = timedelta(hours=4)


@dataclass(frozen=True, slots=True)
class InterviewWorkspaceContext:
    application_status: ApplicationStatus
    follow_up_date: date | None
    follow_up_state: InterviewFollowUpState
    workflow_state: InterviewWorkflowState
    next_action: InterviewNextAction


@dataclass(frozen=True, slots=True)
class WorkspaceInterviewItem:
    interview: Interview
    context: InterviewWorkspaceContext


class WorkspaceResourceService:
    _SETTINGS_FIELDS = frozenset(
        {
            "time_zone",
            "default_follow_up_days",
            "default_application_view",
            "default_dashboard_range",
            "theme",
        }
    )
    _INTERVIEW_FIELDS = frozenset(
        {
            "interview_type",
            "scheduled_at",
            "duration_minutes",
            "location",
            "meeting_url",
            "details",
        }
    )

    def __init__(
        self,
        application_repository: ApplicationRepository,
        resource_repository: WorkspaceResourceRepository,
        *,
        clock: Callable[[], datetime] = utc_now,
        id_factory: Callable[[], str] = new_id,
    ) -> None:
        self._applications = application_repository
        self._resources = resource_repository
        self._clock = clock
        self._id_factory = id_factory

    def get_settings(self, identity: CurrentIdentity) -> WorkspaceSettings:
        current = self._resources.get_settings(identity.user_id)
        if current is not None:
            return current
        now = self._aware_utc_now()
        proposed = WorkspaceSettings(
            owner_user_id=identity.user_id,
            time_zone="UTC",
            default_follow_up_days=7,
            default_application_view=DefaultApplicationView.ACTIVE,
            default_dashboard_range=DashboardRange.THIRTY_DAYS,
            theme=ThemePreference.SYSTEM,
            created_at=now,
            updated_at=now,
            version=1,
            expires_at=identity.expires_at,
        )
        return self._resources.create_settings(proposed)

    def update_settings(
        self, identity: CurrentIdentity, command: UpdateSettingsCommand
    ) -> WorkspaceSettings:
        current = self.get_settings(identity)
        self._require_version(current.version, command.expected_version, "settings")
        unexpected = set(command.changes) - self._SETTINGS_FIELDS
        if unexpected:
            raise ValidationError("One or more settings fields cannot be edited.")
        effective = {
            key: value for key, value in command.changes.items() if getattr(current, key) != value
        }
        if not effective:
            return current

        time_zone = self._typed_change(effective, "time_zone", current.time_zone, str)
        try:
            ZoneInfo(time_zone)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValidationError("time_zone must be a recognized IANA time-zone name.") from error
        updated = replace(
            current,
            time_zone=time_zone,
            default_follow_up_days=self._typed_change(
                effective,
                "default_follow_up_days",
                current.default_follow_up_days,
                int,
            ),
            default_application_view=self._typed_change(
                effective,
                "default_application_view",
                current.default_application_view,
                DefaultApplicationView,
            ),
            default_dashboard_range=self._typed_change(
                effective,
                "default_dashboard_range",
                current.default_dashboard_range,
                DashboardRange,
            ),
            theme=self._typed_change(effective, "theme", current.theme, ThemePreference),
            updated_at=self._aware_utc_now(),
            version=current.version + 1,
        )
        if not 1 <= updated.default_follow_up_days <= 30:
            raise ValidationError("default_follow_up_days must be between 1 and 30.")
        self._resources.replace_settings(updated, expected_version=command.expected_version)
        return updated

    def create_note(
        self,
        identity: CurrentIdentity,
        application_id: str,
        command: CreateNoteCommand,
    ) -> Note:
        self._require_application(identity, application_id)
        content = _require_content(command.content)
        now = self._aware_utc_now()
        note = Note(
            note_id=self._id_factory(),
            application_id=application_id,
            owner_user_id=identity.user_id,
            content=content,
            created_at=now,
            updated_at=now,
            version=1,
            expires_at=identity.expires_at,
        )
        activity = self._activity(
            identity,
            application_id,
            ActivityType.NOTE_CREATED,
            "Note added.",
            {"note_id": note.note_id},
        )
        self._resources.create_note(note, activity)
        return note

    def list_notes(
        self,
        identity: CurrentIdentity,
        application_id: str,
        *,
        limit: int,
        cursor: str | None,
    ) -> ResourcePage[Note]:
        self._require_application(identity, application_id)
        return self._resources.list_notes(
            identity.user_id,
            application_id,
            limit=limit,
            cursor=cursor,
        )

    def preview_notes(
        self, identity: CurrentIdentity, application_id: str, *, limit: int
    ) -> NotePreview:
        self._require_application(identity, application_id)
        return self._resources.preview_notes(identity.user_id, application_id, limit=limit)

    def update_note(
        self,
        identity: CurrentIdentity,
        application_id: str,
        note_id: str,
        command: UpdateNoteCommand,
    ) -> Note:
        self._require_application(identity, application_id)
        current = self._resources.get_note(identity.user_id, application_id, note_id)
        if current is None:
            raise NotFoundError("Note not found.")
        self._require_version(current.version, command.expected_version, "note")
        content = _require_content(command.content)
        if content == current.content:
            return current
        updated = replace(
            current,
            content=content,
            updated_at=self._aware_utc_now(),
            version=current.version + 1,
        )
        activity = self._activity(
            identity,
            application_id,
            ActivityType.NOTE_UPDATED,
            "Note updated.",
            {"note_id": note_id},
        )
        self._resources.replace_note(
            updated,
            expected_version=command.expected_version,
            activity=activity,
        )
        return updated

    def delete_note(
        self,
        identity: CurrentIdentity,
        application_id: str,
        note_id: str,
        *,
        expected_version: int,
    ) -> None:
        self._require_application(identity, application_id)
        current = self._resources.get_note(identity.user_id, application_id, note_id)
        if current is None:
            raise NotFoundError("Note not found.")
        self._require_version(current.version, expected_version, "note")
        activity = self._activity(
            identity,
            application_id,
            ActivityType.NOTE_DELETED,
            "Note deleted.",
            {"note_id": note_id},
        )
        self._resources.delete_note(
            identity.user_id,
            application_id,
            note_id,
            expected_version=expected_version,
            activity=activity,
        )

    def create_interview(
        self,
        identity: CurrentIdentity,
        application_id: str,
        command: CreateInterviewCommand,
    ) -> Interview:
        application = self._require_application(identity, application_id)
        scheduled_at = _aware_utc(command.scheduled_at)
        now = self._aware_utc_now()
        interview = Interview(
            interview_id=self._id_factory(),
            application_id=application_id,
            owner_user_id=identity.user_id,
            company_name=application.company_name,
            job_title=application.job_title,
            interview_type=command.interview_type,
            status=InterviewStatus.SCHEDULED,
            scheduled_at=scheduled_at,
            duration_minutes=command.duration_minutes,
            location=command.location,
            meeting_url=command.meeting_url,
            details=command.details,
            preparation_notes=None,
            completed_checklist_items=(),
            candidate_questions=(),
            application_role_family=application.role_family,
            custom_preparation_items=(),
            debrief_went_well=None,
            debrief_improve=None,
            debrief_signals=None,
            debrief_next_step=None,
            debrief_completed_at=None,
            created_at=now,
            updated_at=now,
            version=1,
            expires_at=identity.expires_at,
        )
        _validate_duration(interview.duration_minutes)
        activity = self._activity(
            identity,
            application_id,
            ActivityType.INTERVIEW_SCHEDULED,
            "Interview scheduled.",
            {
                "interview_id": interview.interview_id,
                "interview_type": interview.interview_type.value,
                "scheduled_at": interview.scheduled_at.isoformat(),
            },
        )
        self._resources.create_interview(interview, activity)
        return interview

    def list_interviews(
        self,
        identity: CurrentIdentity,
        application_id: str,
        *,
        limit: int,
        cursor: str | None,
    ) -> ResourcePage[Interview]:
        self._require_application(identity, application_id)
        return self._resources.list_interviews(
            identity.user_id,
            application_id,
            limit=limit,
            cursor=cursor,
        )

    def list_owner_interviews(
        self,
        identity: CurrentIdentity,
        *,
        view: InterviewWorkspaceView = "UPCOMING",
        limit: int,
        cursor: str | None = None,
    ) -> ResourcePage[WorkspaceInterviewItem]:
        now = self._aware_utc_now()
        settings = self.get_settings(identity)
        local_today = now.astimezone(ZoneInfo(settings.time_zone)).date()
        include_history = view == "ALL"
        page = self._resources.list_owner_interviews(
            identity.user_id,
            scheduled_after=None if include_history else now,
            include_history=include_history,
            limit=limit,
            cursor=cursor,
        )
        items: list[WorkspaceInterviewItem] = []
        for interview in page.items:
            application = self._applications.get(identity.user_id, interview.application_id)
            if application is None:
                continue
            items.append(
                WorkspaceInterviewItem(
                    interview=interview,
                    context=_interview_context(
                        interview,
                        application,
                        local_today=local_today,
                        now=now,
                    ),
                )
            )
        return ResourcePage(items=tuple(items), next_cursor=page.next_cursor)

    def update_interview(
        self,
        identity: CurrentIdentity,
        application_id: str,
        interview_id: str,
        command: UpdateInterviewCommand,
    ) -> Interview:
        application = self._require_application(identity, application_id)
        current = self._resources.get_interview(identity.user_id, application_id, interview_id)
        if current is None:
            raise NotFoundError("Interview not found.")
        self._require_version(current.version, command.expected_version, "interview")
        if current.status is not InterviewStatus.SCHEDULED:
            raise ConflictError("Completed or canceled interviews cannot be edited.")
        unexpected = set(command.changes) - self._INTERVIEW_FIELDS
        if unexpected:
            raise ValidationError("One or more interview fields cannot be edited.")
        effective = {
            key: value for key, value in command.changes.items() if getattr(current, key) != value
        }
        labels_changed = (
            current.company_name != application.company_name
            or current.job_title != application.job_title
            or current.application_role_family != application.role_family
        )
        if not effective and not labels_changed:
            return current

        scheduled_at = self._typed_change(effective, "scheduled_at", current.scheduled_at, datetime)
        updated = replace(
            current,
            company_name=application.company_name,
            job_title=application.job_title,
            application_role_family=application.role_family,
            interview_type=self._typed_change(
                effective, "interview_type", current.interview_type, InterviewType
            ),
            scheduled_at=_aware_utc(scheduled_at),
            duration_minutes=self._typed_change(
                effective, "duration_minutes", current.duration_minutes, int
            ),
            location=_optional_string_change(effective, "location", current.location),
            meeting_url=_optional_string_change(effective, "meeting_url", current.meeting_url),
            details=_optional_string_change(effective, "details", current.details),
            updated_at=self._aware_utc_now(),
            version=current.version + 1,
        )
        _validate_duration(updated.duration_minutes)
        activity = self._activity(
            identity,
            application_id,
            ActivityType.INTERVIEW_UPDATED,
            "Interview updated.",
            {"interview_id": interview_id},
        )
        self._resources.replace_interview(
            updated,
            expected_version=command.expected_version,
            activity=activity,
        )
        return updated

    def update_interview_workspace(
        self,
        identity: CurrentIdentity,
        application_id: str,
        interview_id: str,
        command: UpdateInterviewWorkspaceCommand,
    ) -> Interview:
        self._require_application(identity, application_id)
        current = self._resources.get_interview(identity.user_id, application_id, interview_id)
        if current is None:
            raise NotFoundError("Interview not found.")
        self._require_version(current.version, command.expected_version, "interview")
        if current.status is InterviewStatus.CANCELED:
            raise ConflictError("Canceled interviews cannot be prepared or debriefed.")

        completed_items = tuple(dict.fromkeys(command.completed_checklist_items))
        allowed_items = checklist_ids_for(current)
        if not set(completed_items).issubset(allowed_items):
            raise ValidationError(
                "One or more checklist items are invalid for this interview type."
            )

        preparation_notes = _optional_bounded_text(
            command.preparation_notes, field_name="preparation_notes", max_length=5_000
        )
        candidate_questions = _normalize_text_list(
            command.candidate_questions,
            field_name="candidate_questions",
            max_items=8,
            max_length=300,
        )
        if "prepare_examples" in completed_items and preparation_notes is None:
            raise ValidationError(
                "Preparation notes are required before the evidence-story step can be completed."
            )
        if "prepare_questions" in completed_items and len(candidate_questions) < 2:
            raise ValidationError(
                "At least two candidate questions are required before that step can be completed."
            )

        debrief_went_well = _optional_bounded_text(
            command.debrief_went_well, field_name="debrief_went_well", max_length=2_000
        )
        debrief_improve = _optional_bounded_text(
            command.debrief_improve, field_name="debrief_improve", max_length=2_000
        )
        debrief_signals = _optional_bounded_text(
            command.debrief_signals, field_name="debrief_signals", max_length=2_000
        )
        debrief_next_step = _optional_bounded_text(
            command.debrief_next_step, field_name="debrief_next_step", max_length=500
        )
        has_debrief = any(
            value is not None
            for value in (
                debrief_went_well,
                debrief_improve,
                debrief_signals,
                debrief_next_step,
            )
        )
        if (
            has_debrief or command.debrief_complete
        ) and current.status is not InterviewStatus.COMPLETED:
            raise ConflictError(
                "An interview must be completed before its debrief can be recorded."
            )
        if command.debrief_complete and (debrief_went_well is None or debrief_next_step is None):
            raise ValidationError(
                "A completed debrief requires what went well and a concrete next step."
            )

        debrief_completed_at = current.debrief_completed_at
        if command.debrief_complete and debrief_completed_at is None:
            debrief_completed_at = self._aware_utc_now()
        updated = replace(
            current,
            completed_checklist_items=completed_items,
            preparation_notes=preparation_notes,
            candidate_questions=candidate_questions,
            debrief_went_well=debrief_went_well,
            debrief_improve=debrief_improve,
            debrief_signals=debrief_signals,
            debrief_next_step=debrief_next_step,
            debrief_completed_at=debrief_completed_at,
        )
        if updated == current:
            return current
        updated = replace(
            updated,
            updated_at=self._aware_utc_now(),
            version=current.version + 1,
        )
        guidance = guidance_for(updated)
        activity = self._activity(
            identity,
            application_id,
            ActivityType.INTERVIEW_WORKSPACE_UPDATED,
            (
                "Interview debrief completed."
                if command.debrief_complete and current.debrief_completed_at is None
                else "Interview preparation updated."
            ),
            {
                "interview_id": interview_id,
                "completed_steps": str(guidance.completed_steps),
                "total_steps": str(guidance.total_steps),
            },
        )
        self._resources.replace_interview(
            updated,
            expected_version=command.expected_version,
            activity=activity,
        )
        return updated

    def create_preparation_item(
        self,
        identity: CurrentIdentity,
        application_id: str,
        interview_id: str,
        command: CreatePreparationItemCommand,
    ) -> Interview:
        self._require_application(identity, application_id)
        current = self._resources.get_interview(identity.user_id, application_id, interview_id)
        if current is None:
            raise NotFoundError("Interview not found.")
        self._require_version(current.version, command.expected_version, "interview")
        if current.status is InterviewStatus.CANCELED:
            raise ConflictError("Canceled interviews cannot be prepared.")
        if len(current.custom_preparation_items) >= 2:
            raise ValidationError("An interview can contain at most two custom preparation items.")
        label = _required_bounded_text(command.label, field_name="label", max_length=120)
        if any(
            item.label.casefold() == label.casefold() for item in current.custom_preparation_items
        ):
            raise ValidationError("That custom preparation item already exists.")
        updated = replace(
            current,
            custom_preparation_items=(
                *current.custom_preparation_items,
                CustomPreparationItem(item_id=self._id_factory(), label=label),
            ),
            updated_at=self._aware_utc_now(),
            version=current.version + 1,
        )
        self._resources.replace_interview(
            updated,
            expected_version=command.expected_version,
            activity=self._activity(
                identity,
                application_id,
                ActivityType.INTERVIEW_WORKSPACE_UPDATED,
                "Custom interview preparation item added.",
                {"interview_id": interview_id},
            ),
        )
        return updated

    def delete_preparation_item(
        self,
        identity: CurrentIdentity,
        application_id: str,
        interview_id: str,
        item_id: str,
        *,
        expected_version: int,
    ) -> Interview:
        self._require_application(identity, application_id)
        current = self._resources.get_interview(identity.user_id, application_id, interview_id)
        if current is None:
            raise NotFoundError("Interview not found.")
        self._require_version(current.version, expected_version, "interview")
        if current.status is InterviewStatus.CANCELED:
            raise ConflictError("Canceled interviews cannot be prepared.")
        remaining = tuple(
            item for item in current.custom_preparation_items if item.item_id != item_id
        )
        if len(remaining) == len(current.custom_preparation_items):
            raise NotFoundError("Preparation item not found.")
        updated = replace(
            current,
            custom_preparation_items=remaining,
            completed_checklist_items=tuple(
                value for value in current.completed_checklist_items if value != item_id
            ),
            updated_at=self._aware_utc_now(),
            version=current.version + 1,
        )
        self._resources.replace_interview(
            updated,
            expected_version=expected_version,
            activity=self._activity(
                identity,
                application_id,
                ActivityType.INTERVIEW_WORKSPACE_UPDATED,
                "Custom interview preparation item removed.",
                {"interview_id": interview_id},
            ),
        )
        return updated

    def transition_interview(
        self,
        identity: CurrentIdentity,
        application_id: str,
        interview_id: str,
        command: TransitionInterviewCommand,
    ) -> Interview:
        application = self._require_application(identity, application_id)
        current = self._resources.get_interview(identity.user_id, application_id, interview_id)
        if current is None:
            raise NotFoundError("Interview not found.")
        self._require_version(current.version, command.expected_version, "interview")
        if command.status is current.status:
            return current
        if command.status not in INTERVIEW_STATUS_TRANSITIONS[current.status]:
            raise ConflictError(
                f"Interview cannot move from {current.status.value} to {command.status.value}."
            )
        updated = replace(
            current,
            company_name=application.company_name,
            job_title=application.job_title,
            application_role_family=application.role_family,
            status=command.status,
            updated_at=self._aware_utc_now(),
            version=current.version + 1,
        )
        activity = self._activity(
            identity,
            application_id,
            ActivityType.INTERVIEW_STATUS_CHANGED,
            f"Interview marked {updated.status.value.lower()}.",
            {
                "interview_id": interview_id,
                "from_status": current.status.value,
                "to_status": updated.status.value,
            },
        )
        self._resources.replace_interview(
            updated,
            expected_version=command.expected_version,
            activity=activity,
        )
        return updated

    def _require_application(self, identity: CurrentIdentity, application_id: str) -> Application:
        application = self._applications.get(identity.user_id, application_id)
        if application is None:
            raise NotFoundError("Application not found.")
        return application

    def _activity(
        self,
        identity: CurrentIdentity,
        application_id: str,
        activity_type: ActivityType,
        summary: str,
        metadata: dict[str, str],
    ) -> Activity:
        return Activity(
            activity_id=self._id_factory(),
            application_id=application_id,
            owner_user_id=identity.user_id,
            activity_type=activity_type,
            summary=summary,
            created_at=self._aware_utc_now(),
            metadata=metadata,
            expires_at=identity.expires_at,
        )

    def _aware_utc_now(self) -> datetime:
        return _aware_utc(self._clock())

    @staticmethod
    def _typed_change[T](
        changes: Mapping[str, object], key: str, current: T, expected_type: type[T]
    ) -> T:
        if key not in changes:
            return current
        value = changes[key]
        if not isinstance(value, expected_type):
            raise ValidationError(f"{key} has an invalid value.")
        return value

    @staticmethod
    def _require_version(current: int, expected: int, resource: str) -> None:
        if current != expected:
            raise ConflictError(
                f"The {resource} was changed by another request. Refresh and try again."
            )


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValidationError("scheduled_at must include a UTC offset.")
    return value.astimezone(UTC)


def _follow_up_state(value: date | None, *, local_today: date) -> InterviewFollowUpState:
    if value is None:
        return "NONE"
    if value < local_today:
        return "OVERDUE"
    if value == local_today:
        return "TODAY"
    return "UPCOMING"


def _interview_context(
    interview: Interview,
    application: Application,
    *,
    local_today: date,
    now: datetime,
) -> InterviewWorkspaceContext:
    follow_up_state = _follow_up_state(application.follow_up_date, local_today=local_today)
    readiness = guidance_for(interview).ready_for_interview
    if interview.status is InterviewStatus.CANCELED:
        workflow_state: InterviewWorkflowState = "CANCELED"
        next_action: InterviewNextAction = "OPEN_APPLICATION"
    elif interview.status is InterviewStatus.SCHEDULED and interview.scheduled_at < now:
        workflow_state = "MISSED"
        next_action = "MARK_COMPLETE"
    elif (
        interview.status is InterviewStatus.SCHEDULED
        and interview.scheduled_at <= now + _IMMINENT_INTERVIEW_WINDOW
    ):
        workflow_state = "IMMINENT"
        if interview.meeting_url:
            next_action = "JOIN_MEETING"
        elif not readiness:
            next_action = "PREPARE"
        else:
            next_action = "OPEN_APPLICATION"
    elif interview.status is InterviewStatus.SCHEDULED and not readiness:
        workflow_state = "PREPARE"
        next_action = "PREPARE"
    elif interview.status is InterviewStatus.SCHEDULED:
        workflow_state = "UPCOMING"
        next_action = "JOIN_MEETING" if interview.meeting_url else "OPEN_APPLICATION"
    elif interview.status is InterviewStatus.COMPLETED and interview.debrief_completed_at is None:
        workflow_state = "CAPTURE"
        next_action = "CAPTURE_NOTES"
    elif follow_up_state in {"NONE", "TODAY", "OVERDUE"}:
        workflow_state = "FOLLOW_UP"
        next_action = "REVIEW_FOLLOW_UP"
    else:
        workflow_state = "HISTORY"
        next_action = "OPEN_APPLICATION"
    return InterviewWorkspaceContext(
        application_status=application.status,
        follow_up_date=application.follow_up_date,
        follow_up_state=follow_up_state,
        workflow_state=workflow_state,
        next_action=next_action,
    )


def _require_content(value: str) -> str:
    content = value.strip()
    if not content:
        raise ValidationError("content cannot be empty.")
    if len(content) > 5_000:
        raise ValidationError("content cannot exceed 5000 characters.")
    return content


def _required_bounded_text(value: str, *, field_name: str, max_length: int) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValidationError(f"{field_name} cannot be empty.")
    if len(normalized) > max_length:
        raise ValidationError(f"{field_name} must contain at most {max_length} characters.")
    return normalized


def _validate_duration(value: int) -> None:
    if not 15 <= value <= 480:
        raise ValidationError("duration_minutes must be between 15 and 480.")


def _optional_bounded_text(value: str | None, *, field_name: str, max_length: int) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise ValidationError(f"{field_name} cannot exceed {max_length} characters.")
    return normalized


def _normalize_text_list(
    values: tuple[str, ...], *, field_name: str, max_items: int, max_length: int
) -> tuple[str, ...]:
    if len(values) > max_items:
        raise ValidationError(f"{field_name} cannot contain more than {max_items} items.")
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = value.strip()
        if not item:
            continue
        if len(item) > max_length:
            raise ValidationError(f"Each {field_name} item cannot exceed {max_length} characters.")
        fingerprint = item.casefold()
        if fingerprint not in seen:
            normalized.append(item)
            seen.add(fingerprint)
    return tuple(normalized)


def _optional_string_change(
    changes: Mapping[str, object], key: str, current: str | None
) -> str | None:
    if key not in changes:
        return current
    value = changes[key]
    if value is not None and not isinstance(value, str):
        raise ValidationError(f"{key} must be a string or null.")
    return value
