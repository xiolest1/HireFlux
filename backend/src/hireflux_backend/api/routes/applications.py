from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi import status as http_status

from hireflux_backend.api.dependencies import ApplicationServiceDependency, IdentityDependency
from hireflux_backend.api.schemas import (
    ActivityListResponse,
    ActivityResponse,
    ApplicationCreateRequest,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationStatusRequest,
    ApplicationUpdateRequest,
    FollowUpCompleteRequest,
    FollowUpRescheduleRequest,
)
from hireflux_backend.application.services import (
    CompleteFollowUpCommand,
    CreateApplicationCommand,
    RescheduleFollowUpCommand,
    TransitionApplicationCommand,
    UpdateApplicationCommand,
)
from hireflux_backend.domain.enums import (
    ApplicationSort,
    ApplicationSource,
    ApplicationStatus,
    StageAgeBucket,
    WorkMode,
)
from hireflux_backend.domain.resources import DefaultApplicationView

router = APIRouter(prefix="/api/v1/applications", tags=["applications"])


@router.post("", response_model=ApplicationResponse, status_code=http_status.HTTP_201_CREATED)
def create_application(
    request: ApplicationCreateRequest,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
) -> ApplicationResponse:
    application = service.create(
        identity,
        CreateApplicationCommand(
            company_name=request.company_name,
            job_title=request.job_title,
            status=request.status,
            applied_date=request.applied_date,
            follow_up_date=request.follow_up_date,
            job_url=str(request.job_url) if request.job_url else None,
            location=request.location,
            work_mode=request.work_mode,
            source=request.source,
            source_detail=request.source_detail,
            salary_text=request.salary_text,
            description=request.description,
        ),
    )
    return ApplicationResponse.from_domain(application)


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: str | None = None,
    status: ApplicationStatus | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    source: ApplicationSource | None = None,
    work_mode: WorkMode | None = None,
    stage_age: StageAgeBucket | None = None,
    sort: ApplicationSort = ApplicationSort.UPDATED_DESC,
    view: DefaultApplicationView | None = None,
) -> ApplicationListResponse:
    page = service.list(
        identity,
        status=status,
        limit=limit,
        cursor=cursor,
        q=q,
        source=source,
        work_mode=work_mode,
        stage_age=stage_age,
        sort=sort,
        view=view,
    )
    return ApplicationListResponse(
        items=[ApplicationResponse.from_domain(item) for item in page.items],
        next_cursor=page.next_cursor,
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: UUID,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
) -> ApplicationResponse:
    return ApplicationResponse.from_domain(service.get(identity, str(application_id)))


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: UUID,
    request: ApplicationUpdateRequest,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
) -> ApplicationResponse:
    changes = request.model_dump(exclude={"expected_version"}, exclude_unset=True)
    if changes.get("job_url") is not None:
        changes["job_url"] = str(changes["job_url"])
    application = service.update(
        identity,
        str(application_id),
        UpdateApplicationCommand(
            expected_version=request.expected_version,
            changes=changes,
        ),
    )
    return ApplicationResponse.from_domain(application)


@router.post("/{application_id}/status", response_model=ApplicationResponse)
def transition_application_status(
    application_id: UUID,
    request: ApplicationStatusRequest,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
) -> ApplicationResponse:
    application = service.transition(
        identity,
        str(application_id),
        TransitionApplicationCommand(
            status=request.status,
            expected_version=request.expected_version,
            applied_date=request.applied_date,
        ),
    )
    return ApplicationResponse.from_domain(application)


@router.delete("/{application_id}", response_model=ApplicationResponse)
def archive_application_alias(
    application_id: UUID,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
    expected_version: Annotated[int, Query(ge=1)],
) -> ApplicationResponse:
    """Compatibility alias; the UI uses the explicit status transition route."""
    return ApplicationResponse.from_domain(
        service.archive(identity, str(application_id), expected_version=expected_version)
    )


@router.get("/{application_id}/activity", response_model=ActivityListResponse)
def list_application_activity(
    application_id: UUID,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
) -> ActivityListResponse:
    page = service.list_activity(
        identity,
        str(application_id),
        limit=limit,
        cursor=cursor,
    )
    return ActivityListResponse(
        items=[ActivityResponse.from_domain(item) for item in page.items],
        next_cursor=page.next_cursor,
    )


@router.post("/{application_id}/follow-up/complete", response_model=ApplicationResponse)
def complete_application_follow_up(
    application_id: UUID,
    request: FollowUpCompleteRequest,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
) -> ApplicationResponse:
    application = service.complete_follow_up(
        identity,
        str(application_id),
        CompleteFollowUpCommand(expected_version=request.expected_version),
    )
    return ApplicationResponse.from_domain(application)


@router.post("/{application_id}/follow-up/reschedule", response_model=ApplicationResponse)
def reschedule_application_follow_up(
    application_id: UUID,
    request: FollowUpRescheduleRequest,
    identity: IdentityDependency,
    service: ApplicationServiceDependency,
) -> ApplicationResponse:
    application = service.reschedule_follow_up(
        identity,
        str(application_id),
        RescheduleFollowUpCommand(
            expected_version=request.expected_version,
            follow_up_date=request.follow_up_date,
        ),
    )
    return ApplicationResponse.from_domain(application)
