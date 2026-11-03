# HireFlux — Phase 7B Batch 1 local implementation handoff

Date: November 3, 2026 (America/New_York).

**BATCH 1 LOCALLY QUALIFIED — UNCOMMITTED / UNPUBLISHED.** Production remains
unbound and the complete candidate is not approved for deployment. No AWS,
GitHub, hosted application, credential, account or email operation occurred.

## A. Executive summary

Implemented the owner-selected Option A foundation: production can explicitly
validate Cognito-only or independent Demo plus Cognito operation on one backend.
Cognito remains the mandatory production anchor. Signed production Demo sessions
must last exactly 24 hours. No cryptography or identity/ownership mapping changed.

The frontend now has one exact public deployment trust contract and refuses
unreviewed site/API/provider/environment combinations before configuration fetch
or API credential leasing. Public configuration failure cannot restore or start
either session type. Retry retires old credentials, private caches and async
continuations; a recovered configuration requires deliberate entry. Trusted Demo
remains independently available when the Cognito provider/session path fails.

This is targeted implementation, not a new architecture study. One frontend,
one API transport and the existing session controller remain. No dedicated Demo
deployment, environment, database, authentication system or new dependency was
introduced. The established Phase 7B–7G roadmap is unchanged.

## B. Baseline and files changed

Started from clean `main` at `efcd8afddcde93103637c6476a632245c431a141`.
HEAD and branch remain unchanged. There is no new commit, push or remote check.
All changes below are reviewable local changes made for this task.

Backend:

- [config.py](../backend/src/hireflux_backend/config.py): production anchor,
  explicit mixed-capability admission and 24-hour Demo policy.
- [test_auth_capabilities.py](../backend/tests/unit/test_auth_capabilities.py):
  valid/invalid production combinations, provider requirements, closed defaults,
  and staging/local compatibility.
- [test_lambda_runtime.py](../backend/tests/unit/test_lambda_runtime.py):
  synthetic mixed-production startup with the existing two signing secrets,
  role-based client construction, closed public metadata and rejected credentials.
- [test_cognito_accounts.py](../backend/tests/integration/test_cognito_accounts.py):
  existing owner/lifetime/isolation and provider-outage cases also run under
  mixed-production Settings. Original concurrency fixture/assertions remain.
- [backend README](../backend/README.md): current source contract distinguished
  from historical Cognito-only checkpoint language.

Frontend trust and transport:

- [publicDeployment.ts](../frontend/src/publicDeployment.ts) **new**: a small,
  pure reviewed-binding resolver, exact-origin validation and loopback predicate.
- [publicDeployment.test.ts](../frontend/src/publicDeployment.test.ts) **new**:
  exact staging trust, fictional production trust, unsafe/missing targets and
  callback/logout destination validation.
- [authConfiguration.ts](../frontend/src/api/authConfiguration.ts): structural
  and exact public metadata validation; public failure handling; local-only 404
  compatibility.
- [authConfiguration.test.ts](../frontend/src/api/authConfiguration.test.ts):
  exact provider/environment/capability/registration mismatch, public HTTP/network
  failure and unbound-production regressions.
- [client.ts](../frontend/src/api/client.ts): validate site/API before credential
  acquisition or fetch; exclude public development fallback for requests/downloads.
- [clientTrust.test.ts](../frontend/src/api/clientTrust.test.ts) **new**: invalid
  public inputs cause zero credential leases and zero fetches.
- [securityHeaders.ts](../frontend/src/securityHeaders.ts): reuse the same
  staging site/domain constants. Header directives and allowlists are unchanged;
  this is not the Batch 3 header migration.

Frontend session and UI integration:

- [workspaceSessionController.ts](../frontend/src/auth/workspaceSessionController.ts):
  initial restore, direct activation/reset, Demo entry, account bootstrap and
  sensitive-operation configuration gates; safe configuration retry; independent
  provider setup failure handling.
- [sessionAdapters.ts](../frontend/src/auth/sessionAdapters.ts): development-only
  local durable mode additionally requires a loopback website.
- [PublicConfigurationSessions.test.ts](../frontend/src/auth/PublicConfigurationSessions.test.ts)
  **new**: stored Demo/Personal admission, invalid config and callbacks, provider
  failure separation, configuration-retry races, retired provider state, dirty
  form consent, and public local-mode rejection.
