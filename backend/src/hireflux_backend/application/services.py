from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime
from uuid import uuid4

from hireflux_backend.application.errors import ConflictError, NotFoundError, ValidationError
from hireflux_backend.application.ports import (
    ApplicationPage,
    ApplicationRepository,
    UserRepository,
)
from hireflux_backend.domain.enums import ActivityType, ApplicationStatus, WorkMode
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity, UserProfile
from hireflux_backend.domain.status_policy import (
    ACTIVE_STATUSES_REQUIRING_APPLIED_DATE,
    StatusPolicyError,
    decide_transition,
    validate_initial_status,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class CreateApplicationCommand:
    company_name: str
    job_title: str
    status: ApplicationStatus = ApplicationStatus.DRAFT
    applied_date: date | None = None
    follow_up_date: date | None = None
    job_url: str | None = None
    location: str | None = None
    work_mode: WorkMode | None = None
    source: str | None = None
    salary_text: str | None = None
    description: str | None = None


@dataclass(frozen=True, slots=True)
class UpdateApplicationCommand:
    expected_version: int
    changes: Mapping[str, object]


@dataclass(frozen=True, slots=True)
class TransitionApplicationCommand:
    status: ApplicationStatus
    expected_version: int
    applied_date: date | None = None


class UserService:
    def __init__(
        self, repository: UserRepository, *, clock: Callable[[], datetime] = utc_now
    ) -> None:
        self._repository = repository
        self._clock = clock

    def get_or_create_profile(self, identity: CurrentIdentity) -> UserProfile:
        now = self._clock()
        return self._repository.get_or_create(identity, now_iso=_format_timestamp(now))


class ApplicationService:
    _EDITABLE_FIELDS = frozenset(
        {
            "company_name",
            "job_title",
            "applied_date",
            "follow_up_date",
            "job_url",
            "location",
            "work_mode",
            "source",
            "salary_text",
            "description",
        }
    )

    def __init__(
        self,
        repository: ApplicationRepository,
        *,
        clock: Callable[[], datetime] = utc_now,
        id_factory: Callable[[], str] = new_id,
    ) -> None:
        self._repository = repository
        self._clock = clock
        self._id_factory = id_factory

    def create(self, identity: CurrentIdentity, command: CreateApplicationCommand) -> Application:
        try:
            validate_initial_status(command.status, command.applied_date)
        except StatusPolicyError as error:
            raise ValidationError(str(error)) from error

        now = self._clock()
        application = Application(
            application_id=self._id_factory(),
            owner_user_id=identity.user_id,
            company_name=command.company_name,
            job_title=command.job_title,
            status=command.status,
            applied_date=command.applied_date,
            follow_up_date=command.follow_up_date,
            job_url=command.job_url,
            location=command.location,
            work_mode=command.work_mode,
            source=command.source,
            salary_text=command.salary_text,
            description=command.description,
            created_at=now,
            updated_at=now,
            version=1,
            expires_at=identity.expires_at,
        )
        activity = Activity(
            activity_id=self._id_factory(),
            application_id=application.application_id,
            owner_user_id=identity.user_id,
            activity_type=ActivityType.APPLICATION_CREATED,
            summary=f"Application created as {application.status.value}.",
            created_at=now,
            metadata={"status": application.status.value},
            expires_at=identity.expires_at,
        )
        self._repository.create(application, activity)
        return application

    def get(self, identity: CurrentIdentity, application_id: str) -> Application:
        application = self._repository.get(identity.user_id, application_id)
        if application is None:
            raise NotFoundError("Application not found.")
        return application

    def list(
        self,
        identity: CurrentIdentity,
        *,
        status: ApplicationStatus | None,
        limit: int,
        cursor: str | None,
    ) -> ApplicationPage:
        return self._repository.list(
            identity.user_id,
            status=status,
            limit=limit,
            cursor=cursor,
        )

    def update(
        self,
        identity: CurrentIdentity,
        application_id: str,
        command: UpdateApplicationCommand,
    ) -> Application:
        current = self.get(identity, application_id)
        self._require_version(current, command.expected_version)

        unexpected = set(command.changes) - self._EDITABLE_FIELDS
        if unexpected:
            raise ValidationError("One or more fields cannot be edited through this route.")

        effective_changes = {
            key: value for key, value in command.changes.items() if getattr(current, key) != value
        }
        if not effective_changes:
            return current

        candidate = replace(
            current,
            company_name=_required_string_change(
                effective_changes, "company_name", current.company_name
            ),
            job_title=_required_string_change(effective_changes, "job_title", current.job_title),
            applied_date=_optional_date_change(
                effective_changes, "applied_date", current.applied_date
            ),
            follow_up_date=_optional_date_change(
                effective_changes, "follow_up_date", current.follow_up_date
            ),
            job_url=_optional_string_change(effective_changes, "job_url", current.job_url),
            location=_optional_string_change(effective_changes, "location", current.location),
            work_mode=_optional_work_mode_change(effective_changes, "work_mode", current.work_mode),
            source=_optional_string_change(effective_changes, "source", current.source),
            salary_text=_optional_string_change(
                effective_changes, "salary_text", current.salary_text
            ),
            description=_optional_string_change(
                effective_changes, "description", current.description
            ),
        )
        if (
            candidate.status in ACTIVE_STATUSES_REQUIRING_APPLIED_DATE
            and candidate.applied_date is None
        ):
            raise ValidationError("applied_date is required for the current status.")

        updated = replace(
            candidate,
            updated_at=self._clock(),
            version=current.version + 1,
        )
        self._repository.replace_details(updated, expected_version=command.expected_version)
        return updated

    def transition(
        self,
        identity: CurrentIdentity,
        application_id: str,
        command: TransitionApplicationCommand,
    ) -> Application:
        current = self.get(identity, application_id)
        self._require_version(current, command.expected_version)
        try:
            decision = decide_transition(current, command.status, command.applied_date)
        except StatusPolicyError as error:
            raise ConflictError(str(error)) from error

        if not decision.changed:
            return current

        now = self._clock()
        updated = replace(
            current,
            status=decision.status,
            applied_date=decision.applied_date,
            archived_from_status=decision.archived_from_status,
            updated_at=now,
            version=current.version + 1,
        )
        activity = Activity(
            activity_id=self._id_factory(),
            application_id=current.application_id,
            owner_user_id=identity.user_id,
            activity_type=ActivityType.STATUS_CHANGED,
            summary=f"Status changed from {current.status.value} to {updated.status.value}.",
            created_at=now,
            metadata={"from_status": current.status.value, "to_status": updated.status.value},
            expires_at=identity.expires_at,
        )
        self._repository.replace_with_activity(
            updated,
            prior_status=current.status,
            expected_version=command.expected_version,
            activity=activity,
        )
        return updated

    def archive(
        self, identity: CurrentIdentity, application_id: str, *, expected_version: int
    ) -> Application:
        return self.transition(
            identity,
            application_id,
            TransitionApplicationCommand(
                status=ApplicationStatus.ARCHIVED,
                expected_version=expected_version,
            ),
        )

    def list_activity(self, identity: CurrentIdentity, application_id: str) -> tuple[Activity, ...]:
        self.get(identity, application_id)
        return self._repository.list_activity(identity.user_id, application_id)

    @staticmethod
    def _require_version(application: Application, expected_version: int) -> None:
        if application.version != expected_version:
            raise ConflictError(
                "The application was changed by another request. Refresh and try again."
            )


def _format_timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Clock values must be timezone-aware.")
    return value.astimezone(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _required_string_change(changes: Mapping[str, object], key: str, current: str) -> str:
    if key not in changes:
        return current
    value = changes[key]
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string.")
    return value


def _optional_string_change(
    changes: Mapping[str, object], key: str, current: str | None
) -> str | None:
    if key not in changes:
        return current
    value = changes[key]
    if value is not None and not isinstance(value, str):
        raise ValidationError(f"{key} must be a string or null.")
    return value


def _optional_date_change(
    changes: Mapping[str, object], key: str, current: date | None
) -> date | None:
    if key not in changes:
        return current
    value = changes[key]
    if value is not None and (not isinstance(value, date) or isinstance(value, datetime)):
        raise ValidationError(f"{key} must be a date or null.")
    return value


def _optional_work_mode_change(
    changes: Mapping[str, object], key: str, current: WorkMode | None
) -> WorkMode | None:
    if key not in changes:
        return current
    value = changes[key]
    if value is not None and not isinstance(value, WorkMode):
        raise ValidationError(f"{key} must be a valid work mode or null.")
    return value
