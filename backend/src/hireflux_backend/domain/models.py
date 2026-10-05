from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum

from hireflux_backend.domain.enums import (
    ActivityType,
    ApplicationSource,
    ApplicationStatus,
    DemoWorkspaceState,
    NextStepResponsibility,
    RoleFamily,
    UserRole,
    WorkMode,
)


class IdentityKind(StrEnum):
    LOCAL = "LOCAL"
    PERSISTENT = "PERSISTENT"
    DEMO = "DEMO"


@dataclass(frozen=True, slots=True)
class CurrentIdentity:
    """Verified principal. Credential expiry is deliberately not a data lifetime."""

    user_id: str
    role: UserRole
    kind: IdentityKind = IdentityKind.LOCAL
    data_expires_at: int | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.kind, IdentityKind) or not isinstance(self.role, UserRole):
            raise ValueError("Identity kind and role must be validated.")
        if self.kind is IdentityKind.DEMO:
            if type(self.data_expires_at) is not int or self.data_expires_at <= 0:
                raise ValueError("Demo identities require a data expiry.")
        elif self.data_expires_at is not None:
            raise ValueError("Durable identities cannot expire workspace data.")

    @property
    def is_demo(self) -> bool:
        return self.kind is IdentityKind.DEMO


@dataclass(frozen=True, slots=True)
class TrustedProfileAttributes:
    """Server configuration or verified profile source, separate from access claims."""

    name: str
    email: str


@dataclass(frozen=True, slots=True)
class UserProfile:
    user_id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime
    last_login_at: datetime | None
    expires_at: int | None = None


@dataclass(frozen=True, slots=True)
class Application:
    application_id: str
    owner_user_id: str
    company_name: str
    job_title: str
    status: ApplicationStatus
    applied_date: date | None
    follow_up_date: date | None
    job_url: str | None
    location: str | None
    work_mode: WorkMode | None
    source: ApplicationSource | None
    salary_text: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime
    version: int
    archived_from_status: ApplicationStatus | None = None
    source_detail: str | None = None
    submitted_at: datetime | None = None
    stage_entered_at: datetime | None = None
    first_response_at: datetime | None = None
    first_screening_at: datetime | None = None
    first_interview_at: datetime | None = None
    first_offer_at: datetime | None = None
    first_acceptance_at: datetime | None = None
    expires_at: int | None = None
    role_family: RoleFamily | None = None
    next_step_responsibility: NextStepResponsibility | None = None
    next_step_note: str | None = None


@dataclass(frozen=True, slots=True)
class Activity:
    activity_id: str
    application_id: str
    owner_user_id: str
    activity_type: ActivityType
    summary: str
    created_at: datetime
    metadata: dict[str, str] = field(default_factory=dict)
    expires_at: int | None = None


@dataclass(frozen=True, slots=True)
class DemoWorkspace:
    workspace_id: str
    state: DemoWorkspaceState
    issued_at: datetime
    updated_at: datetime
    expires_at: int
    idempotency_key_hash: str | None = None
