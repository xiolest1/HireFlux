from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from hireflux_backend.application.ports import DemoSessionTokenIssuer
from hireflux_backend.application.services import (
    ApplicationService,
    CreateApplicationCommand,
    TransitionApplicationCommand,
    UserService,
)
from hireflux_backend.domain.enums import ApplicationStatus, UserRole, WorkMode
from hireflux_backend.domain.models import Application, CurrentIdentity


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


@dataclass(frozen=True, slots=True)
class DemoSession:
    access_token: str
    expires_at: datetime


class DemoSessionService:
    def __init__(
        self,
        user_service: UserService,
        application_service: ApplicationService,
        token_issuer: DemoSessionTokenIssuer,
        *,
        ttl_hours: int,
        clock: Callable[[], datetime] = utc_now,
        id_factory: Callable[[], str] = new_id,
    ) -> None:
        self._user_service = user_service
        self._application_service = application_service
        self._token_issuer = token_issuer
        self._ttl = timedelta(hours=ttl_hours)
        self._clock = clock
        self._id_factory = id_factory

    def create(self) -> DemoSession:
        issued_at = self._clock().astimezone(UTC)
        expires_at = issued_at + self._ttl
        workspace_id = self._id_factory()
        identity = CurrentIdentity(
            user_id=workspace_id,
            name="Demo Recruiter",
            email=f"demo-{workspace_id.split('-')[0]}@example.invalid",
            role=UserRole.STANDARD_USER,
            expires_at=int(expires_at.timestamp()),
        )
        self._user_service.get_or_create_profile(identity)
        self._seed_workspace(identity, issued_at.date())
        token = self._token_issuer.issue(
            workspace_id=workspace_id,
            issued_at=issued_at,
            expires_at=expires_at,
        )
        return DemoSession(access_token=token, expires_at=expires_at)

    def _seed_workspace(self, identity: CurrentIdentity, today: date) -> None:
        self._application_service.create(
            identity,
            CreateApplicationCommand(
                company_name="Northstar Labs",
                job_title="Product Designer",
                status=ApplicationStatus.DRAFT,
                location="New York, NY",
                work_mode=WorkMode.HYBRID,
                source="Company careers page",
                salary_text="$125k-$145k",
                description="Design the next generation of workflow tools for growing teams.",
            ),
        )
        self._application_service.create(
            identity,
            CreateApplicationCommand(
                company_name="Atlas Health",
                job_title="Frontend Engineer",
                status=ApplicationStatus.APPLIED,
                applied_date=today - timedelta(days=4),
                follow_up_date=today + timedelta(days=3),
                location="Remote",
                work_mode=WorkMode.REMOTE,
                source="Referral",
                salary_text="$135k-$160k",
            ),
        )
        interview = self._application_service.create(
            identity,
            CreateApplicationCommand(
                company_name="Cedar Analytics",
                job_title="Senior Product Analyst",
                status=ApplicationStatus.APPLIED,
                applied_date=today - timedelta(days=12),
                follow_up_date=today + timedelta(days=1),
                location="Boston, MA",
                work_mode=WorkMode.HYBRID,
                source="LinkedIn",
            ),
        )
        self._transition(identity, interview, ApplicationStatus.INTERVIEW)

        offer = self._application_service.create(
            identity,
            CreateApplicationCommand(
                company_name="Juniper Systems",
                job_title="Platform Engineer",
                status=ApplicationStatus.APPLIED,
                applied_date=today - timedelta(days=22),
                location="Austin, TX",
                work_mode=WorkMode.REMOTE,
                source="Conference connection",
                salary_text="$150k-$175k",
            ),
        )
        offer = self._transition(identity, offer, ApplicationStatus.INTERVIEW)
        self._transition(identity, offer, ApplicationStatus.OFFER)

        rejected = self._application_service.create(
            identity,
            CreateApplicationCommand(
                company_name="Meridian Studio",
                job_title="UX Researcher",
                status=ApplicationStatus.APPLIED,
                applied_date=today - timedelta(days=30),
                location="Chicago, IL",
                work_mode=WorkMode.ONSITE,
                source="Job board",
            ),
        )
        self._transition(identity, rejected, ApplicationStatus.REJECTED)

    def _transition(
        self,
        identity: CurrentIdentity,
        application: Application,
        status: ApplicationStatus,
    ) -> Application:
        return self._application_service.transition(
            identity,
            application.application_id,
            TransitionApplicationCommand(
                status=status,
                expected_version=application.version,
            ),
        )
