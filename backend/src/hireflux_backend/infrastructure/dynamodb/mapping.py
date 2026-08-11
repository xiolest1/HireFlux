from datetime import UTC, date, datetime
from typing import Any

from boto3.dynamodb.types import TypeDeserializer, TypeSerializer

from hireflux_backend.domain.enums import ActivityType, ApplicationStatus, UserRole, WorkMode
from hireflux_backend.domain.models import Activity, Application, UserProfile

_SERIALIZER = TypeSerializer()
_DESERIALIZER = TypeDeserializer()


def user_partition(user_id: str) -> str:
    return f"USER#{user_id}"


def application_partition(owner_user_id: str, application_id: str) -> str:
    return f"USER#{owner_user_id}#APPLICATION#{application_id}"


def owner_applications_key(owner_user_id: str) -> str:
    return f"USER#{owner_user_id}#APPLICATIONS"


def owner_status_key(owner_user_id: str, status: ApplicationStatus) -> str:
    return f"USER#{owner_user_id}#STATUS#{status.value}"


def format_timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("DynamoDB timestamps must be timezone-aware.")
    return value.astimezone(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def application_sort_key(timestamp: str, application_id: str) -> str:
    return f"{timestamp}#{application_id}"


def activity_sort_key(timestamp: str, activity_id: str) -> str:
    return f"ACTIVITY#{timestamp}#{activity_id}"


def serialize_item(item: dict[str, Any]) -> dict[str, Any]:
    return {key: _SERIALIZER.serialize(value) for key, value in item.items() if value is not None}


def deserialize_item(item: dict[str, Any]) -> dict[str, Any]:
    return {key: _DESERIALIZER.deserialize(value) for key, value in item.items()}


def application_to_item(application: Application) -> dict[str, Any]:
    updated_at = format_timestamp(application.updated_at)
    return {
        "PK": application_partition(application.owner_user_id, application.application_id),
        "SK": "METADATA",
        "entity_type": "APPLICATION",
        "application_id": application.application_id,
        "owner_user_id": application.owner_user_id,
        "company_name": application.company_name,
        "job_title": application.job_title,
        "status": application.status.value,
        "applied_date": application.applied_date.isoformat() if application.applied_date else None,
        "follow_up_date": (
            application.follow_up_date.isoformat() if application.follow_up_date else None
        ),
        "job_url": application.job_url,
        "location": application.location,
        "work_mode": application.work_mode.value if application.work_mode else None,
        "source": application.source,
        "salary_text": application.salary_text,
        "description": application.description,
        "created_at": format_timestamp(application.created_at),
        "updated_at": updated_at,
        "version": application.version,
        "archived_from_status": (
            application.archived_from_status.value if application.archived_from_status else None
        ),
        "expires_at": application.expires_at,
        "GSI1PK": (
            owner_applications_key(application.owner_user_id)
            if application.status is not ApplicationStatus.ARCHIVED
            else None
        ),
        "GSI1SK": (
            application_sort_key(updated_at, application.application_id)
            if application.status is not ApplicationStatus.ARCHIVED
            else None
        ),
        "GSI2PK": owner_status_key(application.owner_user_id, application.status),
        "GSI2SK": application_sort_key(updated_at, application.application_id),
    }


def application_from_item(item: dict[str, Any]) -> Application:
    return Application(
        application_id=str(item["application_id"]),
        owner_user_id=str(item["owner_user_id"]),
        company_name=str(item["company_name"]),
        job_title=str(item["job_title"]),
        status=ApplicationStatus(str(item["status"])),
        applied_date=date.fromisoformat(str(item["applied_date"]))
        if item.get("applied_date")
        else None,
        follow_up_date=date.fromisoformat(str(item["follow_up_date"]))
        if item.get("follow_up_date")
        else None,
        job_url=_optional_string(item, "job_url"),
        location=_optional_string(item, "location"),
        work_mode=WorkMode(str(item["work_mode"])) if item.get("work_mode") else None,
        source=_optional_string(item, "source"),
        salary_text=_optional_string(item, "salary_text"),
        description=_optional_string(item, "description"),
        created_at=parse_timestamp(str(item["created_at"])),
        updated_at=parse_timestamp(str(item["updated_at"])),
        version=int(item["version"]),
        archived_from_status=(
            ApplicationStatus(str(item["archived_from_status"]))
            if item.get("archived_from_status")
            else None
        ),
        expires_at=int(item["expires_at"]) if item.get("expires_at") is not None else None,
    )


def activity_to_item(activity: Activity) -> dict[str, Any]:
    created_at = format_timestamp(activity.created_at)
    return {
        "PK": application_partition(activity.owner_user_id, activity.application_id),
        "SK": activity_sort_key(created_at, activity.activity_id),
        "entity_type": "ACTIVITY",
        "activity_id": activity.activity_id,
        "application_id": activity.application_id,
        "owner_user_id": activity.owner_user_id,
        "activity_type": activity.activity_type.value,
        "summary": activity.summary,
        "metadata": activity.metadata,
        "created_at": created_at,
        "expires_at": activity.expires_at,
    }


def activity_from_item(item: dict[str, Any]) -> Activity:
    metadata = item.get("metadata", {})
    return Activity(
        activity_id=str(item["activity_id"]),
        application_id=str(item["application_id"]),
        owner_user_id=str(item["owner_user_id"]),
        activity_type=ActivityType(str(item["activity_type"])),
        summary=str(item["summary"]),
        metadata={str(key): str(value) for key, value in dict(metadata).items()},
        created_at=parse_timestamp(str(item["created_at"])),
        expires_at=int(item["expires_at"]) if item.get("expires_at") is not None else None,
    )


def profile_to_item(profile: UserProfile) -> dict[str, Any]:
    return {
        "PK": user_partition(profile.user_id),
        "SK": "PROFILE",
        "entity_type": "USER_PROFILE",
        "user_id": profile.user_id,
        "name": profile.name,
        "email": profile.email,
        "role": profile.role.value,
        "created_at": format_timestamp(profile.created_at),
        "last_login_at": format_timestamp(profile.last_login_at),
        "expires_at": profile.expires_at,
    }


def profile_from_item(item: dict[str, Any]) -> UserProfile:
    return UserProfile(
        user_id=str(item["user_id"]),
        name=str(item["name"]),
        email=str(item["email"]),
        role=UserRole(str(item["role"])),
        created_at=parse_timestamp(str(item["created_at"])),
        last_login_at=parse_timestamp(str(item["last_login_at"])),
        expires_at=int(item["expires_at"]) if item.get("expires_at") is not None else None,
    )


def _optional_string(item: dict[str, Any], key: str) -> str | None:
    value = item.get(key)
    return str(value) if value is not None else None
