# Phase 5F — Self-service registration and onboarding plan

October 23, 2026 · Execution 1 plan and Execution 2 local implementation record.

**Decision: reuse Cognito managed signup in the existing Essentials User Pool,
with a small HireFlux entry-flow and copy update.** Keep the existing code/PKCE
session boundary, trusted subject ownership, explicit workspace bootstrap and
guarded lifecycle. No new pool, signup backend, password form or service is
justified by the inspected source. Stage 2 was subsequently approved and implemented
locally as recorded below. No staging rollout or public-registration acceptance is
implied.

## Execution 2 — implemented locally

**Local qualification passed**, including the owner-authorized same-major security
repairs and affected frontend requalification. The fresh frontend audit now has
zero findings. An explicitly approved isolated npm 11.21.1 tool generated the
minimal lockfile; the existing npm 10.9.3 successfully installed it with `npm ci`
and validated the installed tree. Global Node/npm and project requirements are
unchanged. Staging rollout and live acceptance remain separately authorized work.

The accepted Stage 2 changes are implemented; the deployed release remains the
recorded `ff18c6762aa1a1f5f423667659cfae83f74f786e`. All new changes are local and
uncommitted. No AWS API, GitHub operation, user creation, email, live test, asset
publication or deployment was performed. Only the frontend dependency pins and
lockfile received the separately approved security patches described below.

- **R1:** `CognitoClient.begin(..., entry)` and `controller.beginSignUp` implement
  explicit managed signup. Capability gates exist at both boundaries. The SDK's
  state/nonce/S256 PKCE transaction is reused, with only the provider path changed.
  Duplicate clicks share one attempt; competing entry intents are rejected rather
  than merged; canceled/stale work cannot navigate. Sign In and sensitive reauth
  retain their original flow.
- **Delayed confirmation:** signup intent is non-authoritative metadata in the
  existing guarded transaction. After five minutes, the consumed state raises
  `OAUTH_SIGNUP_EXPIRED` before exchange. Callback recovery explains that account
  creation may have completed and offers fresh Sign In. No repeated registration,
  old-code replay or extended security lifetime.
- **R2/R3:** primary demo / secondary signup / quiet header Sign In; account-aware
  copy, ready-session actions and no demo-transfer promise. Persistent Home says
  Your job search, hides the demo tour and reuses Record an application. Existing
  bootstrap/data ownership behavior is unchanged.
- **R4:** one typed, default-false `selfRegistrationEnabled` CDK setting drives both
  inverse pool policy and Lambda advertisement. Production opening is rejected.
  Offline staging-open synthesis is a review fixture, not activation. The separate
  [registration reviewer](../infra/lib/release/registration-update-contract.ts)
  pins original 5E template SHA-256
  `65431c46065237d875cc3015cdc1c9bb81136fe331898d2906773bcd50b9526b`;
  accepts only existing pool policy and Lambda environment/explicitly qualified
  code changes; and rejects additions, deletions, replacements, IAM, identity,
  callback/domain and unrelated changes. The old introduction reviewer/tests are
  untouched. The pure semantic helper is not a substitute for the pinned entry.
- **R5:** backend behavior and IAM stay unchanged. Its comment now distinguishes
  documented self-signup mappings from unverified administrative paths. New
  synthetic cases prove a supported mapping can export/finalize, while a mismatched
  admin-like mapping denies both before erasure/provider deletion. No resolver or
  AdminGetUser permission was added.
- **R6/R7:** existing unit/integration/browser fixtures were extended, and the
  frontend/backend/infra guides plus roadmap were aligned. `.env.example` already
  has `COGNITO_SELF_REGISTRATION_ENABLED=false`; no new frontend environment flag
  was needed. A convenient direct recovery shortcut and branding remain optional;
  existing managed-login recovery is preserved.

### Actual local qualification

Frontend tests, lint/typechecks, production/hosting build and browser checks below
were rerun on the repaired graph. Unaffected backend/infra results are from this
same Execution 2 before the frontend-only dependency repair.

| Check | Result | Evidence and limits |
|---|---|---|
| Frontend unit/component tests | PASS — 544 tests / 57 files | Full Vitest suite, including entry/cancellation/cache and persistent empty Home regressions. |
| Backend tests | PASS — 632 | Full pytest suite; new identity cases plus admission/bootstrap/ownership/lifecycle/reconciliation coverage. One existing Starlette/httpx deprecation warning; no dependency workaround. |
| Infrastructure tests | PASS — 144 | Existing introduction contract plus new closed/open configuration and negative update-review tests. |
| Type/lint/format | PASS | Frontend tsc/ESLint, infra tsc, backend Ruff/format/Mypy. |
| Frontend production build | PASS | Explicit staging public URLs; separate ignored output; 45 files, no source maps/private material/local endpoints in deployment artifact. Hosting/header validation: 12 passed. |
| Real-artifact synth | PASS | Bound staging closed/open and production closed; no added resources or IAM changes; exact frozen 5E baseline review accepted only the two intended modifications. |
| Offline CLI/schema parity | PASS — 4 CLI cases and both schemas | Credential-isolated repeatable synth tests with network blocker; same DynamoDB keys, three GSIs, TTL and billing. |
| Backend ZIP/runtime | PASS | Two offline-cache builds identical; pinned Python 3.14 Linux x86_64 runtime, eight native modules, RS256 admission, cold/warm HTTP/CORS/error/export checks; zero network attempts. |
| Fake-provider E2E | PASS — 20 cases | Desktop/mobile, intercepted provider/API traffic; confirmation/error/resend model, delayed signup recovery, sign-out, tab isolation, sensitive intents, export and deletion models. Not actual Cognito acceptance. |
| Responsive/accessibility | PASS within tested scope | 320/390/768/1280, actual light/dark selection, no page overflow, focus/44px signup target, reduced motion; scoped header/CTA browser axe checks. Local screenshots visually reviewed, including empty Home. Exhaustive AT/provider UX remains live acceptance. |
| Dependency audits | PASS — frontend/backend/infra | Frontend now has zero findings at every severity; backend hash-pinned pip-audit and infra npm audit are clean. No suppression or waiver. |
| Lockfile compatibility/minimality | PASS | Format 3; 11 required same-major package changes, no additions/removals; npm 11 regeneration is byte-idempotent; npm 10.9.3 `ci` and installed-tree validation passed. |
| Supply-chain/API inventory | PASS | Backend CycloneDX and inert OpenAPI export retained; updated frontend CycloneDX has 485 components. Backend/infra locks unchanged. |

