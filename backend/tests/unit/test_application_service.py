from datetime import UTC, date, datetime, timedelta

import pytest

from hireflux_backend.application.errors import ValidationError
from hireflux_backend.application.insights import InsightFilters, InsightsService
from hireflux_backend.application.ports import ApplicationPage, StageAgeBounds
from hireflux_backend.application.services import (
    ApplicationService,
    CreateApplicationCommand,
    TransitionApplicationCommand,
)
from hireflux_backend.domain.enums import ApplicationStatus, StageAgeBucket, UserRole
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity
from hireflux_backend.domain.resources import DefaultApplicationView


class ApplicationRepositoryStub:
    def __init__(self) -> None:
        self.application: Application | None = None

    def create(self, application: Application, activity: Activity) -> None:
        self.application = application

    def get(self, owner_user_id: str, application_id: str) -> Application | None:
        return self.application

    def replace_with_activity(
        self,
        application: Application,
        *,
        prior_application: Application,
        expected_version: int,
        activity: Activity,
    ) -> None:
        self.application = application

    def list_all(self, owner_user_id: str) -> tuple[Application, ...]:
        return (self.application,) if self.application is not None else ()


def identity() -> CurrentIdentity:
    return CurrentIdentity(
        user_id="owner",
        name="Recruiter",
        email="recruiter@example.com",
        role=UserRole.STANDARD_USER,
    )


def test_submission_milestones_use_actual_instants_not_applied_date_noon() -> None:
    created_at = datetime(2026, 8, 20, 8, 30, tzinfo=UTC)
    responded_at = datetime(2026, 8, 20, 10, tzinfo=UTC)
    clock = [created_at]
    repository = ApplicationRepositoryStub()
    service = ApplicationService(repository, clock=lambda: clock[0])

    applied = service.create(
        identity(),
        CreateApplicationCommand(
            company_name="Same Day Co",
            job_title="Engineer",
            status=ApplicationStatus.APPLIED,
            applied_date=date(2026, 8, 20),
        ),
    )
    assert applied.submitted_at == created_at

    clock[0] = responded_at
    screening = service.transition(
        identity(),
        applied.application_id,
        TransitionApplicationCommand(
            status=ApplicationStatus.SCREENING,
            expected_version=applied.version,
        ),
    )
    assert screening.submitted_at == created_at
    assert screening.first_response_at == responded_at

    analytics = InsightsService(repository, clock=lambda: responded_at).analytics(
        identity(), reporting_range="all", filters=InsightFilters()
    )
    assert analytics["average_days_to_first_response"] == 0.1


def test_draft_to_applied_captures_transition_instant() -> None:
    created_at = datetime(2026, 8, 19, 16, tzinfo=UTC)
    submitted_at = datetime(2026, 8, 20, 8, 30, tzinfo=UTC)
    clock = [created_at]
    repository = ApplicationRepositoryStub()
    service = ApplicationService(repository, clock=lambda: clock[0])

    draft = service.create(
        identity(),
        CreateApplicationCommand(
            company_name="Transition Co",
            job_title="Engineer",
        ),
    )
    clock[0] = submitted_at
    applied = service.transition(
        identity(),
        draft.application_id,
        TransitionApplicationCommand(
            status=ApplicationStatus.APPLIED,
            expected_version=draft.version,
            applied_date=submitted_at.date(),
        ),
    )

    assert applied.submitted_at == submitted_at


def test_analytics_uses_applied_date_for_both_submission_paths() -> None:
    direct_repo = ApplicationRepositoryStub()
    direct_service = ApplicationService(
        direct_repo,
        clock=lambda: datetime(2026, 8, 15, 10, tzinfo=UTC),
    )
    direct = direct_service.create(
        identity(),
        CreateApplicationCommand(
            company_name="Direct Co",
            job_title="Engineer",
            status=ApplicationStatus.APPLIED,
            applied_date=date(2026, 8, 15),
        ),
    )

    draft_repo = ApplicationRepositoryStub()
    transition_clock = [datetime(2026, 8, 15, 11, tzinfo=UTC)]
    draft_service = ApplicationService(draft_repo, clock=lambda: transition_clock[0])
    draft = draft_service.create(
        identity(),
        CreateApplicationCommand(company_name="Draft Co", job_title="Engineer"),
    )
    transition_clock[0] = datetime(2026, 9, 15, 10, tzinfo=UTC)
    converted = draft_service.transition(
        identity(),
        draft.application_id,
        TransitionApplicationCommand(
            status=ApplicationStatus.APPLIED,
            expected_version=draft.version,
            applied_date=date(2026, 8, 15),
        ),
    )

    class CombinedRepository:
        def list_all(self, owner_user_id: str) -> tuple[Application, ...]:
            return (direct, converted)

    analytics = InsightsService(
        CombinedRepository(),
        clock=lambda: datetime(2026, 9, 20, 10, tzinfo=UTC),
    ).analytics(identity(), reporting_range="30d", filters=InsightFilters())

    assert analytics["rates"] == {
        "submitted_count": 0,
        "response_count": 0,
        "response_rate": 0.0,
        "interview_count": 0,
        "interview_rate": 0.0,
        "offer_count": 0,
        "offer_rate": 0.0,
        "acceptance_count": 0,
        "acceptance_rate": 0.0,
    }

    all_time = InsightsService(
        CombinedRepository(),
        clock=lambda: datetime(2026, 9, 20, 10, tzinfo=UTC),
    ).analytics(identity(), reporting_range="all", filters=InsightFilters())
    august_week = next(
        point for point in all_time["submission_trend"] if point["week_start"] == date(2026, 8, 10)
    )
    assert august_week["count"] == 2


