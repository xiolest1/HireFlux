from datetime import UTC, date, datetime, timedelta

from hireflux_backend.application.pipeline import (
    PIPELINE_CARDS_PER_LANE,
    PIPELINE_STATUSES,
    PipelineService,
)
from hireflux_backend.application.ports import ApplicationPage
from hireflux_backend.domain.enums import ApplicationStatus, UserRole
from hireflux_backend.domain.models import Application, CurrentIdentity

NOW = datetime(2026, 8, 24, 15, tzinfo=UTC)


def identity() -> CurrentIdentity:
    return CurrentIdentity(
        user_id="owner",
        name="Candidate",
        email="candidate@example.test",
        role=UserRole.STANDARD_USER,
    )


def application(
    identifier: int,
    status: ApplicationStatus,
    *,
    follow_up_date: date | None = None,
    stage_days: int | None = None,
) -> Application:
    entered_at = NOW - timedelta(days=stage_days) if stage_days is not None else None
    return Application(
        application_id=f"00000000-0000-4000-8000-{identifier:012d}",
        owner_user_id="owner",
        company_name=f"Company {identifier}",
        job_title="Engineer",
        status=status,
        applied_date=None if status is ApplicationStatus.DRAFT else NOW.date(),
        follow_up_date=follow_up_date,
        job_url=None,
        location=None,
        work_mode=None,
        source=None,
        salary_text=None,
        description=None,
        created_at=NOW,
        updated_at=NOW - timedelta(minutes=identifier),
        version=1,
        stage_entered_at=entered_at,
    )


class PipelineRepositoryStub:
    def __init__(self, applications: tuple[Application, ...]) -> None:
        self._applications = applications
        self.requested_statuses: list[ApplicationStatus] = []

    def get_status_counts(self, owner_user_id: str) -> dict[ApplicationStatus, int]:
        assert owner_user_id == "owner"
        return {
            status: sum(application.status is status for application in self._applications)
            for status in ApplicationStatus
        }

    def list(
        self,
        owner_user_id: str,
        *,
        status: ApplicationStatus | None,
        limit: int,
        cursor: str | None,
        **_kwargs: object,
    ) -> ApplicationPage:
        assert owner_user_id == "owner"
        assert status is not None
        assert cursor is None
        self.requested_statuses.append(status)
        items = tuple(item for item in self._applications if item.status is status)
        return ApplicationPage(items=items[:limit], next_cursor=None)


def test_pipeline_returns_ordered_bounded_lanes_with_server_owned_context() -> None:
    applications = (
        *(
            application(
                index, ApplicationStatus.APPLIED, stage_days=index, follow_up_date=NOW.date()
            )
            for index in range(1, PIPELINE_CARDS_PER_LANE + 2)
        ),
        application(
            20,
            ApplicationStatus.INTERVIEW,
            stage_days=3,
            follow_up_date=NOW.date() - timedelta(days=1),
        ),
        application(
            21, ApplicationStatus.OFFER, stage_days=1, follow_up_date=NOW.date() + timedelta(days=2)
        ),
        application(22, ApplicationStatus.ACCEPTED),
        application(23, ApplicationStatus.ARCHIVED),
    )
    repository = PipelineRepositoryStub(applications)
    payload = PipelineService(repository, clock=lambda: NOW).get_pipeline(identity())  # type: ignore[arg-type]

    lanes = payload["lanes"]
    assert [lane["status"] for lane in lanes] == list(PIPELINE_STATUSES)
    assert repository.requested_statuses == list(PIPELINE_STATUSES)
    assert ApplicationStatus.ARCHIVED not in repository.requested_statuses

    applied = next(lane for lane in lanes if lane["status"] is ApplicationStatus.APPLIED)
    assert applied["count"] == PIPELINE_CARDS_PER_LANE + 1
    assert len(applied["cards"]) == PIPELINE_CARDS_PER_LANE
    assert applied["has_more"] is True
    assert applied["cards"][0]["stage_age_days"] == 1
    assert applied["cards"][0]["follow_up_state"] == "TODAY"

    interview = next(lane for lane in lanes if lane["status"] is ApplicationStatus.INTERVIEW)
    assert interview["cards"][0]["stage_age_days"] == 3
    assert interview["cards"][0]["follow_up_state"] == "OVERDUE"

    accepted = next(lane for lane in lanes if lane["status"] is ApplicationStatus.ACCEPTED)
    assert accepted["cards"][0]["stage_age_days"] is None
    assert accepted["cards"][0]["follow_up_state"] == "NONE"