The prerepair audit had three high and two moderate affected package entries,
already present in the accepted lockfile. The minimum compatible patches applied
are Zod 4.4.3 → 4.6.6 (direct production), Vite 8.1.5 → 8.1.6 and Vitest 4.1.11 →
4.1.12 (direct development), Vitest's seven matching internal packages including
mocker → 4.1.12, and jsdom's transitive undici 7.30.0 → 7.30.1 (development).
Undici stays within jsdom 29.0.0's existing `^7.24.3` range; no new direct dependency
or override was needed. Chai/tinyrainbow were retained at their original versions.
No application/development major changed, and no unrelated package was updated.

npm 10.9.3 and isolated 10.9.4 hit an upstream peer-resolution crash when generating
the lock. After explicit approval, isolated npm 11.21.1 generated format 3. A second
generation was byte-identical, and the existing npm 10.9.3 `ci` and `ls --all`
both passed. Node remains 22.20.0; no project npm dependency/package-manager pin
or global-tool change was introduced. No force/legacy resolution, manual lock
edit or suppression was used. See the
[upstream resolver fix](https://github.com/npm/cli/pull/8448).

The prior audit is preserved as `.tools/phase5f-local/frontend-audit.json`;
`frontend-audit-after-security.json` records zero findings, and
`frontend-sbom-after-security.cdx.json` records the final graph. The final lock
SHA-256 is `4611c69617ae2fe1ca888dc854f4633aa879432e48b796538a0d4f9c30bcaf05`.
The new `security-repair-final-receipt.json` in that directory binds the final
source/evidence hashes without overwriting any earlier receipt.
No exploit was run or deployed vulnerability/compromise inferred. No functionality
regression was observed in the full frontend and authentication/browser checks;
the clean audit is a point-in-time result, not a guarantee against unknown issues.

The backend comment changed a packaged source input, so a new candidate ZIP was
built without altering old artifacts:
`.tools/phase5f-local/hireflux-backend-candidate.zip`, SHA-256
`d08a824d1e99352cf9a2abe15fdf29b5f9e8a2ab46dde78a3a69be9b0ef3baaf`,
31,677,850 compressed bytes / 73,653,566 expanded / 3,956 members. The existing
project size-budget warning remains; do not describe it as spare unlimited capacity.
Its CDK CUSTOM asset destination digest is
`28b39fff1ece3783eaed2b4140add2167aa530281e301b5f15a77ad40882e126`
(CDK fingerprints the qualified ZIP hash text). The reviewer tests and actual
preserved-template comparison cover that distinction.

Browser evidence is under `.tools/phase5f-auth-browser/`; qualified candidates,
three assemblies and the actual baseline review are under `.tools/phase5f-local/`.
These are ignored local evidence, not a committed/published release. The exact
deployed 5E receipts and prior Execution 5 ledger remain preserved. Windows npm
`.bin` quoting failed in the ampersand-containing repository path; direct installed
Node entry points passed without changing package scripts. Docker needed an
owner-confirmed engine start; its isolated runtime check then passed. A browser
fixture timing error was corrected to wait for mounted account controls and assert
the actual theme; final E2E results above include that correction.

No known local implementation defect remains in this scope. Real Cognito signup,
email delivery, canonical mappings, A/B/demo isolation, persistence, recovery,
refresh/logout and safe export/deletion remain unverified live. They are required
for separately authorized **Execution 3**, not waived by these local results.
The earlier blocked temporary-input cleanup remains separate and was not retried.
Broader UX stays Phase 6 and production stays Phase 7.

The sections below retain the accepted Execution 1 rationale and work inventory;
their original “required change” descriptions are not new open implementation gaps.

## 1. Execution 1 baseline evidence and paused testing disposition

Local HEAD is `ff18c6762aa1a1f5f423667659cfae83f74f786e`; application source was
clean at inspection. No AWS API, GitHub or staging application requests were made here, and
no login, tests, build or dependency installation was run. Official AWS reference
pages were consulted on October 23. Live statements below are **dated recorded
evidence**, not fresh inventory.

The preserved local Execution 3 receipt records stack `hireflux-staging`
`UPDATE_COMPLETE`, four Cognito additions, two modifications, no replacements and
successful configuration checks. Execution 4 records Amplify job 4 `SUCCEED` at
the same release, seven bounded public static requests, accepted security headers
and a signed-out landing/browser check. Both receipt SHA-256 values still match
the preceding handoff:

- `.tools/phase5e-readiness/execution3-20261023-result.json`:
  `ea4d8c704544d330f78a9d9c1dbe376c840818d9b9f968008e78b09512cfb768`.
- `.tools/phase5e-readiness/execution4-20261023-result.json`:
  `501b61c45dce5ccd782970b8cbefa23896e01d68dd81e9932c44a221c44f6a09`.

These ignored local receipts are not published evidence. Their hashes establish
local preservation, not independently proven source-to-hosted-artifact equality.

Execution 5 is **PAUSED / INCOMPLETE — live authenticated behavior not accepted**.
Local ledger inspection found zero invitation batch/creation attempts, no protected
identity mapping and no running invitation process. Counts remain users 0,
invitation requests/emails 0, journeys 0, refreshes 0, demos 0, deletes 0 and
owner-counted API A3+B2 = **5/60**. A pause event was appended without changing the
original ledger prefix. Do not restart the helper or request mailbox addresses.

One cleanup item remains: the specifically identified unused
`.tools/phase5e-readiness/private-invitation-input/mailboxes.json`. Automatic
approval review rejected the cleanup command with **“blocked by policy”**; it was
not retried through another mechanism. The file was left untouched and its contents
were not read during this assessment. Treat it as potentially sensitive despite
the earlier placeholder-only observation. Owner removal of this one file is still
needed; no protected identity/evidence file or directory should be removed. No
claim is made about editor history, backups or forensic erasure.

Recorded staging target: account ending 9465 / `us-east-1`, non-root
`hireflux-operator`, pool `us-east-1_A8ogxr5nI`, public client
`7shrt9ejr715i8accus6a0u1e3`, Amplify `d31vp0nq9fzl6q/main`. Recorded frontend is
`https://main.d31vp0nq9fzl6q.amplifyapp.com`; API is
`https://0z0fpmukik.execute-api.us-east-1.amazonaws.com`.

## 2. Execution 1 foundation and gaps (resolved locally as listed above)

“Reusable” means inspected implementation with existing offline tests, not a new
PASS for real Cognito users. Prior local qualification is described in the
[5B](phase5b-backend-cognito-handoff.md), [5C](phase5c-frontend-cognito-handoff.md)
and [5D](phase5d-account-lifecycle-handoff.md) handoffs.

| Surface | Current code and behavior | Disposition |
|---|---|---|
| Landing/demo | [LandingPage](../frontend/src/pages/LandingPage.tsx) `enterDemo` / `switchToDemo`; existing hero, product story, theme and no-account demo | Reuse. Correct demo-only product copy for the combined offering. |
| Account entry | `Create Account` already appears when `self_registration_enabled`; both account buttons call `enterAccount` → `beginSignIn` | Implement an explicit signup intent and provider signup destination. Do not rebuild the entry UI. |
| Public configuration | [auth route](../backend/src/hireflux_backend/api/routes/auth.py) `authentication_configuration`, `Cache-Control: no-store`; [frontend Zod validation](../frontend/src/api/authConfiguration.ts) pins site/API/domain and defaults registration false | Reuse. This boolean advertises capability; it does **not** enforce provider signup policy. |
| OAuth/session | [CognitoClient](../frontend/src/auth/cognitoClient.ts) `begin/callback/restore/refresh/revoke`; [adapter](../frontend/src/auth/cognitoSessionAdapter.ts); [controller](../frontend/src/auth/workspaceSessionController.ts) | Reuse SDK-owned state/nonce/S256 PKCE, single callback, rotated refresh, tab coordination, stale-result fencing and cache clearing. Real acceptance incomplete. |
| Callback/recovery UI | [AuthCallbackPage](../frontend/src/pages/AuthCallbackPage.tsx), [WorkspaceSessionGuard](../frontend/src/auth/WorkspaceSessionGuard.tsx) | Query stripped before asynchronous work; safe error, retry bootstrap and restart-sign-in paths exist. Extend wording/state tests for signup. |
| Admission/ownership | [CognitoVerifier](../backend/src/hireflux_backend/auth/cognito.py) `_verify/_admit/authenticate`; [dependencies](../backend/src/hireflux_backend/api/dependencies.py) | Signature/issuer/client/token-use/scopes/chronology checked; trusted userInfo must match sub and verified email. Ownership is verified sub, fixed STANDARD_USER. Reuse. |
| Bootstrap/persistence | [WorkspaceBootstrapService](../backend/src/hireflux_backend/application/workspace_bootstrap.py), [Dynamo adapter](../backend/src/hireflux_backend/infrastructure/dynamodb/workspace_bootstrap_repository.py) | Explicit empty atomic persistent workspace, bounded race recovery, no demo adoption/seeds/TTL. Already supports an admitted new subject. Live unverified. |
| First-use Home | [DashboardPage](../frontend/src/pages/DashboardPage.tsx), [decision model](../frontend/src/features/workspace/homeDecisionModel.ts), [HomeDecisionSection](../frontend/src/features/workspace/HomeDecisionSection.tsx) | No-record state and `/applications/new` action exist. “Recorded demo search” and optional demo tour render without checking identity kind: correct those for accounts. |
| Settings/recovery/export | [SettingsPage](../frontend/src/pages/SettingsPage.tsx), [account controls](../frontend/src/features/accounts/AccountManagementControls.tsx) | Persistent profile read-only; provider owns recovery; CSV and recent-auth JSON export exist. Demo preview is already demo-only. A direct provider recovery entry is recommended, not a new password API. |
| Deletion/reconciliation | [lifecycle](../backend/src/hireflux_backend/application/account_lifecycle.py), [provider adapter](../backend/src/hireflux_backend/infrastructure/cognito_identity.py), [operator procedure](account-finalization-operations.md) | Confirmed, recent-auth erasure before provider dispatch; durable uncertain-outcome guard; no blind retry. Retain safeguards; validate identity compatibility below. |
| Signup configuration | [CognitoAuth](../infra/lib/auth/cognito-auth.ts), [stack wiring](../infra/lib/hireflux-stack.ts) | `AllowAdminCreateUserOnly=true` and Lambda advertisement false are separately hardcoded. Signup is deliberately disabled, not missing infrastructure. |

### First-use workspace contract

The actual path is **verified provider account → code callback → admitted access
token → explicit `POST /api/v1/me/bootstrap` → ACTIVE private workspace → Home**.
Registration alone writes no application workspace. `CognitoSessionAdapter.activate`
checks returned PERSISTENT identity, subject and STANDARD_USER before normal pages
render. The browser-decoded identity is a consistency check; backend admission
remains authoritative.

Bootstrap creates profile/settings/workspace in a conditional transaction and
retries racing snapshots at most five times. Repeated login reuses records and
preferences, syncing only trusted profile name/email where required. A transaction
failure leaves no partial creation; a lost successful response can be recovered
by explicit bootstrap retry. Existing incompatible/foreign-provenance data,
DELETING/DELETED workspaces or a missing component of an ACTIVE workspace fail
closed instead of being reset. Unverified userInfo is rejected before bootstrap.

The DynamoDB adapter derives owner partitions from the trusted subject
([mapping](../backend/src/hireflux_backend/infrastructure/dynamodb/mapping.py));
no email-owned keys or browser-selected owner are required. Persistent data has no
demo TTL. A newly registered account starts with no fictional applications; display
the existing **Record an application** action. Reuse existing Settings/time-zone
defaults; no new onboarding database, import, tour or demographic form is needed.

## 3. Signup architecture decision

**Choose A: Cognito managed signup.** Existing Essentials managed-login v2,
default branding, domain, public secretless client and callback are compatible.
Passwords, confirmation codes and reset challenges stay on Cognito pages; HireFlux
does not collect or proxy them. Use the SDK's existing signin-request generation
to persist state/nonce/PKCE, then change only the browser destination path on the
already-pinned Cognito origin to `/signup`, retaining the transaction parameters.
AWS explicitly documents that route with the same parameters as authorize.
Keep `/oauth2/authorize` and `prompt=login` for returning/sensitive sign-in; do not
invent `screen_hint` support, construct a second transaction or bypass callback
validation. This is a proposed implementation, not a tested live signup redirect.
[AWS managed endpoints](https://docs.aws.amazon.com/cognito/latest/developerguide/managed-login-endpoints.html)

`CognitoClient.sdk` currently expires stored OAuth state after five minutes.
Email verification can outlast that window, or finish in another browser context.
Preserve that bound rather than globally extending sensitive-login freshness.
If the original transaction cannot finish, explain that registration may already
have completed and offer a **fresh Sign In** transaction; do not repeat signup,
reuse the old authorization code or claim account creation failed/succeeded
without evidence. Add a delayed-verification/state-expiry fixture and accept this
recovery path with the provider during rollout.

**B: custom HireFlux signup UI is deferred.** It would require handling passwords
in browser code, SignUp/ConfirmSignUp/ResendConfirmationCode state, reset states,
validation, throttling/error UX and a wider CSP/provider API boundary. It would
not avoid Cognito's cost, verification or public-endpoint abuse exposure. Its main
gain is visual control, which does not justify that work for this release.
Polish the HireFlux landing and return states while reusing provider credential UI.
[AWS public API model](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flows-public-server-side.html)

## 4. Cognito Username/sub and finalization

`account_lifecycle.require_recent` requires matching issuer/client, PERSISTENT
identity and `principal.provider_username == principal.identity.user_id`, followed
by fresh `auth_time` (300 seconds). This also gates full JSON export through
`get_sensitive_principal`, not just deletion. The provider username comes from the
verified access-token `username`; ownership always comes from verified `sub`.

The [5D handoff](phase5d-account-lifecycle-handoff.md#4-provider-finalization)
explains the equality check: a defensive pinned-email-pool restriction to prevent
mutable email/alias or a foreign username becoming a deletion target. It is not a
provider-neutral domain identity law. The source comment generalizes further than
the evidence; clarify its support boundary during implementation.

Official semantics relevant to this pool:

- With `UsernameAttributes=['email']` and no aliases, AWS documents that **SignUp**
  generates an immutable username with the same value as sub. Sub is stable even
  when email changes. AWS warns against strict RFC UUID validation of sub; the
  application already accepts bounded opaque subjects, including offline fixtures.
  [AWS attributes](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html)
- **AdminCreateUser** documents automatic username generation for email-only
  sign-in, but its API description alone does not establish identical username/sub
  values for every administrative creation path. No actual users were created in
  the stopped workflow, so there is no local live mapping evidence.
  [AWS AdminCreateUser](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminCreateUser.html)
- **AdminDeleteUser** takes a pool and Username. AWS permits aliases in appropriate
  pools and specifies sub for local users when username is not an alias. HireFlux
  intentionally uses the verified canonical target and the exact pool, never a
  body/email lookup.
  [AWS AdminDeleteUser](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminDeleteUser.html)

**Finding:** no demonstrated incompatibility with self-registration in the current
pool, and no evidence justifying a pool migration or removal of the equality
guard. Retain it, clarify the comment and add explicit creation-path fixtures.
Verify real self-signup canonical Username/sub before export/deletion acceptance.
If a valid same-user mapping differs, stop finalization and do not accept signup
as complete. Do not merely relax the comparison or switch to email ownership.

Conditional smallest resolution design, **only if that mismatch is demonstrated**:
introduce an adapter behind a typed provider-identity port that reads one exact
user in the pinned pool using the already verified sub, checks returned sub and
canonical Username against the verified principal, and returns a deletion target.
No ListUsers/email search or client-provided username. Preserve fresh userInfo,
same issuer/client/subject, terminal erasure and conditional dispatch. This needs
separate review of pool-scoped AdminGetUser IAM, bounds, MAU impact, reconciliation
and mismatch/absence/timeout tests; it is not a default prerequisite or an approved
change. Distinguish “unknown mapping” from a proven implementation defect.
[AWS AdminGetUser targeting and MAU behavior](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminGetUser.html)

## 5. Infrastructure changes and compatibility

Keep the existing pool: email required/mutable, auto-verification email,
case-insensitive email sign-in, verified-email recovery, verified updates before
email changes, password minimum 12 with four complexity requirements, MFA OFF,
COGNITO_DEFAULT email, Essentials, deletion protection and Retain. Keep public
code-only OAuth, scopes `openid email profile`, rotation/revocation, one-day
refresh lifetime and exact callback/logout paths. No IAM addition is needed for
managed signup; the Lambda's administrative permission stays AdminDeleteUser on
its one pool. No SES identity, SMS, trigger, identity pool or extra table is needed.

Add one explicit, default-false registration setting to
`infra/lib/config/environment.ts`, derive both
`AllowAdminCreateUserOnly = !enabled` and Lambda
`COGNITO_SELF_REGISTRATION_ENABLED` from it, and test enabled/disabled consistency.
Keep production false. Local/demo operation must not depend on AWS. The backend
public schema and Zod consumer can be reused unchanged unless tests expose a real
contract gap.

CloudFormation documents AdminCreateUserConfig updates as no-interruption. The
expected registration change modifies the existing pool policy and Lambda
environment, with **zero additions, deletions or replacements**, plus only other
explicitly reviewed release changes. Service rules make sign-in-attribute mode,
case sensitivity and existing required-attribute decisions creation-time
constraints even where CloudFormation labels a property “No interruption.” Do
not change them. A future requirement incompatible with those constraints needs a
separately approved new-pool/subject migration, not a quiet replacement.
[CloudFormation pool](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpool.html),
[service attribute constraints](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html)

The existing [update contract](../infra/lib/release/update-contract.ts) is for the
original four-resource Cognito introduction and **intentionally rejects opening
signup**. Preserve that historical contract and tests. Add a separately scoped
registration-update reviewer against the deployed 5E baseline; do not change its
old expectations or reset operational ledgers just to allow the new update.

## 6. Focused UX/UI decisions

Source review plus the checked-in light desktop 1280 and mobile 390 landing
[snapshots](../frontend/e2e/visual-regression.spec.ts-snapshots/) show a strong
headline/hero focal point, one prominent demo CTA and a long illustrative product
story. These are local **demo-state visual fixtures**, not new live observations,
Cognito screenshots or proof of current account-control layout. Preserve their
visual language and the [Home semantic contract](home-implementation-contract.md).

Recommended initial hierarchy:

- Anonymous portfolio landing: **Explore Demo** primary, **Create Account**
  secondary beside it with concise persistence copy, **Sign In** quiet but visible
  in the header. No three equally weighted buttons or recruiter-specific role.
- Ready persistent session: **Return to workspace** primary; an explicit demo
  switch secondary. Ready demo: **Continue Demo** plus explicit Create Account /
  Sign In; state clearly that sample data will not transfer.
- Account entry/recovery context: the requested account action is primary, with
  a clear return to demo. Do not guess audience or hide Sign In below the story.

This favors immediate portfolio evaluation; a later personal-use marketing route
could prioritize Create Account if evidence warrants it. No audience detection or
new landing-page system is needed now.

Required copy corrections: remove the global implication that the entire product
works “without creating an account”; make that statement demo-specific. Replace
unconditional “Demo workspace”/demo footer labeling for account entry and the
“Recorded demo search” Home label for PERSISTENT sessions. Hide the existing demo
tour for persistent accounts; reuse the no-record CTA rather than add a tour.
Keep disposable-staging/fictional-record notices visible without surrounding the
CTA with a wall of technical detail. Existing unsaved-change and cache-clearing
boundaries apply to signup too.

| State | Owner of the interaction and required presentation |
|---|---|
| Entry / redirect | HireFlux capability-gated Create Account; one click/transaction; announce the redirect and prevent duplicate clicks. |
| Email/password / validation | Cognito managed signup; no HireFlux password fields or telemetry of inputs. Explain that credentials open on the secure provider. |
| Verification / resend / invalid or expired code | Cognito confirmation/resend; visible recovery and throttling feedback. No automatic resend loop or copied email/code evidence. |
| Confirmation success | Provider completes verification, then authenticates or returns to Sign In as required. Confirmation alone must not create an apparent HireFlux session. |
| Existing account | Provider sign-in/recovery option; safe HireFlux return copy. Do not promise complete email-enumeration protection in this pool. |
| Canceled / provider or network failure | Safe error and explicit retry/start-over/return options; never issue an automatic demo as fallback. |
| First authenticated callback | Existing focused callback heading and status announcement; validate identity then bootstrap; preserve retry preparation without reusing the code. |
| Empty account / return visit | Existing empty Home → Record an application; existing saved workspace on later login; no seeds or automatic demo import. |
| Recovery | Existing managed login Forgot password, then same-sub account and data; optionally provide a direct recovery entry using the same guarded transaction construction. |
| Export / deletion | Reuse Settings and restricted account screen, fresh same-account login, typed deletion phrase, final confirmation and honest uncertain-outcome status. |

Use existing Button/Dialog/Feedback/theme components. Preserve semantic headings,
skip link and visible focus; move focus to callback/error/first-workspace heading,
announce loading without repeated alerts, associate new errors/help with controls,
and use 44px practical targets. Check 320/390/768/1280 widths, zoom/reflow,
light/dark contrast, keyboard-only traversal and reduced motion. Provider pages
require separate keyboard/screen-reader/mobile acceptance; their accessibility is
not proven by HireFlux tests. No new UI library. Broad dashboard/story redesign,
personalization, MFA/passkeys/social login and marketing refinements belong to
Phase 6 or later decisions.

## 7. Public exposure, privacy and cost controls

Enabling the pool's signup flag exposes the public SignUp API to anyone who knows
the public client ID, including callers bypassing HireFlux. Hiding Create Account,
CORS, API Gateway throttles or a frontend cooldown cannot secure that endpoint.
Existing app throttles (staging 10 requests/s, burst 20; Lambda concurrency 5)
bound part of backend load, not registrations or total spend. Keep verified-email
admission, fixed roles, owner-only access and existing per-workspace resource/export
bounds. Avoid raw credentials, email/code telemetry and verbose provider errors.
[AWS public-signup guidance](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-admin-create-user-policy.html)

`PreventUserExistenceErrors=ENABLED` remains useful, but email-username SignUp can
still disclose an already registered address. Do not promise otherwise or migrate
to aliases merely to mask that behavior. Document this privacy tradeoff, use
generic HireFlux messages and provide sign-in/recovery paths.
[AWS user-existence behavior](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html)

For the first **bounded, owner-supervised signup trial**, retain provider quotas,
email verification, no SMS, no automatic resend/recovery loops, existing diagnostic
logging/alarms and manual spend review. Default Cognito email has a documented
**50 messages/day per AWS account**, shared across signups, resends/recovery and
labs; actual remaining allowance is not verified here. It is an availability
bottleneck, not an abuse defense. Unconfirmed identities can accumulate; they do
not get an application workspace until admission. Inventory/retention of those
identities requires a later explicit policy and bounded owner-approved action,
not a new scheduled cleanup or silent deletion.
[AWS quotas](https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html)

Assume **$0 usable promotional credit**. Current published Cognito Essentials
pricing includes 10,000 direct/social MAUs per account/organization monthly;
remaining allowance shared with other usage is unknown. With allowance available,
20–50 direct testers can add $0 in Cognito MAU charges; if exhausted, the published
$0.015/MAU example implies roughly $0.30–$0.75 for that cohort, before email and
other services. These are conditional estimates, not a current bill or guaranteed
whole-app monthly price. Existing hosting/secrets/monitoring continue while tests
are paused. Lambda/API requests, DynamoDB reads/writes and permanent workspace
growth, logs, bandwidth and Amplify builds remain usage-driven; avoid repeated
builds. No new paid monitor, WAF/Plus feature or service is proposed.
[Cognito pricing](https://aws.amazon.com/cognito/pricing/)

COGNITO_DEFAULT uses AWS-managed email resources; the docs describe limited default
delivery and separate SES sending configuration. Do not assume that MAU allowance
covers every email charge or guarantee inbox delivery. Keep the existing sender
for the small trial; larger volume/custom sender needs a separately costed SES
decision, not this release.
[AWS email configuration](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)

Before broader/unattended public availability, require an explicit abuse and
capacity decision: workable signup/resend/recovery controls, email delivery
capacity, account-retention/privacy policy, operator response/notification and
recovery readiness. Measure evidence before choosing WAF, a trigger or custom
email; do not describe the first supervised trial as launch readiness. Preserve
manual $2 incremental review, ~$5 initial-test stop, ~$1/day unexplained-growth
investigation and >$10/month hosting review. Budgets/quotas are not spending caps.

**Registration shutdown:** separately authorize an in-place pool update restoring
`AllowAdminCreateUserOnly=true` and advertisement false. Keep Cognito capability,
client/domain, existing sign-in/recovery, demo and records intact. Test that closed
SignUp is rejected and old users can still log in. Document how to handle already
unconfirmed accounts. Hiding the CTA alone is not shutdown; removing the pool,
client or domain would unnecessarily disrupt existing users. No shutdown was run.

## 8. Accepted Stage 2 work inventory — implemented locally in Execution 2

Relative effort: S = localized wiring/copy; M = coordinated behavior/tests; any
conditional identity-resolution change is M–L security work. Overall expected
scope is **M**, driven by qualification and live lifecycle evidence rather than
a new authentication system. No calendar estimate is implied.

| Priority / effort | Exact change and reason | Dependencies, tests and completion criterion |
|---|---|---|
| Required R1 / M | `auth/cognitoClient.ts`, `cognitoSessionAdapter.ts`, `workspaceSessionController.ts`: explicit signup entry routed through existing SDK transaction and the pinned `/signup`; existing sign-in/reauth unchanged | Add signup capability check at controller boundary, not just JSX. URL/state/nonce/PKCE/safe-return tests, repeated click/cancel/stale-result tests. Done when signup reaches its intended provider route with one guarded transaction. |
| Required R2 / S–M | `pages/LandingPage.tsx`: wire Create Account separately, clear demo/account copy and CTA hierarchy; visible header Sign In | Depends on R1. Capability off/malformed/unavailable cases, keyboard/focus/mobile layout, ready account/demo switching and no transfer tests. Done when each entry's destination and data lifetime are unambiguous. |
| Required R3 / S | `pages/DashboardPage.tsx`: identity-aware heading; suppress demo tour for accounts; reuse `HomeDecisionSection` no-record action | Bootstrap boundary remains unchanged. Extend `HomeComposition.test.tsx` / session tests with empty persistent fixture. Done when a new account has one clear first action and no sample/demo claims. |
| Required R4 / M | `infra/lib/config/environment.ts`, `auth/cognito-auth.ts`, `hireflux-stack.ts`: one default-closed registration setting, consistent pool/advertisement; production stays closed | `infra/test/registration.test.ts` covers both values and preservation of immutable settings, IAM, CORS, retention and resource IDs. The distinct signup-update review is in `infra/lib/release/registration-update-contract.ts`, with negative replacement/extra-change cases; original introduction contract/tests remain untouched. Only intended nonreplacing changes qualify. |
| Required R5 / S initially | `application/account_lifecycle.py` comment and identity-path regressions; keep existing safety policy unless a real incompatibility is proven | Extend `test_account_lifecycle.py` and `test_account_reconciliation.py` for expected self-signup mapping and mismatched admin-like fixtures, including export denial/no provider call. Preserve fresh auth, verified userInfo and one-winner dispatch. Real mapping plus safe deletion is a Stage 3 release gate; conditional resolver is not preapproved. |
| Required R6 / M | `cognitoClient.test.ts`, `CognitoControllerRaces.test.ts`, callback/guard tests and `e2e/cognito-auth.spec.ts`: modeled signup/verification/return with no automatic demo fallback or lost-code replay | Reuse fixtures, extend rather than recreate protocol infrastructure. Cover unverified denial, duplicate email, delayed verification beyond OAuth-state expiry, expired/invalid code and bounded resend/provider failure with synthetic responses. Distinguish fake-provider PASS from live provider acceptance. |
| Required R7 / S | Relevant frontend/backend/infra guides, auth/lifecycle contract notes and this plan: explain signup, staging data limits, shutdown, known enumeration behavior and deferred live checks | Depends on final code decisions. Update `.env.example` only if configuration actually changes; fake values only. Done when capability defaults, provider policy, privacy and release instructions agree. |
| Recommended / S | `SettingsPage.tsx` / account-entry controller: convenient managed password-recovery entry and concise help; improve redirect/preparation announcements where needed | Same pinned transaction builder, no new password form/API. Keyboard/focus/error tests; no credentials in output. Current provider Forgot password remains usable without this shortcut. |
| Optional / S–M | Modest managed-login branding, richer first-use greeting, extra marketing copy | No new dependencies, required name attribute, onboarding wizard or per-user database. Defer if it delays the functional release. |

No new backend signup route, bootstrap service, table/index, internal identity map,
password storage, authorization model or email delivery system is required by
current evidence. Preserve normal owner/foreign-404 policy and server-owned status,
metrics, transitions and erasure semantics.

### Focused offline qualification

The original assessment did not run suites. Execution 2 performed the approved
Stage 2 checks above using these scope requirements:

1. Reuse backend `test_cognito.py`, `test_cognito_accounts.py`,
   `test_workspace_bootstrap.py`, `test_account_lifecycle.py` and
   `test_account_reconciliation.py`. Existing tests cover opaque subjects, strict
   verified email, empty/idempotent/concurrent bootstrap, rollback, provenance,
   isolation, recent auth, alias denial and ambiguous finalization. Add only the
   creation-path/configuration gaps above; no duplicate generic auth suite.
2. Reuse frontend auth-configuration/client/store/coordination/adapter/race tests,
   `sensitiveOperations.test.ts`, account-management tests and fake-provider browser
   suite. Add signup intent, no-secret/URL-leak assertions, callback retry and
   account-aware landing/empty-state/accessibility cases. No live credentials or
   provider-page automation in offline fixtures.
3. Use existing lint/typecheck/test/build gates for affected stacks; the coordinated
   frontend/infra release also needs both-environment synth, unchanged physical
   schema parity, real-artifact verification and hosting/header checks per the
   repository guides. If backend code/runtime changes, rebuild/qualify its locked
   ZIP and isolated Linux runtime. A config-only Lambda change can reuse the exact
   qualified asset; do not repackage it without a reason.
4. Preserve original release/receipts, freeze the new approved source/artifact
   identities after qualification, and review diffs. Local verification grants no
   permission to push, deploy or enable registration.

## 9. Stage 3 — controlled rollout and acceptance, separate approval

### Financial evidence and current Gate A decision

October 24 Execution 3 Gate A technical reconciliation passed with its recorded
limits. Following the owner's explicit correction, one fresh STS identity check
and **one** already-enabled Cost Explorer `GetCostAndUsage` request succeeded
through `hireflux-operator`. Bills-console permissions are separate and remain
unverified: the October 20 owner/root Bills review did not establish non-root
console access, while the October 23 and October 24 successful API reads establish
the Cost Explorer path. Do not treat a past console denial as API denial or make
manual Bills figures the only evidence route.

The October 24 query started at **03:34:22 EDT / 07:34:22 UTC**. Requested and
returned period: `[2026-10-01, 2026-10-24)`, MONTHLY, UnblendedCost, grouped by
SERVICE and RECORD_TYPE. Estimated positive Usage components were **$3.8967390886**,
Credit components **-$3.8967391270**, with no Refund row and approximately **$0.00**
net (a tiny negative rounding residue). Positive components rose **$0.6944698884**
from the October 23 snapshot. EC2 Other, EC2 Compute and VPC account for $0.6434085335
of that increase; the grouping cannot isolate EBS, individual resources or exact
HireFlux attribution. No new significant unexplained contributor was observed.

**Financial recommendation: READY WITH QUALIFICATIONS for the bounded Gate B
approval review.** The whole-account estimate establishes practical exposure;
there is no formal Bills-only requirement for this release. It is not an invoice
or a forecast. October 24 usage is excluded; reporting can lag/revise earlier
days, no last-refresh timestamp is supplied, and tax/pending adjustments can be
missing. Recorded credit offsets do not establish future usable credit. Keep the
already-accepted $0 credit assumption, supervision and manual controls ($2 review,
$5 initial-test stop, ~$1/day unexplained-growth investigation and hosting review
above $10/month) without requesting them again absent a material
change. The approximately $0.01 current query fee is additional planning exposure
and may not yet appear in the result.

Reuse this accepted evidence and its explicit limits for this bounded release;
do not reopen financial research just because a task/window label changes. Any
necessary refresh needs specific bounded read authorization, current identity and
one-attempt accounting. Do not enable a service, change IAM/Billing, use root,
query again automatically or turn financial readiness into deployment permission.
Request owner Bills figures or one evidence-acceptance decision only if the
available estimate cannot establish exposure or a meaningful discrepancy remains.

Sanitized rows and comparison are in
`.tools/phase5f-execution3/gatea-financial-reconciliation.json`; the append-only
`gatea-20261024.jsonl` records the decision and preserved counts. This is an
authorized documentation amendment; the prior qualified plan is preserved as
`qualified-plan-before-financial-procedure.txt` in the same evidence directory.

1. Review the approved source/template diff and accepted current financial/lab
   evidence using the procedure above. Keep $0 assumed credit and the existing
   manual controls. Obtain specific
   deployment, publication and bounded live-test authorization; do not reuse old
   invitation attempts or reset their counters.
2. Make only relevant future reads: exact STS identity/account, existing stack /
   original template, pool sign-in/schema/email/recovery configuration and public
   client/domain/URLs, plus current branch/job revision needed for that release.
   Check deployment drift; no broad Gate 0 restart. Canonical metadata for two
   newly self-registered test identities is collected only after their approved
   creation, privately and without tokens/passwords.
3. Publish the qualified frontend while registration stays closed, then verify the
   hosted revision and closed-state UI. Review the prepared pool/Lambda UPDATE
   change set for no replacement/removal, no IAM expansion or unexpected resource
   change; preserve prior parameters/artifacts and normal rollback. Stop unexpected
   provider failures; no automatic redeploy/build retry.
4. Execute only after approval for a supervised opening window. Verify provider
   policy and `/auth/config` agree. Opening applies to the public provider endpoint
   immediately, including callers outside HireFlux; a private trial URL is not an
   access restriction. No retention of open signup is implied by this trial.
5. With new explicit request/email/journey budgets and owner-controlled mailboxes,
   complete two real self-signups and verification in isolated browser contexts.
   Confirm trusted subjects/canonical mappings before sensitive actions. Never
   ask for invitation contents, passwords, codes or tokens in chat/receipts.
6. Complete the **unfinished Phase 5E acceptance**: first empty durable bootstrap;
   create only fictional records; A/B/demo isolation and foreign-resource behavior;
   reload/returning sign-in persistence; rotated refresh and logout/caches;
   password recovery retaining the same subject/data; fresh same-account JSON
   export; rejection of wrong-account reauthentication; and safe lifecycle
   completion. No signup-only PASS substitutes for this set.
7. Before each real destructive account-finalization test, obtain separate exact
   owner approval and establish canonical identity plus terminal-erasure guards.
   Confirm provider absence/tombstone via the reviewed bounded method. Retain
   REVIEW_REQUIRED on uncertain outcomes; do not retry or delete ad hoc. Reusing an
   email after deletion must not recover the old subject's data. Synthetic fault
   tests complement, but do not replace, real lifecycle acceptance.
8. Verify the no-account demo still works, registration shutdown preserves existing
   sign-in/demo, and spend/email/abuse observations are acceptable. Do not load-test
   quotas or force dozens of emails. Record limits on untested natural expiry,
   delivery and failure cases honestly.
9. Owner explicitly decides whether registration remains enabled. Without that
   acceptance, use the reviewed close-registration update; do not leave a public
   trial open by inertia. Record created identities, data/tombstones, retained
   resources and unresolved issues for the pending 5E closeout / 5F acceptance.

**Acceptance boundary:** Phase 5F is not fully accepted until real-user
authentication, subject ownership/isolation, recovery, persistence, export and
safe deletion pass. A security/ownership failure blocks acceptance. Staging stays
fictional/disposable; permission for real personal job-search records and broad
public use needs later recovery/privacy/operations hardening. Production remains
Phase 7.

## 10. Owner decisions and next action

Stage 1 decisions, Stage 2 implementation and the narrow dependency repairs were
approved; local implementation and security qualification now pass.
Execution 3 Gate A has now completed its authorized read-only technical and
financial reconciliation with explicit qualifications. The next action is
separate Gate B authorization for the exact reviewed source commit/publication
with registration closed. Later infrastructure opening and bounded real-user
acceptance still need their own approvals. No additional
architecture research is needed. A custom password form, new pool or identity
resolver is not approved by implication. Identity resolution remains conditional
on demonstrated incompatible metadata and explicit security/IAM scope review.

Later decisions remain separate: exact staging opening/test budgets and mailboxes;
destructive test-account finalization; whether signup remains open after acceptance;
and broader public-use privacy/retention/email/abuse protections. Address the one
blocked temporary-file cleanup item independently. Execution 1 made documentation
changes only; Execution 2 changed local source/tests/docs and ran offline checks.
Neither performed AWS changes, commits, pushes, user creation or email delivery.

**PHASE 5F EXECUTION 2 COMPLETE — LOCAL IMPLEMENTATION QUALIFIED; STAGING ROLLOUT NOT AUTHORIZED**
