from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal, cast
from zoneinfo import ZoneInfo

from hireflux_backend.application.source_strategy import SourceSignal
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus
from hireflux_backend.domain.models import Application

Category = Literal["momentum", "response", "pipeline", "follow_up", "source"]
Tone = Literal["ACTION_NEEDED", "WATCH", "INFO", "POSITIVE"]
SemanticType = Literal["action", "trend", "observation", "achievement"]
EvidenceStrength = Literal["LIMITED", "MODERATE", "STRONG"]

# Conservative product heuristics, not scientific or cross-user benchmarks.
MAX_INSIGHTS = 4
MIN_RATE_SAMPLE = 5
MIN_SOURCE_SAMPLE = 5
RATE_DELTA = 0.15
ACTIVE_STATUSES = frozenset(
    {
        ApplicationStatus.APPLIED,
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    }
)
STAGE_STALE_DAYS = {
    ApplicationStatus.APPLIED: 21,
    ApplicationStatus.SCREENING: 14,
    ApplicationStatus.INTERVIEW: 9,
}
STAGE_PRIORITIES = {
    ApplicationStatus.APPLIED: 60,
    ApplicationStatus.SCREENING: 64,
    ApplicationStatus.INTERVIEW: 68,
}


@dataclass(frozen=True, slots=True)
class Candidate:
    code: str
    category: Category
    semantic_type: SemanticType
    tone: Tone
    title: str
    description: str
    evidence_summary: str
    evidence: str
    evidence_strength: EvidenceStrength
    priority: int
    action: dict[str, object] | None = None
    evidence_label: str | None = None
    suppresses: frozenset[str] = field(default_factory=frozenset)

    def response(self) -> dict[str, object]:
        return {
            "code": self.code,
            "category": self.category,
            "semantic_type": self.semantic_type,
            "tone": self.tone,
            "title": self.title,
            "description": self.description,
            "evidence_summary": self.evidence_summary,
            "evidence": self.evidence,
            "evidence_strength": self.evidence_strength,
            "evidence_label": self.evidence_label,
            "priority": self.priority,
            "action": self.action,
        }


def submission_date(application: Application, time_zone: ZoneInfo) -> date | None:
    if application.submitted_at is None:
        return None
    return application.applied_date or application.submitted_at.astimezone(time_zone).date()


def build_search_health(
    applications: tuple[Application, ...],
    *,
    local_today: date,
    time_zone: ZoneInfo,
    period_comparison: dict[str, object],
    source_signal: SourceSignal | None = None,
) -> list[dict[str, object]]:
    submitted = tuple(item for item in applications if submission_date(item, time_zone))
    candidates = [
        *_follow_up(applications, local_today),
        *_pipeline(applications, local_today, time_zone),
        *_combined(period_comparison),
        *_interviews(period_comparison),
        *_momentum(submitted, local_today, time_zone),
        *_responses(submitted, local_today, time_zone),
        *_sources(submitted, source_signal=source_signal),
    ]
    if len(submitted) < MIN_RATE_SAMPLE:
        candidates.append(
            Candidate(
                "BUILD_SAMPLE",
                "response",
                "observation",
                "INFO",
                "Search Health is still building your picture",
                (
                    "Track a few more submitted applications to unlock stronger response, "
                    "momentum, and source comparisons. Valid follow-up and pipeline signals "
                    "still appear when they exist."
                ),
                f"{len(submitted)} submitted · trends begin at {MIN_RATE_SAMPLE}",
                (
                    f"Based on {len(submitted)} submitted "
                    f"{_plural(len(submitted), 'application')}; rate trends begin at "
                    f"{MIN_RATE_SAMPLE}."
                ),
                "LIMITED",
                20,
                _add_action(),
                "Early signal",
            )
        )
    selected = _rank(candidates)
    if not selected and len(submitted) >= MIN_RATE_SAMPLE:
        selected = [
            Candidate(
                "HEALTHY_PIPELINE",
                "pipeline",
                "observation",
                "POSITIVE",
                "No urgent search signal is visible",
                (
                    "Your tracked data does not currently meet an attention threshold. Keep "
                    "statuses and follow-up dates current so the picture stays useful."
                ),
                f"{len(submitted)} submitted applications reviewed",
                f"Search Health reviewed {len(submitted)} submitted applications.",
                "MODERATE",
                10,
            )
        ]
    return [item.response() for item in selected]


