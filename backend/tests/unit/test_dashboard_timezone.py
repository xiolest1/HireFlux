from datetime import UTC, date, datetime
from typing import cast

from hireflux_backend.application.insights import InsightsService
from hireflux_backend.domain.enums import ApplicationStatus, UserRole
from hireflux_backend.domain.models import Application, CurrentIdentity
from hireflux_backend.domain.resources import (
    DashboardRange,
    DefaultApplicationView,
    ThemePreference,
    WorkspaceSettings,
)


def _application(application_id: str, follow_up_date: date | None) -> Application:
    timestamp = datetime(2026, 8, 12, 2, 30, tzinfo=UTC)
    return Application(
        application_id=application_id,
        owner_user_id="owner",
        company_name="Boundary Co",
        job_title="Engineer",
        status=ApplicationStatus.APPLIED,
        applied_date=date(2026, 8, 1),
        follow_up_date=follow_up_date,
        job_url=None,
        location=None,
        work_mode=None,
        source=None,
        salary_text=None,
        description=None,
        created_at=timestamp,
        updated_at=timestamp,
        version=1,
        submitted_at=timestamp,
        stage_entered_at=timestamp,
    )


class RepositorySpy:
    def __init__(self) -> None:
        self.query_date: date | None = None
        self.query_owner: str | None = None
        self.all_applications = (_application("future", date(2026, 8, 12)),)
        self.due_applications = (_application("today", date(2026, 8, 11)),)

    def list_all(self, owner_user_id: str) -> tuple[Application, ...]:
        return self.all_applications

    def get_status_counts(self, owner_user_id: str) -> dict[ApplicationStatus, int]:
        return {status: int(status is ApplicationStatus.APPLIED) for status in ApplicationStatus}

    def get_funnel_counts(self, owner_user_id: str) -> dict[str, int]:
        return {"submitted_count": 1}

    def list_follow_ups_due(
        self, owner_user_id: str, *, due_on_or_before: date, limit: int
    ) -> tuple[Application, ...]:
        self.query_owner = owner_user_id
        self.query_date = due_on_or_before
        return self.due_applications


class ResourceServiceStub:
    def get_settings(self, identity: CurrentIdentity) -> WorkspaceSettings:
        timestamp = datetime(2026, 8, 12, 2, 30, tzinfo=UTC)
        return WorkspaceSettings(
            owner_user_id=identity.user_id,
            time_zone="America/New_York",
            default_follow_up_days=7,
            default_application_view=DefaultApplicationView.ACTIVE,
            default_dashboard_range=DashboardRange.THIRTY_DAYS,
            theme=ThemePreference.SYSTEM,
            created_at=timestamp,
            updated_at=timestamp,
            version=1,
        )

    def list_owner_interviews(self, identity: CurrentIdentity, *, limit: int) -> tuple[object, ...]:
        return ()


def test_dashboard_uses_saved_zone_and_schedule_query_for_follow_up_dates() -> None:
    repository = RepositorySpy()
    identity = CurrentIdentity(
        user_id="owner",
        name="User",
        email="user@example.com",
        role=UserRole.STANDARD_USER,
    )
    service = InsightsService(  # type: ignore[arg-type]
        repository,
        resource_service=ResourceServiceStub(),  # type: ignore[arg-type]
        clock=lambda: datetime(2026, 8, 12, 2, 30, tzinfo=UTC),
    )

    payload = service.dashboard(identity, reporting_range="all")

    assert repository.query_owner == "owner"
    assert repository.query_date == date(2026, 8, 11)
    actions = cast(list[dict[str, object]], payload["actions"])
    follow_ups = [action for action in actions if str(action["kind"]).startswith("FOLLOW_UP")]
    assert follow_ups == [
        {
            "kind": "FOLLOW_UP_TODAY",
            "application_id": "today",
            "company_name": "Boundary Co",
            "job_title": "Engineer",
            "due_date": date(2026, 8, 11),
            "due_at": None,
            "priority": "MEDIUM",
            "label": "Follow up today",
        }
    ]
    assert all(action["application_id"] != "future" for action in follow_ups)
