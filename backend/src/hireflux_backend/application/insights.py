from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import cast
from zoneinfo import ZoneInfo

from hireflux_backend.application.ports import ApplicationRepository
from hireflux_backend.application.progress_narrative import build_progress_narrative
from hireflux_backend.application.resource_services import WorkspaceResourceService
from hireflux_backend.application.search_health import (
    build_progress_signals,
    build_search_health,
    submission_date,
)
from hireflux_backend.application.services import utc_now
from hireflux_backend.application.source_strategy import build_source_strategy
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
        workspace_time_zone = _workspace_time_zone(self._resource_service, identity)
        local_today = now.astimezone(workspace_time_zone).date()
        applications = self._repository.list_all(identity.user_id)
        submitted = _submitted_in_range(
            applications,
            reporting_range,
            today=local_today,
            time_zone=workspace_time_zone,
        )
        status_counts = self._repository.get_status_counts(identity.user_id)
        funnel_counts = self._repository.get_funnel_counts(identity.user_id)
        upcoming_items = (
            self._resource_service.list_owner_interviews(identity, limit=5)
            if self._resource_service is not None
            else ()
        )
        upcoming = tuple(item.interview for item in upcoming_items)
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
            "submission_trend": _submission_trend(
                submitted,
                today=local_today,
                time_zone=workspace_time_zone,
                fixed_weeks=8,
            ),
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
        workspace_time_zone = _workspace_time_zone(self._resource_service, identity)
        local_today = now.astimezone(workspace_time_zone).date()
        all_applications = self._repository.list_all(identity.user_id)
        filtered = tuple(
            item
            for item in all_applications
            if (filters.status is None or item.status is filters.status)
            and (filters.source is None or item.source is filters.source)
            and (filters.work_mode is None or item.work_mode is filters.work_mode)
        )
        submitted = _submitted_in_range(
            filtered,
            reporting_range,
            today=local_today,
            time_zone=workspace_time_zone,
        )
        current_population = _current_population_in_range(
            filtered,
            reporting_range,
            today=local_today,
            time_zone=workspace_time_zone,
        )
        rates = _rates(submitted)
        response_days = [
            (item.first_response_at - item.submitted_at).total_seconds() / 86_400
            for item in submitted
            if item.first_response_at is not None
            and item.submitted_at is not None
            and item.first_response_at >= item.submitted_at
        ]
        period_comparison = _period_comparison(
            filtered,
            reporting_range,
            today=local_today,
            time_zone=workspace_time_zone,
        )
        source_period, recent_sources, previous_sources = _source_period(
            filtered,
            reporting_range,
            today=local_today,
            time_zone=workspace_time_zone,
        )
        follow_up_coverage = _follow_up_coverage(current_population, local_today)
        # Process health intentionally remains workspace-wide. Analytics filters
        # narrow performance evidence, but they must not make active follow-up
        # obligations disappear from the Home narrative.
        workspace_process_coverage = _follow_up_coverage(all_applications, local_today)
        source_performance, source_summary, source_signal = build_source_strategy(
            submitted,
            recent_applications=recent_sources,
            previous_applications=previous_sources,
        )
        stage_aging = _stage_aging(
            current_population,
            now,
            time_zone=workspace_time_zone,
        )
        insights = build_search_health(
            filtered,
            local_today=local_today,
            time_zone=workspace_time_zone,
            period_comparison=period_comparison,
            source_signal=source_signal,
        )
        progress_narrative = build_progress_narrative(
            reporting_range=reporting_range,
            rates=rates,
            period_comparison=period_comparison,
            performance_signals=build_progress_signals(period_comparison),
            insights=insights,
            process_coverage=workspace_process_coverage,
        )
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
            "submission_trend": _submission_trend(
                submitted,
                today=local_today,
                time_zone=workspace_time_zone,
            ),
            "funnel": _funnel(submitted),
            "stage_aging": stage_aging,
            "source_performance": source_performance,
            "source_period": source_period,
            "source_summary": source_summary,
            "work_mode_breakdown": _work_mode_breakdown(submitted),
            "average_days_to_first_response": (
                round(sum(response_days) / len(response_days), 1) if response_days else None
            ),
            "no_response_count": sum(item.first_response_at is None for item in submitted),
            "period_comparison": period_comparison,
            "follow_up_coverage": follow_up_coverage,
            "insights": insights,
            "progress_narrative": progress_narrative,
            "disclaimer": (
                "These analytics describe this demo workspace dataset and are not career "
                "predictions. Rate-based Search Health signals require meaningful sample sizes."
            ),
        }