def build_progress_signals(period_comparison: dict[str, object]) -> list[dict[str, object]]:
    """Return uncapped, selected-period candidates for the Home narrative.

    Search Health intentionally caps and balances its cards across categories. Home has a
    different job: deterministically choose the strongest performance relationship for the
    selected range. Keeping these candidates uncapped prevents an unrelated source or process
    card from hiding a qualified conversion signal.
    """
    candidates = [
        *_combined(period_comparison),
        *_interviews(period_comparison),
        *_period_responses(period_comparison),
        *_period_activity(period_comparison),
    ]
    return [item.response() for item in candidates]


def _follow_up(applications: tuple[Application, ...], today: date) -> list[Candidate]:
    active = tuple(item for item in applications if item.status in ACTIVE_STATUSES)
    overdue = sum(bool(item.follow_up_date and item.follow_up_date < today) for item in active)
    missing = sum(item.follow_up_date is None for item in active)
    due_today = sum(item.follow_up_date == today for item in active)
    due_soon = sum(
        bool(item.follow_up_date and today < item.follow_up_date <= today + timedelta(days=3))
        for item in active
    )
    if not (overdue or due_today or missing or due_soon):
        return []
    detail_parts = []
    if overdue:
        detail_parts.append(f"{overdue} {_plural(overdue, 'follow-up')} overdue")
    if due_today:
        detail_parts.append(f"{due_today} due today")
    if due_soon:
        detail_parts.append(f"{due_soon} due in the next 3 days")
    if missing:
        detail_parts.append(f"{missing} without a next step scheduled")
    summary_parts = [
        f"{overdue} overdue" if overdue else "",
        f"{due_today} due today" if due_today else "",
        f"{due_soon} due soon" if due_soon else "",
        f"{missing} missing a next step" if missing else "",
    ]
    evidence_summary = " · ".join(part for part in summary_parts if part)
    if overdue:
        title = f"{overdue} {_plural(overdue, 'follow-up')} {_verb(overdue, 'is', 'are')} overdue"
        description = _missing_follow_up_context(missing)
        tone: Tone = "ACTION_NEEDED"
        priority = 100
    elif due_today:
        title = (
            f"{due_today} {_plural(due_today, 'follow-up')} "
            f"{_verb(due_today, 'is', 'are')} due today"
        )
        description = _missing_follow_up_context(missing)
        tone = "ACTION_NEEDED"
        priority = 92
    elif missing:
        title = (
            f"{missing} active {_plural(missing, 'application')} "
            f"{_verb(missing, 'needs', 'need')} a next step"
        )
        description = "Add a follow-up plan when you know what you want to do next."
        tone = "INFO"
        priority = 54
    else:
        title = (
            f"{due_soon} {_plural(due_soon, 'follow-up')} {_verb(due_soon, 'is', 'are')} coming up"
        )
        description = "These next steps are scheduled and do not require immediate attention."
        tone = "INFO"
        priority = 36
    action = (
        _view_action("Review follow-ups", view="ACTIVE", follow_up="NEEDS_ATTENTION")
        if overdue or due_today or missing
        else _view_action("Review active applications", view="ACTIVE")
    )
    return [
        Candidate(
            "FOLLOW_UP_ATTENTION",
            "follow_up",
            "action",
            tone,
            title,
            description,
            evidence_summary,
            f"{_join(detail_parts)} across {len(active)} active applications.",
            "STRONG",
            priority,
            action,
        )
    ]


