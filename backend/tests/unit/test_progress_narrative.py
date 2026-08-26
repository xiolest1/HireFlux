from hireflux_backend.application.progress_narrative import build_progress_narrative


def comparison(
    current_count: int,
    previous_count: int,
    *,
    response_delta: float = 0.0,
    interview_delta: float = 0.0,
) -> dict[str, object]:
    current = {
        "submitted_count": current_count,
        "response_rate": 0.5 + response_delta,
        "interview_rate": 0.3 + interview_delta,
    }
    previous = {
        "submitted_count": previous_count,
        "response_rate": 0.5,
        "interview_rate": 0.3,
    }
    return {
        "available": True,
        "current": current,
        "previous": previous,
        "deltas": {
            "submitted_count": current_count - previous_count,
            "response_rate": response_delta,
            "interview_rate": interview_delta,
        },
    }


def insight(
    code: str,
    *,
    priority: int,
    title: str,
    tone: str = "WATCH",
    action: dict[str, object] | None = None,
    semantic_type: str = "trend",
) -> dict[str, object]:
    return {
        "code": code,
        "category": "response",
        "semantic_type": semantic_type,
        "tone": tone,
        "title": title,
        "description": f"Explanation for {title}.",
        "evidence_summary": f"Evidence for {title}",
        "evidence": f"Detailed evidence for {title}.",
        "evidence_strength": "STRONG",
        "evidence_label": "Based on 20 applications",
        "priority": priority,
        "action": action,
    }


def coverage(**changes: int | float) -> dict[str, int | float]:
    result: dict[str, int | float] = {
        "active_count": 10,
        "scheduled_count": 8,
        "coverage_rate": 0.8,
        "overdue_count": 1,
        "due_today_count": 0,
        "missing_count": 2,
    }
    result.update(changes)
    return result


def narrative(
    *,
    reporting_range: str = "30d",
    submitted_count: int = 10,
    period: dict[str, object] | None = None,
    insights: list[dict[str, object]] | None = None,
    process: dict[str, int | float] | None = None,
) -> dict[str, object]:
    return build_progress_narrative(
        reporting_range=reporting_range,
        rates={"submitted_count": submitted_count},
        period_comparison=period or comparison(10, 8),
        performance_signals=insights or [],
        insights=insights or [],
        process_coverage=process or coverage(),
    )


def test_combined_interview_signal_outranks_response_and_activity() -> None:
    result = narrative(
        period=comparison(10, 5, response_delta=-0.2, interview_delta=-0.2),
        insights=[
            insight("MOMENTUM_UP", priority=70, title="Activity increased"),
            insight("RESPONSE_DECLINING", priority=80, title="Responses declined"),
            insight(
                "VOLUME_UP_INTERVIEW_DOWN",
                priority=76,
                title="More applications are reaching interviews less often",
            ),
        ],
    )

    assert result["headline"] == "More applications are reaching interviews less often"
    assert result["primary_signal"]["code"] == "VOLUME_UP_INTERVIEW_DOWN"  # type: ignore[index]
    assert result["primary_signal"]["evidence_metric_keys"] == [  # type: ignore[index]
        "SUBMISSIONS",
        "INTERVIEW_RATE",
    ]


def test_process_action_remains_separate_from_performance_headline() -> None:
    follow_up_action = {
        "kind": "VIEW_APPLICATIONS",
        "label": "Review follow-ups",
        "parameters": {"view": "ACTIVE", "follow_up": "NEEDS_ATTENTION"},
    }
    result = narrative(
        insights=[
            insight("INTERVIEW_DECLINING", priority=72, title="Interview conversion declined"),
            insight(
                "FOLLOW_UP_ATTENTION",
                priority=100,
                title="2 follow-ups are overdue",
                action=follow_up_action,
                semantic_type="action",
            ),
        ]
    )

    assert result["headline"] == "Interview conversion declined"
    assert result["recommended_focus"]["title"] == "2 follow-ups are overdue"  # type: ignore[index]
    assert result["process_health"]["active_count"] == 10  # type: ignore[index]


def test_lower_activity_with_stronger_conversion_outranks_activity_alone() -> None:
    result = narrative(
        period=comparison(4, 9, interview_delta=0.3),
        insights=[
            insight("MOMENTUM_DOWN", priority=90, title="Activity slowed"),
            insight(
                "MOMENTUM_WITH_INTERVIEWS",
                priority=78,
                title="Lower activity is moving deeper",
                tone="POSITIVE",
            ),
        ],
    )

    assert result["headline"] == "Lower activity is moving deeper"
    assert result["tone"] == "POSITIVE"
    assert result["primary_signal"]["direction"] == "MIXED"  # type: ignore[index]


def test_interview_signal_outranks_response_signal_regardless_of_priority() -> None:
    result = narrative(
        insights=[
            insight("RESPONSE_DECLINING", priority=99, title="Responses declined"),
            insight("INTERVIEW_DECLINING", priority=60, title="Interviews declined"),
        ]
    )

    assert result["primary_signal"]["code"] == "INTERVIEW_DECLINING"  # type: ignore[index]


def test_ready_without_a_qualified_signal_is_neutral() -> None:
    result = narrative(submitted_count=8, period=comparison(8, 8))

    assert result["state"] == "READY"
    assert result["tone"] == "NEUTRAL"
    assert result["primary_signal"] is None


def test_empty_limited_and_all_time_states_do_not_make_comparison_claims() -> None:
    empty = narrative(submitted_count=0, period=comparison(0, 8))
    limited = narrative(submitted_count=3, period=comparison(3, 2))
    all_time = narrative(
        reporting_range="all",
        insights=[insight("INTERVIEW_DECLINING", priority=72, title="Ignored period signal")],
    )

    assert empty["state"] == "EMPTY"
    assert limited["state"] == "LIMITED"
    assert all_time["state"] == "ALL_TIME"
    assert all_time["primary_signal"] is None


def test_narrative_is_deterministic_and_process_health_handles_zero_activity() -> None:
    inputs = {
        "submitted_count": 8,
        "period": comparison(8, 8),
        "insights": [
            insight(
                "INTERVIEW_IMPROVING",
                priority=58,
                title="Interviews improved",
                tone="POSITIVE",
            )
        ],
        "process": coverage(
            active_count=0,
            scheduled_count=0,
            coverage_rate=0,
            overdue_count=0,
            missing_count=0,
        ),
    }

    assert narrative(**inputs) == narrative(**inputs)
    assert narrative(**inputs)["process_health"]["tone"] == "NEUTRAL"  # type: ignore[index]
