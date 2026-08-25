from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from hireflux_backend.application.errors import ConflictError, NotFoundError, ValidationError
from hireflux_backend.application.ports import (
    ActivityPage,
    ApplicationPage,
    ApplicationRepository,
    StageAgeBounds,
    UserRepository,
)
from hireflux_backend.domain.enums import (
    ActivityType,
    ApplicationSort,
    ApplicationSource,
    ApplicationStatus,
    FollowUpFilter,
    RoleFamily,
    StageAgeBucket,
    WorkMode,
)
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity, UserProfile
from hireflux_backend.domain.resources import ACTIVE_APPLICATION_STATUSES, DefaultApplicationView
from hireflux_backend.domain.status_policy import (
    ACTIVE_STATUSES_REQUIRING_APPLIED_DATE,
    StatusPolicyError,
    decide_transition,
    validate_applied_date,
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
    source: ApplicationSource | None = None
    source_detail: str | None = None
    salary_text: str | None = None
    description: str | None = None
    role_family: RoleFamily | None = None
    trusted_created_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class UpdateApplicationCommand:
    expected_version: int
    changes: Mapping[str, object]


@dataclass(frozen=True, slots=True)
class TransitionApplicationCommand:
    status: ApplicationStatus
    expected_version: int
    applied_date: date | None = None
    trusted_transitioned_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class CompleteFollowUpCommand:
    expected_version: int


@dataclass(frozen=True, slots=True)
class RescheduleFollowUpCommand:
    expected_version: int
    follow_up_date: date


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
            "source_detail",
            "salary_text",
            "description",
            "role_family",
        }
    )

    def __init__(
        self,
        repository: ApplicationRepository,
        *,
        clock: Callable[[], datetime] = utc_now,
        id_factory: Callable[[], str] = new_id,
        workspace_time_zone: Callable[[CurrentIdentity], str] | None = None,
    ) -> None:
        self._repository = repository
        self._clock = clock
        self._id_factory = id_factory
        self._workspace_time_zone = workspace_time_zone or (lambda _identity: "UTC")

    def create(self, identity: CurrentIdentity, command: CreateApplicationCommand) -> Application:
        now = command.trusted_created_at or self._clock()
        _require_aware(now)
        try:
            validate_initial_status(command.status, command.applied_date)
            validate_applied_date(
                command.applied_date,
                today=_workspace_today(identity, now, self._workspace_time_zone),
            )
        except StatusPolicyError as error:
            raise ValidationError(str(error)) from error

        submitted_at = now if command.status is ApplicationStatus.APPLIED else None
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
            source_detail=command.source_detail,
            salary_text=command.salary_text,
            description=command.description,
            role_family=command.role_family,
            created_at=now,
            updated_at=now,
            version=1,
            submitted_at=submitted_at,
            stage_entered_at=now,
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
        q: str | None = None,
        source: ApplicationSource | None = None,
        work_mode: WorkMode | None = None,
        stage_age: StageAgeBucket | None = None,
        follow_up: FollowUpFilter | None = None,
        sort: ApplicationSort = ApplicationSort.UPDATED_DESC,
        view: DefaultApplicationView | None = None,
    ) -> ApplicationPage:
        if follow_up is not None and view is not DefaultApplicationView.ACTIVE:
            raise ValidationError("follow_up requires the ACTIVE application view.")
        if (
            follow_up is not None
            and status is not None
            and status not in ACTIVE_APPLICATION_STATUSES
        ):
            raise ValidationError("follow_up can only be combined with an active status.")
        follow_up_today = None
        if follow_up is not None:
            now = self._clock()
            _require_aware(now)
            follow_up_today = _workspace_today(identity, now, self._workspace_time_zone)
        if stage_age is not None and view is not DefaultApplicationView.ACTIVE:
            raise ValidationError("stage_age requires the ACTIVE application view.")
        if (
            stage_age is not None
            and status is not None
            and status not in ACTIVE_APPLICATION_STATUSES
        ):
            raise ValidationError("stage_age can only be combined with an active status.")
        stage_age_bounds = None
        if stage_age is not None:
            now = self._clock()
            _require_aware(now)
            stage_age_bounds = _stage_age_bounds(
                stage_age,
                today=_workspace_today(identity, now, self._workspace_time_zone),
            )
        return self._repository.list(
            identity.user_id,
            status=status,
            limit=limit,
            cursor=cursor,
            q=q,
            source=source,
            work_mode=work_mode,
            stage_age=stage_age_bounds,
            follow_up=follow_up,
            follow_up_today=follow_up_today,
            sort=sort,
            view=view,
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
            source=_optional_source_change(effective_changes, "source", current.source),
            source_detail=_optional_string_change(
                effective_changes, "source_detail", current.source_detail
            ),
            salary_text=_optional_string_change(
                effective_changes, "salary_text", current.salary_text
            ),
            description=_optional_string_change(
                effective_changes, "description", current.description
            ),
            role_family=_optional_role_family_change(
                effective_changes, "role_family", current.role_family
            ),
        )
        required_status = (
            current.archived_from_status
            if current.status is ApplicationStatus.ARCHIVED
            else candidate.status
        )
        if (
            required_status in ACTIVE_STATUSES_REQUIRING_APPLIED_DATE
            and candidate.applied_date is None
        ):
            raise ValidationError("applied_date is required for the restore status.")
        now = self._clock()
        _require_aware(now)
        try:
            validate_applied_date(
                candidate.applied_date,
                today=_workspace_today(identity, now, self._workspace_time_zone),
            )
        except StatusPolicyError as error:
            raise ValidationError(str(error)) from error

        updated = replace(
            candidate,
            updated_at=now,
            version=current.version + 1,
        )
        labels_changed = (
            current.company_name != updated.company_name
            or current.job_title != updated.job_title
            or current.role_family != updated.role_family
        )
        if "follow_up_date" in effective_changes:
            activity = self._follow_up_activity(
                identity,
                current,
                updated,
                activity_type=ActivityType.FOLLOW_UP_RESCHEDULED,
                summary=(
                    f"Follow-up rescheduled for {updated.follow_up_date.isoformat()}."
                    if updated.follow_up_date
                    else "Follow-up removed."
                ),
            )
            self._repository.replace_details_with_activity(
                updated,
                expected_version=command.expected_version,
                activity=activity,
                sync_interview_labels=labels_changed,
            )
        else:
            self._repository.replace_details(
                updated,
                expected_version=command.expected_version,
                sync_interview_labels=labels_changed,
            )
        return updated

    def transition(
        self,
        identity: CurrentIdentity,
        application_id: str,
        command: TransitionApplicationCommand,
    ) -> Application:
        current = self.get(identity, application_id)
        self._require_version(current, command.expected_version)
        now = command.trusted_transitioned_at or self._clock()
        _require_aware(now)
        try:
            validate_applied_date(
                command.applied_date,
                today=_workspace_today(identity, now, self._workspace_time_zone),
            )
        except StatusPolicyError as error:
            raise ValidationError(str(error)) from error
        try:
            decision = decide_transition(current, command.status, command.applied_date)
        except StatusPolicyError as error:
            raise ConflictError(str(error)) from error

        try:
            validate_applied_date(
                decision.applied_date,
                today=_workspace_today(identity, now, self._workspace_time_zone),
            )
        except StatusPolicyError as error:
            raise ValidationError(str(error)) from error

        if not decision.changed:
            return current

        milestones = _milestones_for_transition(current, decision.status, now)
        updated = replace(
            current,
            status=decision.status,
            applied_date=decision.applied_date,
            archived_from_status=decision.archived_from_status,
            updated_at=now,
            version=current.version + 1,
            submitted_at=milestones[0],
            stage_entered_at=milestones[1],
            first_response_at=milestones[2],
            first_screening_at=milestones[3],
            first_interview_at=milestones[4],
            first_offer_at=milestones[5],
            first_acceptance_at=milestones[6],
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
            prior_application=current,
            expected_version=command.expected_version,
            activity=activity,
        )
        return updated

    def complete_follow_up(
        self,
        identity: CurrentIdentity,
        application_id: str,
        command: CompleteFollowUpCommand,
    ) -> Application:
        current = self.get(identity, application_id)
        self._require_version(current, command.expected_version)
        if current.follow_up_date is None:
            return current
        updated = replace(
            current,
            follow_up_date=None,
            updated_at=self._clock(),
            version=current.version + 1,
        )
        activity = self._follow_up_activity(
            identity,
            current,
            updated,
            activity_type=ActivityType.FOLLOW_UP_COMPLETED,
            summary="Follow-up completed.",
        )
        self._repository.replace_details_with_activity(
            updated, expected_version=command.expected_version, activity=activity
        )
        return updated

    def reschedule_follow_up(
        self,
        identity: CurrentIdentity,
        application_id: str,
        command: RescheduleFollowUpCommand,
    ) -> Application:
        return self.update(
            identity,
            application_id,
            UpdateApplicationCommand(
                expected_version=command.expected_version,
                changes={"follow_up_date": command.follow_up_date},
            ),
        )

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

    def list_activity(
        self,
        identity: CurrentIdentity,
        application_id: str,
        *,
        limit: int,
        cursor: str | None,
        order: str = "asc",
    ) -> ActivityPage:
        self.get(identity, application_id)
        return self._repository.list_activity(
            identity.user_id,
            application_id,
            limit=limit,
            cursor=cursor,
            order=order,
        )

    def list_all(self, identity: CurrentIdentity) -> tuple[Application, ...]:
        return self._repository.list_all(identity.user_id)

    def _follow_up_activity(
        self,
        identity: CurrentIdentity,
        before: Application,
        after: Application,
        *,
        activity_type: ActivityType,
        summary: str,
    ) -> Activity:
        return Activity(
            activity_id=self._id_factory(),
            application_id=before.application_id,
            owner_user_id=identity.user_id,
            activity_type=activity_type,
            summary=summary,
            created_at=after.updated_at,
            metadata={
                "from_date": before.follow_up_date.isoformat() if before.follow_up_date else "",
                "to_date": after.follow_up_date.isoformat() if after.follow_up_date else "",
            },
            expires_at=identity.expires_at,
        )

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