def _pipeline(
    applications: tuple[Application, ...], today: date, time_zone: ZoneInfo
) -> list[Candidate]:
    stale: Counter[ApplicationStatus] = Counter()
    for item in applications:
        threshold = STAGE_STALE_DAYS.get(item.status)
        if threshold is None or item.stage_entered_at is None:
            continue
        age = max(0, (today - item.stage_entered_at.astimezone(time_zone).date()).days)
        if age >= threshold:
            stale[item.status] += 1
    if not stale:
        return []
    ordered = sorted(stale, key=STAGE_PRIORITIES.__getitem__, reverse=True)
    strongest = ordered[0]
    evidence = _join(
        [
            f"{stale[status]} in {status.value.title()} for at least "
            f"{STAGE_STALE_DAYS[status]} days"
            for status in ordered
        ]
    )
    count = sum(stale.values())
    summary = " · ".join(f"{stale[status]} {status.value.lower()}" for status in ordered)
    return [
        Candidate(
            "STALLED_PIPELINE",
            "pipeline",
            "action",
            "WATCH",
            f"{count} {_plural(count, 'application')} haven't moved recently",
            (
                "These stage ages may be worth reviewing, but they do not predict an "
                "employer's next decision."
            ),
            summary,
            f"{evidence}.",
            "MODERATE",
            STAGE_PRIORITIES[strongest],
            _view_action("Review pipeline", view="ACTIVE"),
        )
    ]


def _combined(comparison: dict[str, object]) -> list[Candidate]:
    values = _comparison_values(comparison)
    if values is None:
        return []
    (
        current_count,
        previous_count,
        current_response,
        previous_response,
        current_interview,
        previous_interview,
    ) = values
    down = previous_count - current_count >= 3 and current_count <= previous_count * 0.75
    up = current_count - previous_count >= 3 and current_count >= previous_count * 1.5
    if (
        min(current_count, previous_count) >= MIN_RATE_SAMPLE
        and up
        and previous_interview - current_interview >= RATE_DELTA
    ):
        return [
            Candidate(
                "VOLUME_UP_INTERVIEW_DOWN",
                "response",
                "trend",
                "WATCH",
                "More applications are reaching interviews less often",
                (
                    "You submitted more applications while interview conversion was lower. "
                    "The relationship matters more than either number by itself."
                ),
                f"{current_count} submissions · {current_interview:.0%} interview rate",
                (
                    f"{current_count} submissions at {current_interview:.0%} interview "
                    f"conversion versus {previous_count} at {previous_interview:.0%} previously."
                ),
                _comparison_strength(current_count, previous_count),
                _trend_priority(72, current_count, previous_count),
                _view_action("Review recent applications", view="ALL"),
                _sample_label(current_count, previous_count),
                frozenset(
                    {
                        "MOMENTUM_UP",
                        "INTERVIEW_DECLINING",
                        "VOLUME_UP_RESPONSE_DOWN",
                        "RESPONSE_DECLINING",
                    }
                ),
            )
        ]
    if (
        previous_count >= MIN_RATE_SAMPLE
        and current_count >= 3
        and down
        and current_interview - previous_interview >= RATE_DELTA
    ):
        return [
            Candidate(
                "MOMENTUM_WITH_INTERVIEWS",
                "momentum",
                "trend",
                "POSITIVE",
                "Application pace is lower, but the pipeline is moving deeper",
                (
                    "Submission volume fell while interview conversion increased. That "
                    "combination is more informative than application volume alone."
                ),
                f"{current_count} submissions · {current_interview:.0%} interview rate",
                (
                    f"{current_count} submissions versus {previous_count} previously; "
                    f"interview rate {current_interview:.0%} versus {previous_interview:.0%}."
                ),
                _comparison_strength(current_count, previous_count),
                78,
                evidence_label=_sample_label(current_count, previous_count),
                suppresses=frozenset({"MOMENTUM_DOWN", "RESPONSE_DECLINING"}),
            )
        ]
    if (
        min(current_count, previous_count) >= MIN_RATE_SAMPLE
        and up
        and previous_response - current_response >= RATE_DELTA
    ):
        return [
            Candidate(
                "VOLUME_UP_RESPONSE_DOWN",
                "response",
                "trend",
                "WATCH",
                "Higher application volume is converting less often",
                (
                    "You submitted more applications while the comparison-period response "
                    "rate was lower. This describes the tracked outcomes without assigning "
                    "a cause."
                ),
                f"{current_count} recent · {previous_count} previous",
                (
                    f"{current_count} submissions at {current_response:.0%} response versus "
                    f"{previous_count} at {previous_response:.0%} previously."
                ),
                _comparison_strength(current_count, previous_count),
                _trend_priority(66, current_count, previous_count),
                _view_action("Review recent applications", view="ALL"),
                _sample_label(current_count, previous_count),
                frozenset({"MOMENTUM_UP", "RESPONSE_DECLINING"}),
            )
        ]
    stable = abs(current_count - previous_count) <= 1
    if (
        min(current_count, previous_count) >= MIN_RATE_SAMPLE
        and stable
        and current_response - previous_response >= RATE_DELTA
        and current_interview - previous_interview >= RATE_DELTA
    ):
        return [
            Candidate(
                "SEARCH_CONVERTING",
                "response",
                "achievement",
                "POSITIVE",
                "Your recent search is converting more effectively",
                (
                    "Application volume stayed steady while both response and interview "
                    "rates improved."
                ),
                f"{current_response:.0%} response · {current_interview:.0%} interview",
                (
                    f"{current_count} submissions versus {previous_count}; response rate "
                    f"{current_response:.0%} versus {previous_response:.0%}, and interview "
                    f"rate {current_interview:.0%} versus {previous_interview:.0%}."
                ),
                _comparison_strength(current_count, previous_count),
                60,
                evidence_label=_sample_label(current_count, previous_count),
                suppresses=frozenset({"RESPONSE_IMPROVING"}),
            )
        ]
    return []


