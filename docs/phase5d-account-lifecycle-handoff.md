# Phase 5D — account safety and offline Cognito release

Date: 2026-10-20. Scope: local implementation and offline qualification only.
This record supersedes earlier statements that account safety/CDK await 5D;
it does not amend the frozen Phase 4H evidence or claim deployed Cognito.

## 1. Disposition

**PASS WITH EXPLICIT QUALIFICATIONS — local Phase 5D only.** The source is ready
for owner review of a separately authorized Phase 5E proposal. No commit, push,
remote CI, AWS/GitHub account API call, deployment, asset upload, real provider
authentication, email, hosted application request or credential change occurred.
Public documentation/package downloads and local fake-provider traffic were used.
The existing staging test pause and cash-funded baseline remain in force.

## 2. Source baseline

Actual HEAD remains `138309d759e43ba4eda131e9f047a5bcf919f446` (5B). Phase 5C was
uncommitted: all 46 paths matched its prior SHA-256 receipt before editing.
`.tools/phase5d/baseline.json` records that initial status and file hashes.
5D extends those local changes; it does not claim a new immutable Git revision.
The final local verification receipt inventories each inherited/changed/new path
and SHA-256. That receipt, source, locks and artifacts must travel together.
Any subsequent change invalidates the affected release qualification.

## 3. Account lifecycle

`SensitivePrincipalDependency` reuses the existing verifier, then forces uncached
trusted userInfo admission and compares the original verified identity, issuer
and client. Sensitive persistent JSON export and deletion require signed integer
`auth_time` no older than 300 seconds, not a newly refreshed token's `iat`.
Old/missing/malformed freshness is safely denied; ordinary CSV, LOCAL erasure
and DEMO behavior remain compatible. Management is default-off outside explicit
Cognito configuration; the proposed Lambda enables it only with complete trust.

DELETE/retry requires exactly `DELETE_MY_ACCOUNT`; unknown ownership/confirmation
fields cannot select a target. The service orchestrates the existing bounded
erasure engine and strong status read. Its limits, manifest, atomic ACTIVE guards
and one-way ACTIVE → DELETING → DELETED lifecycle are retained. Provider deletion
never precedes strong terminal proof. DELETED cannot bootstrap or become ACTIVE.
Freshness is checked again after bounded erasure before provider dispatch.

## 4. Provider finalization

The verified provider username must equal the verified subject in the pinned
email-username pool; email aliases are never deletion targets. AWS documents
generated usernames for email-only pools and matching username/sub for SignUp.
The implementation additionally fails closed on inequality; actual owner-created
test-user metadata remains a 5E gate, not an assumption from synthetic fixtures.
[AWS attributes](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html),
[AdminCreateUser](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminCreateUser.html).

`CognitoIdentityDeletion` is typed/injected and uses regional HTTPS, bounded
timeouts and one SDK attempt. UserNotFound is idempotent success. Explicit
access/authorization/throttle/parameter rejection permits a later newly
authorized retry; unknown errors remain REVIEW_REQUIRED. The non-TTL tombstone
adds only PENDING/REVIEW_REQUIRED/COMPLETE and a completion timestamp.

One conditional winner durably arms REVIEW_REQUIRED before dispatch. Lost
provider responses, process exit and failed completion writes never trigger
automatic repetition or report false success. Provider success cannot be made
atomic with DynamoDB; uncertain cases deliberately require independent operator
metadata. See the [tested reconciliation procedure](account-finalization-operations.md).
The Lambda gains only AdminDeleteUser on its exact pool ARN, not metadata-read
or broad administrative rights. The separate inert operator helper never calls
AdminDeleteUser and needs separately approved operator permissions/live access.

## 5. Frontend

