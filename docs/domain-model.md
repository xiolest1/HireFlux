# Domain model

This file is the durable contract for HireFlux domain vocabulary. API JSON uses `snake_case`; IDs are UUID strings; timestamps are timezone-aware UTC ISO 8601 values; date-only fields use `YYYY-MM-DD`.

## Shared ownership rules

Every application belongs to exactly one user. Every note, interview, attachment, activity, and application-linked notification carries both `application_id` and `owner_user_id`. The API always derives ownership from the authenticated identity and never accepts it from request JSON. Missing and foreign-owned resources both return the same not-found response.

`STANDARD_USER` and `ADMIN` are the only roles. Clients cannot mutate a role. In AWS, a verified Cognito group/custom claim is authoritative and the DynamoDB profile value is only a projection.

## User

- `user_id`: Cognito `sub` in AWS; fixed UUID in local mode.
- `name`, `email`, `role`.
- `created_at`, `last_login_at`.

Cognito owns passwords, verification, resets, MFA options, sessions, and tokens. HireFlux never stores passwords or password hashes.

## Application

- `application_id`, `owner_user_id`.
- Required `company_name`, `job_title`, and non-null `status`.
- `applied_date`, nullable only for a draft or an archived former draft.
- Optional `follow_up_date`, `job_url`, `location`, `work_mode`, `source`, `salary_text`, `description`.
- `created_at`, `updated_at`, and integer `version` for optimistic concurrency.
- Internal optional `archived_from_status` to make archive reversible without bypassing the transition policy.

Statuses are `DRAFT`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`, and `ARCHIVED`. Work modes are `REMOTE`, `HYBRID`, and `ONSITE`. The complete workflow is in [status-transitions.md](status-transitions.md).

## Note (Milestone 2)

- `note_id`, `application_id`, `owner_user_id`.
- Required `body`.
- `created_at`, `updated_at`.

## Interview (Milestone 2)

- `interview_id`, `application_id`, `owner_user_id`.
- `interview_type`: `PHONE`, `VIDEO`, `ONSITE`, `TECHNICAL`, `BEHAVIORAL`, or `OTHER`.
- Required `scheduled_at`; optional `location_or_url` and `notes`.
- `status`: `SCHEDULED`, `COMPLETED`, or `CANCELED`.
- `created_at`, `updated_at`.

Rescheduling changes `scheduled_at` and appends activity; it is not a separate status.

## Attachment metadata (Milestone 4)

- `attachment_id`, `application_id`, `owner_user_id`, `attachment_type`.
- `original_filename`, private S3 `object_key`, `content_type`, `size_bytes`, `uploaded_at`.

Only metadata lives in DynamoDB. File bytes live in private S3 and are never logged.

## Notification (Milestones 2 and 6)

- `notification_id`, `owner_user_id`, optional `application_id`.
- `type`, `message`, optional `scheduled_for`.
- `created_at`, optional `read_at`.

## ActivityLog

- `activity_id`, `application_id`, `owner_user_id`.
- `activity_type`, human-readable `summary`, string-valued structured `metadata`, `created_at`.

Milestone 1 activity types are `APPLICATION_CREATED` and `STATUS_CHANGED`. Later child operations add explicit event types rather than rewriting existing entries. Ordinary application behavior can append activity but cannot edit or delete it.

