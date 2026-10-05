# ADR 0005: Durable local identity and explicit empty workspace bootstrap

- Status: Accepted for Phase 2A
- Date: 2026-10-05

## Context

The local fixed owner already writes non-expiring data through the shared domain,
but public profile/settings reads previously initialized records implicitly.
Identity also mixed name/email, demo flags, and generic expiry. Persistent access
credentials must eventually expire independently of durable workspace data.

## Decision

Keep the modular monolith, existing owner/application keys, and all three indexes.
Separate verified principal fields from trusted profile attributes. Require data
expiry for DEMO, prohibit it for LOCAL and future PERSISTENT, and derive demo
classification from kind. Authentication configuration and local deployment guards
remain unchanged; no Cognito implementation or browser account session is added.

Authenticated non-demo `POST /api/v1/me/bootstrap` creates an empty profile,
deterministic UTC settings, and versioned durable ACTIVE readiness record in one
conditional transaction. The body has no fields and needs no idempotency key.
Absent quotas/counters continue to mean zero. The readiness record occupies the
existing owner WORKSPACE slot under a distinct entity type, preventing accidental
demo conversion. It has no TTL. Existing compatible profile/settings are condition
checked, never rewritten; race conflicts reread and converge through bounded retries.

Use one central dependency to require readiness before ordinary durable API
operations. GET /me reads an established profile. Verified demos bypass durable
readiness and retain their separate seed/token lifecycle. Demo display-name
compatibility is read-only and demo-specific. Deprecate the nullable login field
and return null; creation-only legacy storage does not prove login events.

Recover compatible incomplete records, preserving timestamps and preferences.
New bootstrap cannot partially create its three items because the transaction is
atomic. Recover a missing active profile from trusted attributes; fail explicitly
if ACTIVE settings disappear, rather than guessing customized preferences.
Never delete durable data or remove TTL during recovery. Adopt compatible local
legacy data after owner validation and lifetime checks on GSI2-discovered application
partitions, including archived records and helper items.

## Consequences

Local API callers must bootstrap before workspace operations. The SPA remains
demo-only. No table reset, migration, new index, infrastructure deployment, or
authentication provider dependency is required. Readiness costs a strongly
consistent owner query per durable request; demo requests pay no extra query.

Legacy discovery remains eventually consistent and cannot enumerate unindexed
orphans reliably. Phase 2C must add the strong manifest, deletion states, and write
guards before personal-account erasure or production safety is claimed. Existing
export remains as implemented and is not an erasure guarantee.

Follow-on order: Phase 2B frontend sessions; Phase 2C persistent-account safety;
Phase 3 CDK synth; Phase 4 AWS staging demo; Phase 5 Cognito staging accounts;
Phase 6 hardening; Phase 7 production deployment. Direct verified Cognito sub
ownership is approved for later implementation.