def _submitted_in_range(
    applications: tuple[Application, ...],
    reporting_range: str,
    *,
    today: date,
    time_zone: ZoneInfo,
) -> tuple[Application, ...]:
    if reporting_range not in REPORTING_RANGES:
        raise ValueError("Unsupported reporting range.")
    cutoff = None
    if reporting_range != "all":
        cutoff = today - timedelta(days=int(reporting_range.removesuffix("d")))
    return tuple(
        item
        for item in applications
        if (submission_date := _submission_date(item, time_zone)) is not None
        and (cutoff is None or submission_date >= cutoff)
    )


def _current_population_in_range(
    applications: tuple[Application, ...],
    reporting_range: str,
    *,
    today: date,
    time_zone: ZoneInfo,
) -> tuple[Application, ...]:
    if reporting_range not in REPORTING_RANGES:
        raise ValueError("Unsupported reporting range.")
    if reporting_range == "all":
        return applications
    cutoff = today - timedelta(days=int(reporting_range.removesuffix("d")))
    return tuple(
        item
        for item in applications
        if item.status is ApplicationStatus.DRAFT
        or (
            (submission_date := _submission_date(item, time_zone)) is not None
            and submission_date >= cutoff
        )
    )


def _source_period(
    applications: tuple[Application, ...],
    reporting_range: str,
    *,
    today: date,
    time_zone: ZoneInfo,
) -> tuple[dict[str, object], tuple[Application, ...], tuple[Application, ...]]:
    days = 30 if reporting_range == "all" else int(reporting_range.removesuffix("d"))
    current_start = today - timedelta(days=days)
    current_end = today
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days)

    def in_window(application: Application, start: date, end: date) -> bool:
        submitted_on = _submission_date(application, time_zone)
        return submitted_on is not None and start <= submitted_on <= end

    recent = tuple(item for item in applications if in_window(item, current_start, current_end))
    previous = tuple(item for item in applications if in_window(item, previous_start, previous_end))
    return (
        {
            "label": "Last 30 days" if reporting_range == "all" else "Selected range",
            "current_start": current_start,
            "current_end": current_end,
            "previous_start": previous_start,
            "previous_end": previous_end,
        },
        recent,
        previous,
    )


def _workspace_time_zone(
    resource_service: WorkspaceResourceService | None,
    identity: CurrentIdentity,
) -> ZoneInfo:
    if resource_service is None:
        return ZoneInfo("UTC")
    return ZoneInfo(resource_service.get_settings(identity).time_zone)


def _submission_date(application: Application, time_zone: ZoneInfo) -> date | None:
    """Return the canonical business date for a submitted application.

    `submitted_at` remains the exact server instant used for elapsed-time metrics.
    The user-entered `applied_date` is the stable calendar date used for reporting
    windows and trends, including when a draft is later submitted.
    """
    return submission_date(application, time_zone)


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


def _average_days_to_first_response(applications: tuple[Application, ...]) -> float | None:
    response_days = [
        (item.first_response_at - item.submitted_at).total_seconds() / 86_400
        for item in applications
        if item.first_response_at is not None
        and item.submitted_at is not None
        and item.first_response_at >= item.submitted_at
    ]
    return round(sum(response_days) / len(response_days), 1) if response_days else None


def _period_metrics(applications: tuple[Application, ...]) -> dict[str, int | float | None]:
    rates = _rates(applications)
    return {
        "submitted_count": rates["submitted_count"],
        "response_rate": rates["response_rate"],
        "interview_rate": rates["interview_rate"],
        "offer_rate": rates["offer_rate"],
        "acceptance_rate": rates["acceptance_rate"],
        "average_days_to_first_response": _average_days_to_first_response(applications),
    }


