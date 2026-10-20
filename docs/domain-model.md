# Domain model

This file is the durable contract for HireFlux domain vocabulary. API JSON uses `snake_case`; generated resource/demo IDs and LOCAL owners are UUID strings. PERSISTENT owners preserve a verified Cognito `sub` as a bounded safe opaque string, without UUID normalization. Timestamps are timezone-aware UTC ISO 8601 values; date-only fields use `YYYY-MM-DD`.

## Shared ownership rules

Every application belongs to exactly one user. Every note, interview, attachment, activity, and application-linked notification carries both `application_id` and `owner_user_id`. The API always derives ownership from the authenticated identity and never accepts it from request JSON. Missing and foreign-owned resources both return the same not-found response.

The local demo bounds resource growth per application: 100 notes, 25 interviews, and 500 activity entries by default. Notes, interviews, and activity list endpoints return bounded pages with signed cursors; quota counters are server-owned and updated atomically with the corresponding write.

`STANDARD_USER` and `ADMIN` are the only server-side role vocabulary. Clients cannot mutate a role. Phase 5B admits Cognito users only as `STANDARD_USER`; groups, custom claims and stored profile roles grant no administrative authority. `ADMIN` remains reserved for a future separately guarded service. The deployed demo remains unchanged.

## User

- `user_id`: generated UUID for demos; fixed configured UUID for local durable workspaces.
  Phase 5B implements direct verified Cognito `sub` ownership locally: maximum 128
  characters, no controls, whitespace or `#` key delimiter; preserve case and value.
  Real Cognito/AWS admission remains unverified until separately authorized 5E.
- `name`, `email`, `role`.
- `created_at`: profile initialization instant. The deprecated nullable API field
  `last_login_at` is always null; HireFlux does not observe actual login events.
  Existing creation-only stored values remain untouched on adoption.

Future Cognito owns passwords, verification, resets, MFA options, sessions, and tokens. HireFlux never stores passwords or password hashes.

The verified principal (`CurrentIdentity`) has `user_id`, `role`, `kind`, and
`data_expires_at`; it does not require name/email or contain token expiry.
`DEMO` requires a positive data expiry. `LOCAL` and `PERSISTENT` prohibit
workspace expiry. `is_demo` is derived from kind, so contradictory flags cannot
be constructed. `TrustedProfileAttributes` supplies name/email independently
from guarded LOCAL configuration or verified server-side Cognito userInfo admission.
Provider expiry/authentication metadata belongs to `VerifiedPrincipal`, outside
domain identity/data lifetime. No email-based ownership/linking is implemented.

## Durable workspace readiness

`DurableWorkspace` contains `owner_user_id`, `identity_kind`, `bootstrap_version`
(currently 1), `state` (`PROVISIONING`, `ACTIVE`, `DELETING`, or `DELETED`),
`created_at`, `updated_at`, and optional `application_manifest_version`,
`deletion_started_at`, and `deletion_completed_at`. It has no TTL field. Normal
bootstrap atomically creates `ACTIVE` metadata plus profile and default settings;
`PROVISIONING` supports safe incomplete-record recovery. Existing records are
preserved with conditional checks. Counters remain lazy and an absent counter
represents zero.

`POST /api/v1/me/bootstrap` accepts no authoritative client fields and always
initializes the authenticated durable owner. It returns readiness/version,
profile, and settings with HTTP 200 for both initialization and replay. Demo
identities receive 403. Ordinary durable operations require complete readiness;
`GET /me` cannot initialize a workspace. Compatible legacy local records are
adopted without seed/reset. TTL/type/owner conflicts are never repaired by stripping
expiry. Lost responses and concurrent attempts converge through atomic conditional
writes. Missing settings in an already active workspace return a conflict because
preferences cannot safely be reconstructed; missing profiles can be recovered
from the trusted source. Defaults are UTC, 7 follow-up days, ACTIVE application
view, 30d dashboard range, SYSTEM theme, and settings version 1.

