from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from hireflux_backend.api.resource_schemas import InterviewResponse
from hireflux_backend.api.schemas import ApplicationResponse
from hireflux_backend.domain.enums import (
    ApplicationSource,
    ApplicationStatus,
    StageAgeBucket,
    WorkMode,
)

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
    bucket: StageAgeBucket
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
    application_share: float
    response_rate_delta_vs_overall: float
    interview_rate_delta_vs_overall: float
    recent: "SourceRecentPerformanceResponse"
    recent_sample_sufficient: bool
    signal: (
        Literal[
            "STRONG_PERFORMER",
            "HIGH_VOLUME_LOW_RESPONSE",
            "PROMISING_EARLY",
            "CONCENTRATED_MIX",
            "LIMITED_DATA",
        ]
        | None
    )
    guidance: str | None


class SourceRecentPerformanceResponse(BaseModel):
    submitted_count: int
    response_count: int
    response_rate: float
    interview_count: int
    interview_rate: float
    offer_count: int
    offer_rate: float
    previous_submitted_count: int
    previous_response_rate: float
    previous_interview_rate: float
    response_rate_delta: float | None
    interview_rate_delta: float | None


class SourcePeriodResponse(BaseModel):
    label: Literal["Selected range", "Last 30 days"]
    current_start: date
    current_end: date
    previous_start: date
    previous_end: date


class SourceSummaryItemResponse(BaseModel):
    source: ApplicationSource
    submitted_count: int
    application_share: float
    response_rate: float
    response_rate_delta_vs_overall: float


class SourceRecentMovementResponse(BaseModel):
    source: ApplicationSource
    submitted_count: int
    response_rate: float
    response_rate_delta: float
    direction: Literal["IMPROVING", "DECLINING", "STABLE"]


class SourceConcentrationResponse(BaseModel):
    flagged: bool
    source: ApplicationSource | None
    application_share: float
    threshold: float
    submitted_count: int


class SourceSummaryResponse(BaseModel):
    submitted_count: int
    sufficient_for_strategy: bool
    top_volume: SourceSummaryItemResponse | None
    strongest_response: SourceSummaryItemResponse | None
    recent_movement: SourceRecentMovementResponse | None
    concentration: SourceConcentrationResponse


class WorkModeCountResponse(BaseModel):
    work_mode: WorkMode
    count: int


class PeriodMetricsResponse(BaseModel):
    submitted_count: int
    response_rate: float
    interview_rate: float
    offer_rate: float
    acceptance_rate: float
    average_days_to_first_response: float | None


class PeriodDeltasResponse(PeriodMetricsResponse):
    pass


class PeriodComparisonResponse(BaseModel):
    available: bool
    current_start: date | None
    current_end: date | None
    previous_start: date | None
    previous_end: date | None
    current: PeriodMetricsResponse | None
    previous: PeriodMetricsResponse | None
    deltas: PeriodDeltasResponse | None


class FollowUpCoverageResponse(BaseModel):
    active_count: int
    scheduled_count: int
    coverage_rate: float
    overdue_count: int
    due_today_count: int
    missing_count: int


class AnalyticsInsightActionResponse(BaseModel):
    kind: Literal["VIEW_APPLICATIONS", "ADD_APPLICATION"]
    label: str
    parameters: dict[str, str]


class AnalyticsInsightResponse(BaseModel):
    code: Literal[
        "BUILD_SAMPLE",
        "FOLLOW_UP_ATTENTION",
        "STALLED_PIPELINE",
        "MOMENTUM_WITH_INTERVIEWS",
        "VOLUME_UP_RESPONSE_DOWN",
        "SEARCH_CONVERTING",
        "MOMENTUM_DOWN",
        "MOMENTUM_UP",
        "RESPONSE_IMPROVING",
        "RESPONSE_DECLINING",
        "STRONG_SOURCE",
        "HIGH_VOLUME_LOW_RESPONSE",
        "SOURCE_CONCENTRATION",
        "PROMISING_SOURCE",
        "HEALTHY_PIPELINE",
    ]
    category: Literal["momentum", "response", "pipeline", "follow_up", "source"]
    semantic_type: Literal["action", "trend", "observation", "achievement"]
    tone: Literal["ACTION_NEEDED", "WATCH", "INFO", "POSITIVE"]
    title: str
    description: str
    evidence_summary: str
    evidence: str
    evidence_strength: Literal["LIMITED", "MODERATE", "STRONG"]
    evidence_label: str | None
    priority: int = Field(ge=0, le=100)
    action: AnalyticsInsightActionResponse | None


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
    source_period: SourcePeriodResponse
    source_summary: SourceSummaryResponse
    work_mode_breakdown: list[WorkModeCountResponse]
    average_days_to_first_response: float | None
    no_response_count: int
    period_comparison: PeriodComparisonResponse
    follow_up_coverage: FollowUpCoverageResponse
    insights: list[AnalyticsInsightResponse]
    disclaimer: str
