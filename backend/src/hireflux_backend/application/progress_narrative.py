from __future__ import annotations

from typing import cast

from hireflux_backend.application.search_health import MIN_RATE_SAMPLE

PERFORMANCE_ORDER = {
    "VOLUME_UP_INTERVIEW_DOWN": 0,
    "MOMENTUM_WITH_INTERVIEWS": 1,
    "SEARCH_CONVERTING": 2,
    "INTERVIEW_DECLINING": 3,
    "INTERVIEW_IMPROVING": 4,
    "VOLUME_UP_RESPONSE_DOWN": 5,
    "RESPONSE_DECLINING": 6,
    "RESPONSE_IMPROVING": 7,
    "MOMENTUM_DOWN": 8,
    "MOMENTUM_UP": 9,
}

SIGNAL_METRICS = {
    "VOLUME_UP_INTERVIEW_DOWN": ("SUBMISSIONS", "INTERVIEW_RATE"),
    "MOMENTUM_WITH_INTERVIEWS": ("SUBMISSIONS", "INTERVIEW_RATE"),
    "SEARCH_CONVERTING": ("RESPONSE_RATE", "INTERVIEW_RATE"),
    "INTERVIEW_DECLINING": ("INTERVIEW_RATE",),
    "INTERVIEW_IMPROVING": ("INTERVIEW_RATE",),
    "VOLUME_UP_RESPONSE_DOWN": ("SUBMISSIONS", "RESPONSE_RATE"),
    "RESPONSE_DECLINING": ("RESPONSE_RATE",),
    "RESPONSE_IMPROVING": ("RESPONSE_RATE",),
    "MOMENTUM_DOWN": ("SUBMISSIONS",),
    "MOMENTUM_UP": ("SUBMISSIONS",),
}

SIGNAL_DIRECTIONS = {
    "VOLUME_UP_INTERVIEW_DOWN": "MIXED",
    "MOMENTUM_WITH_INTERVIEWS": "MIXED",
    "SEARCH_CONVERTING": "IMPROVING",
    "INTERVIEW_DECLINING": "DECLINING",
    "INTERVIEW_IMPROVING": "IMPROVING",
    "VOLUME_UP_RESPONSE_DOWN": "MIXED",
    "RESPONSE_DECLINING": "DECLINING",
    "RESPONSE_IMPROVING": "IMPROVING",
    "MOMENTUM_DOWN": "DECLINING",
    "MOMENTUM_UP": "IMPROVING",
}


def build_progress_narrative(
    *,
    reporting_range: str,
    rates: dict[str, int | float],
    period_comparison: dict[str, object],
    performance_signals: list[dict[str, object]],
    insights: list[dict[str, object]],
    process_coverage: dict[str, int | float],
) -> dict[str, object]:
    submitted_count = int(rates["submitted_count"])
    primary = _primary_performance_signal(performance_signals) if reporting_range != "all" else None
    state = _state(reporting_range, submitted_count, period_comparison, primary)
    headline, explanation, tone = _summary(state, primary)

    return {
        "state": state,
        "tone": tone,
        "headline": headline,
        "explanation": explanation,
        "primary_signal": _primary_response(primary),
        "supporting_signals": _supporting_signals(period_comparison, primary),
        "process_health": _process_health(process_coverage),
        "recommended_focus": _recommended_focus(insights),
    }


def _primary_performance_signal(
    insights: list[dict[str, object]],
) -> dict[str, object] | None:
    eligible = [item for item in insights if str(item["code"]) in PERFORMANCE_ORDER]
    if not eligible:
        return None
    return min(
        eligible,
        key=lambda item: (
            PERFORMANCE_ORDER[str(item["code"])],
            -int(cast(int, item["priority"])),
            str(item["code"]),
        ),
    )


def _state(
    reporting_range: str,
    submitted_count: int,
    comparison: dict[str, object],
    primary: dict[str, object] | None,
) -> str:
    if reporting_range == "all":
        return "ALL_TIME"
    if submitted_count == 0:
        return "EMPTY"
    if primary is not None:
        return "READY"
    current = comparison.get("current")
    previous = comparison.get("previous")
    if isinstance(current, dict) and isinstance(previous, dict):
        current_count = int(cast(int | float, current["submitted_count"]))
        previous_count = int(cast(int | float, previous["submitted_count"]))
        if min(current_count, previous_count) < MIN_RATE_SAMPLE:
            return "LIMITED"
    return "READY"