- [LandingPage.tsx](../frontend/src/pages/LandingPage.tsx): truthful configuration
  recovery wording and disabled Demo entry in the existing closing CTA when
  configuration is unverified. Existing layout/navigation/motion remain.
- [LandingAccountEntry.test.tsx](../frontend/src/pages/LandingAccountEntry.test.tsx):
  both Demo and account entry remain disabled until configuration is verified.
- [test/setup.ts](../frontend/src/test/setup.ts): explicit loopback test defaults
  avoid inheriting a developer's private Vite deployment configuration; individual
  public trust tests override those defaults normally.
- [frontend README](../frontend/README.md): current trust, compatibility and retry
  contract with historical release notes preserved.

Documentation/examples:

- [.env.example](../.env.example): comments describe production anchor, loopback
  compatibility and unbound public trust. Local values and registration=false
  defaults remain; no real credentials or production identifiers were added.
- [architecture index](architecture.md), [roadmap](roadmap.md),
  [devlog](devlog.md), and this handoff: current local checkpoint, qualifications
  and next-batch boundary. Earlier acceptance reports/reviewers remain untouched.

Total: **24 repository files**, including this handoff; **5 new**, **19 modified**.
Generated local qualification evidence is ignored under
`.tools/phase7b-batch1-20261103/`; it is not a release artifact or commit input.

## C. Security and architecture

Production requires `ENVIRONMENT=production` and `AUTH_MODE=cognito`.
`AUTH_CAPABILITIES` may be absent, `cognito`, or an explicitly configured set
containing `demo,cognito`. Order is normalized by the existing parser. Empty,
unknown, duplicate and unsupported combinations still fail. LOCAL cannot mix
with another capability. A Demo anchor or Demo-only production fails even if
provider fields are present. Production Demo also requires the existing valid
nonlocal signing key, capacity for the seed, and exactly 24-hour lifetime.

The existing independent admission paths are unchanged: Demo HMAC verification
and expiry, Cognito RS256/JWKS/issuer/client/access-token/scope checks, verified
email admission and exact trusted subject ownership. No token fallback, subject
rewriting, ownership-key migration, client-chosen owner or shared password store
was introduced. Local authorization restrictions and Lambda marker guards remain.

Persistent workspaces still bootstrap empty/idempotently and avoid temporary TTL;
Demo workspaces stay isolated and temporary. Server-owned policy, foreign/missing
404 behavior, optimistic concurrency, transactions, activity and lifecycle guards
remain. No data adapter, cleanup method or DynamoDB schema was changed.

The Lambda loader already delegates to Settings and resolves both existing keys.
It needed no implementation change. Synthetic runtime coverage verifies the new
capability policy through that existing path; no new ZIP or Linux release was
created in Batch 1.

## D. Configuration behavior

The reviewed public tuple lives in `frontend/src/publicDeployment.ts`:

