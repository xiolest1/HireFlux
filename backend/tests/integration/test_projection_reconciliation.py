from datetime import UTC, datetime
from typing import Any

import pytest

from hireflux_backend.config import Settings
from hireflux_backend.domain.enums import ApplicationSource, ApplicationStatus, WorkMode
from hireflux_backend.domain.models import Application
from hireflux_backend.domain.resources import Interview, InterviewStatus, InterviewType
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_to_item,
    deserialize_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.reconciliation import reconcile_local_projections
from hireflux_backend.infrastructure.dynamodb.resource_mapping import (
    interview_key,
    interview_to_item,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import UnsafeTableTargetError


def _settings() -> Settings:
    return Settings(
        _env_file=None,
        environment="local",
        auth_mode="local",
        cursor_signing_key="test-signing-key-that-is-at-least-32-bytes",
        dynamodb_table_name="HireFluxTest",
        dynamodb_endpoint_url="http://127.0.0.1:8001",
        aws_access_key_id="LOCALTESTACCESSKEY",
        aws_secret_access_key="LOCALTESTSECRETKEY",
    )


def test_reconciliation_is_confirmed_idempotent_and_rebuilds_counters(
    dynamodb_client: Any,
) -> None:
    timestamp = datetime(2026, 8, 12, 12, tzinfo=UTC)
    application = Application(
        application_id="00000000-0000-4000-8000-000000000099",
        owner_user_id="projection-owner",
        company_name="Projection Co",
        job_title="Engineer",
        status=ApplicationStatus.INTERVIEW,
        applied_date=timestamp.date(),
        follow_up_date=timestamp.date(),
        job_url=None,
        location="Remote",
        work_mode=WorkMode.REMOTE,
        source=ApplicationSource.REFERRAL,
        salary_text=None,
        description=None,
        created_at=timestamp,
        updated_at=timestamp,
        version=1,
        submitted_at=timestamp,
        stage_entered_at=timestamp,
        first_response_at=timestamp,
        first_interview_at=timestamp,
    )
    dynamodb_client.put_item(
        TableName="HireFluxTest", Item=serialize_item(application_to_item(application))
    )
    interview = Interview(
        interview_id="00000000-0000-4000-8000-000000000098",
        application_id=application.application_id,
        owner_user_id=application.owner_user_id,
        company_name=application.company_name,
        job_title=application.job_title,
        interview_type=InterviewType.TECHNICAL_SCREEN,
        status=InterviewStatus.SCHEDULED,
        scheduled_at=timestamp,
        duration_minutes=60,
        location=None,
        meeting_url=None,
        details=None,
        preparation_notes=None,
        completed_checklist_items=(),
        candidate_questions=(),
        debrief_went_well=None,
        debrief_improve=None,
        debrief_signals=None,
        debrief_next_step=None,
        debrief_completed_at=None,
        created_at=timestamp,
        updated_at=timestamp,
        version=1,
    )
    stale_interview_item = interview_to_item(interview)
    stale_interview_item.pop("GSI3PK")
    stale_interview_item.pop("GSI3SK")
    dynamodb_client.put_item(TableName="HireFluxTest", Item=serialize_item(stale_interview_item))
    completed_interview = Interview(
        interview_id="00000000-0000-4000-8000-000000000097",
        application_id=application.application_id,
        owner_user_id=application.owner_user_id,
        company_name=application.company_name,
        job_title=application.job_title,
        interview_type=InterviewType.RECRUITER_CALL,
        status=InterviewStatus.COMPLETED,
        scheduled_at=timestamp,
        duration_minutes=30,
        location=None,
        meeting_url=None,
        details=None,
        preparation_notes=None,
        completed_checklist_items=(),
        candidate_questions=(),
        debrief_went_well=None,
        debrief_improve=None,
        debrief_signals=None,
        debrief_next_step=None,
        debrief_completed_at=None,
        created_at=timestamp,
        updated_at=timestamp,
        version=2,
    )
    stale_completed_item = interview_to_item(completed_interview)
    stale_completed_item["GSI3PK"] = "stale-schedule-partition"
    stale_completed_item["GSI3SK"] = "INTERVIEW#stale"
    dynamodb_client.put_item(TableName="HireFluxTest", Item=serialize_item(stale_completed_item))
    configured = _settings()
    with pytest.raises(UnsafeTableTargetError, match="exactly match"):
        reconcile_local_projections(configured, confirmation="wrong", client=dynamodb_client)

    assert (
        reconcile_local_projections(configured, confirmation="HireFluxTest", client=dynamodb_client)
        == 1
    )
    assert (
        reconcile_local_projections(configured, confirmation="HireFluxTest", client=dynamodb_client)
        == 1
    )
    funnel = dynamodb_client.get_item(
        TableName="HireFluxTest",
        Key=serialize_item({"PK": user_partition("projection-owner"), "SK": "COUNTER#FUNNEL"}),
    )["Item"]
    values = deserialize_item(funnel)
    assert values["total_tracked"] == 1
    assert values["submitted_count"] == 1
    assert values["response_count"] == 1
    assert values["interview_count"] == 1
    repaired_interview = deserialize_item(
        dynamodb_client.get_item(
            TableName="HireFluxTest",
            Key=serialize_item(
                interview_key(
                    interview.owner_user_id,
                    interview.application_id,
                    interview.interview_id,
                )
            ),
        )["Item"]
    )
    assert repaired_interview["GSI3PK"].endswith("#SCHEDULE")
    assert repaired_interview["GSI3SK"].startswith("INTERVIEW#")
    repaired_completed = deserialize_item(
        dynamodb_client.get_item(
            TableName="HireFluxTest",
            Key=serialize_item(
                interview_key(
                    completed_interview.owner_user_id,
                    completed_interview.application_id,
                    completed_interview.interview_id,
                )
            ),
        )["Item"]
    )
    assert "GSI3PK" not in repaired_completed
    assert "GSI3SK" not in repaired_completed


def test_reconciliation_refuses_nonlocal_targets(dynamodb_client: Any) -> None:
    configured = Settings(
        _env_file=None,
        environment="test",
        auth_mode="local",
        cursor_signing_key="test-signing-key-that-is-at-least-32-bytes",
        dynamodb_table_name="HireFluxTest",
    )
    with pytest.raises(UnsafeTableTargetError, match="ENVIRONMENT=local"):
        reconcile_local_projections(configured, confirmation="HireFluxTest", client=dynamodb_client)