def _interviews(comparison: dict[str, object]) -> list[Candidate]:
    values = _comparison_values(comparison)
    if values is None:
        return []
    current_count, previous_count, _, _, current_rate, previous_rate = values
    if min(current_count, previous_count) < MIN_RATE_SAMPLE:
        return []
    delta = current_rate - previous_rate
    if abs(delta) < RATE_DELTA:
        return []
    improving = delta > 0
    return [
        Candidate(
            "INTERVIEW_IMPROVING" if improving else "INTERVIEW_DECLINING",
            "response",
            "trend",
            "POSITIVE" if improving else "WATCH",
            (
                "Recent applications are reaching interviews more often"
                if improving
                else "Recent applications are reaching interviews less often"
            ),
            (
                "Interview conversion improved across equal comparison periods."
                if improving
                else (
                    "Interview conversion declined across equal comparison periods. "
                    "Keep tracking to see whether the pattern continues."
                )
            ),
            f"{current_rate:.0%} recent · {previous_rate:.0%} previous",
            (
                f"{current_count} submissions at {current_rate:.0%} interview conversion, "
                f"compared with {previous_count} at {previous_rate:.0%} previously."
            ),
            _comparison_strength(current_count, previous_count),
            58 if improving else _trend_priority(68, current_count, previous_count),
            None if improving else _view_action("Review recent applications", view="ALL"),
            _sample_label(current_count, previous_count),
        )
    ]


def _period_responses(comparison: dict[str, object]) -> list[Candidate]:
    values = _comparison_values(comparison)
    if values is None:
        return []
    current_count, previous_count, current_response, previous_response, _, _ = values
    if min(current_count, previous_count) < MIN_RATE_SAMPLE:
        return []
    delta = current_response - previous_response
    if abs(delta) < RATE_DELTA:
        return []
    improving = delta > 0
    return [
        Candidate(
            "RESPONSE_IMPROVING" if improving else "RESPONSE_DECLINING",
            "response",
            "trend",
            "POSITIVE" if improving else "WATCH",
            (
                "Recent applications are getting more responses"
                if improving
                else "Recent response activity is lower"
            ),
            (
                "Response conversion improved across the selected equal-length periods."
                if improving
                else (
                    "Response conversion declined across the selected equal-length periods. "
                    "Keep tracking to see whether the pattern continues."
                )
            ),
            f"{current_response:.0%} recent · {previous_response:.0%} previous",
            (
                f"{current_count} submissions at {current_response:.0%} response conversion, "
                f"compared with {previous_count} at {previous_response:.0%} previously."
            ),
            _comparison_strength(current_count, previous_count),
            52 if improving else _trend_priority(62, current_count, previous_count),
            None if improving else _view_action("Review recent applications", view="ALL"),
            _sample_label(current_count, previous_count),
        )
    ]


