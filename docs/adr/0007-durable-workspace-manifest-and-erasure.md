# ADR 0007: Strong durable application inventory and resumable workspace erasure

- Status: Accepted for Phase 2C
- Date: 2026-10-05

## Context

Readiness checks alone cannot prevent a request that passed preflight from writing
after erasure starts. Eventually consistent application indexes cannot establish
an exhaustive erasure inventory. Record counts alone cannot bound export payloads.

## Decision

Keep the single table and existing indexes. Durable creation atomically writes a
minimal `APPLICATION_REF#<application_id>` in the owner partition with canonical
metadata, activity, quotas, and counters. Archive, restore, and child mutations
retain this reference. Demos do not acquire references or durable guard reads.

New empty durable workspaces have `application_manifest_version=1`, separate from
`bootstrap_version=1`. Older LOCAL workspaces require an explicit, confirmed,
loopback-only backfill. Status indexes supply candidates, not completeness. Strong
canonical validation, exact unique candidate/ref equality against the authoritative
lifetime application quota, and a quota-conditioned final marker establish
completeness. Concurrent creation invalidates that condition; rerunning is safe.
TTL/provenance/orphan/count discrepancies fail closed without resetting data.

All ordinary durable mutations include a ConditionCheck proving ACTIVE durable
workspace provenance/schema/no TTL in the same transaction as their existing
optimistic writes. Single-item settings/application writes become transactions.
Local reconciliation also conditionally denies writes after a lifecycle freeze;
its explicit operator path supports pre-bootstrap local legacy data separately.

The provider-neutral erasure service freezes ACTIVE to DELETING conditionally.
Ordinary reads, writes, bootstrap, and exports then deny access. Repeated deletion
and retry process bounded strong owner/reference/application queries. Entire
application partitions, including unknown entity types, are erased in batches of
at most 25. References disappear only after a strong empty-partition query. Owner
data is then erased except WORKSPACE; strong verification precedes DELETED.
Remaining references/items provide durable progress without client cursors/jobs.
Unprocessed batches receive at most four attempts with bounded backoff. Item,
elapsed-work, and operation bounds preserve DELETING on unfinished work. Transient
failure never restores ACTIVE. Time budgets are checked between SDK operations;
they do not interrupt an in-flight SDK call.

The non-TTL DELETED tombstone contains only owner provenance, lifecycle/schema,
creation/update and deletion timestamps. It has no profile, preferences, product
content, application IDs, or manifest. Bootstrap cannot resurrect this subject.
Retention is provisionally non-expiring; production privacy/backup/token policy
must settle its eventual retention and restore semantics.

Full JSON export requires an ACTIVE complete manifest, strongly discovers
applications, and reads canonical child pages. It incrementally accounts records,
public-response UTF-8 bytes (including derived guidance), and monotonic elapsed
work. The exact final JSON bytes/time are checked before delivery. Limits return
413 WORKSPACE_EXPORT_TOO_LARGE without a partial success. CSV retains its existing
owner/status-index discovery and formula neutralization; it is a human-readable
bounded application list, not the complete account archive. Both have no-store
headers. Export is a current best-effort copy, not a transactional snapshot.

## Consequences and phase boundary

No table reset/index migration is required. Local users with pre-2C data run the
explicit backfill before full JSON export or erasure. The frontend session
architecture and UI stay unchanged; there is no destructive account button.

This erases HireFlux live-table workspace content only. It does not delete a
Cognito identity or historical backups. Provider-backed recent authentication,
identity deletion/revocation, public destructive UX, and backup/retention policy
are Phase 5/6 work. Future provider finalization follows HireFlux DELETED without
changing the erasure engine. CDK definitions/synthesis are Phase 3; AWS staging
deployment is Phase 4. No AWS/Cognito/CDK/background worker is implemented here.
