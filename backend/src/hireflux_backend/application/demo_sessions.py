from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from hireflux_backend.application.errors import PersistenceError, ValidationError
from hireflux_backend.application.ports import DemoSessionTokenIssuer, DemoWorkspaceRepository
from hireflux_backend.application.resource_services import (
    CreateInterviewCommand,
    CreateNoteCommand,
    TransitionInterviewCommand,
    WorkspaceResourceService,
)
from hireflux_backend.application.services import (
    ApplicationService,
    CreateApplicationCommand,
    TransitionApplicationCommand,
    UserService,
)
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus, UserRole, WorkMode
from hireflux_backend.domain.models import Application, CurrentIdentity, DemoWorkspace
from hireflux_backend.domain.resources import InterviewStatus, InterviewType


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class DemoSession:
    access_token: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class SeedApplication:
    company: str
    title: str
    status: ApplicationStatus
    days_ago: int
    source: ApplicationSource
    work_mode: WorkMode
    follow_up_offset: int | None = None


_SEED = (
    SeedApplication(
        "Northstar Labs",
        "Product Designer",
        ApplicationStatus.DRAFT,
        2,
        ApplicationSource.COMPANY_WEBSITE,
        WorkMode.HYBRID,
    ),
    SeedApplication(
        "Bluebird AI",
        "UX Designer",
        ApplicationStatus.DRAFT,
        6,
        ApplicationSource.LINKEDIN,
        WorkMode.REMOTE,
    ),
    SeedApplication(
        "Atlas Health",
        "Frontend Engineer",
        ApplicationStatus.APPLIED,
        4,
        ApplicationSource.REFERRAL,
        WorkMode.REMOTE,
        0,
    ),
    SeedApplication(
        "Summit Cloud",
        "Backend Engineer",
        ApplicationStatus.APPLIED,
        18,
        ApplicationSource.INDEED,
        WorkMode.HYBRID,
        -2,
    ),
    SeedApplication(
        "Harbor Finance",
        "Platform Engineer",
        ApplicationStatus.APPLIED,
        9,
        ApplicationSource.RECRUITER,
        WorkMode.ONSITE,
        3,
    ),
    SeedApplication(
        "Cedar Analytics",
        "Senior Product Analyst",
        ApplicationStatus.SCREENING,
        12,
        ApplicationSource.LINKEDIN,
        WorkMode.HYBRID,
        1,
    ),
    SeedApplication(
        "Evergreen Media",
        "Data Analyst",
        ApplicationStatus.SCREENING,
        20,
        ApplicationSource.COMPANY_WEBSITE,
        WorkMode.REMOTE,
    ),
    SeedApplication(
        "Orbit Systems",
        "Cloud Engineer",
        ApplicationStatus.INTERVIEW,
        24,
        ApplicationSource.REFERRAL,
        WorkMode.REMOTE,
        2,
    ),
    SeedApplication(
        "Juniper Systems",
        "Platform Engineer",
        ApplicationStatus.OFFER,
        32,
        ApplicationSource.CAREER_FAIR,
        WorkMode.REMOTE,
    ),
    SeedApplication(
        "Signal Works",
        "Product Manager",
        ApplicationStatus.ACCEPTED,
        55,
        ApplicationSource.RECRUITER,
        WorkMode.HYBRID,
    ),
    SeedApplication(
        "Meridian Studio",
        "UX Researcher",
        ApplicationStatus.REJECTED,
        30,
        ApplicationSource.INDEED,
        WorkMode.ONSITE,
    ),
    SeedApplication(
        "Pioneer Retail",
        "Software Engineer",
        ApplicationStatus.REJECTED,
        45,
        ApplicationSource.LINKEDIN,
        WorkMode.HYBRID,
    ),
    SeedApplication(
        "Lumen Education",
        "Product Designer",
        ApplicationStatus.REJECTED,
        70,
        ApplicationSource.HANDSHAKE,
        WorkMode.REMOTE,
    ),
    SeedApplication(
        "Maple Robotics",
        "QA Engineer",
        ApplicationStatus.WITHDRAWN,
        16,
        ApplicationSource.COMPANY_WEBSITE,
        WorkMode.ONSITE,
    ),
    SeedApplication(
        "Riverbank Tech",
        "Systems Analyst",
        ApplicationStatus.ARCHIVED,
        80,
        ApplicationSource.OTHER,
        WorkMode.HYBRID,
    ),
    SeedApplication(
        "Vertex Energy",
        "DevOps Engineer",
        ApplicationStatus.INTERVIEW,
        38,
        ApplicationSource.LINKEDIN,
        WorkMode.REMOTE,
    ),
)


