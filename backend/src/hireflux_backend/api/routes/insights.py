from typing import Annotated, cast

from fastapi import APIRouter, Query, Request

from hireflux_backend.api.dependencies import IdentityDependency
from hireflux_backend.api.insight_schemas import (
    AnalyticsResponse,
    DashboardRange,
    DashboardResponse,
)
from hireflux_backend.api.resource_schemas import InterviewResponse
from hireflux_backend.api.schemas import ApplicationResponse
from hireflux_backend.application.insights import InsightFilters, InsightsService
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus, WorkMode
from hireflux_backend.domain.models import Application
from hireflux_backend.domain.resources import Interview

router = APIRouter(tags=["insights"])


def _service(request: Request) -> InsightsService:
    return request.app.state.insights_service


@router.get("/api/v1/dashboard", response_model=DashboardResponse)
def get_dashboard(
    identity: IdentityDependency,
    request: Request,
    range: Annotated[DashboardRange, Query()] = "30d",
) -> dict[str, object]:
    payload = _service(request).dashboard(identity, reporting_range=range)
    recent = cast(list[Application], payload["recent_applications"])
    upcoming = cast(list[Interview], payload["upcoming_interviews"])
    payload["recent_applications"] = [
        ApplicationResponse.from_domain(application).model_dump(mode="json")
        for application in recent
    ]
    payload["upcoming_interviews"] = [
        InterviewResponse.from_domain(interview).model_dump(mode="json") for interview in upcoming
    ]
    return payload


@router.get("/api/v1/analytics", response_model=AnalyticsResponse)
def get_analytics(
    identity: IdentityDependency,
    request: Request,
    range: Annotated[DashboardRange, Query()] = "30d",
    status: ApplicationStatus | None = None,
    source: ApplicationSource | None = None,
    work_mode: WorkMode | None = None,
) -> dict[str, object]:
    return _service(request).analytics(
        identity,
        reporting_range=range,
        filters=InsightFilters(status=status, source=source, work_mode=work_mode),
    )
