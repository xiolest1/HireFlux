# Phase 5C — frontend Cognito implementation and local qualification

Date: October 20, 2026. Disposition: **PASS WITH EXPLICIT QUALIFICATIONS**.
This is a local source checkpoint, not acceptance of a real Cognito integration.
Phase 5C stops here; 5D and 5E require separate authorization.

## Baseline and execution boundary

The actual starting tree was clean at
`138309d759e43ba4eda131e9f047a5bcf919f446` (`5B: Backend Cognito implementation`).
This supersedes the attachment's description of uncommitted 5B work; the older
5B handoff remains historical evidence. No inherited dirty changes were removed.
All changes described here remain uncommitted.

No AWS/GitHub account API calls, real Cognito calls, hosted staging requests,
demo issuance, credential operations, remote CI, Amplify builds, pushes or
deployments occurred. Dependency registry/audit requests and official public
documentation reads were used. Backend, infrastructure, workflows, original
diagrams, accepted 5A contract and historical 5B/4H evidence remain unchanged.
The staging testing pause and owner-approved cash-funded baseline remain in force.

## Implemented account flows

The existing `WorkspaceSessionController` remains the sole session authority.
Its DEMO and guarded development LOCAL adapters now coexist with a COGNITO
adapter. Users explicitly choose a demo or account; account errors never issue
or restore a demo as fallback. The current selected adapter survives a reload
without storing credentials in that selection marker.

Public landing content renders independently of private hydration. Account entry
requires a validated version-1 `GET /api/v1/auth/config` response from the
configured API. Zod checks fields, capability/provider agreement, scopes, data
policy and approved environment/site/API pairing. Exact staging trust and
loopback-only mock development are accepted; no production account trust map is
invented. Only HTTP 404 selects legacy demo compatibility. Other failures disable
account entry with explicit retry; there is no polling. The unauthenticated
request omits cookies, refuses redirects, accepts at most 16 KiB of UTF-8 bytes
and has a ten-second deadline covering response-body processing.

Sign In and Create Account use the managed authorization flow with `prompt=login`.
New users choose the provider's Create account option; password handling,
verification and recovery stay with Cognito. Dirty forms require abandonment
confirmation. The old generation, query cache and private UI are invalidated
before OAuth initiation. Dedicated public `/auth/callback` and
`/auth/signed-out` routes remain outside workspace guards.

Successful OAuth processing or stored-session restoration must complete the
existing authenticated `POST /api/v1/me/bootstrap` with `{}` before private
routes render. Trusted bootstrap must report PERSISTENT, the same opaque subject
as the OIDC session, and STANDARD_USER. It seeds only profile/settings caches;
no applications are imported or seeded. All other resource UUID validation is
preserved. A temporary bootstrap failure retains this verified account for
explicit same-account retry. DELETING/DELETED/conflict responses show restricted
guidance and do not recreate data or start another identity.

## Protocol and library qualification

Pinned dependencies: `oidc-client-ts` **3.5.0** and its decoder dependency
`jwt-decode` **4.0.0**, also declared directly because the application imports it.
The lockfile adds these two packages without upgrading unrelated versions.

The supported lower-level `OidcClient` performs state creation/consumption,
S256 PKCE, nonce comparison and authorization-code/refresh/revocation exchanges.
No `UserManager` is instantiated: its user storage, event delivery, automatic
silent renewal, session monitoring and iframe/popup paths are absent. This
avoids its default automatic-renew behavior and keeps one coordinator. Installed
3.5.0 response/storage behavior was inspected rather than relying on defaults.
An explicit nonce is supplied because the SDK code-flow default does not create
one. Public-client exchange sends no client secret. Explicit metadata pins the
issuer and authorize/token/revoke endpoints, disables userInfo loading and avoids
browser discovery/JWKS requests. SDK logging is disabled.

The SDK is **not a browser JWT signature verifier**. The wrapper additionally
checks token-use, issuer, client, subject, scopes and bounded time claims, while
the 5B backend verifies signatures and trusted provider admission. Decoding is
never evidence of API privilege. Bootstrap remains authoritative.

Callback processing requires the exact origin/path/registered redirect, query
code flow, allowed single-valued parameters, one valid five-minute tab transaction,
matching nonce/context and a validated same-origin workspace return path. State
is consumed synchronously before exchange. The page captures once and promptly
removes query parameters from history before asynchronous work. StrictMode shares
only the active callback promise; completed/canceled/stale callbacks are rejected.
The initial hosting callback request can still contain code/state in access
records; no claim is made that browser cleanup erases those records.

