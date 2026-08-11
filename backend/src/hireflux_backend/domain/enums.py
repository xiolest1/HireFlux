from enum import StrEnum


class UserRole(StrEnum):
    STANDARD_USER = "STANDARD_USER"
    ADMIN = "ADMIN"


class ApplicationStatus(StrEnum):
    DRAFT = "DRAFT"
    APPLIED = "APPLIED"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"


class WorkMode(StrEnum):
    REMOTE = "REMOTE"
    HYBRID = "HYBRID"
    ONSITE = "ONSITE"


class ActivityType(StrEnum):
    APPLICATION_CREATED = "APPLICATION_CREATED"
    STATUS_CHANGED = "STATUS_CHANGED"