The existing controller/OidcClient is extended, not replaced. Full JSON export
and deletion create one-use opaque intent, bound to original issuer/client/sub,
operation, generation, tab instance/logout epoch, creation time and a new SDK
state/nonce/S256-PKCE transaction with `prompt=login`. Typed deletion confirmation
precedes the redirect; a final explicit button follows same-account reauthentication.
Different-account return is rejected before credentials are stored or an API acts.
Refresh, stale callbacks, logout/switch, expired intent and unknown network outcomes
cannot authorize replay. Backend signature/admission/freshness remains decisive.

The public restricted `/account` route avoids normal workspace bootstrap/queries,
so a DELETING account can recover without dashboard access. It presents ACTIVE,
partial erasure, definitive rejection, confirmed completion and operator review
truthfully. A bounded read-only status check follows uncertain requests without
repeating DELETE. Both direct and status-observed terminal outcomes clear local
credentials/query identity and broadcast logout. Managed-login sign-out remains
explicit and can be unconfirmed offline. Historical deletion notices contain
no credentials or identity and grant no authority.

Settings keeps the 5C changed-field/conflict correction. Accessible confirmation
dialogs retain focus/Escape/dirty-form handling; desktop/mobile fake-browser
scenarios cover confirmation, different-account refusal, export and final outcomes.
Staging warns that job records must be fictional, real identity information is
personal, exports are not backups, and retained systems are separate from erasure.

## 6. Synthesized Cognito infrastructure

Exactly four additions per environment:

- `CognitoAuthUserPoolAF093846` — AWS::Cognito::UserPool.
- `CognitoAuthPublicClient5A05A7D7` — AWS::Cognito::UserPoolClient.
- `CognitoAuthDomain0075BD90` — AWS::Cognito::UserPoolDomain.
- `CognitoAuthManagedLoginBranding8935A739` — AWS::Cognito::ManagedLoginBranding.

Pool: Essentials, email username attributes (no aliases), case-insensitive,
required mutable email, automatic verification, verification before email update,
verified-email-only recovery, COGNITO_DEFAULT email, MFA off, 12-character mixed
password policy and one-day temporary password. Deletion protection ACTIVE,
DeletionPolicy/UpdateReplacePolicy Retain. No SMS, triggers, identity pool,
custom domain, custom auth, extra threat-protection plan or provisioned capacity.

Client: public/no secret, authorization code only, openid/email/profile,
COGNITO only, exact token-derived `/auth/callback` and `/auth/signed-out` URLs,
explicit SRP only (no password/admin/custom/default broad flows), 60-minute
access/ID, one-day refresh, rotation enabled/10-second grace, token revocation
and existence-error protection. Read email/email_verified/name; write email/name.

Domain: managed login version 2, explicit provided-value branding dependent on
the domain. Staging prefix `hireflux-staging-9465-use1-20261020` matches qualified
5C CSP. Production uses a different account-qualified prefix and callback origin;
its synth binds a fictitious separate account. No actual production pool is
configured or authorized. Domain availability and provider acceptance are 5E gates.

## 7. Registration policy

Initial staging is **closed registration**, owner-created testers only:
AllowAdminCreateUserOnly=true and COGNITO_SELF_REGISTRATION_ENABLED=false.
Public metadata carries that policy and the landing page hides Create Account.
This deliberately narrows 5A's proposed self-signup path under the 5D instruction.
There is no invitation subsystem, WAF, CAPTCHA or trigger.

The proposed initial window can prove managed sign-in, first temporary-password
completion, recovery, fresh auth, isolation and erasure for two controlled users.
The owner must establish real email ownership before marking email verified;
the application never bypasses strict verification. It does **not** prove public
self-signup, confirmation/resend or handling unverified self-registered users.

A later public-signup test needs separate explicit approval, a reviewed source/
offline-guard amendment, pool registration plus backend capability update, and a
planned closing update. If opening after the initial release, this adds two
stack updates (open/close); no extra frontend build is needed if unchanged
dynamic capability handling is retained. Signup/verification/resend requests,
emails and cleanup must fit a revised explicit budget. Do not silently append
them to the closed-window budget or retain public signup after supervision ends.