def _period_comparison(
    applications: tuple[Application, ...],
    reporting_range: str,
    *,
    today: date,
    time_zone: ZoneInfo,
) -> dict[str, object]:
    if reporting_range == "all":
        return {
            "available": False,
            "current_start": None,
            "current_end": None,
            "previous_start": None,
            "previous_end": None,
            "current": None,
            "previous": None,
            "deltas": None,
        }

    range_days = int(reporting_range.removesuffix("d"))
    current_start = today - timedelta(days=range_days)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=range_days)

    def in_window(item: Application, start: date, end: date) -> bool:
        submitted_on = _submission_date(item, time_zone)
        return submitted_on is not None and start <= submitted_on <= end

    current_items = tuple(item for item in applications if in_window(item, current_start, today))
    previous_items = tuple(
        item for item in applications if in_window(item, previous_start, previous_end)
    )
    current = _period_metrics(current_items)
    previous = _period_metrics(previous_items)
    current_average = current["average_days_to_first_response"]
    previous_average = previous["average_days_to_first_response"]
    average_delta = (
        round(float(current_average) - float(previous_average), 1)
        if current_average is not None and previous_average is not None
        else None
    )
    deltas: dict[str, int | float | None] = {
        "submitted_count": int(cast(int | float, current["submitted_count"]))
        - int(cast(int | float, previous["submitted_count"])),
        "response_rate": round(
            float(cast(int | float, current["response_rate"]))
            - float(cast(int | float, previous["response_rate"])),
            4,
        ),
        "interview_rate": round(
            float(cast(int | float, current["interview_rate"]))
            - float(cast(int | float, previous["interview_rate"])),
            4,
        ),
        "offer_rate": round(
            float(cast(int | float, current["offer_rate"]))
            - float(cast(int | float, previous["offer_rate"])),
            4,
        ),
        "acceptance_rate": round(
            float(cast(int | float, current["acceptance_rate"]))
            - float(cast(int | float, previous["acceptance_rate"])),
            4,
        ),
        "average_days_to_first_response": average_delta,
    }
    return {
        "available": True,
        "current_start": current_start,
        "current_end": today,
        "previous_start": previous_start,
        "previous_end": previous_end,
        "current": current,
        "previous": previous,
        "deltas": deltas,
    }


def _follow_up_coverage(
    applications: tuple[Application, ...], local_today: date
) -> dict[str, int | float]:
    active = tuple(item for item in applications if item.status in ACTIVE_PURSUIT_STATUSES)
    scheduled = tuple(item for item in active if item.follow_up_date is not None)
    return {
        "active_count": len(active),
        "scheduled_count": len(scheduled),
        "coverage_rate": round(len(scheduled) / len(active), 4) if active else 0.0,
        "overdue_count": sum(
            item.follow_up_date is not None and item.follow_up_date < local_today for item in active
        ),
        "due_today_count": sum(item.follow_up_date == local_today for item in active),
        "missing_count": len(active) - len(scheduled),
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
    applications: tuple[Application, ...],
    *,
    today: date,
    time_zone: ZoneInfo,
    fixed_weeks: int | None = None,
) -> list[dict[str, object]]:
    end_week = today - timedelta(days=today.weekday())
    submission_dates = [
        submission_date
        for application in applications
        if (submission_date := _submission_date(application, time_zone)) is not None
    ]
    if fixed_weeks is not None:
        first_week = end_week - timedelta(weeks=fixed_weeks - 1)
    elif submission_dates:
        earliest = min(submission_dates)
        first_week = earliest - timedelta(days=earliest.weekday())
    else:
        first_week = end_week
    counts: Counter[date] = Counter()
    for submission_date in submission_dates:
        week = submission_date - timedelta(days=submission_date.weekday())
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


def _stage_aging(
    applications: tuple[Application, ...],
    now: datetime,
    *,
    time_zone: ZoneInfo,
) -> list[dict[str, object]]:
    buckets = {"0-7": 0, "8-14": 0, "15-30": 0, "31+": 0}
    today = now.astimezone(time_zone).date()
    for item in applications:
        if item.status not in ACTIVE_PURSUIT_STATUSES or item.stage_entered_at is None:
            continue
        entered_date = item.stage_entered_at.astimezone(time_zone).date()
        days = max(0, (today - entered_date).days)
        key = "0-7" if days <= 7 else "8-14" if days <= 14 else "15-30" if days <= 30 else "31+"
        buckets[key] += 1
    return [{"bucket": key, "count": count} for key, count in buckets.items()]


def _work_mode_breakdown(applications: tuple[Application, ...]) -> list[dict[str, object]]:
    counts = Counter(item.work_mode for item in applications)
    return [{"work_mode": mode, "count": counts[mode]} for mode in WorkMode]
