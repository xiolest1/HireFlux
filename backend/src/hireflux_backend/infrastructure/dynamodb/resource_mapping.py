from typing import Any

from hireflux_backend.domain.enums import RoleFamily
from hireflux_backend.domain.resources import (
    CustomPreparationItem,
    DashboardRange,
    DefaultApplicationView,
    Interview,
    InterviewStatus,
    InterviewType,
    Note,
    ThemePreference,
    WorkspaceSettings,
)
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    format_timestamp,
    parse_timestamp,
    user_partition,
)


def settings_key(owner_user_id: str) -> dict[str, str]:
    return {"PK": user_partition(owner_user_id), "SK": "SETTINGS"}


def note_key(owner_user_id: str, application_id: str, note_id: str) -> dict[str, str]:
    return {
        "PK": application_partition(owner_user_id, application_id),
        "SK": f"NOTE#{note_id}",
    }


def interview_key(owner_user_id: str, application_id: str, interview_id: str) -> dict[str, str]:
    return {
        "PK": application_partition(owner_user_id, application_id),
        "SK": f"INTERVIEW#{interview_id}",
    }


def resource_quota_key(owner_user_id: str, application_id: str) -> dict[str, str]:
    return {
        "PK": application_partition(owner_user_id, application_id),
        "SK": "RESOURCE_QUOTA",
    }


def owner_schedule_key(owner_user_id: str) -> str:
    return f"USER#{owner_user_id}#SCHEDULE"


def owner_interviews_key(owner_user_id: str) -> str:
    return f"USER#{owner_user_id}#INTERVIEWS"


def interview_owner_sort_key(interview: Interview) -> str:
    return f"{format_timestamp(interview.scheduled_at)}#{interview.interview_id}"


def interview_schedule_sort_key(interview: Interview) -> str:
    return f"INTERVIEW#{format_timestamp(interview.scheduled_at)}#{interview.interview_id}"


def settings_to_item(settings: WorkspaceSettings) -> dict[str, Any]:
    return {
        **settings_key(settings.owner_user_id),
        "entity_type": "WORKSPACE_SETTINGS",
        "owner_user_id": settings.owner_user_id,
        "time_zone": settings.time_zone,
        "default_follow_up_days": settings.default_follow_up_days,
        "default_application_view": settings.default_application_view.value,
        "default_dashboard_range": settings.default_dashboard_range.value,
        "theme": settings.theme.value,
        "created_at": format_timestamp(settings.created_at),
        "updated_at": format_timestamp(settings.updated_at),
        "version": settings.version,
        "expires_at": settings.expires_at,
    }


def settings_from_item(item: dict[str, Any]) -> WorkspaceSettings:
    return WorkspaceSettings(
        owner_user_id=str(item["owner_user_id"]),
        time_zone=str(item["time_zone"]),
        default_follow_up_days=int(item["default_follow_up_days"]),
        default_application_view=DefaultApplicationView(str(item["default_application_view"])),
        default_dashboard_range=DashboardRange(str(item["default_dashboard_range"])),
        theme=ThemePreference(str(item["theme"])),
        created_at=parse_timestamp(str(item["created_at"])),
        updated_at=parse_timestamp(str(item["updated_at"])),
        version=int(item["version"]),
        expires_at=int(item["expires_at"]) if item.get("expires_at") is not None else None,
    )


def note_to_item(note: Note) -> dict[str, Any]:
    return {
        **note_key(note.owner_user_id, note.application_id, note.note_id),
        "entity_type": "NOTE",
        "note_id": note.note_id,
        "application_id": note.application_id,
        "owner_user_id": note.owner_user_id,
        "content": note.content,
        "created_at": format_timestamp(note.created_at),
        "updated_at": format_timestamp(note.updated_at),
        "version": note.version,
        "expires_at": note.expires_at,
    }


def note_from_item(item: dict[str, Any]) -> Note:
    return Note(
        note_id=str(item["note_id"]),
        application_id=str(item["application_id"]),
        owner_user_id=str(item["owner_user_id"]),
        content=str(item["content"]),
        created_at=parse_timestamp(str(item["created_at"])),
        updated_at=parse_timestamp(str(item["updated_at"])),
        version=int(item["version"]),
        expires_at=int(item["expires_at"]) if item.get("expires_at") is not None else None,
    )


