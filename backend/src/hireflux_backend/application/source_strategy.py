from collections import defaultdict
from dataclasses import dataclass
from typing import Literal, cast

from hireflux_backend.domain.enums import ApplicationSource
from hireflux_backend.domain.models import Application

MIN_TABLE_SAMPLE = 3
MIN_SOURCE_SAMPLE = 5
MIN_PROMISING_SAMPLE = 2
RATE_DELTA = 0.15
MIN_STRONG_RESPONSE_RATE = 0.4
HIGH_VOLUME_SHARE = 0.3
CONCENTRATION_THRESHOLD = 0.5

SourceSignalCode = Literal[
    "STRONG_PERFORMER",
    "HIGH_VOLUME_LOW_RESPONSE",
    "PROMISING_EARLY",
    "CONCENTRATED_MIX",
    "LIMITED_DATA",
]
RecentDirection = Literal["IMPROVING", "DECLINING", "STABLE"]


@dataclass(frozen=True, slots=True)
class SourceSignal:
    code: SourceSignalCode
    source: ApplicationSource
    title: str
    description: str
    evidence_summary: str
    evidence: str
    tone: Literal["WATCH", "INFO", "POSITIVE"]
    priority: int
    evidence_strength: Literal["LIMITED", "MODERATE", "STRONG"]
    evidence_label: str | None
    guidance: str


def build_source_strategy(
    applications: tuple[Application, ...],
    *,
    recent_applications: tuple[Application, ...],
    previous_applications: tuple[Application, ...],
) -> tuple[list[dict[str, object]], dict[str, object], SourceSignal | None]:
    overall = _metrics(applications)
    grouped = _group_by_source(applications)
    recent_grouped = _group_by_source(recent_applications)
    previous_grouped = _group_by_source(previous_applications)
    total_submitted = _as_int(overall["submitted_count"])
    provisional_rows = [
        _row(
            source,
            tuple(grouped[source]),
            tuple(recent_grouped[source]),
            tuple(previous_grouped[source]),
            overall,
        )
        for source in ApplicationSource
    ]
    non_empty = [row for row in provisional_rows if _as_int(row["submitted_count"]) > 0]
    top_volume = _top_volume(non_empty)
    strongest = _strongest_source(non_empty)
    recent_movement = _recent_movement(non_empty)
    concentration = {
        "flagged": bool(
            top_volume and _as_float(top_volume["application_share"]) >= CONCENTRATION_THRESHOLD
        ),
        "source": top_volume["source"] if top_volume else None,
        "application_share": _as_float(top_volume["application_share"]) if top_volume else 0.0,
        "threshold": CONCENTRATION_THRESHOLD,
        "submitted_count": total_submitted,
    }
    signals = _source_signals(non_empty, concentration)
    signal = max(signals, key=lambda item: (item.priority, item.source.value), default=None)
    rows = [_with_signal(row, signals) for row in provisional_rows]
    return (
        rows,
        {
            "submitted_count": total_submitted,
            "sufficient_for_strategy": total_submitted >= MIN_SOURCE_SAMPLE,
            "top_volume": _summary_source(top_volume),
            "strongest_response": _summary_source(strongest),
            "recent_movement": _summary_recent_movement(recent_movement),
            "concentration": concentration,
        },
        signal,
    )


def _group_by_source(
    applications: tuple[Application, ...],
) -> defaultdict[ApplicationSource, list[Application]]:
    grouped: defaultdict[ApplicationSource, list[Application]] = defaultdict(list)
    for application in applications:
        if application.source is not None:
            grouped[application.source].append(application)
    return grouped


def _metrics(applications: tuple[Application, ...]) -> dict[str, int | float]:
    submitted_count = len(applications)
    response_count = sum(item.first_response_at is not None for item in applications)
    interview_count = sum(item.first_interview_at is not None for item in applications)
    offer_count = sum(item.first_offer_at is not None for item in applications)

    def ratio(count: int) -> float:
        return round(count / submitted_count, 4) if submitted_count else 0.0

    return {
        "submitted_count": submitted_count,
        "response_count": response_count,
        "response_rate": ratio(response_count),
        "interview_count": interview_count,
        "interview_rate": ratio(interview_count),
        "offer_count": offer_count,
        "offer_rate": ratio(offer_count),
    }


