# ADR 0006: General frontend workspace sessions

- Status: Accepted for Phase 2B
- Date: 2026-10-05

## Context

Phase 2A provides an empty durable backend workspace. The browser previously
assumed a demo credential and lifecycle in API access, protected routes, settings,
and layout. Clearing a cache alone cannot prevent late requests, mutation
callbacks, exports, or authentication errors from acting on a replacement identity.

## Decision

Use an injected `SessionAdapter` at composition and a discriminated session state
in `WorkspaceSessionController`, exposed by `WorkspaceSessionProvider`. Ordinary
workspace UI uses temporary/durable capabilities, retaining shared product pages.
States cover initialization, anonymous, activation/bootstrap, ready, reset
switching, expired/invalidation, and stable errors. Errors retain the existing
safe API envelope and request ID. Bootstrap failures require explicit retry.

The demo adapter preserves tab storage, signed 24-hour expiry, serialized launch,
idempotent operation keys, reset, and valid previous-workspace recovery after
failure. Retry retains a demo key only for lost responses or provisioning-in-progress.
Reset removes old protected content while its confirmation/retry intent survives.

The local adapter exists only for development with `VITE_WORKSPACE_MODE=local`
paired with backend `AUTH_MODE=local`. It never supplies owner/name/email/role or
a fabricated credential. It validates Phase 2A bootstrap evidence, including
ACTIVE state, LOCAL kind, schema version, timestamps, profile, and settings. Only
then does it seed profile/settings and publish readiness. Refresh repeats the
idempotent bootstrap; leaving persists only a tab-local boolean. No personal
data or durable credentials are stored in the browser. Configured local mode
ignores unrelated demo storage. Production local configuration fails closed.

Every transition creates a unique generation before clearing/cancelling the old
QueryClient and mutation cache. Ready generations get fresh clients. Workspace
query consumers remount at the shared layout boundary because existing TanStack
observers retain their original client. `keepPreviousData` remains within one
generation. Initial and transition caches never provide protected data.

JSON and download helpers capture an immutable credential scope and check it
after headers and body parsing. Scoped query/mutation hooks fence result delivery,
observer and per-call callbacks, and `mutateAsync` continuations. Mutation
variables retain their originating scope even if an observer changes options.
Compound operations check scope between HTTP calls. Component continuations,
scoped navigation/toasts, theme rollback, and object-URL exposure check the same
scope. An old 401 or old reset/bootstrap result cannot invalidate/reactivate a
new generation. No generic write replay is introduced.

Durable preferences are authoritative server data, including UTC/default values;
browser detection and manual tab markers cannot overwrite them. Demo-only
auto-detection and optional account simulations remain truthful. Central cleanup
removes identity-specific tour/preview/manual-zone state while retaining harmless
device sidebar/appearance preferences. Voluntary leave confirms registered unsaved
forms; reset warns explicitly. Forced invalidation fences first and bypasses form
navigation blockers. No cross-identity draft autosave is added.

## Consequences and limits

The public landing page does not wait for personal hydration. Protected deep links
wait for authoritative initialization, and only validated same-origin workspace
return paths are accepted. Durable local layout omits demo expiry/reset/simulated
account controls and exposes the existing full JSON export. Browser/backend
configuration must agree; mismatch is an error, never an automatic demo fallback.

This is not Cognito, real login, real sign-out, or production account readiness.
Backend policy, ownership, bootstrap, keys, indexes, TTL, CSP, dependencies, and
API contracts are unchanged. Future adapters can invoke credential-free invalidation
without broadcasting profile, application data, or tokens; real cross-tab auth
coordination remains future work.

DEFERRED TO 2C: strong application manifest, persistent deletion lifecycle,
deletion/write guards, and expanded export safety.

DEFERRED TO PHASE 3: TypeScript CDK definitions and synth only.

DEFERRED TO PHASE 5+: Cognito access-token verification, managed login/PKCE,
refresh/revocation, real account controls, production cross-tab logout, and
optional attachments/reminders/email. AWS staging remains Phase 4, undeployed.
