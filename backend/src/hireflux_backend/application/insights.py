from collections import Counter, defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from hireflux_backend.application.ports import ApplicationRepository
from hireflux_backend.application.resource_services import WorkspaceResourceService
from hireflux_backend.application.services import utc_now
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus, WorkMode
from hireflux_backend.domain.models import Application, CurrentIdentity

ACTIVE_PURSUIT_STATUSES = frozenset(
    {
        ApplicationStatus.APPLIED,
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    }
)
RESPONSE_STATUSES = frozenset(
    {
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.REJECTED,
    }
)
REPORTING_RANGES = frozenset({"30d", "90d", "all"})


@dataclass(frozen=True, slots=True)
class InsightFilters:
    status: ApplicationStatus | None = None
    source: ApplicationSource | None = None
    work_mode: WorkMode | None = None


class InsightsService:
    def __init__(
        self,
        repository: ApplicationRepository,
        *,
        resource_service: WorkspaceResourceService | None = None,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._repository = repository
        self._resource_service = resource_service
        self._clock = clock

    def dashboard(self, identity: CurrentIdentity, *, reporting_range: str) -> dict[str, object]:
        now = self._clock().astimezone(UTC)
        workspace_time_zone = (
            ZoneInfo(self._resource_service.get_settings(identity).time_zone)
            if self._resource_service is not None
            else ZoneInfo("UTC")
        )
        local_today = now.astimezone(workspace_time_zone).date()
        applications = self._repository.list_all(identity.user_id)
        submitted = _submitted_in_range(applications, reporting_range, now)
        status_counts = self._repository.get_status_counts(identity.user_id)
        funnel_counts = self._repository.get_funnel_counts(identity.user_id)
        upcoming = (
            self._resource_service.list_owner_interviews(identity, limit=5)
            if self._resource_service is not None
            else ()
        )
        due_follow_ups = self._repository.list_follow_ups_due(
            identity.user_id, due_on_or_before=local_today, limit=100
        )
        actions = _actions(applications, due_follow_ups, now, local_today)
        for interview in upcoming:
            if interview.scheduled_at <= now + timedelta(hours=24):
                actions.append(
                    {
                        "kind": "INTERVIEW_SOON",
                        "application_id": interview.application_id,
                        "company_name": interview.company_name,
                        "job_title": interview.job_title,
                        "due_date": None,
                        "due_at": interview.scheduled_at,
                        "priority": "HIGH",
                        "label": "Prepare for upcoming interview",
                    }
                )
        actions.sort(key=_action_sort_key)
        return {
            "range": reporting_range,
            "generated_at": now,
            "summary": _summary_from_counts(status_counts),
            "rates": (
                _rates_from_counts(funnel_counts) if reporting_range == "all" else _rates(submitted)
            ),
            "actions": actions,
            "upcoming_interviews": list(upcoming),
            "recent_applications": [
                application
                for application in applications
                if application.status is not ApplicationStatus.ARCHIVED
            ][:5],
            "submission_trend": _submission_trend(submitted, now=now, fixed_weeks=8),
            "status_breakdown": _status_breakdown(applications),
        }

    def analytics(
        self,
        identity: CurrentIdentity,
        *,
        reporting_range: str,
        filters: InsightFilters,
    ) -> dict[str, object]:
        now = self._clock().astimezone(UTC)
        all_applications = self._repository.list_all(identity.user_id)
        filtered = tuple(
            item
            for item in all_applications
            if (filters.status is None or item.status is filters.status)
            and (filters.source is None or item.source is filters.source)
            and (filters.work_mode is None or item.work_mode is filters.work_mode)
        )
        submitted = _submitted_in_range(filtered, reporting_range, now)
        current_population = _current_population_in_range(filtered, reporting_range, now)
        rates = _rates(submitted)
        response_days = [
            (item.first_response_at - item.submitted_at).total_seconds() / 86_400
            for item in submitted
            if item.first_response_at is not None and item.submitted_at is not None
        ]
        return {
            "range": reporting_range,
            "filters": {
                "status": filters.status,
                "source": filters.source,
                "work_mode": filters.work_mode,
            },
            "generated_at": now,
            "summary": _summary(current_population),
            "rates": rates,
            "status_breakdown": _status_breakdown(current_population),
            "submission_trend": _submission_trend(submitted, now=now),
            "funnel": _funnel(submitted),
            "stage_aging": _stage_aging(current_population, now),
            "source_performance": _source_performance(submitted),
            "work_mode_breakdown": _work_mode_breakdown(submitted),
            "average_days_to_first_response": (
                round(sum(response_days) / len(response_days), 1) if response_days else None
            ),
            "no_response_count": sum(item.first_response_at is None for item in submitted),
            "disclaimer": (
                "These analytics describe this demo workspace dataset and are not career "
                "predictions. Source comparisons require at least three submitted applications."
            ),
        }


def _submitted_in_range(
    applications: tuple[Application, ...], reporting_range: str, now: datetime
) -> tuple[Application, ...]:
    if reporting_range not in REPORTING_RANGES:
        raise ValueError("Unsupported reporting range.")
    cutoff = None
    if reporting_range != "all":
        cutoff = now - timedelta(days=int(reporting_range.removesuffix("d")))
    return tuple(
        item
        for item in applications
        if item.submitted_at is not None and (cutoff is None or item.submitted_at >= cutoff)
    )


def _current_population_in_range(
    applications: tuple[Application, ...], reporting_range: str, now: datetime
) -> tuple[Application, ...]:
    if reporting_range not in REPORTING_RANGES:
        raise ValueError("Unsupported reporting range.")
    if reporting_range == "all":
        return applications
    cutoff = now - timedelta(days=int(reporting_range.removesuffix("d")))
    return tuple(
        item
        for item in applications
        if item.status is ApplicationStatus.DRAFT
        or (item.submitted_at is not None and item.submitted_at >= cutoff)
    )


def _summary(applications: tuple[Application, ...]) -> dict[str, int]:
    counts = Counter(item.status for item in applications)
    return {
        "total_tracked": len(applications),
        "active_pursuits": sum(counts[status] for status in ACTIVE_PURSUIT_STATUSES),
        "drafts": counts[ApplicationStatus.DRAFT],
        "accepted": counts[ApplicationStatus.ACCEPTED],
        "rejected": counts[ApplicationStatus.REJECTED],
        "withdrawn": counts[ApplicationStatus.WITHDRAWN],
        "archived": counts[ApplicationStatus.ARCHIVED],
    }


def _summary_from_counts(counts: dict[ApplicationStatus, int]) -> dict[str, int]:
    return {
        "total_tracked": sum(counts.values()),
        "active_pursuits": sum(counts[status] for status in ACTIVE_PURSUIT_STATUSES),
        "drafts": counts[ApplicationStatus.DRAFT],
        "accepted": counts[ApplicationStatus.ACCEPTED],
        "rejected": counts[ApplicationStatus.REJECTED],
        "withdrawn": counts[ApplicationStatus.WITHDRAWN],
        "archived": counts[ApplicationStatus.ARCHIVED],
    }


def _rates(applications: tuple[Application, ...]) -> dict[str, int | float]:
    submitted_count = len(applications)
    response_count = sum(item.first_response_at is not None for item in applications)
    interview_count = sum(item.first_interview_at is not None for item in applications)
    offer_count = sum(item.first_offer_at is not None for item in applications)
    acceptance_count = sum(item.first_acceptance_at is not None for item in applications)

    def ratio(numerator: int) -> float:
        return round(numerator / submitted_count, 4) if submitted_count else 0.0

    return {
        "submitted_count": submitted_count,
        "response_count": response_count,
        "response_rate": ratio(response_count),
        "interview_count": interview_count,
        "interview_rate": ratio(interview_count),
        "offer_count": offer_count,
        "offer_rate": ratio(offer_count),
        "acceptance_count": acceptance_count,
        "acceptance_rate": ratio(acceptance_count),
    }


def _rates_from_counts(counts: dict[str, int]) -> dict[str, int | float]:
    submitted_count = counts.get("submitted_count", 0)

    def ratio(key: str) -> float:
        count = counts.get(key, 0)
        return round(count / submitted_count, 4) if submitted_count else 0.0

    return {
        "submitted_count": submitted_count,
        "response_count": counts.get("response_count", 0),
        "response_rate": ratio("response_count"),
        "interview_count": counts.get("interview_count", 0),
        "interview_rate": ratio("interview_count"),
        "offer_count": counts.get("offer_count", 0),
        "offer_rate": ratio("offer_count"),
        "acceptance_count": counts.get("acceptance_count", 0),
        "acceptance_rate": ratio("acceptance_count"),
    }


def _actions(
    applications: tuple[Application, ...],
    due_follow_ups: tuple[Application, ...],
    now: datetime,
    local_today: date,
) -> list[dict[str, object]]:
    actions: list[dict[str, object]] = []
    for application in due_follow_ups:
        if application.follow_up_date is not None:
            overdue = application.follow_up_date < local_today
            actions.append(
                {
                    "kind": "FOLLOW_UP_OVERDUE" if overdue else "FOLLOW_UP_TODAY",
                    "application_id": application.application_id,
                    "company_name": application.company_name,
                    "job_title": application.job_title,
                    "due_date": application.follow_up_date,
                    "due_at": None,
                    "priority": "HIGH" if overdue else "MEDIUM",
                    "label": "Complete overdue follow-up" if overdue else "Follow up today",
                }
            )
    for application in applications:
        if application.status is ApplicationStatus.ARCHIVED:
            continue
        if (
            application.status in {ApplicationStatus.APPLIED, ApplicationStatus.SCREENING}
            and application.stage_entered_at is not None
            and application.stage_entered_at <= now - timedelta(days=14)
        ):
            actions.append(
                {
                    "kind": "STALE_APPLICATION",
                    "application_id": application.application_id,
                    "company_name": application.company_name,
                    "job_title": application.job_title,
                    "due_date": None,
                    "due_at": application.stage_entered_at + timedelta(days=14),
                    "priority": "LOW",
                    "label": "Review application with no recent progress",
                }
            )
    return sorted(actions, key=_action_sort_key)


def _action_sort_key(item: dict[str, object]) -> tuple[int, str]:
    priorities = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    due = item.get("due_date") or item.get("due_at")
    due_text = due.isoformat() if isinstance(due, (date, datetime)) else ""
    return priorities[str(item["priority"])], due_text


def _status_breakdown(applications: tuple[Application, ...]) -> list[dict[str, object]]:
    counts = Counter(item.status for item in applications)
    return [{"status": status, "count": counts[status]} for status in ApplicationStatus]


def _submission_trend(
    applications: tuple[Application, ...], *, now: datetime, fixed_weeks: int | None = None
) -> list[dict[str, object]]:
    end_week = now.date() - timedelta(days=now.weekday())
    if fixed_weeks is not None:
        first_week = end_week - timedelta(weeks=fixed_weeks - 1)
    elif applications:
        earliest = min(item.submitted_at for item in applications if item.submitted_at)
        assert earliest is not None
        first_week = earliest.date() - timedelta(days=earliest.weekday())
    else:
        first_week = end_week
    counts: Counter[date] = Counter()
    for item in applications:
        if item.submitted_at is not None:
            week = item.submitted_at.date() - timedelta(days=item.submitted_at.weekday())
            counts[week] += 1
    points: list[dict[str, object]] = []
    week = first_week
    while week <= end_week:
        points.append({"week_start": week, "count": counts[week]})
        week += timedelta(weeks=1)
    return points


def _funnel(applications: tuple[Application, ...]) -> list[dict[str, object]]:
    submitted = len(applications)
    stages = (
        ("SUBMITTED", submitted),
        ("RESPONSE", sum(item.first_response_at is not None for item in applications)),
        ("INTERVIEW", sum(item.first_interview_at is not None for item in applications)),
        ("OFFER", sum(item.first_offer_at is not None for item in applications)),
        ("ACCEPTED", sum(item.first_acceptance_at is not None for item in applications)),
    )
    return [
        {
            "stage": stage,
            "count": count,
            "rate": round(count / submitted, 4) if submitted else 0.0,
        }
        for stage, count in stages
    ]


def _stage_aging(applications: tuple[Application, ...], now: datetime) -> list[dict[str, object]]:
    buckets = {"0-7": 0, "8-14": 0, "15-30": 0, "31+": 0}
    for item in applications:
        if item.status not in ACTIVE_PURSUIT_STATUSES or item.stage_entered_at is None:
            continue
        days = max(0, (now.date() - item.stage_entered_at.date()).days)
        key = "0-7" if days <= 7 else "8-14" if days <= 14 else "15-30" if days <= 30 else "31+"
        buckets[key] += 1
    return [{"bucket": key, "count": count} for key, count in buckets.items()]


def _source_performance(applications: tuple[Application, ...]) -> list[dict[str, object]]:
    grouped: defaultdict[ApplicationSource, list[Application]] = defaultdict(list)
    for item in applications:
        if item.source is not None:
            grouped[item.source].append(item)
    performance: list[dict[str, object]] = []
    for source in ApplicationSource:
        items = tuple(grouped[source])
        metrics = _rates(items)
        performance.append(
            {
                "source": source,
                **metrics,
                "sample_sufficient": len(items) >= 3,
            }
        )
    return performance


def _work_mode_breakdown(applications: tuple[Application, ...]) -> list[dict[str, object]]:
    counts = Counter(item.work_mode for item in applications)
    return [{"work_mode": mode, "count": counts[mode]} for mode in WorkMode]
