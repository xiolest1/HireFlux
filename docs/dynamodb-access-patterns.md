# DynamoDB access patterns

## Modeling rules

HireFlux uses one table with string partition and sort keys named `PK` and `SK`. Item types share the table but remain explicit through an `entity_type` attribute. Normal request paths use `GetItem` and `Query`, never `Scan`.

The local Milestone 2 table uses three sparse indexes:

- `GSI1` (`GSI1PK`, `GSI1SK`) lists an owner's non-archived applications by most recent update and separately projects owner interviews by scheduled time.
- `GSI2` (`GSI2PK`, `GSI2SK`) lists an owner's applications by status.
- `GSI3` (`GSI3PK`, `GSI3SK`) lists outstanding follow-ups and scheduled interviews for one owner.

All three indexes use `ALL` projection. Archived applications are removed from the non-archived GSI1 application projection; they remain discoverable through the `ARCHIVED` partition on GSI2. Explicit `ACTIVE`, `ALL`, and `ARCHIVED` list views use owner/status partitions on GSI2 rather than treating GSI1 as a semantic active view. Interview items use a distinct owner-interviews partition on GSI1 and cannot collide with application-list queries.

Adding or changing an index is an explicit schema migration decision, not an application-startup behavior. A tightly controlled sparse admin index remains deferred.

## Item shapes

| Entity | Primary key | Sort key | Relevant index keys |
| --- | --- | --- | --- |
| User profile | `USER#<user_id>` | `PROFILE` | none |
| Workspace quota | `USER#<user_id>` | `WORKSPACE_QUOTA` | none |
| Application | `USER#<owner>#APPLICATION#<application_id>` | `METADATA` | non-archived only: `GSI1PK=USER#<owner>#APPLICATIONS`, `GSI1SK=<updated_at>#<id>`; every status: `GSI2PK=USER#<owner>#STATUS#<status>`, `GSI2SK=<updated_at>#<id>`; outstanding follow-up only: `GSI3PK=USER#<owner>#SCHEDULE`, `GSI3SK=FOLLOW_UP#<date>#<id>` |
| Activity | same application partition | `ACTIVITY#<created_at>#<activity_id>` | optional owner recent-activity projection later |
| Application resource quota | same application partition | `RESOURCE_QUOTA` | none |
| Note | same application partition | `NOTE#<note_id>` | none |
| Interview | same application partition | `INTERVIEW#<interview_id>` | `GSI1PK=USER#<owner>#INTERVIEWS`, `GSI1SK=<scheduled_at>#<id>`; scheduled only: `GSI3PK=USER#<owner>#SCHEDULE`, `GSI3SK=INTERVIEW#<scheduled_at>#<id>` |
| Workspace settings | `USER#<owner_user_id>` | `SETTINGS` | none |
| Attachment metadata | same application partition | `ATTACHMENT#<attachment_id>` | upload time in a timeline index later |
| Notification | `USER#<owner_user_id>` | `NOTIFICATION#<created_at>#<notification_id>` | sparse unread index later |
| Status counter | `USER#<owner_user_id>` | `COUNTER#STATUS#<status>` | none |
| Funnel counter | `USER#<owner_user_id>` | `COUNTER#FUNNEL` | none |

Every child item repeats `owner_user_id` as a defense-in-depth assertion and useful projection. Because the application partition includes the authenticated owner, a guessed application UUID cannot address another user's items.

Every temporary demo item, including settings, notes, counters, and interviews, carries the numeric `expires_at` DynamoDB TTL attribute. Token expiry ends authorization immediately; TTL only performs eventual physical cleanup.

## Access-pattern inventory