def _optional_source_change(
    changes: Mapping[str, object], key: str, current: ApplicationSource | None
) -> ApplicationSource | None:
    if key not in changes:
        return current
    value = changes[key]
    if value is not None and not isinstance(value, ApplicationSource):
        raise ValidationError(f"{key} must be a valid application source or null.")
    return value


def _optional_role_family_change(
    changes: Mapping[str, object], key: str, current: RoleFamily | None
) -> RoleFamily | None:
    if key not in changes:
        return current
    value = changes[key]
    if value is not None and not isinstance(value, RoleFamily):
        raise ValidationError(f"{key} must be a valid role family or null.")
    return value


def _require_aware(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Trusted timestamps and clock values must be timezone-aware.")


def _workspace_today(
    identity: CurrentIdentity,
    now: datetime,
    time_zone_provider: Callable[[CurrentIdentity], str],
) -> date:
    return now.astimezone(ZoneInfo(time_zone_provider(identity))).date()


def _stage_age_bounds(bucket: StageAgeBucket | None, *, today: date) -> StageAgeBounds | None:
    if bucket is None:
        return None
    ranges = {
        StageAgeBucket.ZERO_TO_SEVEN: (today - timedelta(days=7), today + timedelta(days=1)),
        StageAgeBucket.EIGHT_TO_FOURTEEN: (today - timedelta(days=14), today - timedelta(days=7)),
        StageAgeBucket.FIFTEEN_TO_THIRTY: (today - timedelta(days=30), today - timedelta(days=14)),
        StageAgeBucket.THIRTY_ONE_PLUS: (None, today - timedelta(days=30)),
    }
    entered_on_or_after, entered_before = ranges[bucket]
    return StageAgeBounds(
        entered_on_or_after=entered_on_or_after,
        entered_before=entered_before,
    )


def _milestones_for_transition(
    application: Application, target: ApplicationStatus, now: datetime
) -> tuple[
    datetime | None,
    datetime | None,
    datetime | None,
    datetime | None,
    datetime | None,
    datetime | None,
    datetime | None,
]:
    submitted_at = application.submitted_at
    if submitted_at is None and target not in {ApplicationStatus.DRAFT, ApplicationStatus.ARCHIVED}:
        submitted_at = now
    response_statuses = {
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.REJECTED,
    }
    return (
        submitted_at,
        (
            application.stage_entered_at
            if target is ApplicationStatus.ARCHIVED
            or application.status is ApplicationStatus.ARCHIVED
            else now
        ),
        (application.first_response_at or (now if target in response_statuses else None)),
        application.first_screening_at or (now if target is ApplicationStatus.SCREENING else None),
        application.first_interview_at or (now if target is ApplicationStatus.INTERVIEW else None),
        application.first_offer_at or (now if target is ApplicationStatus.OFFER else None),
        application.first_acceptance_at or (now if target is ApplicationStatus.ACCEPTED else None),
    )