def _summary(state: str, primary: dict[str, object] | None) -> tuple[str, str, str]:
    if primary is not None:
        return (
            str(primary["title"]),
            str(primary["description"]),
            _home_tone(str(primary["tone"])),
        )
    if state == "EMPTY":
        return (
            "Your recent progress picture is waiting for activity",
            "Submit and track applications to start seeing meaningful changes over time.",
            "NEUTRAL",
        )
    if state == "LIMITED":
        return (
            "Your recent search is still building a reliable pattern",
            (
                "The current numbers are useful context, but there is not enough "
                "comparison data for a strong conclusion yet."
            ),
            "NEUTRAL",
        )
    if state == "ALL_TIME":
        return (
            "Your complete tracked search history",
            (
                "All-time results show the full journey without treating separate periods "
                "as directly comparable."
            ),
            "NEUTRAL",
        )
    return (
        "Your recent search is holding relatively steady",
        "No meaningful performance change currently meets HireFlux's evidence thresholds.",
        "NEUTRAL",
    )


def _primary_response(primary: dict[str, object] | None) -> dict[str, object] | None:
    if primary is None:
        return None
    code = str(primary["code"])
    return {
        "code": code,
        "category": "PERFORMANCE" if code not in {"MOMENTUM_DOWN", "MOMENTUM_UP"} else "ACTIVITY",
        "direction": SIGNAL_DIRECTIONS[code],
        "priority": int(cast(int, primary["priority"])),
        "evidence_metric_keys": list(SIGNAL_METRICS[code]),
        "evidence_summary": str(primary["evidence_summary"]),
        "sample_label": cast(str | None, primary.get("evidence_label")),
    }


def _supporting_signals(
    comparison: dict[str, object], primary: dict[str, object] | None
) -> list[dict[str, str]]:
    deltas = comparison.get("deltas")
    primary_metrics = set(SIGNAL_METRICS.get(str(primary["code"]), ())) if primary else set()
    definitions = (
        ("SUBMISSIONS", "ACTIVITY", "submitted_count"),
        ("RESPONSE_RATE", "PERFORMANCE", "response_rate"),
        ("INTERVIEW_RATE", "PERFORMANCE", "interview_rate"),
    )
    signals: list[dict[str, str]] = []
    for metric_key, category, delta_key in definitions:
        value = deltas.get(delta_key) if isinstance(deltas, dict) else None
        direction = "NOT_AVAILABLE"
        if isinstance(value, int | float):
            direction = "IMPROVING" if value > 0 else "DECLINING" if value < 0 else "STABLE"
        signals.append(
            {
                "metric_key": metric_key,
                "category": category,
                "direction": direction,
                "emphasis": "PRIMARY" if metric_key in primary_metrics else "CONTEXT",
            }
        )
    return signals


def _process_health(coverage: dict[str, int | float]) -> dict[str, object]:
    active = int(coverage["active_count"])
    overdue = int(coverage["overdue_count"])
    due_today = int(coverage["due_today_count"])
    missing = int(coverage["missing_count"])
    if active == 0:
        tone = "NEUTRAL"
        summary = "There are no active opportunities to schedule yet."
    elif overdue or due_today:
        tone = "ACTION_NEEDED"
        summary = "Some active opportunities need follow-up attention now."
    elif missing:
        tone = "WATCH"
        summary = "Some active opportunities still need a clear next step."
    else:
        tone = "POSITIVE"
        summary = "Every active opportunity has a next step scheduled."
    return {"tone": tone, "summary": summary, **coverage}


def _recommended_focus(insights: list[dict[str, object]]) -> dict[str, object] | None:
    actionable = [item for item in insights if item.get("action") is not None]
    if not actionable:
        return None
    selected = min(
        actionable,
        key=lambda item: (
            0 if item["semantic_type"] == "action" else 1,
            -int(cast(int, item["priority"])),
            str(item["code"]),
        ),
    )
    return {
        "title": str(selected["title"]),
        "explanation": str(selected["description"]),
        "tone": _home_tone(str(selected["tone"])),
        "action": selected["action"],
    }


def _home_tone(tone: str) -> str:
    return {
        "ACTION_NEEDED": "ACTION_NEEDED",
        "WATCH": "WATCH",
        "POSITIVE": "POSITIVE",
        "INFO": "NEUTRAL",
    }[tone]