def _row(
    source: ApplicationSource,
    applications: tuple[Application, ...],
    recent_applications: tuple[Application, ...],
    previous_applications: tuple[Application, ...],
    overall: dict[str, int | float],
) -> dict[str, object]:
    metrics = _metrics(applications)
    recent = _metrics(recent_applications)
    previous = _metrics(previous_applications)
    submitted_count = _as_int(metrics["submitted_count"])
    recent_submitted = _as_int(recent["submitted_count"])
    previous_submitted = _as_int(previous["submitted_count"])
    overall_submitted = _as_int(overall["submitted_count"])
    return {
        "source": source,
        **metrics,
        "sample_sufficient": submitted_count >= MIN_TABLE_SAMPLE,
        "application_share": (
            round(submitted_count / overall_submitted, 4) if overall_submitted else 0.0
        ),
        "response_rate_delta_vs_overall": round(
            _as_float(metrics["response_rate"]) - _as_float(overall["response_rate"]), 4
        ),
        "interview_rate_delta_vs_overall": round(
            _as_float(metrics["interview_rate"]) - _as_float(overall["interview_rate"]), 4
        ),
        "recent": {
            **recent,
            "previous_submitted_count": previous_submitted,
            "previous_response_rate": _as_float(previous["response_rate"]),
            "previous_interview_rate": _as_float(previous["interview_rate"]),
            "response_rate_delta": (
                round(
                    _as_float(recent["response_rate"]) - _as_float(previous["response_rate"]),
                    4,
                )
                if recent_submitted and previous_submitted
                else None
            ),
            "interview_rate_delta": (
                round(
                    _as_float(recent["interview_rate"]) - _as_float(previous["interview_rate"]),
                    4,
                )
                if recent_submitted and previous_submitted
                else None
            ),
        },
        "recent_sample_sufficient": recent_submitted >= MIN_TABLE_SAMPLE,
        "signal": None,
        "guidance": None,
    }


def _top_volume(rows: list[dict[str, object]]) -> dict[str, object] | None:
    return max(
        rows,
        key=lambda row: (_as_int(row["submitted_count"]), str(row["source"])),
        default=None,
    )


def _strongest_source(rows: list[dict[str, object]]) -> dict[str, object] | None:
    eligible = [
        row
        for row in rows
        if _as_int(row["submitted_count"]) >= MIN_SOURCE_SAMPLE
        and _as_float(row["response_rate"]) >= MIN_STRONG_RESPONSE_RATE
        and _as_float(row["response_rate_delta_vs_overall"]) >= RATE_DELTA
    ]
    return max(
        eligible,
        key=lambda row: (
            _as_float(row["response_rate_delta_vs_overall"]),
            _as_float(row["response_rate"]),
            _as_int(row["submitted_count"]),
            str(row["source"]),
        ),
        default=None,
    )


def _recent_movement(rows: list[dict[str, object]]) -> dict[str, object] | None:
    eligible = [
        row
        for row in rows
        if bool(row["recent_sample_sufficient"])
        and _as_int(_recent(row)["previous_submitted_count"]) >= MIN_TABLE_SAMPLE
        and _recent(row)["response_rate_delta"] is not None
    ]
    return max(
        eligible,
        key=lambda row: (
            abs(_as_float(_recent(row)["response_rate_delta"])),
            _as_int(_recent(row)["submitted_count"]),
            str(row["source"]),
        ),
        default=None,
    )


