from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, Field, HttpUrl

from hireflux_backend.api.schemas import RequestModel
from hireflux_backend.domain.enums import ApplicationStatus, RoleFamily
from hireflux_backend.domain.interview_guidance import (
    InterviewGuidance,
    PreparationPhase,
    PreparationSource,
    guidance_for,
)
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
from hireflux_backend.domain.role_context import RoleFamilySource


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
    next_cursor: str | None


class NotePreviewResponse(BaseModel):
    items: list[NoteResponse]
    total_count: int


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


InterviewQuestion = Annotated[str, Field(min_length=1, max_length=300)]
ChecklistItemId = Annotated[str, Field(min_length=1, max_length=80)]


class InterviewWorkspaceUpdateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    completed_checklist_items: list[ChecklistItemId] = Field(max_length=8)
    preparation_notes: str | None = Field(min_length=1, max_length=5_000)
    candidate_questions: list[InterviewQuestion] = Field(max_length=8)
    debrief_went_well: str | None = Field(min_length=1, max_length=2_000)
    debrief_improve: str | None = Field(min_length=1, max_length=2_000)
    debrief_signals: str | None = Field(min_length=1, max_length=2_000)
    debrief_next_step: str | None = Field(min_length=1, max_length=500)
    debrief_complete: bool


class InterviewChecklistItemResponse(BaseModel):
    item_id: str
    label: str
    description: str
    phase: PreparationPhase
    source: PreparationSource
    source_label: str
    removable: bool


class CuratedTextResponse(BaseModel):
    text: str
    source: PreparationSource
    source_label: str


class PreparationTipResponse(BaseModel):
    title: str
    body: str
    source: PreparationSource
    source_label: str


class PreparationRoleContextResponse(BaseModel):
    role_family: RoleFamily
    role_family_label: str
    source: RoleFamilySource
    explanation: str


class InterviewReadinessResponse(BaseModel):
    completed_steps: int
    total_steps: int
    ready_for_interview: bool
    missing_actions: list[str]


class InterviewGuidanceResponse(BaseModel):
    role_context: PreparationRoleContextResponse
    checklist_items: list[InterviewChecklistItemResponse]
    focus_prompts: list[CuratedTextResponse]
    suggested_questions: list[CuratedTextResponse]
    tips: list[PreparationTipResponse]
    readiness: InterviewReadinessResponse

    @classmethod
    def from_domain(cls, guidance: InterviewGuidance) -> "InterviewGuidanceResponse":
        return cls(
            role_context=PreparationRoleContextResponse(
                role_family=guidance.role_context.role_family,
                role_family_label=guidance.role_context.role_family_label,
                source=guidance.role_context.source,
                explanation=guidance.role_context.explanation,
            ),
            checklist_items=[
                InterviewChecklistItemResponse(
                    item_id=item.item_id,
                    label=item.label,
                    description=item.description,
                    phase=item.phase,
                    source=item.source,
                    source_label=item.source_label,
                    removable=item.removable,
                )
                for item in guidance.checklist_items
            ],
            focus_prompts=[
                CuratedTextResponse(
                    text=item.text, source=item.source, source_label=item.source_label
                )
                for item in guidance.focus_prompts
            ],
            suggested_questions=[
                CuratedTextResponse(
                    text=item.text, source=item.source, source_label=item.source_label
                )
                for item in guidance.suggested_questions
            ],
            tips=[
                PreparationTipResponse(
                    title=item.title,
                    body=item.body,
                    source=item.source,
                    source_label=item.source_label,
                )
                for item in guidance.tips
            ],
            readiness=InterviewReadinessResponse(
                completed_steps=guidance.completed_steps,
                total_steps=guidance.total_steps,
                ready_for_interview=guidance.ready_for_interview,
                missing_actions=list(guidance.missing_actions),
            ),
        )


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
    preparation_notes: str | None
    completed_checklist_items: list[str]
    candidate_questions: list[str]
    custom_preparation_items: list[InterviewChecklistItemResponse]
    debrief_went_well: str | None
    debrief_improve: str | None
    debrief_signals: str | None
    debrief_next_step: str | None
    debrief_completed_at: datetime | None
    guidance: InterviewGuidanceResponse
    created_at: datetime
    updated_at: datetime
    version: int
    allowed_statuses: list[InterviewStatus]

    @classmethod
    def from_domain(cls, interview: Interview) -> "InterviewResponse":
        guidance = InterviewGuidanceResponse.from_domain(guidance_for(interview))
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
            preparation_notes=interview.preparation_notes,
            completed_checklist_items=list(interview.completed_checklist_items),
            candidate_questions=list(interview.candidate_questions),
            custom_preparation_items=[
                item
                for item in guidance.checklist_items
                if item.source is PreparationSource.CANDIDATE
            ],
            debrief_went_well=interview.debrief_went_well,
            debrief_improve=interview.debrief_improve,
            debrief_signals=interview.debrief_signals,
            debrief_next_step=interview.debrief_next_step,
            debrief_completed_at=interview.debrief_completed_at,
            guidance=guidance,
            created_at=interview.created_at,
            updated_at=interview.updated_at,
            version=interview.version,
            allowed_statuses=list(allowed_interview_statuses(interview)),
        )


class PreparationItemCreateRequest(RequestModel):
    expected_version: int = Field(ge=1)
    label: str = Field(min_length=1, max_length=120)


class InterviewListResponse(BaseModel):
    items: list[InterviewResponse]
    next_cursor: str | None


class InterviewWorkspaceContextResponse(BaseModel):
    application_status: ApplicationStatus
    follow_up_date: date | None
    follow_up_state: Literal["NONE", "UPCOMING", "TODAY", "OVERDUE"]
    workflow_state: Literal[
        "PREPARE",
        "UPCOMING",
        "IMMINENT",
        "MISSED",
        "CAPTURE",
        "FOLLOW_UP",
        "HISTORY",
        "CANCELED",
    ]
    next_action: Literal[
        "PREPARE",
        "JOIN_MEETING",
        "MARK_COMPLETE",
        "CAPTURE_NOTES",
        "REVIEW_FOLLOW_UP",
        "REVIEW_DEBRIEF",
        "OPEN_APPLICATION",
    ]


class WorkspaceInterviewResponse(InterviewResponse):
    context: InterviewWorkspaceContextResponse

    @classmethod
    def from_domain_with_context(
        cls,
        interview: Interview,
        *,
        application_status: ApplicationStatus,
        follow_up_date: date | None,
        follow_up_state: Literal["NONE", "UPCOMING", "TODAY", "OVERDUE"],
        workflow_state: Literal[
            "PREPARE",
            "UPCOMING",
            "IMMINENT",
            "MISSED",
            "CAPTURE",
            "FOLLOW_UP",
            "HISTORY",
            "CANCELED",
        ],
        next_action: Literal[
            "PREPARE",
            "JOIN_MEETING",
            "MARK_COMPLETE",
            "CAPTURE_NOTES",
            "REVIEW_FOLLOW_UP",
            "REVIEW_DEBRIEF",
            "OPEN_APPLICATION",
        ],
    ) -> "WorkspaceInterviewResponse":
        base = InterviewResponse.from_domain(interview).model_dump()
        return cls(
            **base,
            context=InterviewWorkspaceContextResponse(
                application_status=application_status,
                follow_up_date=follow_up_date,
                follow_up_state=follow_up_state,
                workflow_state=workflow_state,
                next_action=next_action,
            ),
        )


class WorkspaceInterviewListResponse(BaseModel):
    items: list[WorkspaceInterviewResponse]
    next_cursor: str | None