def interview_to_item(interview: Interview) -> dict[str, Any]:
    scheduled = interview.status is InterviewStatus.SCHEDULED
    return {
        **interview_key(interview.owner_user_id, interview.application_id, interview.interview_id),
        "entity_type": "INTERVIEW",
        "interview_id": interview.interview_id,
        "application_id": interview.application_id,
        "owner_user_id": interview.owner_user_id,
        "company_name": interview.company_name,
        "job_title": interview.job_title,
        "interview_type": interview.interview_type.value,
        "status": interview.status.value,
        "scheduled_at": format_timestamp(interview.scheduled_at),
        "duration_minutes": interview.duration_minutes,
        "location": interview.location,
        "meeting_url": interview.meeting_url,
        "details": interview.details,
        "preparation_notes": interview.preparation_notes,
        "completed_checklist_items": list(interview.completed_checklist_items),
        "candidate_questions": list(interview.candidate_questions),
        "application_role_family": (
            interview.application_role_family.value if interview.application_role_family else None
        ),
        "custom_preparation_items": [
            {"item_id": item.item_id, "label": item.label}
            for item in interview.custom_preparation_items
        ],
        "debrief_went_well": interview.debrief_went_well,
        "debrief_improve": interview.debrief_improve,
        "debrief_signals": interview.debrief_signals,
        "debrief_next_step": interview.debrief_next_step,
        "debrief_primary_reflection": interview.debrief_primary_reflection,
        "debrief_carry_forward": interview.debrief_carry_forward,
        "debrief_completed_at": (
            format_timestamp(interview.debrief_completed_at)
            if interview.debrief_completed_at is not None
            else None
        ),
        "created_at": format_timestamp(interview.created_at),
        "updated_at": format_timestamp(interview.updated_at),
        "version": interview.version,
        "expires_at": interview.expires_at,
        "GSI1PK": owner_interviews_key(interview.owner_user_id),
        "GSI1SK": interview_owner_sort_key(interview),
        "GSI3PK": owner_schedule_key(interview.owner_user_id) if scheduled else None,
        "GSI3SK": interview_schedule_sort_key(interview) if scheduled else None,
    }


def interview_from_item(item: dict[str, Any]) -> Interview:
    return Interview(
        interview_id=str(item["interview_id"]),
        application_id=str(item["application_id"]),
        owner_user_id=str(item["owner_user_id"]),
        company_name=str(item["company_name"]),
        job_title=str(item["job_title"]),
        interview_type=InterviewType(str(item["interview_type"])),
        status=InterviewStatus(str(item["status"])),
        scheduled_at=parse_timestamp(str(item["scheduled_at"])),
        duration_minutes=int(item["duration_minutes"]),
        location=_optional_string(item, "location"),
        meeting_url=_optional_string(item, "meeting_url"),
        details=_optional_string(item, "details"),
        preparation_notes=_optional_string(item, "preparation_notes"),
        completed_checklist_items=tuple(
            str(value) for value in item.get("completed_checklist_items", [])
        ),
        candidate_questions=tuple(str(value) for value in item.get("candidate_questions", [])),
        application_role_family=(
            RoleFamily(str(item["application_role_family"]))
            if item.get("application_role_family")
            else None
        ),
        custom_preparation_items=tuple(
            CustomPreparationItem(item_id=str(value["item_id"]), label=str(value["label"]))
            for value in item.get("custom_preparation_items", [])
        ),
        debrief_went_well=_optional_string(item, "debrief_went_well"),
        debrief_improve=_optional_string(item, "debrief_improve"),
        debrief_signals=_optional_string(item, "debrief_signals"),
        debrief_next_step=_optional_string(item, "debrief_next_step"),
        debrief_completed_at=(
            parse_timestamp(str(item["debrief_completed_at"]))
            if item.get("debrief_completed_at") is not None
            else None
        ),
        created_at=parse_timestamp(str(item["created_at"])),
        updated_at=parse_timestamp(str(item["updated_at"])),
        version=int(item["version"]),
        expires_at=int(item["expires_at"]) if item.get("expires_at") is not None else None,
        debrief_primary_reflection=_optional_string(item, "debrief_primary_reflection"),
        debrief_carry_forward=_optional_string(item, "debrief_carry_forward"),
    )


def _optional_string(item: dict[str, Any], key: str) -> str | None:
    value = item.get(key)
    return str(value) if value is not None else None