def _source_signals(
    rows: list[dict[str, object]], concentration: dict[str, object]
) -> list[SourceSignal]:
    candidates: list[SourceSignal] = []
    for row in rows:
        source = row["source"]
        assert isinstance(source, ApplicationSource)
        label = source.value.replace("_", " ").title()
        submitted_count = _as_int(row["submitted_count"])
        response_count = _as_int(row["response_count"])
        response_rate = _as_float(row["response_rate"])
        response_delta = _as_float(row["response_rate_delta_vs_overall"])
        share = _as_float(row["application_share"])
        if (
            submitted_count >= MIN_SOURCE_SAMPLE
            and share >= HIGH_VOLUME_SHARE
            and response_delta <= -RATE_DELTA
        ):
            candidates.append(
                SourceSignal(
                    "HIGH_VOLUME_LOW_RESPONSE",
                    source,
                    f"{label} is generating volume without comparable responses",
                    (
                        "This source is taking a meaningful share of your applications while "
                        "responding less often than your overall search."
                    ),
                    (
                        f"{submitted_count} submitted · {response_rate:.0%} response · "
                        f"{response_delta:+.0%} vs overall"
                    ),
                    (
                        f"{response_count} of {submitted_count} {label.lower()} applications "
                        f"received a response ({response_rate:.0%}), which is "
                        f"{abs(response_delta):.0%} below your overall response rate."
                    ),
                    "WATCH",
                    64,
                    "MODERATE",
                    f"Based on {submitted_count} applications",
                    (
                        "Consider reviewing the quality of these applications or testing more "
                        "time in another source."
                    ),
                )
            )
        if (
            submitted_count >= MIN_SOURCE_SAMPLE
            and response_rate >= MIN_STRONG_RESPONSE_RATE
            and response_delta >= RATE_DELTA
        ):
            candidates.append(
                SourceSignal(
                    "STRONG_PERFORMER",
                    source,
                    f"{label} is outperforming your overall search",
                    (
                        "This source has a meaningfully stronger response rate within your own "
                        "tracked data."
                    ),
                    (
                        f"{response_count} of {submitted_count} responded · "
                        f"{response_delta:+.0%} vs overall"
                    ),
                    (
                        f"{response_count} of {submitted_count} {label.lower()} applications "
                        f"received a response ({response_rate:.0%}), which is "
                        f"{response_delta:.0%} above your overall response rate."
                    ),
                    "POSITIVE",
                    45,
                    "MODERATE" if submitted_count < 10 else "STRONG",
                    f"Based on {submitted_count} applications",
                    (
                        "Keep using this source while continuing to validate the pattern with "
                        "more applications."
                    ),
                )
            )
        if (
            MIN_PROMISING_SAMPLE <= submitted_count < MIN_SOURCE_SAMPLE
            and response_count > 0
            and response_delta > 0
        ):
            candidates.append(
                SourceSignal(
                    "PROMISING_EARLY",
                    source,
                    f"{label} is showing an early positive signal",
                    (
                        "The early result is encouraging, but there are not enough applications "
                        "to treat it as a reliable pattern yet."
                    ),
                    (
                        f"{response_count} of {submitted_count} responded · "
                        f"{response_delta:+.0%} vs overall"
                    ),
                    (
                        f"{response_count} of {submitted_count} {label.lower()} applications "
                        "received a response. That is stronger than your overall rate so far, "
                        "but the sample is still small."
                    ),
                    "INFO",
                    34,
                    "LIMITED",
                    "Early signal",
                    (
                        "Try a few more relevant applications through this source before "
                        "changing your strategy."
                    ),
                )
            )

    concentration_source = concentration["source"]
    if bool(concentration["flagged"]) and isinstance(concentration_source, ApplicationSource):
        label = concentration_source.value.replace("_", " ").title()
        share = _as_float(concentration["application_share"])
        candidates.append(
            SourceSignal(
                "CONCENTRATED_MIX",
                concentration_source,
                f"Your search is concentrated in {label}",
                (
                    "One source accounts for at least half of your submitted applications. "
                    "That can be a useful focus, but it leaves less room to test other paths."
                ),
                f"{share:.0%} of submitted applications · {label}",
                (
                    f"{label} accounts for {share:.0%} of your submitted applications. "
                    f"The concentration threshold is {CONCENTRATION_THRESHOLD:.0%}."
                ),
                "WATCH",
                30,
                (
                    "LIMITED"
                    if _as_int(concentration["submitted_count"]) < MIN_SOURCE_SAMPLE
                    else "MODERATE"
                ),
                (
                    "Early mix"
                    if _as_int(concentration["submitted_count"]) < MIN_SOURCE_SAMPLE
                    else None
                ),
                "Consider testing one or two additional sources alongside your current approach.",
            )
        )

    return candidates


def _with_signal(row: dict[str, object], signals: list[SourceSignal]) -> dict[str, object]:
    source = row["source"]
    assert isinstance(source, ApplicationSource)
    result = dict(row)
    source_signals = [item for item in signals if item.source is source]
    if source_signals:
        selected = max(source_signals, key=lambda item: item.priority)
        result["signal"] = selected.code
        result["guidance"] = selected.guidance
    elif 0 < _as_int(row["submitted_count"]) < MIN_TABLE_SAMPLE:
        result["signal"] = "LIMITED_DATA"
        result["guidance"] = (
            "Track at least three submitted applications before comparing this source with "
            "confidence."
        )
    return result


def _summary_source(row: dict[str, object] | None) -> dict[str, object] | None:
    if row is None:
        return None
    return {
        "source": row["source"],
        "submitted_count": row["submitted_count"],
        "application_share": row["application_share"],
        "response_rate": row["response_rate"],
        "response_rate_delta_vs_overall": row["response_rate_delta_vs_overall"],
    }


def _summary_recent_movement(row: dict[str, object] | None) -> dict[str, object] | None:
    if row is None:
        return None
    recent = row["recent"]
    assert isinstance(recent, dict)
    delta = recent["response_rate_delta"]
    assert isinstance(delta, float)
    direction: RecentDirection = (
        "IMPROVING" if delta > 0 else "DECLINING" if delta < 0 else "STABLE"
    )
    return {
        "source": row["source"],
        "submitted_count": recent["submitted_count"],
        "response_rate": recent["response_rate"],
        "response_rate_delta": delta,
        "direction": direction,
    }


def _recent(row: dict[str, object]) -> dict[str, object]:
    recent = row["recent"]
    assert isinstance(recent, dict)
    return recent


def _as_int(value: object) -> int:
    return cast(int, value)


def _as_float(value: object) -> float:
    return cast(float, value)