class DemoSessionService:
    def __init__(
        self,
        user_service: UserService,
        application_service: ApplicationService,
        token_issuer: DemoSessionTokenIssuer,
        *,
        ttl_hours: int,
        failure_ttl_minutes: int,
        resource_service: WorkspaceResourceService | None = None,
        workspace_repository: DemoWorkspaceRepository,
        clock: Callable[[], datetime] = utc_now,
        id_factory: Callable[[], str] = new_id,
    ) -> None:
        self._user_service = user_service
        self._application_service = application_service
        self._resource_service = resource_service
        self._token_issuer = token_issuer
        self._ttl = timedelta(hours=ttl_hours)
        self._failure_ttl = timedelta(minutes=failure_ttl_minutes)
        self._clock = clock
        self._id_factory = id_factory
        self._workspace_repository = workspace_repository

    def create(self, idempotency_key: str | None = None) -> DemoSession:
        if idempotency_key is not None and not 16 <= len(idempotency_key) <= 255:
            raise ValidationError("Idempotency-Key must contain between 16 and 255 characters.")
        issued_at = self._clock().astimezone(UTC)
        expires_at = issued_at + self._ttl
        workspace_id = self._id_factory()
        reservation = self._workspace_repository.reserve(
            workspace_id,
            issued_at=issued_at,
            expires_at=int(expires_at.timestamp()),
            idempotency_key=idempotency_key,
        )
        if not reservation.is_new:
            return self._session_for_workspace(reservation.workspace)

        identity = CurrentIdentity(
            user_id=workspace_id,
            name="Demo Recruiter",
            email=f"demo-{workspace_id.split('-')[0]}@example.invalid",
            role=UserRole.STANDARD_USER,
            expires_at=int(expires_at.timestamp()),
        )
        created: list[Application] = []
        try:
            self._user_service.get_or_create_profile(identity)
            self._seed_workspace(identity, issued_at, created)
            self._workspace_repository.mark_ready(reservation.workspace)
        except Exception as error:
            self._handle_provisioning_failure(reservation.workspace, created)
            raise PersistenceError("Unable to create demo workspace.") from error
        return self._session_for_workspace(reservation.workspace)

    def _session_for_workspace(self, workspace: DemoWorkspace) -> DemoSession:
        expires_at = datetime.fromtimestamp(workspace.expires_at, UTC)
        token = self._token_issuer.issue(
            workspace_id=workspace.workspace_id,
            issued_at=workspace.issued_at,
            expires_at=expires_at,
        )
        return DemoSession(access_token=token, expires_at=expires_at)

    def _handle_provisioning_failure(
        self, workspace: DemoWorkspace, created: list[Application]
    ) -> None:
        failed_expires_at = int((self._clock().astimezone(UTC) + self._failure_ttl).timestamp())
        try:
            self._workspace_repository.mark_failed(workspace, expires_at=failed_expires_at)
        except Exception:
            pass
        try:
            self._workspace_repository.cleanup(
                workspace.workspace_id,
                application_ids=tuple(application.application_id for application in created),
            )
        except Exception:
            pass

    def _seed_workspace(
        self, identity: CurrentIdentity, now: datetime, created: list[Application]
    ) -> None:
        for seed in _SEED:
            created_at = now - timedelta(days=seed.days_ago)
            applied_date = created_at.date() if seed.status is not ApplicationStatus.DRAFT else None
            application = self._application_service.create(
                identity,
                CreateApplicationCommand(
                    company_name=seed.company,
                    job_title=seed.title,
                    status=ApplicationStatus.DRAFT
                    if seed.status is ApplicationStatus.DRAFT
                    else ApplicationStatus.APPLIED,
                    applied_date=applied_date,
                    follow_up_date=(now + timedelta(days=seed.follow_up_offset)).date()
                    if seed.follow_up_offset is not None
                    else None,
                    location="Remote" if seed.work_mode is WorkMode.REMOTE else "New York, NY",
                    work_mode=seed.work_mode,
                    source=seed.source,
                    source_detail="Deterministic demo scenario",
                    trusted_created_at=created_at,
                ),
            )
            created.append(application)
            application = self._advance(identity, application, seed.status, created_at)

        if self._resource_service is not None:
            self._seed_resources(identity, created, now)

    def _advance(
        self,
        identity: CurrentIdentity,
        application: Application,
        target: ApplicationStatus,
        created_at: datetime,
    ) -> Application:
        paths: dict[ApplicationStatus, tuple[ApplicationStatus, ...]] = {
            ApplicationStatus.DRAFT: (),
            ApplicationStatus.APPLIED: (),
            ApplicationStatus.SCREENING: (ApplicationStatus.SCREENING,),
            ApplicationStatus.INTERVIEW: (ApplicationStatus.INTERVIEW,),
            ApplicationStatus.OFFER: (ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER),
            ApplicationStatus.ACCEPTED: (
                ApplicationStatus.INTERVIEW,
                ApplicationStatus.OFFER,
                ApplicationStatus.ACCEPTED,
            ),
            ApplicationStatus.REJECTED: (ApplicationStatus.REJECTED,),
            ApplicationStatus.WITHDRAWN: (ApplicationStatus.WITHDRAWN,),
            ApplicationStatus.ARCHIVED: (ApplicationStatus.ARCHIVED,),
        }
        for index, status in enumerate(paths[target], start=1):
            application = self._application_service.transition(
                identity,
                application.application_id,
                TransitionApplicationCommand(
                    status=status,
                    expected_version=application.version,
                    trusted_transitioned_at=created_at + timedelta(days=index * 3),
                ),
            )
        return application

    def _seed_resources(
        self, identity: CurrentIdentity, applications: list[Application], now: datetime
    ) -> None:
        assert self._resource_service is not None
        for application in (applications[5], applications[7], applications[8]):
            self._resource_service.create_note(
                identity,
                application.application_id,
                CreateNoteCommand(
                    content="Review role requirements and prepare concrete examples."
                ),
            )
        self._resource_service.create_interview(
            identity,
            applications[7].application_id,
            CreateInterviewCommand(
                interview_type=InterviewType.TECHNICAL_SCREEN,
                scheduled_at=now + timedelta(days=2),
                duration_minutes=60,
                meeting_url="https://example.com/demo-interview",
            ),
        )
        self._resource_service.create_interview(
            identity,
            applications[15].application_id,
            CreateInterviewCommand(
                interview_type=InterviewType.HIRING_MANAGER,
                scheduled_at=now + timedelta(days=5),
                duration_minutes=45,
            ),
        )
        completed = self._resource_service.create_interview(
            identity,
            applications[8].application_id,
            CreateInterviewCommand(
                interview_type=InterviewType.RECRUITER_CALL,
                scheduled_at=now - timedelta(days=10),
                duration_minutes=30,
            ),
        )
        self._resource_service.transition_interview(
            identity,
            completed.application_id,
            completed.interview_id,
            TransitionInterviewCommand(
                status=InterviewStatus.COMPLETED,
                expected_version=completed.version,
            ),
        )
        canceled = self._resource_service.create_interview(
            identity,
            applications[11].application_id,
            CreateInterviewCommand(
                interview_type=InterviewType.BEHAVIORAL,
                scheduled_at=now - timedelta(days=18),
                duration_minutes=45,
            ),
        )
        self._resource_service.transition_interview(
            identity,
            canceled.application_id,
            canceled.interview_id,
            TransitionInterviewCommand(
                status=InterviewStatus.CANCELED,
                expected_version=canceled.version,
            ),
        )