- Website: `https://main.d31vp0nq9fzl6q.amplifyapp.com`.
- API: `https://0z0fpmukik.execute-api.us-east-1.amazonaws.com`.
- Backend environment/capabilities: `staging`, exactly Demo plus Cognito.
- Issuer: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_A8ogxr5nI`.
- Public client: `7shrt9ejr715i8accus6a0u1e3`.
- Managed domain:
  `https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com`.
- Callback: the exact website plus `/auth/callback`.
- Logout destination: the exact website plus `/auth/signed-out`.
- Expected public self-registration flag: **false**.

These public identifiers come from existing sanitized Phase 5E Execution 3/4
receipts, also documented in the existing 5F plan. They are not fresh live-state
evidence. `production: null` is intentional. Fictional production IDs exist only
in tests of the pure resolver/validator; there is no runtime override or guessed
production mapping.

Public behavior:

1. Require exact current website, compiled `VITE_PUBLIC_SITE_URL`, configured
   single API and reviewed target agreement. Missing public API/site inputs,
   unknown site, mismatched compiled site, credentials/paths/query/fragment in
   origins, or public-to-loopback pairing fails before fetch or credential lease.
2. Validate bounded public configuration against its strict schema and exact
   environment, capability set, provider and registration binding. Account-data
   policy must match environment. Unknown fields, duplicate capabilities and malformed metadata
   cannot create a valid session. Existing 16-KiB and ten-second bounds remain.
3. Public 404 is an error. HTTP errors, unavailable network, timeout, malformed
   body or trust mismatch do not become legacy Demo configuration.
4. Initial restore and activation/reset cannot use previously stored Demo or
   Personal state without trusted configuration. Account login/callback and
   bootstrap retries remain gated. Invalid API trust also prevents transport
   from obtaining credentials, including a potential provider refresh.
5. Explicit configuration retry shares an existing pending load; otherwise it
   retires old scopes, caches, credentials and provider coordination before the
   replacement load. A late old response cannot publish readiness. Dirty work
   requires explicit discard. Successful retry returns to deliberate entry,
   without automatic Demo creation, account restoration or callback replay.
6. A valid trusted configuration is distinct from provider/session availability.
   Cognito setup/restore failure cannot silently turn Personal into Demo, but an
   explicit Demo choice remains available when its capability/API are valid.

Local/staging compatibility:

- Both loopback site and API origins retain development defaults and expected
  legacy `/auth/config` 404 Demo compatibility. Local/test metadata stays local;
  an external origin with a similar hostname does not qualify.
- Existing local test-provider fixture compatibility remains explicit. It does
  not add public provider trust or authorize contacting a real provider.
- `VITE_WORKSPACE_MODE=demo` remains the managed-adapter convention, supporting
  both identities after configuration. No second API client or new mode exists.
- Local durable mode still needs a development build and now also a loopback
  website. Public frontend cannot select it.
- Reviewed staging identities remain unchanged; provider/metadata must now match
  them exactly. Unexpected live drift would require separate read authorization,
  not a broadened allowlist or deployment from this task.

## E. Actual local qualification

All final affected checks passed:

- Backend focused capability/config/Lambda/Cognito/integration run: **269 passed**.
- Full backend suite: **670 passed**, Python **3.13.15**, pytest **9.1.1**,
  **81.11 seconds**. One existing Starlette/httpx deprecation warning.
- Backend Ruff: **PASS**; formatting: **128 files formatted correctly**;
  Mypy: **80 source files, no issues**.
- Frontend focused trust/transport/header run: **112 passed across 5 files**.
- Frontend focused session/race/lifecycle/landing run: **85 passed across 5 files**.
- Full frontend suite: **662 passed across 67 files**, Vitest **4.1.12**,
  Node **22.20.0**, **117.64 seconds**, two workers. A jsdom unsupported-document-
  navigation notice occurred; zero failed tests or unhandled-error summary.
- Full frontend ESLint and TypeScript build/typecheck: **PASS**.
- Existing hosting-header and build-verifier unit checks: **12 passed**.
- Production-mode Vite build using the reviewed staging public tuple: **PASS**.
  Output is isolated in `.tools/phase7b-batch1-20261103/public-build/`.
- Existing hosted-build scanner: **45 files**, expected public URLs present,
  no source maps/private material/local endpoints. This is an offline artifact
  check, not proof of a hosted release.
- Headless Chromium local-artifact QA: **5/5 scenarios PASS**. Every navigation,
  asset/API/provider request was intercepted; none forwarded to staging/AWS.
  Cases: public 404, wrong client, recovery through explicit retry, valid stored
  Demo restore after trusted config, and unbound website stopped before API fetch.
  No Demo was issued, provider contacted, account created or signup enabled.
- `git diff --check`: **PASS**. Independent source review found no actionable
  security/correctness defect; that review did not independently rerun tests.

Existing Phase 6 tests remain present and passed in the full frontend suite.
The original full-response and convergence assertions and concurrent bootstrap
fixture remain intact. No assertion, authentication check or ownership rule was
removed to make qualification pass.

Iteration qualifications: an early new test had a missing closing brace, corrected
locally. One initial trust run had 108 passes / 4 failures. The first combined
session run had 43 passes / 31 failures, one parse-failed suite and six secondary
unhandled assertion rejections. These runs exposed the newly enforced compiled-site
check against inherited developer `.env` defaults and the syntax error; test setup now explicitly
selects loopback fixtures rather than weakening public validation. Existing npm
Windows shims mis-handle this workspace's `&`; equivalent direct Node entry points
ran successfully. Final commands did not require global tooling/dependency changes.
An artificial `core.autocrlf=false` diff check treated existing CRLF as whitespace;
normal repository-configured diff checking passed, with no line-ending rewrite.

Representative final commands from the repository root (PowerShell):

```powershell
backend/.venv/Scripts/python.exe -m ruff check backend
backend/.venv/Scripts/python.exe -m ruff format --check backend
backend/.venv/Scripts/python.exe -m mypy backend/src
backend/.venv/Scripts/python.exe -m pytest backend
Set-Location frontend
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc -b
node node_modules/vitest/vitest.mjs run --maxWorkers=2
node --test scripts/render-hosting-headers.test.mjs scripts/verify-hosted-build.test.mjs
Set-Location ..
git diff --check
```

The actual full lint invocation ran from `frontend/` as
`node node_modules/eslint/bin/eslint.js . --max-warnings 0`. Build invocation ran
there with the reviewed public Vite variables and `vite build --outDir
../.tools/phase7b-batch1-20261103/public-build`; no canonical release artifact was
overwritten. Evidence summaries, logs and synthetic browser tooling are in the
ignored task evidence directory.

No dependency manifests/locks changed. Existing dependencies and installed tools
were reused. No fresh network audit, dependency repair, CDK synth, new backend ZIP,
Docker campaign or repeated financial investigation was needed for this diff.
Production-on-AWS, real provider journeys and deployed artifact equality remain
unverified here; local tests do not replace those acceptance gates.

## F. Preserved safeguards and operational boundary

OAuth PKCE/state/nonce, SDK token handling/rotation guards, callback parsing,
single-use sensitive intents, verified subject binding, generation/revision
fences, cross-tab coordination, private-cache clearing, dirty-form consent and
existing account deletion safeguards remain. Phase 6 layout, accessibility,
motion, navigation, empty/error/retry and durable preference functionality remain.

No changes to application persistence, DynamoDB access patterns, Demo failure
cleanup, issuance controls, API routes, dependency graph, infrastructure, root
hosting headers, frozen release reviewers or historical acceptance evidence.
No credentials, email addresses or private user data were inspected or added.

AWS/login/Billing/Cost Explorer calls: **0**. GitHub/remote Git operations: **0**.
Hosted traffic/builds, actual Demo workspaces, Cognito users/emails: **0**.
AWS resource mutations, Git commits/pushes, release ZIP creation and synths: **0**.
The browser QA's synthetic intercepted requests are not application service calls.

Registration remains false in default Settings/examples and the exact public
binding; no AWS registration setting changed. Its historical live CLOSED status
was not re-read. There is no new operational cost observation or credit assumption;
the owner-approved cash-funded baseline and manual financial controls persist.

## G. Remaining dependencies and Batch 2 handoff

**Next proposed assignment: separately authorize Phase 7B Batch 2 only.** Preserve
this unpublished candidate and its qualification evidence; do not commit/deploy it
as a complete production release.

Batch 2 owns finite atomic Demo admission and operator pause behavior, independent
of existing Demo verification/Personal requests, plus the focused failed-seed
cleanup guard protecting durable/partial durable metadata. Existing unsafe cleanup
and unbounded new-issuance concerns remain open; Batch 1 does not resolve them.
Use the accepted roadmap's bounded admission/idempotency/concurrency/pause tests,
and forced-owner collision tests. Preserve ownership keys and existing protocols;
no new service/table/index or public administrative bypass is justified here.

Batch 3 owns CDK production mixed-capability wiring, per-app exact hosting policy
and later header migration, registration/issuance closed defaults, release-contract
updates, deterministic packaging and full offline infrastructure qualification.
The existing CDK production path still represents the old Cognito-only target;
it was deliberately not modified or synthesized in Batch 1.

Later established 7C–7G gates still require actual protected production provisioning,
exact approved site/API/provider bindings, backup/restore/deletion reconciliation,
operational/cost/closure controls, delivered headers/hosted source verification,
genuine two-account registration/confirmation/persistence/isolation, and separate
public-signup acceptance. Production IDs must come from that authorized provisioning,
never the staging tuple or fictional tests. No gate is waived by these local passes.

## H. Final status

**BATCH 1 LOCALLY QUALIFIED.** No unresolved Batch 1 test failure or discovered
security blocker remains. Local work is reviewable, uncommitted and unpublished.
Production remains unbound, and the complete HireFlux candidate is **not yet
production-ready, publicly deployable or fully acceptance-tested**.

Stop here. Batch 2, Batch 3 and all later live actions require their own scope and
authorization; none was started automatically.