def _period_activity(comparison: dict[str, object]) -> list[Candidate]:
    values = _comparison_values(comparison)
    if values is None:
        return []
    current_count, previous_count, _, _, _, _ = values
    down = (
        previous_count >= MIN_RATE_SAMPLE
        and previous_count - current_count >= 3
        and current_count <= previous_count * 0.75
    )
    up = (
        previous_count >= 3
        and current_count - previous_count >= 3
        and current_count >= previous_count * 1.5
    )
    if not (down or up):
        return []
    return [
        Candidate(
            "MOMENTUM_DOWN" if down else "MOMENTUM_UP",
            "momentum",
            "trend",
            "WATCH" if down else "POSITIVE",
            "Application activity has slowed" if down else "Application momentum has increased",
            (
                "Submission activity was lower across the selected equal-length periods."
                if down
                else "Submission activity was higher across the selected equal-length periods."
            ),
            f"{current_count} recent · {previous_count} previous",
            (
                f"{current_count} submissions in the selected period, compared with "
                f"{previous_count} in the previous equal-length period."
            ),
            _comparison_strength(current_count, previous_count),
            _trend_priority(56, current_count, previous_count) if down else 40,
            _add_action() if down else None,
            _sample_label(current_count, previous_count),
        )
    ]


def _comparison_values(
    comparison: dict[str, object],
) -> tuple[int, int, float, float, float, float] | None:
    if not comparison.get("available"):
        return None
    current = comparison.get("current")
    previous = comparison.get("previous")
    if not isinstance(current, dict) or not isinstance(previous, dict):
        return None
    return (
        int(cast(int | float, current["submitted_count"])),
        int(cast(int | float, previous["submitted_count"])),
        float(cast(int | float, current["response_rate"])),
        float(cast(int | float, previous["response_rate"])),
        float(cast(int | float, current["interview_rate"])),
        float(cast(int | float, previous["interview_rate"])),
    )


def _momentum(
    applications: tuple[Application, ...], today: date, time_zone: ZoneInfo
) -> list[Candidate]:
    current = _count_between(applications, today - timedelta(days=6), today, time_zone)
    previous = _count_between(
        applications, today - timedelta(days=13), today - timedelta(days=7), time_zone
    )
    if previous >= 5 and previous - current >= 3 and current <= previous * 0.75:
        return [
            Candidate(
                "MOMENTUM_DOWN",
                "momentum",
                "trend",
                "WATCH",
                "Application activity has slowed",
                (
                    "If you are actively searching, consider whether your weekly target or "
                    "available search time needs an adjustment."
                ),
                f"{current} this week · {previous} previous week",
                (
                    f"{current} submissions in the last 7 days, compared with {previous} "
                    "in the previous 7 days."
                ),
                _comparison_strength(current, previous),
                _trend_priority(56, current, previous),
                _add_action(),
                _sample_label(current, previous),
            )
        ]
    if previous >= 3 and current - previous >= 3 and current >= previous * 1.5:
        return [
            Candidate(
                "MOMENTUM_UP",
                "momentum",
                "trend",
                "POSITIVE",
                "Application momentum has increased",
                "You tracked a meaningfully higher submission pace this week.",
                f"{current} this week · {previous} previous week",
                (
                    f"{current} submissions in the last 7 days, compared with {previous} "
                    "in the previous 7 days."
                ),
                _comparison_strength(current, previous),
                40,
                evidence_label=_sample_label(current, previous),
            )
        ]
    return []


