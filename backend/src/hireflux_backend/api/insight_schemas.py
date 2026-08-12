from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, model_validator

from hireflux_backend.api.resource_schemas import InterviewResponse
from hireflux_backend.api.schemas import ApplicationResponse
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus, WorkMode

DashboardRange = Literal["30d", "90d", "all"]


class InsightSummaryResponse(BaseModel):
    total_tracked: int
    active_pursuits: int
    drafts: int
    accepted: int
    rejected: int
    withdrawn: int
    archived: int


class InsightRatesResponse(BaseModel):
    submitted_count: int
    response_count: int
    response_rate: float
    interview_count: int
    interview_rate: float
    offer_count: int
    offer_rate: float
    acceptance_count: int
    acceptance_rate: float


class ActionResponse(BaseModel):
    kind: Literal["FOLLOW_UP_OVERDUE", "FOLLOW_UP_TODAY", "STALE_APPLICATION", "INTERVIEW_SOON"]
    application_id: str
    company_name: str
    job_title: str
    due_date: date | None = None
    due_at: datetime | None = None
    priority: Literal["HIGH", "MEDIUM", "LOW"]
    label: str

    @model_validator(mode="after")
    def require_exactly_one_due_value(self) -> "ActionResponse":
        if (self.due_date is None) == (self.due_at is None):
            raise ValueError("Actions require exactly one of due_date or due_at.")
        follow_up = self.kind in {"FOLLOW_UP_OVERDUE", "FOLLOW_UP_TODAY"}
        if follow_up != (self.due_date is not None):
            raise ValueError("Follow-ups require due_date; timed actions require due_at.")
        return self


class TrendPointResponse(BaseModel):
    week_start: date
    count: int


class StatusCountResponse(BaseModel):
    status: ApplicationStatus
    count: int


class DashboardResponse(BaseModel):
    range: DashboardRange
    generated_at: datetime
    summary: InsightSummaryResponse
    rates: InsightRatesResponse
    actions: list[ActionResponse]
    upcoming_interviews: list[InterviewResponse]
    recent_applications: list[ApplicationResponse]
    submission_trend: list[TrendPointResponse]
    status_breakdown: list[StatusCountResponse]


class AnalyticsFiltersResponse(BaseModel):
    status: ApplicationStatus | None
    source: ApplicationSource | None
    work_mode: WorkMode | None


class FunnelPointResponse(BaseModel):
    stage: str
    count: int
    rate: float


class AgingBucketResponse(BaseModel):
    bucket: str
    count: int


class SourcePerformanceResponse(BaseModel):
    source: ApplicationSource
    submitted_count: int
    response_count: int
    response_rate: float
    interview_count: int
    interview_rate: float
    offer_count: int
    offer_rate: float
    sample_sufficient: bool


class WorkModeCountResponse(BaseModel):
    work_mode: WorkMode
    count: int


class AnalyticsResponse(BaseModel):
    range: DashboardRange
    filters: AnalyticsFiltersResponse
    generated_at: datetime
    summary: InsightSummaryResponse
    rates: InsightRatesResponse
    status_breakdown: list[StatusCountResponse]
    submission_trend: list[TrendPointResponse]
    funnel: list[FunnelPointResponse]
    stage_aging: list[AgingBucketResponse]
    source_performance: list[SourcePerformanceResponse]
    work_mode_breakdown: list[WorkModeCountResponse]
    average_days_to_first_response: float | None
    no_response_count: int
    disclaimer: str
