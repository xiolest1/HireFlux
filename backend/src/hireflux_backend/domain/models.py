from dataclasses import dataclass, field
from datetime import date, datetime

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


@dataclass(frozen=True, slots=True)
class CurrentIdentity:
    user_id: str
    name: str
    email: str
    role: UserRole
    expires_at: int | None = None
    is_demo: bool = False


@dataclass(frozen=True, slots=True)
class UserProfile:
    user_id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime
    last_login_at: datetime
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
