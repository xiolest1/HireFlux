from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from hireflux_backend.domain.enums import ApplicationStatus, RoleFamily


class ThemePreference(StrEnum):
    SYSTEM = "SYSTEM"
    LIGHT = "LIGHT"
    DARK = "DARK"


class DefaultApplicationView(StrEnum):
    ACTIVE = "ACTIVE"
    ALL = "ALL"
    ARCHIVED = "ARCHIVED"


ACTIVE_APPLICATION_STATUSES = (
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
)


class DashboardRange(StrEnum):
    THIRTY_DAYS = "30d"
    NINETY_DAYS = "90d"
    ALL = "all"


class InterviewType(StrEnum):
    RECRUITER_CALL = "RECRUITER_CALL"
    TECHNICAL_SCREEN = "TECHNICAL_SCREEN"
    BEHAVIORAL = "BEHAVIORAL"
    CODING_ASSESSMENT = "CODING_ASSESSMENT"
    HIRING_MANAGER = "HIRING_MANAGER"
    ONSITE = "ONSITE"
    FINAL = "FINAL"
    OTHER = "OTHER"


class InterviewStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELED = "CANCELED"


@dataclass(frozen=True, slots=True)
class CustomPreparationItem:
    item_id: str
    label: str


INTERVIEW_STATUS_TRANSITIONS: dict[InterviewStatus, tuple[InterviewStatus, ...]] = {
    InterviewStatus.SCHEDULED: (
        InterviewStatus.COMPLETED,
        InterviewStatus.CANCELED,
    ),
    InterviewStatus.COMPLETED: (),
    InterviewStatus.CANCELED: (),
}


@dataclass(frozen=True, slots=True)
class WorkspaceSettings:
    owner_user_id: str
    time_zone: str
    default_follow_up_days: int
    default_application_view: DefaultApplicationView
    default_dashboard_range: DashboardRange
    theme: ThemePreference
    created_at: datetime
    updated_at: datetime
    version: int
    expires_at: int | None = None


@dataclass(frozen=True, slots=True)
class Note:
    note_id: str
    application_id: str
    owner_user_id: str
    content: str
    created_at: datetime
    updated_at: datetime
    version: int
    expires_at: int | None = None


@dataclass(frozen=True, slots=True)
class Interview:
    interview_id: str
    application_id: str
    owner_user_id: str
    company_name: str
    job_title: str
    interview_type: InterviewType
    status: InterviewStatus
    scheduled_at: datetime
    duration_minutes: int
    location: str | None
    meeting_url: str | None
    details: str | None
    preparation_notes: str | None
    completed_checklist_items: tuple[str, ...]
    candidate_questions: tuple[str, ...]
    debrief_went_well: str | None
    debrief_improve: str | None
    debrief_signals: str | None
    debrief_next_step: str | None
    debrief_completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    version: int
    expires_at: int | None = None
    application_role_family: RoleFamily | None = None
    custom_preparation_items: tuple[CustomPreparationItem, ...] = ()


def allowed_interview_statuses(interview: Interview) -> tuple[InterviewStatus, ...]:
    return INTERVIEW_STATUS_TRANSITIONS[interview.status]