| # | Query | Key condition / operation | Index | Pagination | Authorization check |
| --- | --- | --- | --- | --- | --- |
| 1 | Get profile by verified identity | `GetItem PK=USER#owner, SK=PROFILE` | table | none | owner comes from the verified identity dependency |
| 2 | Create an application | conditional transaction update of the owner quota plus puts of metadata and activity | table | none | owner is derived from identity; body has no owner field; quota bounds lifetime writes |
| 3 | Get one application | `GetItem PK=USER#sub#APPLICATION#id, SK=METADATA` | table | none | absent under that owner is `404`, avoiding existence disclosure |
| 4 | List/search/filter an owner's applications by view | Explicit `ACTIVE`, `ALL`, and `ARCHIVED` views fan out owner-scoped `Query` calls across four, nine, or one GSI2 status partitions, then boundedly filter, merge, and sort them; omitted legacy view uses the non-archived GSI1 partition | GSI2; legacy GSI1 | signed logical cursor bound to owner, view, status, search, source, work mode, and sort | every index partition is rebuilt from identity; the configured workspace quota bounds the merge |
| 5 | Query an owner's applications by explicit status | `Query GSI2PK=USER#sub#STATUS#status`; status overrides the broader view population | GSI2 | cursor is bound to owner, status, view, filters, and sort | owner comes from identity; status and view are validated enums |
| 6 | Edit application | owner-key `GetItem`, then conditional versioned write | table | none | owner-qualified key plus expected version |
| 7 | Transition/archive application | owner-key read, domain policy, transactional conditional write plus activity | table | none | owner-qualified key; policy is server-owned |
| 8 | List notes | `Query owner-qualified application PK AND begins_with(SK, NOTE#)` | table | `limit+1` query with a signed cursor bound to owner and application | partition is derived from identity plus route id |
| 9 | Create/get/update/delete one note | conditional `PutItem`/`GetItem`/versioned write/delete at `SK=NOTE#id` | table | none | owner-qualified parent partition; body has no owner/application IDs |
| 10 | List application interviews | `Query owner-qualified application PK AND begins_with(SK, INTERVIEW#)` | table | `limit+1` query with a signed cursor bound to owner and application | partition is derived from identity plus route id |
| 11 | Create/get/update/cancel one interview | conditional `PutItem`/`GetItem`/versioned write at `SK=INTERVIEW#id`; schedule projection updated transactionally | table + GSI3 | none | owner-qualified parent partition |
| 12 | List owner's upcoming interviews | `Query GSI3PK=USER#sub#SCHEDULE AND begins_with(GSI3SK, INTERVIEW#)` | GSI3 | bounded `limit+1` query with a signed cursor | owner comes from identity; only scheduled items project into GSI3 |
| 13 | Retrieve activity timeline | `Query owner-qualified application PK AND begins_with(SK, ACTIVITY#)` | table | `limit+1` query with a signed cursor bound to owner and application | partition is derived from identity plus route id |
| 14 | Upcoming follow-ups/interviews | two kind-prefixed `Query` operations on `GSI3PK=USER#sub#SCHEDULE`, merged by time | GSI3 | bounded dashboard result | index owner is derived from identity |
| 15 | Get/update workspace settings | `GetItem` or conditional versioned write at `PK=USER#sub, SK=SETTINGS` | table | none | owner comes from identity |
| 16 | List/create notifications | owner-partition query or conditional put at `NOTIFICATION#<id>` | table | signed cursor for list | owner comes from verified identity/event target |
| 17 | Read or mark one notification read | `GetItem` or conditional versioned update at owner/notification key | table | none | owner partition comes from identity |
| 18 | List unread notifications | `Query GSI2PK=USER#sub#NOTIFICATION#UNREAD` | overloaded GSI2 | signed cursor | owner partition comes from identity |
| 19 | Dashboard counts by status and historical funnel | strongly consistent `Query PK=USER#sub AND begins_with(SK, COUNTER#)` reads the nine status counters and funnel counter | table | none | the counter partition comes from the authenticated owner |
| 20 | Later admin reporting | role-gated query on a sparse admin index keyed by entity/date | admin GSI, later | signed cursor | separate admin service requires `ADMIN`; ordinary methods never use this index |

## Cursor contract

The API converts the last returned logical position into a small payload containing a format version, list kind, last timestamp, last item ID, and an owner/query fingerprint. The fingerprint covers view, explicit status, search, source, work mode, sort, or application scope as appropriate. The API signs canonical JSON with HMAC-SHA256 and base64url-encodes the payload and signature. Decoding verifies the signature and complete scope before continuing. A single-index query reconstructs an exclusive start key without exposing DynamoDB internals.

This keeps DynamoDB attribute names out of the public contract and rejects tampering or cross-user/filter reuse. Pagination is best-effort rather than a frozen snapshot: concurrent edits can move an item and cause a duplicate or omission between pages. The frontend deduplicates accumulated pages by `application_id`; users refresh to obtain a current complete view.

## Projection maintenance

Status counters, funnel counters, historical milestone timestamps, and schedule entries are denormalized read models. Application creation and status changes update counters in the same transaction as application metadata and activity. Follow-up and interview writes add or remove their sparse schedule keys atomically with the canonical item and activity.

The idempotent reconciliation command is deliberately local-only and requires the operator to confirm the exact table name. Its controlled maintenance scans load canonical applications and interviews, rewrite them through the current serializers, and rebuild status and funnel counters. Rewriting repairs application index attributes and both interview projections: it restores missing owner-interview or scheduled-interview keys and removes stale GSI3 schedule keys from completed or canceled interviews. Scans remain forbidden in normal request paths.

GSI reads are eventually consistent. Mutations return the canonical base-table result immediately; a following list, upcoming schedule, or dashboard action can lag briefly. Search and multi-status view merging operate over owner-scoped queries bounded by the configured workspace quota, which defaults to 100 applications. Each application also has resource quotas for stored notes (100), interviews (25), and append-only activity entries (500) by default. The `RESOURCE_QUOTA` item is updated in the same transaction as the child/activity mutation, so rejected quota writes cannot leave a partial record behind; deleting a note releases its note slot atomically. Update-time ascending and descending ordering use the index sort value and application ID as a stable logical position.

## Local versus AWS clients

Local configuration explicitly provides `DYNAMODB_ENDPOINT_URL` plus obviously fake SDK credentials. The table initializer refuses non-loopback endpoints, validates an existing table's key/index schema instead of silently accepting drift, and enables TTL on `expires_at`. In AWS, the endpoint and explicit credentials are omitted; boto3 uses the configured region and the Lambda execution role.