def _responses(
    applications: tuple[Application, ...], today: date, time_zone: ZoneInfo
) -> list[Candidate]:
    start = today - timedelta(days=29)
    recent = tuple(
        item
        for item in applications
        if (value := submission_date(item, time_zone)) is not None and start <= value <= today
    )
    historical = tuple(
        item
        for item in applications
        if (value := submission_date(item, time_zone)) is not None and value < start
    )
    if min(len(recent), len(historical)) < MIN_RATE_SAMPLE:
        return []
    recent_rate = _response_rate(recent)
    historical_rate = _response_rate(historical)
    overall_rate = _response_rate(applications)
    recent_responses = sum(item.first_response_at is not None for item in recent)
    historical_responses = sum(item.first_response_at is not None for item in historical)
    strength = _comparison_strength(len(recent), len(historical))
    label = _sample_label(len(recent), len(historical))
    evidence_summary = (
        f"{recent_responses} of {len(recent)} recent · "
        f"{historical_responses} of {len(historical)} earlier"
    )
    common = (
        f"{recent_rate:.0%} across {len(recent)} recent applications, compared with "
        f"{historical_rate:.0%} across {len(historical)} earlier applications "
        f"({overall_rate:.0%} overall)."
    )
    if recent_rate - historical_rate >= RATE_DELTA:
        return [
            Candidate(
                "RESPONSE_IMPROVING",
                "response",
                "trend",
                "POSITIVE",
                "Recent applications are getting more responses",
                "Your 30-day response rate is meaningfully above your earlier tracked baseline.",
                evidence_summary,
                common,
                strength,
                52,
                evidence_label=label,
            )
        ]
    if historical_rate - recent_rate >= RATE_DELTA:
        return [
            Candidate(
                "RESPONSE_DECLINING",
                "response",
                "trend",
                "WATCH",
                "Recent response activity is lower",
                (
                    f"{recent_responses} of your {len(recent)} most recent applications received "
                    f"a response, compared with {historical_responses} of the previous "
                    f"{len(historical)}. Keep tracking to see whether the pattern continues."
                ),
                evidence_summary,
                common,
                strength,
                _trend_priority(62, len(recent), len(historical)),
                _view_action("View applications", view="ALL"),
                label,
            )
        ]
    return []


def _sources(
    applications: tuple[Application, ...], *, source_signal: SourceSignal | None = None
) -> list[Candidate]:
    if source_signal is not None:
        code = {
            "STRONG_PERFORMER": "STRONG_SOURCE",
            "HIGH_VOLUME_LOW_RESPONSE": "HIGH_VOLUME_LOW_RESPONSE",
            "PROMISING_EARLY": "PROMISING_SOURCE",
            "CONCENTRATED_MIX": "SOURCE_CONCENTRATION",
            "LIMITED_DATA": "PROMISING_SOURCE",
        }[source_signal.code]
        return [
            Candidate(
                code,
                "source",
                "achievement" if source_signal.tone == "POSITIVE" else "observation",
                source_signal.tone,
                source_signal.title,
                source_signal.description,
                source_signal.evidence_summary,
                source_signal.evidence,
                source_signal.evidence_strength,
                source_signal.priority,
                _view_action(
                    f"View {source_signal.source.value.replace('_', ' ').lower()} applications",
                    view="ALL",
                    source=source_signal.source.value,
                ),
                source_signal.evidence_label,
            )
        ]
    overall = _response_rate(applications)
    grouped: defaultdict[ApplicationSource, list[Application]] = defaultdict(list)
    for item in applications:
        if item.source:
            grouped[item.source].append(item)
    eligible = [
        (source, tuple(items), _response_rate(tuple(items)))
        for source, items in grouped.items()
        if len(items) >= MIN_SOURCE_SAMPLE
        and _response_rate(tuple(items)) >= max(0.4, overall + RATE_DELTA)
    ]
    if not eligible:
        return []
    source, items, rate = max(eligible, key=lambda row: (row[2], len(row[1]), row[0].value))
    responses = sum(item.first_response_at is not None for item in items)
    label = source.value.replace("_", " ").title()
    return [
        Candidate(
            "STRONG_SOURCE",
            "source",
            "achievement",
            "POSITIVE",
            f"{label} is outperforming your overall search",
            "This source has a meaningfully stronger response rate within your own tracked data.",
            f"{responses} of {len(items)} responded · {overall:.0%} overall",
            (
                f"{responses} of {len(items)} {label.lower()} applications received a response "
                f"({rate:.0%}), compared with {overall:.0%} overall. Based on "
                f"{len(items)} applications."
            ),
            _single_sample_strength(len(items)),
            45,
            _view_action(f"View {label.lower()} applications", view="ALL", source=source.value),
            _single_sample_label(len(items)),
        )
    ]


