from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from hireflux_backend.application.duplicate_candidates import (
    DuplicateCandidate,
    DuplicateConfidence,
    DuplicateSignal,
)
from hireflux_backend.domain.enums import (
    ActivityType,
    ApplicationSource,
    ApplicationStatus,
    NextStepResponsibility,
    RoleFamily,
    UserRole,
    WorkMode,
)
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
    source: ApplicationSource | None = None
    source_detail: str | None = Field(default=None, min_length=1, max_length=120)
    salary_text: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=5_000)
    role_family: RoleFamily | None = None


class DuplicateCandidateRequest(RequestModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=120)
    job_title: str | None = Field(default=None, min_length=1, max_length=120)
    job_url: HttpUrl | None = Field(default=None, max_length=2048)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    requisition_id: str | None = Field(default=None, min_length=1, max_length=120)

    @model_validator(mode="after")
    def enough_evidence(self) -> "DuplicateCandidateRequest":
        if (
            self.job_url
            or (self.company_name and self.job_title)
            or (self.company_name and self.requisition_id)
        ):
            return self
        raise ValueError("Provide a job URL, company and title, or company and requisition ID.")


class DuplicateCandidateResponse(BaseModel):
    application_id: str
    company_name: str
    job_title: str
    status: ApplicationStatus
    applied_date: date | None
    created_at: datetime
    confidence: DuplicateConfidence
    matched_on: list[DuplicateSignal]

    @classmethod
    def from_domain(cls, candidate: DuplicateCandidate) -> "DuplicateCandidateResponse":
        application = candidate.application
        return cls(
            application_id=application.application_id,
            company_name=application.company_name,
            job_title=application.job_title,
            status=application.status,
            applied_date=application.applied_date,
            created_at=application.created_at,
            confidence=candidate.confidence,
            matched_on=list(candidate.matched_on),
        )


class DuplicateCandidateListResponse(BaseModel):
    candidates: list[DuplicateCandidateResponse]


class ApplicationUpdateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    company_name: str | None = Field(default=None, min_length=1, max_length=120)
    job_title: str | None = Field(default=None, min_length=1, max_length=120)
    applied_date: date | None = None
    follow_up_date: date | None = None
    job_url: HttpUrl | None = Field(default=None, max_length=2048)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    work_mode: WorkMode | None = None
    source: ApplicationSource | None = None
    source_detail: str | None = Field(default=None, min_length=1, max_length=120)
    salary_text: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=5_000)
    role_family: RoleFamily | None = None

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


class FollowUpCompleteRequest(RequestModel):
    expected_version: int = Field(ge=1)


class FollowUpRescheduleRequest(RequestModel):
    expected_version: int = Field(ge=1)
    follow_up_date: date


class NextStepUpdateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    next_step_responsibility: NextStepResponsibility
    next_step_note: str | None = Field(default=None, min_length=1, max_length=500)
    follow_up_date: date | None = None


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
    next_step_responsibility: NextStepResponsibility | None
    next_step_note: str | None
    job_url: str | None
    location: str | None
    work_mode: WorkMode | None
    source: ApplicationSource | None
    source_detail: str | None
    salary_text: str | None
    description: str | None
    role_family: RoleFamily | None
    created_at: datetime
    updated_at: datetime
    version: int
    submitted_at: datetime | None
    stage_entered_at: datetime | None
    first_response_at: datetime | None
    first_screening_at: datetime | None
    first_interview_at: datetime | None
    first_offer_at: datetime | None
    first_acceptance_at: datetime | None
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
            next_step_responsibility=application.next_step_responsibility,
            next_step_note=application.next_step_note,
            job_url=application.job_url,
            location=application.location,
            work_mode=application.work_mode,
            source=application.source,
            source_detail=application.source_detail,
            salary_text=application.salary_text,
            description=application.description,
            role_family=application.role_family,
            created_at=application.created_at,
            updated_at=application.updated_at,
            version=application.version,
            submitted_at=application.submitted_at,
            stage_entered_at=application.stage_entered_at,
            first_response_at=application.first_response_at,
            first_screening_at=application.first_screening_at,
            first_interview_at=application.first_interview_at,
            first_offer_at=application.first_offer_at,
            first_acceptance_at=application.first_acceptance_at,
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
    next_cursor: str | None


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
