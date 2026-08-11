# DynamoDB access patterns

## Modeling rules

HireFlux uses one table with string partition and sort keys named `PK` and `SK`. Item types share the table but remain explicit through an `entity_type` attribute. Normal request paths use `GetItem` and `Query`, never `Scan`.

Milestone 1 creates two sparse indexes:

- `GSI1` (`GSI1PK`, `GSI1SK`) lists all of an owner's applications by most recent update.
- `GSI2` (`GSI2PK`, `GSI2SK`) lists an owner's applications by status.

Both Milestone 1 indexes use `ALL` projection. Archived items remain on GSI1 so the default list can show them clearly and the UI can filter to `ARCHIVED`; archiving never makes a record undiscoverable.

Later milestones may add `GSI3` for scheduled work and a tightly controlled sparse admin index. Adding an index is a schema migration decision, not an application-startup behavior.

## Item shapes

| Entity | Primary key | Sort key | Relevant index keys |
| --- | --- | --- | --- |
| User profile | `USER#<user_id>` | `PROFILE` | none |
| Application | `USER#<owner>#APPLICATION#<application_id>` | `METADATA` | `GSI1PK=USER#<owner>#APPLICATIONS`, `GSI1SK=<updated_at>#<id>`; `GSI2PK=USER#<owner>#STATUS#<status>`, `GSI2SK=<updated_at>#<id>` |
| Activity | same application partition | `ACTIVITY#<created_at>#<activity_id>` | optional owner recent-activity projection later |
| Note | same application partition | `NOTE#<note_id>` | creation time in a timeline index later |
| Interview | same application partition | `INTERVIEW#<interview_id>` | scheduled time in sparse schedule/timeline indexes later |
| Attachment metadata | same application partition | `ATTACHMENT#<attachment_id>` | upload time in a timeline index later |
| Notification | `USER#<owner_user_id>` | `NOTIFICATION#<created_at>#<notification_id>` | sparse unread index later |
| Status counter | `USER#<owner_user_id>` | `METRIC#APPLICATION_STATUS#<status>` | none |

Every child item repeats `owner_user_id` as a defense-in-depth assertion and useful projection. Because the application partition includes the authenticated owner, a guessed application UUID cannot address another user's items.

## Access-pattern inventory

| # | Query | Key condition / operation | Index | Pagination | Authorization check |
| --- | --- | --- | --- | --- | --- |
| 1 | Get profile by Cognito `sub` | `GetItem PK=USER#sub, SK=PROFILE` | table | none | `sub` comes from verified identity |
| 2 | Create an application | conditional transaction put of metadata plus activity in owner-qualified partition | table | none | owner is derived from identity; body has no owner field |
| 3 | Get one application | `GetItem PK=USER#sub#APPLICATION#id, SK=METADATA` | table | none | absent under that owner is `404`, avoiding existence disclosure |
| 4 | List an owner's applications | `Query GSI1PK=USER#sub#APPLICATIONS`, descending | GSI1 | signed opaque cursor from a logical last key | index partition is rebuilt from identity |
| 5 | Query an owner's applications by status | `Query GSI2PK=USER#sub#STATUS#status`, descending | GSI2 | cursor is bound to owner and status | owner comes from identity; status is a validated enum |
| 6 | Edit application | owner-key `GetItem`, then conditional versioned write | table | none | owner-qualified key plus expected version |
| 7 | Transition/archive application | owner-key read, domain policy, transactional conditional write plus activity | table | none | owner-qualified key; policy is server-owned |
| 8 | List notes | `Query owner-qualified application PK AND begins_with(SK, NOTE#)` | table | signed child cursor | partition is derived from identity plus route id |
| 9 | Create/get/update/delete one note | conditional `PutItem`/`GetItem`/versioned write/delete at `SK=NOTE#id` | table | none | owner-qualified parent partition; body has no owner/application IDs |
| 10 | List interviews | `Query owner-qualified application PK AND begins_with(SK, INTERVIEW#)` | table | signed child cursor | partition is derived from identity plus route id |
| 11 | Create/get/update/cancel one interview | conditional `PutItem`/`GetItem`/versioned write at `SK=INTERVIEW#id`; schedule projection updated transactionally | table + GSI3 | none | owner-qualified parent partition |
| 12 | List attachments | `Query owner-qualified application PK AND begins_with(SK, ATTACHMENT#)` | table | signed child cursor | partition is derived from identity plus route id |
| 13 | Create/finalize/get/delete attachment metadata | conditional operations at `SK=ATTACHMENT#id`, coordinated with private S3 lifecycle | table | none | parent ownership verified before presign/finalize/delete |
| 14 | Retrieve activity timeline | `Query owner-qualified application PK AND begins_with(SK, ACTIVITY#)` | table | signed child cursor | partition is derived from identity plus route id |
| 15 | Upcoming follow-ups/interviews | `Query GSI3PK=USER#sub#SCHEDULE` with time range on `GSI3SK=<UTC>#<kind>#<id>` | GSI3, later | cursor bound to time window | index owner is derived from identity |
| 16 | List/create notifications | owner-partition query or conditional put at `NOTIFICATION#<id>` | table | signed cursor for list | owner comes from verified identity/event target |
| 17 | Read or mark one notification read | `GetItem` or conditional versioned update at owner/notification key | table | none | owner partition comes from identity |
| 18 | List unread notifications | `Query GSI2PK=USER#sub#NOTIFICATION#UNREAD` | overloaded GSI2 | signed cursor | owner partition comes from identity |
| 19 | Dashboard counts by status | parallel `GetItem`/`BatchGetItem` of six status counter items | table | none | counter keys use authenticated owner |
| 20 | Later admin reporting | role-gated query on a sparse admin index keyed by entity/date | admin GSI, later | signed cursor | separate admin service requires `ADMIN`; ordinary methods never use this index |

## Cursor contract

The API converts DynamoDB's last evaluated key into a small logical payload containing a format version, list kind, last timestamp, last application ID, status when present, and an owner/query fingerprint. It signs canonical JSON with HMAC-SHA256 and base64url-encodes the payload and signature. Decoding verifies the signature and scope before reconstructing an exclusive start key.

This keeps DynamoDB attribute names out of the public contract and rejects tampering or cross-user/filter reuse. Pagination is best-effort rather than a frozen snapshot: concurrent edits can move an item and cause a duplicate or omission between pages. The frontend deduplicates accumulated pages by `application_id`; users refresh to obtain a current complete view.

## Projection maintenance

Status counters and schedule entries are denormalized read models. Milestone 2 will update status counters in the same transaction as application/status changes and maintain schedule index attributes when follow-up or interview times change. An idempotent operator-only reconciliation command will backfill Milestone 1 records; a controlled maintenance scan is acceptable there, while request-path scans remain forbidden.

GSI reads are eventually consistent. Mutations return the canonical base-table result immediately; a following list can lag briefly. Search in Milestone 2 will be a bounded in-memory filter over owner-query pages for this low-volume demo, with explicit limits. Supported server ordering remains recent update unless a new measured access pattern justifies an index.

## Local versus AWS clients

Local configuration explicitly provides `DYNAMODB_ENDPOINT_URL` plus obviously fake SDK credentials. The table initializer refuses non-loopback endpoints and validates an existing table's key/index schema instead of silently accepting drift. In AWS, the endpoint and explicit credentials are omitted; boto3 uses the configured region and the Lambda execution role.
