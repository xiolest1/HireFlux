from collections.abc import Callable
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from hireflux_backend.application.ports import ApplicationRepository
from hireflux_backend.application.services import utc_now
from hireflux_backend.domain.enums import ApplicationSort, ApplicationStatus
from hireflux_backend.domain.models import Application, CurrentIdentity

PIPELINE_STATUSES = (
    ApplicationStatus.DRAFT,
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
)
ACTIVE_PIPELINE_STATUSES = frozenset(
    {
        ApplicationStatus.APPLIED,
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    }
)
PIPELINE_CARDS_PER_LANE = 8


class PipelineService:
    """Builds the bounded, owner-isolated workflow view used by the Pipeline tab."""

    def __init__(
        self,
        repository: ApplicationRepository,
        *,
        clock: Callable[[], datetime] = utc_now,
        workspace_time_zone: Callable[[CurrentIdentity], str] | None = None,
    ) -> None:
        self._repository = repository
        self._clock = clock
        self._workspace_time_zone = workspace_time_zone or (lambda _identity: "UTC")

    def get_pipeline(self, identity: CurrentIdentity) -> dict[str, object]:
        now = self._clock().astimezone(UTC)
        time_zone = ZoneInfo(self._workspace_time_zone(identity))
        local_today = now.astimezone(time_zone).date()
        counts = self._repository.get_status_counts(identity.user_id)
        lanes: list[dict[str, object]] = []

        for status in PIPELINE_STATUSES:
            page = self._repository.list(
                identity.user_id,
                status=status,
                limit=PIPELINE_CARDS_PER_LANE,
                cursor=None,
                sort=ApplicationSort.UPDATED_DESC,
            )
            lanes.append(
                {
                    "status": status,
                    "count": counts[status],
                    "has_more": counts[status] > len(page.items),
                    "cards": [
                        _card(application, local_today=local_today, time_zone=time_zone)
                        for application in page.items
                    ],
                }
            )

        return {"generated_at": now, "lanes": lanes}


def _card(application: Application, *, local_today: date, time_zone: ZoneInfo) -> dict[str, object]:
    return {
        "application": application,
        "stage_age_days": _stage_age_days(
            application, local_today=local_today, time_zone=time_zone
        ),
        "follow_up_state": _follow_up_state(application.follow_up_date, local_today=local_today),
    }


def _stage_age_days(
    application: Application, *, local_today: date, time_zone: ZoneInfo
) -> int | None:
    if application.status not in ACTIVE_PIPELINE_STATUSES or application.stage_entered_at is None:
        return None
    entered_on = application.stage_entered_at.astimezone(time_zone).date()
    return max(0, (local_today - entered_on).days)


def _follow_up_state(follow_up_date: date | None, *, local_today: date) -> str:
    if follow_up_date is None:
        return "NONE"
    if follow_up_date < local_today:
        return "OVERDUE"
    if follow_up_date == local_today:
        return "TODAY"
    return "UPCOMING"