## Credential storage, fencing and rotation

With refresh-family ownership established by a native Web Lock, a guarded
`sessionStorage` envelope persists the SDK User: **access token, ID token,
refresh token, profile and expiry**, not only a refresh token. Tab storage also
holds the nonce/PKCE transaction and opaque instance identifier. Credentials are
JavaScript-readable and remain exposed to successful same-origin XSS. They are
never placed in localStorage, URLs, query caches, broadcast messages or diagnostics.

LocalStorage holds only an opaque logout epoch. A duplicated tab inheriting tab
storage cannot acquire the original instance's lock and refuses restoration;
it does not revoke the other tab's family. Without Web Locks, a new callback may
create a memory-only account; reload requires sign-in. Full-page login requires
working tab/epoch storage for transaction binding and fails safely if unavailable.
Broken credential writes cannot be treated as restorable sessions.

Every API operation retains an immutable identity scope and the credential
revision used for its request. Scope checks surround credential acquisition,
headers, body parsing and asynchronous effects. QueryClients, drafts, preferences,
downloads, navigation and mutation continuations keep the existing fences.
An old-revision 401 cannot invalidate a renewed credential; an old-generation
response cannot affect another identity.

Refresh runs on demand within 60 seconds of expiry, with one shared promise per
active account. It advances credential revision without clearing same-user cache
or forms. Rotation must return a nonempty changed refresh token and consistent
issuer/client/subject. The final native persistence write and generation/epoch/
instance/revision checks occur in the same JavaScript turn. SDK receipt-derived
expiry is capped at the token's `exp`, never extended; this handles token delivery
latency conservatively. Stale completions cannot write after logout or a new login.

The accepted ten-second provider grace period does **not** authorize refresh
retry. A lost response, invalid grant, timeout, 429, 5xx, identity mismatch or
storage failure clears account access and requires interactive sign-in. There
is one refresh attempt and no automatic refresh-family revocation on ambiguity.
Ten-second SDK/whole-operation deadlines also bound stalled response bodies.

## Retry and logout policy

- Configuration: one request; user-triggered retry only.
- OAuth callback: one transaction/code exchange; duplicate renders share only
  its pending operation. Starting again creates a new transaction.
- Credential refresh: one coordinated attempt; no retry using an uncertain token.
- Ordinary reads: existing TanStack Query bounded retry remains; every attempt
  still checks its originating scope and cannot revive an invalidated session.
- Bootstrap: no automatic replay; explicit same-account retry uses its idempotent
  backend contract. Lifecycle denial is not a transient retry invitation.
- Mutations: existing mutation retry remains disabled; no automatic replay after
  401 or an unknown network outcome. A write may have committed server-side even
  when its old UI continuation is discarded.
- Downloads: the originating scope is checked after blob processing and before
  browser exposure; stale exports are discarded.

Logout captures the current refresh token in memory, fences and clears private
access first, advances the credential-free epoch and broadcasts logout, then
attempts one bounded revocation. Messaging failures do not prevent local cleanup
or the storage-event fallback. Other account tabs clear their sessions; independent
demo tabs keep their demo behavior. Canceled/signed-out selection prevents stale
reload restoration even while public configuration is unavailable. Raw account
storage can be cleared without constructing a provider client.

Navigation uses Cognito's documented `/logout` with only `client_id` and the exact
registered `logout_uri`; no generic ID-token logout hint is used. Failed revocation
or navigation leaves local access cleared and offers honest managed-cookie
uncertainty/retry guidance. The retry opens provider logout, not an uncertain
revocation replay. Logout never deletes durable workspace data.

## UI, Settings and hosting policy

Persistent workspaces show trusted provider profile fields, Sign Out, JSON export
and retained-data semantics without demo expiry/reset/simulations. Permanent
account deletion remains unavailable. Disposable-staging metadata enables clear
fictional-data, supervision and no-backup/recovery notices. LOCAL remains a guarded
development identity and does not acquire a provider dependency.

Settings PATCH sends only changed fields plus `expected_version`. Demo time zone
becomes manual only after an actual successful time-zone change; unrelated saves
do not mark it manual. A 409 retains edits and offers an explicit saved-preference
refresh before retry. Persistent settings are not overwritten by browser time-zone
detection; stale mutations remain fenced.