## 8. Preservation and update guards

The actual account-bound proposed template was compared against the frozen
provider-recovery staging template, not merely a fabricated previous shape.
There are 29 declarations / 26 selected with the accepted blank alert email
(previously 25/22). Every old logical ID remains. Only these change:

- `BackendApiBackendFunctionFFB5248D`: qualified ZIP and six additive environment
  fields for demo,cognito, trust identifiers/domain, management and closed signup.
- `BackendApiExecutionRoleDefaultPolicyDE57D6A3`: one exact-pool AdminDeleteUser statement.

All existing Amplify App/Branch properties, table/schema/TTL/lifecycle, signing
secrets, role identity, CORS, throttles, concurrency, logs/retention, dashboard,
alarms, budget, blank email and bootstrap remain unchanged. No new NAT or service.
Pool/client references and explicit branding/domain ordering are acyclic.

Pure offline guards compare all other resource properties and top-level sections,
reject removals or broad IAM, and require exactly four Add plus two nonreplacing
Modify changes with permitted property details in a future live review. Unknown,
missing, duplicate, conditional/required replacement or any Amplify change is STOP.

The inert UPDATE fixture uses the prior reviewed CDK execution role and all three
previous parameters, including `{"ParameterKey":"AmplifyGitHubAccessToken",
"UsePreviousValue":true}`, without ParameterValue. The NoEcho parameter and
Amplify reference are unchanged. This does not reactivate either deleted PAT.
Any provider reconnection/credential requirement is STOP, not a reason to recreate
a PAT. No old CREATE executor or consumed ledger is reused.
Normal rollback remains enabled; the future execution must explicitly preserve
that policy. The non-executable `inert-execution-policy.json` separately records
DisableRollback=false, zero currently authorized attempts and no automatic retries;
the final evidence checker verifies these values. RETAIN can leave an orphaned protected pool after rollback/removal;
inspect events and obtain owner direction instead of auto-delete/import/retry.
Offline comparison cannot prove the actual CloudFormation change set will pass.

## 9. Cost and staging risk

Assume **$0 usable promotional credits**. The existing accepted cash model remains
$1.30–$2.30/month mostly idle or $3.20–$4.20/month for limited testers, excluding
tax, personal labs and extra usage. These are inherited models, not new Bills
observations. The four Cognito resources add no configured fixed capacity,
SMS, SES, custom domain or threat-protection charge.

