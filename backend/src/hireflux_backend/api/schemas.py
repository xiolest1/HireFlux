from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from hireflux_backend.domain.enums import ActivityType, ApplicationStatus, UserRole, WorkMode
from hireflux_backend.domain.models import Activity, Application, UserProfile
from hireflux_backend.domain.status_policy import allowed_transitions


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ApplicationCreateRequest(RequestModel):
    company_name: str = Field(min_length=1, max_length=120)
    job_title: str = Field(min_length=1, max_length=120)
    status: ApplicationStatus = ApplicationStatus.DRAFT
    applied_date: date | None = None
    follow_up_date: date | None = None
    job_url: HttpUrl | None = Field(default=None, max_length=2048)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    work_mode: WorkMode | None = None
    source: str | None = Field(default=None, min_length=1, max_length=120)
    salary_text: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=5_000)


class ApplicationUpdateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    company_name: str | None = Field(default=None, min_length=1, max_length=120)
    job_title: str | None = Field(default=None, min_length=1, max_length=120)
    applied_date: date | None = None
    follow_up_date: date | None = None
    job_url: HttpUrl | None = Field(default=None, max_length=2048)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    work_mode: WorkMode | None = None
    source: str | None = Field(default=None, min_length=1, max_length=120)
    salary_text: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=5_000)

    @model_validator(mode="after")
    def required_text_cannot_be_cleared(self) -> "ApplicationUpdateRequest":
        for field_name in ("company_name", "job_title"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self


class ApplicationStatusRequest(RequestModel):
    status: ApplicationStatus
    expected_version: int = Field(ge=1)
    applied_date: date | None = None


class UserResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime
    last_login_at: datetime | None

    @classmethod
    def from_domain(cls, profile: UserProfile) -> "UserResponse":
        return cls(
            user_id=profile.user_id,
            name=profile.name,
            email=profile.email,
            role=profile.role,
            created_at=profile.created_at,
            last_login_at=profile.last_login_at,
        )


class ApplicationResponse(BaseModel):
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
    allowed_transitions: list[ApplicationStatus]

    @classmethod
    def from_domain(cls, application: Application) -> "ApplicationResponse":
        return cls(
            application_id=application.application_id,
            owner_user_id=application.owner_user_id,
            company_name=application.company_name,
            job_title=application.job_title,
            status=application.status,
            applied_date=application.applied_date,
            follow_up_date=application.follow_up_date,
            job_url=application.job_url,
            location=application.location,
            work_mode=application.work_mode,
            source=application.source,
            salary_text=application.salary_text,
            description=application.description,
            created_at=application.created_at,
            updated_at=application.updated_at,
            version=application.version,
            allowed_transitions=list(allowed_transitions(application)),
        )


class ApplicationListResponse(BaseModel):
    items: list[ApplicationResponse]
    next_cursor: str | None


class ActivityResponse(BaseModel):
    activity_id: str
    application_id: str
    activity_type: ActivityType
    summary: str
    metadata: dict[str, object] | None
    created_at: datetime

    @classmethod
    def from_domain(cls, activity: Activity) -> "ActivityResponse":
        metadata: dict[str, object] = {key: value for key, value in activity.metadata.items()}
        return cls(
            activity_id=activity.activity_id,
            application_id=activity.application_id,
            activity_type=activity.activity_type,
            summary=activity.summary,
            metadata=metadata,
            created_at=activity.created_at,
        )


class ActivityListResponse(BaseModel):
    items: list[ActivityResponse]


class DemoSessionResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_at: datetime


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str
    details: object | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorBody
