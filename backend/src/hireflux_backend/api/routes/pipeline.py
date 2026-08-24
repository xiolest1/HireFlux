from datetime import datetime
from typing import cast

from fastapi import APIRouter, Request

from hireflux_backend.api.dependencies import IdentityDependency
from hireflux_backend.api.pipeline_schemas import PipelineLaneResponse, PipelineResponse
from hireflux_backend.application.pipeline import PipelineService

router = APIRouter(tags=["pipeline"])


def _service(request: Request) -> PipelineService:
    return request.app.state.pipeline_service


@router.get("/api/v1/pipeline", response_model=PipelineResponse)
def get_pipeline(identity: IdentityDependency, request: Request) -> PipelineResponse:
    payload = _service(request).get_pipeline(identity)
    return PipelineResponse(
        generated_at=cast(datetime, payload["generated_at"]),
        lanes=[
            PipelineLaneResponse.from_payload(lane)
            for lane in cast(list[dict[str, object]], payload["lanes"])
        ],
    )