Cognito Essentials direct-user allowance is 10,000 MAU shared per account or
organization; exhausted allowance costs $0.015/MAU at the first paid tier.
Two controlled identities therefore model $0–$0.03 incremental Cognito/month;
20 would model $0–$0.30. These are arithmetic estimates from
[AWS pricing](https://aws.amazon.com/cognito/pricing/), not a verified remaining
allowance or spending cap. AdminGetUser can also activate billing for a user.
No Cognito usage occurred in 5D.

Default Cognito email has a shared daily limit of 50; actual remaining allowance
is unknown and no increase is proposed. Recovery/invitation abuse can consume it
even with closed registration. See [AWS quotas](https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html).
Existing anonymous demo issuance, request/log/storage usage and auto-build exposure
remain. One proposed standard 5–10-minute frontend build models $0.05–$0.10 before
any verified allowance; duration is uncertain. [Amplify pricing](https://aws.amazon.com/amplify/pricing/).

Carry forward manual $2 incremental gross review, $5 first-week testing stop,
investigation around unexplained $1/day growth, and review before indefinite
hosting above $10/month. Billing can lag; none is a hard cap. Pausing tests does
not stop existing resources/assets from costing money. Do not redesign monitoring
or alter retention to improve an unverified estimate.

Staging table PITR and deletion protection remain off, removal remains destructive.
No demo TTL applies to persistent records; that is not a durability promise.
Retained identities cannot recover records or lost erasure tombstones. Fictional
application data and owner-controlled identity cleanup are required; irreplaceable
data needs a separate storage/recovery decision before use. Production remains
Phases 6–7.

## 10. Dependencies and artifacts

Runtime: Python 3.14/x86_64 Linux, 35 distributions, PyJWT 2.15.1,
cryptography 50.0.2; existing runtime graph preserved. Development-only Werkzeug
3.1.8 → 3.1.9 fixes the known advisory. Added typed cognito-idp stubs to the existing
boto3-stubs extra. No broad runtime upgrades. Frontend retains oidc-client-ts 3.5.0
and jwt-decode 4.0.0 from 5C. CDK library 2.272.0 / CLI 2.1144.0 remain pinned.

New ZIP: `.tools/phase5d/hireflux-backend-candidate.zip`.
SHA-256 `0934a7850fb2ec8c2946afc5828c76e830638a3965736434ef31025504f58f6d`.
31,677,804 compressed / 73,653,480 expanded bytes; 3,956 members.
Two independent clean builds match byte-for-byte and manifests match current
source, pyproject and lock. Compressed size 30.21 MiB exceeds the 30-MiB soft
warning, below the 40-MiB project hard limit; expanded size is below 150-MiB soft
and 200-MiB hard limits. Preserve the ZIP/manifest together; cross-toolchain
compression equality is not claimed.

Pinned official Lambda image
`public.ecr.aws/lambda/python:3.14@sha256:b81a4aa3bc1d56999090333cefea611e5a84bb4e2638c1ae4107fdc9b8622da3`
passed isolated native imports, real RS256/synthetic Cognito admission and cold/
warm HTTP transport. Read-only package/root, no capabilities, no network; only
the candidate/probe are mounted. It reports zero network attempts. Docker's Linux
engine was initially unavailable; the owner started it before this successful gate.

Qualified frontend: `.tools/phase5d/qualified-frontend/`, production mode with the
recorded public staging origins, demo anchor and dynamic Cognito capabilities.
No source maps, credentials/private files or local endpoints; per-file size/SHA-256
and aggregate identity are in `release-artifacts.json`. An earlier local build
used an incorrect public API origin; it is unqualified and excluded from release.
The qualified inventory contains 45 files / 2,581,975 bytes; its aggregate
path/size/SHA-256 inventory identity is
`98d69b6b210af34b342b96c2dccd540d2b0005075784161921878cb1c438097c`.
This is an inventory digest, not a ZIP or remote Amplify artifact hash.

Lock/project SHA-256 identities:

- backend/uv.lock: `964d6d2ae3ef5cb631d73a399498f6bf603aefdb737fcab3107af3bdb69bcc83`.
- backend/pyproject.toml: `e1185e4d30f263176d8417a51dd0374e0fb2f19acd9586ac788840af53dc0922`.
- frontend/package-lock.json: `3fb82b1eb27ef4e83a2901ea752d9217975e3171c50a4b77b0d749e56e6a0d20`.
- infra/package-lock.json: `314e1dfc107e72c933b401b301a3367dcb710685b9a174c8ebad2987136a3bfb`.

Raw staging template file SHA-256:
`65431c46065237d875cc3015cdc1c9bb81136fe331898d2906773bcd50b9526b`.
Canonical JSON identity differs by serialization and is separately recorded.
Inert UPDATE fixture SHA-256:
`c407196d6b3a80a8dc49219571ce198594474187af43c00a127db5e323cb9b13`.
Backend/frontend SBOMs, OpenAPI, schema, audit JSON, locks and hashes are local
`.tools/phase5d/` evidence, not published artifacts.

## 11. Local validation

Required checks and exact invocations (root unless noted):

- `backend/.venv/Scripts/python.exe -m ruff check backend`: PASS.
- `backend/.venv/Scripts/python.exe -m ruff format --check backend`: 128 files PASS.
- `backend/.venv/Scripts/python.exe -m mypy backend/src`: 80 source files PASS.
- `backend/.venv/Scripts/python.exe -m pytest backend`: 630 PASS, one inherited
  Starlette/httpx deprecation warning; final log `backend-full-final.log`.
- `.tools/phase3b-tooling/bin/uv.exe lock --project backend --check` and
  `uv.exe pip check --python backend/.venv/Scripts/python.exe`: PASS. The uv-managed
  venv does not contain pip; a direct `python -m pip check` attempt was inapplicable
  and the installed graph was checked with uv instead.
- Locked runtime and development requirements exported using `uv export --project
  backend --locked --no-emit-project --no-dev` / `--extra dev --format requirements.txt`.
  `uv tool run --from pip-audit==2.10.1 pip-audit --require-hashes --disable-pip
  --progress-spinner=off --format=json --output=<audit-json> --requirement <export>`:
  both zero known vulnerabilities.
- The exact Linux ZIP distribution list was independently pinned against uv.lock,
  including lock hashes in `linux-runtime-requirements.txt`, then audited with
  the same hash-required/disabled-resolver command. All 35 exact packaged versions
  passed, including the Linux-only dependency not selected on Windows.
- Python 3.14 `backend/scripts/build_lambda_artifact.py --uv <pinned-uv.exe>
  --output .tools/phase5d/hireflux-backend-candidate.zip --verify-reproducible`:
  two matching clean builds. `backend/scripts/validate_lambda_artifact.py
  --artifact .tools/phase5d/hireflux-backend-candidate.zip`: isolated Linux PASS.
- Frontend directory: `node node_modules/eslint/bin/eslint.js . --max-warnings 0`,
  `node node_modules/typescript/bin/tsc -b`: PASS. `node node_modules/vitest/vitest.mjs
  run --maxWorkers=1`: all 527 tests / 56 files PASS. Includes 14 focused sensitive
  operation tests and inherited session/controller/Settings/demo regressions.
  Final current-source log: `frontend-full-frozen.log`; three additional page
  regressions distinguish untouched ACTIVE, pending finalization and explicit
  provider rejection. Async errors remain published by the identity-fenced
  controller rather than copied into stale page state.
- `node frontend/node_modules/@playwright/test/cli.js test --config
  frontend/playwright.account.config.ts`: desktop/mobile fake-provider suite;
  14 PASS, final result in `browser-qualified.log`. No tracing or live endpoints.
- Frontend directory: `node --test scripts/render-hosting-headers.test.mjs
  scripts/verify-hosted-build.test.mjs`: 12 PASS. `node node_modules/vite/bin/vite.js
  build --outDir ../.tools/phase5d/qualified-frontend` with recorded HTTPS staging
  API/site URLs and VITE_WORKSPACE_MODE=demo; `node scripts/verify-hosted-build.mjs
  --directory ../.tools/phase5d/qualified-frontend`: 45 files PASS.
- `npm --prefix frontend audit --json`: zero vulnerabilities; frontend lock-based
  CycloneDX, backend lock-based CycloneDX (65 dependency components), OpenAPI and
  canonical DynamoDB schema exports generated into the new 5D evidence directory.
- Infra directory: `node node_modules/typescript/bin/tsc`,
  `node scripts/test-unit.mjs`: 127 PASS. With the explicit qualified candidate
  environment variable, `node --test build/test/cli.integration.js`: four PASS,
  both environments repeated identically with no network attempts and invalid
  profile/credential inputs fenced out.
- `node --require ./build/test/block-network.js scripts/check-schema-parity.mjs
  --schema ../.tools/phase5d/dynamodb-schema.json` with the candidate environment:
  staging/production table keys, GSIs, projections, TTL and billing PASS.
- `.tools/phase5d/qualify-infra.cjs`: two fresh network-blocked account-bound
  synths and actual frozen-template/inert UPDATE comparisons PASS. Production
  binds fictitious account 222222222222; the staging fixture uses the locally
  recorded accepted account. A final current-guard comparison also passed.
- Final whitespace, documentation-link, source/artifact consistency and historical
  preservation checks are bound in `.tools/phase5d/verification.json`.

All commands ran locally. Package/advisory downloads are not AWS account actions.
The runtime image cannot contact providers; CDK uses the credential-isolating
local wrapper plus a network-attempt blocker; Playwright fulfills fake endpoints
and blocks unmocked requests. No hosted verifier or consumed executor was run.

The first full backend run exposed an obsolete 5B 'management unavailable until
5D' assertion and a concurrent-bootstrap test failure. The former was updated
to the explicit default-off/Cognito-only opt-in contract; the latter retained its
all-success assertion with diagnostic output and passed focused/final full runs.
The final full result is required, not inferred from targeted results.

Initial highly concurrent frontend reruns produced timing failures. No product
policy, security assertion or timeout was weakened; the final qualification uses
a bounded worker count and records the unsuccessful runs alongside final evidence.
The CDK review script's initial Windows backslash preload failed before synth;
the corrected forward-slash path used the same network blocker and completed.

Runtime/development Python audits and frontend npm audit report zero known
vulnerabilities. A separate manifest-derived locked Linux-runtime audit also
covers all 35 packaged distributions, including uvloop, which the Windows-marked
export does not select; it reports zero vulnerabilities. **Infra npm audit is
qualified, not clean:** bundled
brace-expansion 5.0.9 in aws-cdk-lib 2.272.0 still reports one high vulnerable
dependency and multiple DoS advisories. npm advertises a fix and the registry now
lists 2.274.0; that newer CDK has not been installed or qualified. No unsupported
override/suppression is used. The vulnerable toolchain is not in either product
artifact and offline synth accepts reviewed local inputs only. Before cloud
release, the owner must explicitly accept this remaining tooling qualification
or authorize a narrow CDK upgrade with exact-template and full infra requalification.

## 12. Remaining limits

Local proofs cannot establish current AWS drift, domain availability, live managed
login/branding/first-login behavior, SDK token rotation/revocation timing, real
username/sub equality, email delivery/quota, current Billing/shared MAU, provider
AdminDeleteUser behavior or actual CloudFormation acceptance. They do not prove
remote CI, browser XSS immunity, immediate historical data removal, restored
tombstones or production readiness. Browser tests use mocked tokens; backend
verifier/runtime tests independently exercise real signatures.

## 13. Phase 5E proposal — no execution authorized

1. Owner reviews this candidate/qualifications and separately authorizes the exact
   closed staging rollout and bounded test window. No standing 4D–4H allowance.
2. Refresh Bills/Credits/lab baseline, supervision, temporary non-root STS identity,
   exact account/region, live stack/toolkit/artifact state and source/lock hashes.
   Reconcile unexpected drift and the CDK advisory before asset publication.
3. Check domain availability. Review prior parameters, blank email, normal rollback,
   retained-pool implications and the reviewed execution role. Publish only the
   separately approved new backend artifact, then prepare a fresh UPDATE change set.
4. Independently review the actual template/parameters/assets and exact four Add +
   two nonreplacing Modify changes. Any Amplify App/Branch change, credential request,
   table/secret replacement, broad IAM or unexpected cost/security change is STOP.
5. With explicit supervised execution authorization, execute once. Inspect events
   on failure; do not auto-retry, force, delete retained resources or reset ledgers.
   Keep the old demo frontend while backend/Cognito are verified.
6. Verify actual pool/client/domain/branding, closed policy, exact IAM, API public
   capabilities, old demo compatibility and no unintended resources. Confirm owner-
   created canonical username/sub and verified-email policy before sensitive tests.
7. Release the qualified frontend once through a separately approved source push;
   acknowledge main auto-build. No App/Branch infrastructure mutation or second
   manual build. Verify exact hosted revision, headers and callback configuration.
8. Run only the accepted bounded closed-window checks; account creation, real email
   ownership and password/MFA entry are personal owner/tester actions. Inspect
   outcomes and clean up each identity using the reviewed lifecycle. Record any
   retained pool/identity and pending operator reconciliation. Stop after evidence.

Proposed **upper bounds**, including negative cases: two controlled identities,
one fictional demo issuance, six total invitation/verification/recovery emails,
eight total interactive login/recovery/reauthentication flows, two refresh
exchanges, 60 sequential application API requests, two provider finalization
dispatches (one per test identity), one frontend build. No load/fault campaigns,
automatic retries, extra identities, third finalization or duplicate build.
The separate fresh metadata/control-plane checks must be enumerated before the
owner authorizes them; this application budget is not blanket API permission.
If the eight flows cannot cover a necessary case, STOP and request a specific
budget amendment before traffic. Do not silently substitute a new phase.

Suggested eight-flow allocation: A initial login/temp-password; B initial login;
A normal login; A recent export; A recovery and return; A deletion reauth that
returns B (refused); A correct deletion reauth; B correct deletion reauth/cleanup.
Recovery must demonstrate email ownership without silently marking an unverified
address verified. Count every actual flow/email/API request; lack of retry budget
means a provider failure ends testing. Read-only status requests count toward 60.

Normal rollback can restore the previous Lambda/config and IAM when the actual
update permits it, while a retained pool can remain. A frontend must never claim
accounts are ready against rolled-back metadata. Inspect the actual failure and
authorize the smallest repair rather than restoring tombstones or switching pool
trust silently. A rollback after user creation needs an explicit retained-identity
and data disposition. No production rollout is included.

## 14. Evidence preservation

`.tools/phase5d/verification.json`, `release-artifacts.json`, `infra-review.json`
and `preservation.json` bind final source, locks, package inventories, template,
inert request, checks and preservation evidence. Raw account-bound fixtures stay
ignored/local and contain no PAT value. Historical evidence remains dated.
The final preservation check verifies 88 frozen evidence entries, ten consumed
ledgers, 59 prior receipts, frozen document/index hashes, old bound template/ZIP,
canonical artifact and 5B candidate. The historical 5C handoff and its evidence
remain separate; its source-file hashes describe the pre-5D source, not the new tree.
That check caught a proposed current-status note in the frozen production-readiness
document. The note was removed and the exact original bytes/hash restored; current
status is linked through the architecture index instead. No frozen evidence was
left modified.

<!-- SOURCE_MANIFEST_BEGIN -->
Inherited 5C paths preserved without 5D edits (24):

- `customHttp.template.yml`
- `customHttp.yml`
- `docs/phase5c-frontend-cognito-handoff.md`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/playwright.auth.config.ts`
- `frontend/scripts/render-hosting-headers.mjs`
- `frontend/scripts/render-hosting-headers.test.mjs`
- `frontend/src/api/client.ts`
- `frontend/src/api/cognitoRequests.test.ts`
- `frontend/src/api/workspaceBootstrap.ts`
- `frontend/src/auth/cognitoClient.test.ts`
- `frontend/src/auth/cognitoCoordination.test.ts`
- `frontend/src/auth/cognitoCoordination.ts`
- `frontend/src/auth/cognitoSessionAdapter.test.ts`
- `frontend/src/auth/cognitoSessionStore.test.ts`
- `frontend/src/auth/sessionAdapters.ts`
- `frontend/src/auth/sessionGeneration.ts`
- `frontend/src/auth/workspaceCapabilities.ts`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/features/resources/queries.ts`
- `frontend/src/securityHeaders.test.ts`
- `frontend/src/securityHeaders.ts`
- `frontend/vite.config.ts`

Inherited 5C paths extended in 5D (22):

- `ARCHITECTURE.md`
- `README.md`
- `docs/architecture.md`
- `docs/devlog.md`
- `docs/roadmap.md`
- `frontend/README.md`
- `frontend/e2e/cognito-auth.spec.ts`
- `frontend/scripts/serve-auth-fixture.mjs`
- `frontend/src/api/authConfiguration.test.ts`
- `frontend/src/api/authConfiguration.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/auth/CognitoControllerRaces.test.ts`
- `frontend/src/auth/WorkspaceSessionGuard.tsx`
- `frontend/src/auth/cognitoClient.ts`
- `frontend/src/auth/cognitoSessionAdapter.ts`
- `frontend/src/auth/cognitoSessionStore.ts`
- `frontend/src/auth/workspaceSessionController.ts`
- `frontend/src/pages/AuthCallbackPage.tsx`
- `frontend/src/pages/AuthSignedOutPage.tsx`
- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/SettingsPreferences.test.tsx`

5D added or changed outside the 5C path set (47):

- `.env.example`
- `backend/README.md`
- `backend/pyproject.toml`
- `backend/scripts/reconcile_account_finalization.py`
- `backend/src/hireflux_backend/api/deletion_schemas.py`
- `backend/src/hireflux_backend/api/dependencies.py`
- `backend/src/hireflux_backend/api/error_handlers.py`
- `backend/src/hireflux_backend/api/routes/auth.py`
- `backend/src/hireflux_backend/api/routes/me.py`
- `backend/src/hireflux_backend/app_factory.py`
- `backend/src/hireflux_backend/application/account_lifecycle.py`
- `backend/src/hireflux_backend/application/account_reconciliation.py`
- `backend/src/hireflux_backend/application/errors.py`
- `backend/src/hireflux_backend/config.py`
- `backend/src/hireflux_backend/domain/workspace.py`
- `backend/src/hireflux_backend/infrastructure/cognito_identity.py`
- `backend/src/hireflux_backend/infrastructure/dynamodb/workspace_bootstrap_repository.py`
- `backend/src/hireflux_backend/infrastructure/dynamodb/workspace_finalization_repository.py`
- `backend/src/hireflux_backend/infrastructure/dynamodb/workspace_safety_repository.py`
- `backend/tests/integration/test_account_lifecycle.py`
- `backend/tests/integration/test_cognito_accounts.py`
- `backend/tests/unit/test_account_reconciliation.py`
- `backend/tests/unit/test_auth_capabilities.py`
- `backend/uv.lock`
- `docs/account-finalization-operations.md`
- `docs/domain-model.md`
- `docs/phase5d-account-lifecycle-handoff.md`
- `frontend/playwright.account.config.ts`
- `frontend/src/api/accountLifecycle.ts`
- `frontend/src/auth/sensitiveIntent.ts`
- `frontend/src/auth/sensitiveOperations.test.ts`
- `frontend/src/auth/workspaceReturnPath.ts`
- `frontend/src/features/accounts/AccountManagementControls.tsx`
- `frontend/src/pages/AccountManagementPage.test.tsx`
- `frontend/src/pages/AccountManagementPage.tsx`
- `infra/README.md`
- `infra/lib/app.ts`
- `infra/lib/auth/cognito-auth.ts`
- `infra/lib/backend/artifact.ts`
- `infra/lib/hireflux-stack.ts`
- `infra/lib/release/update-contract.ts`
- `infra/scripts/check-schema-parity.mjs`
- `infra/test/backend.test.ts`
- `infra/test/cli.integration.ts`
- `infra/test/cognito.test.ts`
- `infra/test/operations.test.ts`
- `infra/test/resource-inventory.ts`
<!-- SOURCE_MANIFEST_END -->

## 15. Final decision

The local implementation and artifacts are sufficiently qualified for **owner
review and a separate Phase 5E authorization decision**, subject to every explicit
qualification above. No AWS action is authorized by this handoff or cost model.
No automatic commit, push, deployment, build, registration window or live test.
The accepted roadmap remains 5E staging release/live verification, Phase 6
production hardening and Phase 7 production deployment. **STOP at local 5D.**
