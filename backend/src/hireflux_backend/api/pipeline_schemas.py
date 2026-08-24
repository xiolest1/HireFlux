from datetime import datetime
from typing import Literal, cast

from pydantic import BaseModel, Field

from hireflux_backend.api.schemas import ApplicationResponse
from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Application


class PipelineCardResponse(BaseModel):
    application: ApplicationResponse
    stage_age_days: int | None = Field(default=None, ge=0)
    follow_up_state: Literal["NONE", "UPCOMING", "TODAY", "OVERDUE"]

    @classmethod
    def from_payload(cls, payload: dict[str, object]) -> "PipelineCardResponse":
        application = payload["application"]
        assert isinstance(application, Application)
        return cls(
            application=ApplicationResponse.from_domain(application),
            stage_age_days=cast(int | None, payload["stage_age_days"]),
            follow_up_state=cast(
                Literal["NONE", "UPCOMING", "TODAY", "OVERDUE"],
                payload["follow_up_state"],
            ),
        )


class PipelineLaneResponse(BaseModel):
    status: ApplicationStatus
    count: int = Field(ge=0)
    has_more: bool
    cards: list[PipelineCardResponse]

    @classmethod
    def from_payload(cls, payload: dict[str, object]) -> "PipelineLaneResponse":
        return cls(
            status=cast(ApplicationStatus, payload["status"]),
            count=cast(int, payload["count"]),
            has_more=cast(bool, payload["has_more"]),
            cards=[
                PipelineCardResponse.from_payload(card)
                for card in cast(list[dict[str, object]], payload["cards"])
            ],
        )


class PipelineResponse(BaseModel):
    generated_at: datetime
    lanes: list[PipelineLaneResponse]
