from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from hireflux_backend.application.errors import ConflictError, NotFoundError, ValidationError
from hireflux_backend.application.ports import ApplicationRepository
from hireflux_backend.application.resource_ports import WorkspaceResourceRepository
from hireflux_backend.domain.enums import ActivityType
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity
from hireflux_backend.domain.resources import (
    INTERVIEW_STATUS_TRANSITIONS,
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

    def list_notes(self, identity: CurrentIdentity, application_id: str) -> tuple[Note, ...]:
        self._require_application(identity, application_id)
        return self._resources.list_notes(identity.user_id, application_id)

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
        self, identity: CurrentIdentity, application_id: str
    ) -> tuple[Interview, ...]:
        self._require_application(identity, application_id)
        return self._resources.list_interviews(identity.user_id, application_id)

    def list_owner_interviews(
        self, identity: CurrentIdentity, *, limit: int
    ) -> tuple[Interview, ...]:
        return self._resources.list_owner_interviews(
            identity.user_id,
            scheduled_after=self._aware_utc_now(),
            limit=limit,
        )

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
        )
        if not effective and not labels_changed:
            return current

        scheduled_at = self._typed_change(effective, "scheduled_at", current.scheduled_at, datetime)
        updated = replace(
            current,
            company_name=application.company_name,
            job_title=application.job_title,
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


def _require_content(value: str) -> str:
    content = value.strip()
    if not content:
        raise ValidationError("content cannot be empty.")
    if len(content) > 5_000:
        raise ValidationError("content cannot exceed 5000 characters.")
    return content


def _validate_duration(value: int) -> None:
    if not 15 <= value <= 480:
        raise ValidationError("duration_minutes must be between 15 and 480.")


def _optional_string_change(
    changes: Mapping[str, object], key: str, current: str | None
) -> str | None:
    if key not in changes:
        return current
    value = changes[key]
    if value is not None and not isinstance(value, str):
        raise ValidationError(f"{key} must be a string or null.")
    return value