def test_future_applied_dates_are_rejected_using_workspace_calendar() -> None:
    now = datetime(2026, 8, 20, 1, tzinfo=UTC)
    service = ApplicationService(
        ApplicationRepositoryStub(),
        clock=lambda: now,
        workspace_time_zone=lambda _identity: "America/Los_Angeles",
    )

    with pytest.raises(ValidationError, match="cannot be in the future"):
        service.create(
            identity(),
            CreateApplicationCommand(
                company_name="Future Co",
                job_title="Engineer",
                status=ApplicationStatus.APPLIED,
                applied_date=date(2026, 8, 21),
            ),
        )


def test_legacy_out_of_order_response_is_omitted_from_average() -> None:
    submitted_at = datetime(2026, 8, 20, 12, tzinfo=UTC)
    response_at = datetime(2026, 8, 20, 10, tzinfo=UTC)
    application = Application(
        application_id="00000000-0000-4000-8000-000000000001",
        owner_user_id="owner",
        company_name="Legacy Co",
        job_title="Engineer",
        status=ApplicationStatus.SCREENING,
        applied_date=date(2026, 8, 20),
        follow_up_date=None,
        job_url=None,
        location=None,
        work_mode=None,
        source=None,
        salary_text=None,
        description=None,
        created_at=submitted_at,
        updated_at=response_at,
        version=1,
        submitted_at=submitted_at,
        stage_entered_at=submitted_at,
        first_response_at=response_at,
    )

    class AnalyticsRepositoryStub:
        def list_all(self, owner_user_id: str) -> tuple[Application, ...]:
            return (application,)

    analytics = InsightsService(
        AnalyticsRepositoryStub(),
        clock=lambda: datetime(2026, 8, 21, tzinfo=UTC),  # type: ignore[arg-type]
    ).analytics(identity(), reporting_range="all", filters=InsightFilters())

    assert analytics["average_days_to_first_response"] is None


@pytest.mark.parametrize(
    ("bucket", "entered_on_or_after", "entered_before"),
    [
        (StageAgeBucket.ZERO_TO_SEVEN, date(2026, 8, 16), date(2026, 8, 24)),
        (StageAgeBucket.EIGHT_TO_FOURTEEN, date(2026, 8, 9), date(2026, 8, 16)),
        (StageAgeBucket.FIFTEEN_TO_THIRTY, date(2026, 7, 24), date(2026, 8, 9)),
        (StageAgeBucket.THIRTY_ONE_PLUS, None, date(2026, 7, 24)),
    ],
)
def test_application_list_stage_age_bounds_are_server_owned(
    bucket: StageAgeBucket,
    entered_on_or_after: date | None,
    entered_before: date | None,
) -> None:
    class ListRepositoryStub(ApplicationRepositoryStub):
        def __init__(self) -> None:
            super().__init__()
            self.bounds: StageAgeBounds | None = None

        def list(self, owner_user_id: str, **kwargs: object) -> ApplicationPage:
            self.bounds = kwargs["stage_age"]  # type: ignore[assignment]
            return ApplicationPage(items=(), next_cursor=None)

    repository = ListRepositoryStub()
    service = ApplicationService(
        repository,
        clock=lambda: datetime(2026, 8, 23, 12, tzinfo=UTC),
    )
    page = service.list(
        identity(),
        status=None,
        limit=20,
        cursor=None,
        stage_age=bucket,
        view=DefaultApplicationView.ACTIVE,
    )

    assert page.items == ()
    assert repository.bounds == StageAgeBounds(entered_on_or_after, entered_before)


