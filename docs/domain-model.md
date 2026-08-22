# Domain model

This file is the durable contract for HireFlux domain vocabulary. API JSON uses `snake_case`; IDs are UUID strings; timestamps are timezone-aware UTC ISO 8601 values; date-only fields use `YYYY-MM-DD`.

## Shared ownership rules

Every application belongs to exactly one user. Every note, interview, attachment, activity, and application-linked notification carries both `application_id` and `owner_user_id`. The API always derives ownership from the authenticated identity and never accepts it from request JSON. Missing and foreign-owned resources both return the same not-found response.

The local demo bounds resource growth per application: 100 notes, 25 interviews, and 500 activity entries by default. Notes, interviews, and activity list endpoints return bounded pages with signed cursors; quota counters are server-owned and updated atomically with the corresponding write.

`STANDARD_USER` and `ADMIN` are the only roles. Clients cannot mutate a role. In AWS, a verified Cognito group/custom claim is authoritative and the DynamoDB profile value is only a projection.

## User

- `user_id`: Cognito `sub` in AWS; fixed UUID in local mode.
- `name`, `email`, `role`.
- `created_at`, `last_login_at`.

Cognito owns passwords, verification, resets, MFA options, sessions, and tokens. HireFlux never stores passwords or password hashes.

## Application

- `application_id`, `owner_user_id`.
- Required `company_name`, `job_title`, and non-null `status`.
- `applied_date`, nullable only for a draft or an archived former draft. It is a user-entered calendar date, is never later than the workspace's current calendar date, and is never converted into a timestamp.
- Optional `follow_up_date`, `job_url`, `location`, `work_mode`, normalized `source`, `source_detail`, `salary_text`, and `description`.
- `created_at`, `updated_at`, and integer `version` for optimistic concurrency.
- Internal optional `archived_from_status` to make archive reversible without bypassing the transition policy.
- Archived edits continue to satisfy the requirements of `archived_from_status`; an archived later-stage application cannot clear its required `applied_date`. A legacy archived record missing that field must supply it as part of the restore request.
- Server-owned UTC `submitted_at`, `stage_entered_at`, `first_response_at`, `first_screening_at`, `first_interview_at`, `first_offer_at`, and `first_acceptance_at` milestones. `submitted_at` captures the actual instant an application is created as `APPLIED` or first leaves `DRAFT`; public write bodies cannot set them.

Statuses are `DRAFT`, `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, and `ARCHIVED`. Work modes are `REMOTE`, `HYBRID`, and `ONSITE`. Sources are `LINKEDIN`, `INDEED`, `COMPANY_WEBSITE`, `RECRUITER`, `REFERRAL`, `HANDSHAKE`, `CAREER_FAIR`, and `OTHER`. The complete workflow is in [status-transitions.md](status-transitions.md).

## Note

- `note_id`, `application_id`, `owner_user_id`.
- Required plain-text `content`.
- `created_at`, `updated_at`, and integer `version`.

Creating, editing, and deleting a note appends activity without copying the note content into the activity record. Notes are ordinary mutable child records; activity remains append-only.

## Interview

- `interview_id`, `application_id`, `owner_user_id`.
- `interview_type`: `RECRUITER_CALL`, `TECHNICAL_SCREEN`, `BEHAVIORAL`, `CODING_ASSESSMENT`, `HIRING_MANAGER`, `ONSITE`, `FINAL`, or `OTHER`.
- Required timezone-aware `scheduled_at`; `duration_minutes`; optional `location`, `meeting_url`, and `details`.
- `status`: `SCHEDULED`, `COMPLETED`, or `CANCELED`.
- Denormalized `company_name` and `job_title`, refreshed from the owned parent when the interview changes.
- `created_at`, `updated_at`, and integer `version`.

Only scheduled interviews are editable. They may transition to completed or canceled; both are terminal. Rescheduling and status changes append activity.

## Workspace settings

- `owner_user_id`, IANA `time_zone`, and `default_follow_up_days` from 1 through 30.
- `default_application_view`: `ACTIVE`, `ALL`, or `ARCHIVED`.
- `default_dashboard_range`: `30d`, `90d`, or `all`.
- `theme`: `SYSTEM`, `LIGHT`, or `DARK`.
- `created_at`, `updated_at`, integer `version`, and demo-workspace expiry.

The temporary demo persists these preferences for its own 24-hour lifetime. Identity, password, MFA, and connected-login controls remain read-only previews because the demo is not a permanent account.

## Demo workspace provisioning

- Lifecycle item: `workspace_id`, `state`, `issued_at`, `updated_at`, and `expires_at`.
- `state` is `PROVISIONING` while the seed is being written, `READY` only after the complete seed succeeds, or `FAILED` after a failed attempt.
- A failed lifecycle marker uses a short cleanup TTL and is not an authenticated workspace. Partial profile, settings, application, child-resource, quota, counter, and activity records are removed best-effort.
- An optional request `Idempotency-Key` is hashed server-side and stored with the lifecycle reference. A successful replay reissues the deterministic token for the original workspace; provisioning and failed replays return a conflict so the caller does not create an ambiguous second result.

## Attachment metadata (Milestone 4)

- `attachment_id`, `application_id`, `owner_user_id`, `attachment_type`.
- `original_filename`, private S3 `object_key`, `content_type`, `size_bytes`, `uploaded_at`.

Only metadata lives in DynamoDB. File bytes live in private S3 and are never logged.

## Notification (Milestone 6)

- `notification_id`, `owner_user_id`, optional `application_id`.
- `type`, `message`, optional `scheduled_for`.
- `created_at`, optional `read_at`.

## ActivityLog

- `activity_id`, `application_id`, `owner_user_id`.
- `activity_type`, human-readable `summary`, string-valued structured `metadata`, `created_at`.

Activity types include application creation/status changes, follow-up completion/rescheduling, note mutations, and interview scheduling/updates/status changes. Ordinary application behavior can append activity but cannot edit or delete it.
