from dataclasses import dataclass, field
from datetime import date, datetime

from hireflux_backend.domain.enums import (
    ActivityType,
    ApplicationStatus,
    UserRole,
    WorkMode,
)


@dataclass(frozen=True, slots=True)
class CurrentIdentity:
    user_id: str
    name: str
    email: str
    role: UserRole


@dataclass(frozen=True, slots=True)
class UserProfile:
    user_id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime
    last_login_at: datetime


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
    source: str | None
    salary_text: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime
    version: int
    archived_from_status: ApplicationStatus | None = None


@dataclass(frozen=True, slots=True)
class Activity:
    activity_id: str
    application_id: str
    owner_user_id: str
    activity_type: ActivityType
    summary: str
    created_at: datetime
    metadata: dict[str, str] = field(default_factory=dict)
