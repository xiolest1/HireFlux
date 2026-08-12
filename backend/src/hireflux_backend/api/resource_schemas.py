from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, HttpUrl

from hireflux_backend.api.schemas import RequestModel
from hireflux_backend.domain.resources import (
    DashboardRange,
    DefaultApplicationView,
    Interview,
    InterviewStatus,
    InterviewType,
    Note,
    ThemePreference,
    WorkspaceSettings,
    allowed_interview_statuses,
)


class SettingsUpdateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    time_zone: str | None = Field(
        default=None,
        min_length=3,
        max_length=64,
        pattern=r"^(?:UTC|[A-Za-z_+-]+(?:/[A-Za-z0-9_+-]+)+)$",
    )
    default_follow_up_days: int | None = Field(default=None, ge=1, le=30)
    default_application_view: DefaultApplicationView | None = None
    default_dashboard_range: DashboardRange | None = None
    theme: ThemePreference | None = None


class SettingsResponse(BaseModel):
    time_zone: str
    default_follow_up_days: int
    default_application_view: DefaultApplicationView
    default_dashboard_range: DashboardRange
    theme: ThemePreference
    created_at: datetime
    updated_at: datetime
    version: int

    @classmethod
    def from_domain(cls, settings: WorkspaceSettings) -> "SettingsResponse":
        return cls(
            time_zone=settings.time_zone,
            default_follow_up_days=settings.default_follow_up_days,
            default_application_view=settings.default_application_view,
            default_dashboard_range=settings.default_dashboard_range,
            theme=settings.theme,
            created_at=settings.created_at,
            updated_at=settings.updated_at,
            version=settings.version,
        )


class NoteCreateRequest(RequestModel):
    content: str = Field(min_length=1, max_length=5_000)


class NoteUpdateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    content: str = Field(min_length=1, max_length=5_000)


class NoteResponse(BaseModel):
    note_id: str
    application_id: str
    content: str
    created_at: datetime
    updated_at: datetime
    version: int

    @classmethod
    def from_domain(cls, note: Note) -> "NoteResponse":
        return cls(
            note_id=note.note_id,
            application_id=note.application_id,
            content=note.content,
            created_at=note.created_at,
            updated_at=note.updated_at,
            version=note.version,
        )


class NoteListResponse(BaseModel):
    items: list[NoteResponse]


class InterviewCreateRequest(RequestModel):
    interview_type: InterviewType
    scheduled_at: AwareDatetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    location: str | None = Field(default=None, min_length=1, max_length=240)
    meeting_url: HttpUrl | None = Field(default=None, max_length=2_048)
    details: str | None = Field(default=None, min_length=1, max_length=5_000)


class InterviewUpdateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    interview_type: InterviewType | None = None
    scheduled_at: AwareDatetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    location: str | None = Field(default=None, min_length=1, max_length=240)
    meeting_url: HttpUrl | None = Field(default=None, max_length=2_048)
    details: str | None = Field(default=None, min_length=1, max_length=5_000)


class InterviewStatusRequest(RequestModel):
    status: Literal[InterviewStatus.COMPLETED, InterviewStatus.CANCELED]
    expected_version: int = Field(ge=1)


class InterviewResponse(BaseModel):
    interview_id: str
    application_id: str
    company_name: str
    job_title: str
    interview_type: InterviewType
    status: InterviewStatus
    scheduled_at: datetime
    duration_minutes: int
    location: str | None
    meeting_url: str | None
    details: str | None
    created_at: datetime
    updated_at: datetime
    version: int
    allowed_statuses: list[InterviewStatus]

    @classmethod
    def from_domain(cls, interview: Interview) -> "InterviewResponse":
        return cls(
            interview_id=interview.interview_id,
            application_id=interview.application_id,
            company_name=interview.company_name,
            job_title=interview.job_title,
            interview_type=interview.interview_type,
            status=interview.status,
            scheduled_at=interview.scheduled_at,
            duration_minutes=interview.duration_minutes,
            location=interview.location,
            meeting_url=interview.meeting_url,
            details=interview.details,
            created_at=interview.created_at,
            updated_at=interview.updated_at,
            version=interview.version,
            allowed_statuses=list(allowed_interview_statuses(interview)),
        )


class InterviewListResponse(BaseModel):
    items: list[InterviewResponse]