Only this exact offline 5A proposal was added to staging `connect-src`:

`https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com`

It is not evidence that a domain/pool exists. The existing regional API CSP source
is preserved, API CORS is unchanged, and no Cognito origin is added to API CORS.
Script/frame/form/worker protections remain intact. Referrer-Policy becomes
`no-referrer`. Header source, root staging template/artifact, Vite policy, renderer
and tests agree. Production output has no reviewed Cognito origin and cannot
overwrite the checked-in staging artifact. A future production release needs its
own explicit trust/publication qualification. Existing SPA fallback and missing
static-asset rules are unchanged and locally tested.

## Verification and fixes

The full frontend suite passed **510 tests in 54 files**. Focused coverage includes
the actual SDK against fake endpoints, state/nonce/issuer/client/time validation,
PKCE, replay and stale writes, single-flight/lost refresh outcomes, storage failure,
expired-access renewal, old-revision 401s, uncertain writes, delayed exports,
bootstrap retry/denial, metadata limits, cross-tab and disposal races, and Settings.
Existing demo/LOCAL, identity, route, accessibility and product tests are included.

Review/browser testing found and corrected: self-broadcast interrupting logout;
blocked BroadcastChannel preventing cleanup/fallback; canceled login while config
was pending; late disposed configuration affecting a replacement controller;
demo restoration despite disabled capability; signed-out cleanup during a config
outage; post-buffer rather than streaming body bounds; and SDK receipt-time expiry
incorrectly rejecting otherwise valid delayed tokens. An injected legacy-adapter
storage regression was corrected without weakening its assertion.

Final local gate commands and receipts are recorded below. No backend suite was
reopened: no backend source/contract change was needed.

Commands run from the repository root unless noted:

- `npm --prefix frontend ci --ignore-scripts`: clean lockfile install passed;
  448 packages installed and 449 audited. Lifecycle scripts were suppressed;
  the installed graph subsequently passed build/browser checks.
- `node node_modules/eslint/bin/eslint.js . --max-warnings 0` and
  `node node_modules/typescript/bin/tsc -b` from `frontend/`: passed.
- `node node_modules/vitest/vitest.mjs run --maxWorkers=2` from `frontend/`:
  510/510 tests, 54/54 files passed. Current test discovery also lists 510 tests.
- `node --test frontend/scripts/render-hosting-headers.test.mjs frontend/scripts/verify-hosted-build.test.mjs`:
  12/12 tests passed. Security-header unit cases are also in the full suite.
- `node frontend/node_modules/@playwright/test/cli.js test --config frontend/playwright.auth.config.ts`:
  final rerun 8/8 passed in 21.8 seconds at desktop 1280×900 and mobile 390×844.
  All provider/API calls were intercepted; unexpected external destinations were
  blocked. Actual SDK PKCE exchange, bootstrap/reload, wrong nonce, callback query
  cleanup/replay, cross-tab logout, native clone-lock refusal and failed mobile
  revocation guidance passed. Screenshots were visually inspected.
- Production build: after TypeScript, ran
  `node node_modules/vite/bin/vite.js build --outDir ../.tools/phase5c/production-dist`
  from `frontend/` with existing `VITE_WORKSPACE_MODE=demo` and the accepted
  staging public API/site URLs. This is a local production-mode artifact, not a
  deployed update. Original `dist/` and frozen deployment artifacts were preserved.
- With the same public variables,
  `node scripts/verify-hosted-build.mjs --directory ../.tools/phase5c/production-dist`
  from `frontend/`: 43 files passed; expected public URLs present; no detected
  private material/local endpoints, source maps or private configuration files.
  This is a rule-based leakage scan, not proof against every possible secret.
- `npm --prefix frontend audit --audit-level=high`: zero known vulnerabilities.
  `npm --prefix frontend sbom --package-lock-only --sbom-format cyclonedx --sbom-type application`:
  generated a separate ignored `.tools/phase5c/frontend.cdx.json` inventory.
- `node frontend/scripts/render-hosting-headers.mjs --environment production --output .tools/phase5c/production-headers.yml`:
  separate production policy rendered without staging Cognito trust.
- `backend/.venv/Scripts/python.exe .tools/phase5c/verify_preservation.py`:
  all 88 frozen evidence entries, ten consumed ledgers, 59 prior receipt entries,
  original canonical/bound artifacts and 5B candidate preserved. Backend, infra,
  workflows, diagrams and accepted historical handoffs are unchanged.