def _rank(candidates: list[Candidate]) -> list[Candidate]:
    suppressed: set[str] = set()
    eligible: list[Candidate] = []
    for candidate in sorted(candidates, key=lambda item: (-item.priority, item.code)):
        if candidate.code in suppressed:
            continue
        eligible.append(candidate)
        suppressed.update(candidate.suppresses)

    actions = [item for item in eligible if item.tone == "ACTION_NEEDED"]
    context = [item for item in eligible if item.tone in {"WATCH", "INFO"}]
    positive = [item for item in eligible if item.tone == "POSITIVE"]
    selected = [*actions[:1], *context[:2], *positive[:1]]
    for candidate in eligible:
        if len(selected) == MAX_INSIGHTS:
            break
        if candidate not in selected:
            selected.append(candidate)
    return sorted(selected, key=lambda item: (-item.priority, item.code))


def _count_between(
    applications: tuple[Application, ...], start: date, end: date, time_zone: ZoneInfo
) -> int:
    return sum(
        (value := submission_date(item, time_zone)) is not None and start <= value <= end
        for item in applications
    )


def _response_rate(applications: tuple[Application, ...]) -> float:
    return (
        sum(item.first_response_at is not None for item in applications) / len(applications)
        if applications
        else 0.0
    )


def _view_action(label: str, **parameters: str) -> dict[str, object]:
    return {"kind": "VIEW_APPLICATIONS", "label": label, "parameters": parameters}


def _add_action() -> dict[str, object]:
    return {"kind": "ADD_APPLICATION", "label": "Add application", "parameters": {}}


def _comparison_strength(current: int, previous: int) -> EvidenceStrength:
    return _single_sample_strength(min(current, previous))


def _single_sample_strength(size: int) -> EvidenceStrength:
    if size < 10:
        return "LIMITED"
    if size < 20:
        return "MODERATE"
    return "STRONG"


def _sample_label(current: int, previous: int) -> str:
    total = current + previous
    prefix = "Early signal · " if _comparison_strength(current, previous) == "LIMITED" else ""
    return f"{prefix}Based on {total} applications"


def _single_sample_label(size: int) -> str:
    prefix = "Early signal · " if _single_sample_strength(size) == "LIMITED" else ""
    return f"{prefix}Based on {size} applications"


def _trend_priority(base: int, current: int, previous: int) -> int:
    strength_bonus = {"LIMITED": 0, "MODERATE": 4, "STRONG": 8}
    return base + strength_bonus[_comparison_strength(current, previous)]


def _missing_follow_up_context(missing: int) -> str:
    if missing == 0:
        return "Review the affected applications and update the next step when it is complete."
    return (
        f"{missing} other active {_plural(missing, 'application')} "
        f"{_verb(missing, 'does', 'do')} not have a next step scheduled."
    )


def _verb(count: int, singular: str, plural: str) -> str:
    return singular if count == 1 else plural


def _plural(count: int, noun: str) -> str:
    return noun if count == 1 else f"{noun}s"


def _join(parts: list[str]) -> str:
    if len(parts) < 2:
        return parts[0] if parts else ""
    if len(parts) == 2:
        return f"{parts[0]} and {parts[1]}"
    return f"{', '.join(parts[:-1])}, and {parts[-1]}"