def test_application_list_stage_age_bounds_use_workspace_calendar() -> None:
    class ListRepositoryStub(ApplicationRepositoryStub):
        def __init__(self) -> None:
            super().__init__()
            self.bounds: StageAgeBounds | None = None

        def list(self, owner_user_id: str, **kwargs: object) -> ApplicationPage:
            self.bounds = kwargs["stage_age"]  # type: ignore[assignment]
            return ApplicationPage(items=(), next_cursor=None)

    repository = ListRepositoryStub()
    service = ApplicationService(
        repository,
        clock=lambda: datetime(2026, 8, 23, 1, tzinfo=UTC),
        workspace_time_zone=lambda _identity: "America/Los_Angeles",
    )

    service.list(
        identity(),
        status=None,
        limit=20,
        cursor=None,
        stage_age=StageAgeBucket.ZERO_TO_SEVEN,
        view=DefaultApplicationView.ACTIVE,
    )

    assert repository.bounds == StageAgeBounds(date(2026, 8, 15), date(2026, 8, 23))


def test_application_list_stage_age_rejects_non_active_views_and_statuses() -> None:
    repository = ApplicationRepositoryStub()
    service = ApplicationService(
        repository,
        clock=lambda: datetime(2026, 8, 23, 12, tzinfo=UTC),
    )

    with pytest.raises(ValidationError, match="requires the ACTIVE"):
        service.list(
            identity(),
            status=None,
            limit=20,
            cursor=None,
            stage_age=StageAgeBucket.FIFTEEN_TO_THIRTY,
            view=DefaultApplicationView.ALL,
        )
    with pytest.raises(ValidationError, match="active status"):
        service.list(
            identity(),
            status=ApplicationStatus.ACCEPTED,
            limit=20,
            cursor=None,
            stage_age=StageAgeBucket.FIFTEEN_TO_THIRTY,
            view=DefaultApplicationView.ACTIVE,
        )


def test_analytics_compares_adjacent_windows_and_tracks_follow_up_coverage() -> None:
    now = datetime(2026, 8, 22, 12, tzinfo=UTC)

    def application(
        identifier: int,
        applied_on: date,
        *,
        response_days: int | None = None,
        follow_up_date: date | None = None,
    ) -> Application:
        submitted_at = datetime.combine(applied_on, datetime.min.time(), tzinfo=UTC)
        return Application(
            application_id=f"00000000-0000-4000-8000-{identifier:012d}",
            owner_user_id="owner",
            company_name=f"Company {identifier}",
            job_title="Engineer",
            status=ApplicationStatus.APPLIED,
            applied_date=applied_on,
            follow_up_date=follow_up_date,
            job_url=None,
            location=None,
            work_mode=None,
            source=None,
            salary_text=None,
            description=None,
            created_at=submitted_at,
            updated_at=submitted_at,
            version=1,
            submitted_at=submitted_at,
            stage_entered_at=submitted_at,
            first_response_at=(
                submitted_at + timedelta(days=response_days) if response_days is not None else None
            ),
        )

    applications = (
        application(1, date(2026, 8, 22), response_days=2, follow_up_date=date(2026, 8, 22)),
        application(2, date(2026, 7, 23), follow_up_date=date(2026, 8, 21)),
        application(3, date(2026, 7, 22), response_days=4),
        application(4, date(2026, 6, 22)),
    )

    class AnalyticsRepositoryStub:
        def list_all(self, owner_user_id: str) -> tuple[Application, ...]:
            return applications

    analytics = InsightsService(AnalyticsRepositoryStub(), clock=lambda: now).analytics(  # type: ignore[arg-type]
        identity(), reporting_range="30d", filters=InsightFilters()
    )

    comparison = analytics["period_comparison"]
    assert isinstance(comparison, dict)
    assert comparison["current_start"] == date(2026, 7, 23)
    assert comparison["previous_end"] == date(2026, 7, 22)
    assert comparison["current"] == {
        "submitted_count": 2,
        "response_rate": 0.5,
        "interview_rate": 0.0,
        "offer_rate": 0.0,
        "acceptance_rate": 0.0,
        "average_days_to_first_response": 2.0,
    }
    assert comparison["previous"] == {
        "submitted_count": 2,
        "response_rate": 0.5,
        "interview_rate": 0.0,
        "offer_rate": 0.0,
        "acceptance_rate": 0.0,
        "average_days_to_first_response": 4.0,
    }
    assert comparison["deltas"]["average_days_to_first_response"] == -2.0  # type: ignore[index]
    assert analytics["follow_up_coverage"] == {
        "active_count": 2,
        "scheduled_count": 2,
        "coverage_rate": 1.0,
        "overdue_count": 1,
        "due_today_count": 1,
        "missing_count": 0,
    }