- `git diff --check` and local documentation link/source-evidence checks: passed;
  the inventory below covers all 46 changed/new paths, including seven Markdown
  documents whose local links were checked.

The suite emits a non-failing jsdom document-navigation notice; browser output
also contains terminal color-environment warnings. Neither contains credential
material. These do not establish real provider navigation behavior; the mocked
browser assertions are the local navigation evidence.

Ignored local evidence lives under `.tools/phase5c/`,
`.tools/phase5c-auth-browser/` and `.tools/phase5c-*.log`; it is not a committed
release artifact. Screenshot/network traces contain no real users or credentials;
OAuth tracing is disabled. Public official documentation confirms the
[refresh grant and rotation contract](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html)
and [Cognito logout parameters](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html).
SDK behavior is qualified against the pinned installed 3.5.0 implementation and
[its response validator source](https://github.com/authts/oidc-client-ts/blob/v3.5.0/src/ResponseValidator.ts).

## Changed files

Application, dependency and header sources:

- `customHttp.template.yml`
- `customHttp.yml`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/scripts/render-hosting-headers.mjs`
- `frontend/src/api/authConfiguration.ts`
- `frontend/src/api/client.ts`
- `frontend/src/api/workspaceBootstrap.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/auth/WorkspaceSessionGuard.tsx`
- `frontend/src/auth/cognitoClient.ts`
- `frontend/src/auth/cognitoCoordination.ts`
- `frontend/src/auth/cognitoSessionAdapter.ts`
- `frontend/src/auth/cognitoSessionStore.ts`
- `frontend/src/auth/sessionAdapters.ts`
- `frontend/src/auth/sessionGeneration.ts`
- `frontend/src/auth/workspaceCapabilities.ts`
- `frontend/src/auth/workspaceSessionController.ts`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/features/resources/queries.ts`
- `frontend/src/pages/AuthCallbackPage.tsx`
- `frontend/src/pages/AuthSignedOutPage.tsx`
- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/securityHeaders.ts`
- `frontend/vite.config.ts`

Tests and local browser tooling:

- `frontend/e2e/cognito-auth.spec.ts`
- `frontend/playwright.auth.config.ts`
- `frontend/scripts/render-hosting-headers.test.mjs`
- `frontend/scripts/serve-auth-fixture.mjs`
- `frontend/src/api/authConfiguration.test.ts`
- `frontend/src/api/cognitoRequests.test.ts`
- `frontend/src/auth/CognitoControllerRaces.test.ts`
- `frontend/src/auth/cognitoClient.test.ts`
- `frontend/src/auth/cognitoCoordination.test.ts`
- `frontend/src/auth/cognitoSessionAdapter.test.ts`
- `frontend/src/auth/cognitoSessionStore.test.ts`
- `frontend/src/pages/SettingsPreferences.test.tsx`
- `frontend/src/securityHeaders.test.ts`

Current documentation:

- `ARCHITECTURE.md`
- `README.md`
- `docs/architecture.md`
- `docs/devlog.md`
- `docs/phase5c-frontend-cognito-handoff.md`
- `docs/roadmap.md`
- `frontend/README.md`

## Qualifications and next authorized boundary

Fake-provider Chromium tests do not prove real managed-login/signup/email recovery,
Cognito cookies, token endpoint CORS, live rotation/revocation or provider throttling
behavior. No real browser/provider/account is accepted by this checkpoint. Only
Chromium desktop/mobile was exercised; other browsers' storage/locking behavior
needs later qualification. Browser token decoding provides no signature authority.
JavaScript-readable credentials retain the XSS risk described above. The current
deployed Amplify site, Lambda and paused fictional-demo environment are unchanged.

Phase 5D must implement the already accepted recent-authentication/account-safety
and provider-finalization workflow, Cognito CDK resources/configuration, exact
callback/logout/domain binding, public client/scopes, token lifetimes and rotation
with the ten-second grace setting, and offline final artifact/source qualification.
Keep account deletion unavailable until that workflow is complete. Preserve the
current frontend build variables and backend public metadata boundary. Production
trust, data durability and release gates remain separate.

Phase 5E alone may authorize resource deployment, real account creation and bounded
live managed-login/refresh/logout verification after renewed source, security and
cost approval. The original 5A–5E and later roadmap remains unchanged. No work on
5D or 5E begins automatically.