Only LOCAL can adopt unmarked legacy data. PERSISTENT bootstrap requires an empty
owner or compatible persistent readiness provenance. Explicit bootstrap conditionally
synchronizes changed trusted name/email under the ACTIVE/no-TTL transaction guard;
ordinary `/me` overlays current admitted attributes without a write. Settings and
creation timestamps survive replay. Persistent DELETE `/me` and deletion retry
return `403 ACCOUNT_MANAGEMENT_UNAVAILABLE` until the separate Phase 5D safety work.

Durable application creation atomically adds a minimal owner-scoped manifest
reference, retained through archive/restore and child changes. Fresh empty durable
workspaces have `application_manifest_version=1`; older LOCAL workspaces require
explicit verified local backfill before full JSON export or erasure. Ordinary
durable mutations condition-check ACTIVE state, owner provenance, bootstrap
version, and absence of TTL in the same transaction as their resource changes.
Demos retain signed expiry and TTL without durable manifest references or guards,
and cannot use durable erasure.

The implemented local erasure API conditionally freezes `ACTIVE` to `DELETING`,
blocking ordinary access, exports, bootstrap, and writes that passed earlier
preflight. Bounded retries use strongly consistent manifest and canonical queries
to erase application partitions and owner data, including activity; this is
separate from ordinary application archival. Unfinished work stays `DELETING` and
resumes from remaining server-owned references/items. Strong verification precedes
terminal `DELETED`, leaving only a minimal non-TTL lifecycle tombstone that
bootstrap cannot resurrect. There is no destructive account UI; provider identity
deletion/revocation and historical backup erasure are outside this live-table
contract. Tombstone retention remains provisional. See
[ADR 0007](adr/0007-durable-workspace-manifest-and-erasure.md) for prerequisites,
safety guarantees, and future hosted-account boundaries.

## Application

- `application_id`, `owner_user_id`.
- Required `company_name`, `job_title`, and non-null `status`.
- `applied_date`, nullable only for a draft or an archived former draft. It is a user-entered calendar date, is never later than the workspace's current calendar date, and is never converted into a timestamp.
- Optional `follow_up_date`, `job_url`, `location`, `work_mode`, normalized `source`, `source_detail`, `salary_text`, `description`, and candidate-selected `role_family`. A null role family allows conservative title inference only for interview preparation; `GENERAL` explicitly requests universal guidance.
- Optional `next_step_responsibility`: `CANDIDATE`, `EMPLOYER`, `NONE`, or null for a legacy/not-yet-reviewed active opportunity. `next_step_note` stores bounded candidate context. `follow_up_date` is independent and means the calendar date when HireFlux should surface the opportunity again if nothing changes.
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
- Denormalized `company_name`, `job_title`, and optional application role family, synchronized transactionally when the owned
  parent labels change and refreshed from the parent when the interview itself changes.
- `created_at`, `updated_at`, and integer `version`.
- Private preparation notes, candidate questions, completed checklist IDs, and up to two server-ID custom preparation items. Server-owned essential outcomes determine preparation completion; additional and candidate work cannot regress it.
- Optional `debrief_primary_reflection` and `debrief_carry_forward`, plus the compatible structured private `debrief_*` fields and original completion timestamp. Reflection remains interview-scoped and may be revised with optimistic concurrency. See [interview-preparation.md](interview-preparation.md).

Only scheduled interview logistics are editable. They may transition to completed or canceled; both are lifecycle-terminal. A completed interview's private reflection may still be revised without changing the original completion timestamp. Rescheduling, status changes, and workspace changes append activity.

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

Activity types include application creation/status changes, `NEXT_STEP_UPDATED`, follow-up completion/rescheduling, note mutations, and interview scheduling/updates/status changes. Ordinary application behavior can append activity but cannot edit or delete it. Activity records never copy private preparation, reflection, note, or next-step prose.
