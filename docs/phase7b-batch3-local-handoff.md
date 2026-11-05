# HireFlux — Phase 7B Batch 3: Shared Production Infrastructure & Offline Release Qualification

November 3, 2026 — current local source and artifact evidence. No production deployment.

Repository: `C:\Users\xiole\Desktop\Development & Cloud\Projects\HireFlux`.

## A. Executive result

**LOCALLY QUALIFIED — UNCOMMITTED / UNPUBLISHED, WITH EXPLICIT EXECUTION-BOUNDARY QUALIFICATION.**

Option A is represented in offline infrastructure. Production independently accepts
verified Cognito Personal identities and signed temporary Demo identities on the
same API. Registration is configured CLOSED; absent operator policy pauses new
Demo issuance. Production binding remains null and publication is intentionally
blocked. This is not public-launch acceptance or permission to deploy.

All final affected suites pass: backend **811**, frontend **672 / 68 files**,
infrastructure **164**, real-artifact CLI **4**, Node hosting scripts **19**, browser
**20 scenarios**. Two backend builds are byte-identical; two pinned offline Linux
runtime checks pass. No application backend source or dependency lock was changed
by Batch 3. See K for limitations and iterative corrections.

The task prohibited hosted traffic. A failed browser provider-redirect fixture
unintentionally made **three read-only staging callback GETs**. Earlier zero-traffic
claims for those failed fixtures were wrong and are superseded by the retained
incident receipt. No live API calls, provider token requests, credentials, real
identities or account operations resulted. The corrected final suite intercepted
all requests and forwarded zero. This boundary deviation remains explicit; it
cannot be described as a perfectly offline execution history.

## B. Verified source baseline

Started clean on `main`, HEAD `ceaca6a892b81f1ac48fd62cb900c5c052c4ddac`
(`fix: patch dnspython and stabilize bootstrap concurrency test`; baseline retained in
`.tools/phase7b-batch3-20261103/starting-baseline.json`). No fetch or remote read.
Batch 1 commit `ff1ecad2db564c0a9781dc922646f1c398224873` and Batch 2 commit
`c84f359a7b33310106fa7eca4cd4fa0a90683ac1` already existed.
Pre-Batch-1 baseline is `efcd8afddcde93103637c6476a632245c431a141`.

The two pre-existing differences after Batch 2 are preserved: `backend/uv.lock`
updates dnspython 2.8.0 to 2.9.0; `test_cognito_accounts.py` strengthens the Moto
four-request concurrency fixture. Twenty-three of 24 Batch 2 receipt hashes match;
the explained concurrency-test hash is the sole exception. No author/publication
intent is inferred from local commits. Historical Batch 1/2 handoffs, source
receipts, old UPDATE reviewers and root header bytes are preserved.

Final HEAD and branch are unchanged. The working tree is dirty only with the
Batch 3 files listed below; nothing is staged, committed or pushed. The final
complete source snapshot hashes every tracked and nonignored untracked file,
including this report. Ignored artifacts/evidence have separate hashes to avoid
self-referential manifests. This is HEAD plus dirty-source provenance, not a claim
that HEAD alone contains the candidate.

## C. Files changed

Inherited Batch 1/2 application work is already in HEAD, not fresh Batch 3 edits.
The existing dnspython lock and concurrency fixture are not rewritten. Batch 3
modifies/adds the following files (38 modified,
9 new at final inventory preparation):

- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [backend/README.md](../backend/README.md)
- [backend/scripts/lambda_artifact_probe.py](../backend/scripts/lambda_artifact_probe.py)
- [backend/scripts/validate_lambda_artifact.py](../backend/scripts/validate_lambda_artifact.py)
- [backend/tests/unit/test_lambda_packaging.py](../backend/tests/unit/test_lambda_packaging.py)
- [docs/adr/0012-amplify-hosting-origin-wiring.md](../docs/adr/0012-amplify-hosting-origin-wiring.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/deployment-environments.md](../docs/deployment-environments.md)
- [docs/devlog.md](../docs/devlog.md)
- [docs/phase7b-batch3-local-handoff.md](../docs/phase7b-batch3-local-handoff.md)
- [docs/roadmap.md](../docs/roadmap.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/scripts/public-deployment-projection.d.mts](../frontend/scripts/public-deployment-projection.d.mts)
- [frontend/scripts/public-deployment-projection.mjs](../frontend/scripts/public-deployment-projection.mjs)
- [frontend/scripts/public-deployment-projection.test.mjs](../frontend/scripts/public-deployment-projection.test.mjs)
- [frontend/scripts/render-hosting-headers.mjs](../frontend/scripts/render-hosting-headers.mjs)
- [frontend/scripts/render-hosting-headers.test.mjs](../frontend/scripts/render-hosting-headers.test.mjs)
- [frontend/scripts/verify-hosted-build.mjs](../frontend/scripts/verify-hosted-build.mjs)
- [frontend/scripts/verify-hosted-build.test.mjs](../frontend/scripts/verify-hosted-build.test.mjs)
- [frontend/src/api/authConfiguration.test.ts](../frontend/src/api/authConfiguration.test.ts)
- [frontend/src/api/clientTrust.test.ts](../frontend/src/api/clientTrust.test.ts)
- [frontend/src/deployment-targets.json](../frontend/src/deployment-targets.json)
- [frontend/src/publicDeployment.test.ts](../frontend/src/publicDeployment.test.ts)
- [frontend/src/publicDeployment.ts](../frontend/src/publicDeployment.ts)
- [frontend/src/publicDeploymentPolicy.d.mts](../frontend/src/publicDeploymentPolicy.d.mts)
- [frontend/src/publicDeploymentPolicy.mjs](../frontend/src/publicDeploymentPolicy.mjs)
- [frontend/src/securityHeaders.ts](../frontend/src/securityHeaders.ts)
- [frontend/vite.config.ts](../frontend/vite.config.ts)
- [infra/README.md](../infra/README.md)
- [infra/lib/app.ts](../infra/lib/app.ts)
- [infra/lib/backend/backend-api.ts](../infra/lib/backend/backend-api.ts)
- [infra/lib/config/environment.ts](../infra/lib/config/environment.ts)
- [infra/lib/hireflux-stack.ts](../infra/lib/hireflux-stack.ts)
- [infra/lib/hosting/frontend-hosting.ts](../infra/lib/hosting/frontend-hosting.ts)
- [infra/lib/operations/operational-guardrails.ts](../infra/lib/operations/operational-guardrails.ts)
- [infra/lib/release/shared-production-contract.ts](../infra/lib/release/shared-production-contract.ts)
- [infra/scripts/check-schema-parity.mjs](../infra/scripts/check-schema-parity.mjs)
- [infra/test/backend.test.ts](../infra/test/backend.test.ts)
- [infra/test/cli.integration.ts](../infra/test/cli.integration.ts)
- [infra/test/cognito.test.ts](../infra/test/cognito.test.ts)
- [infra/test/config.test.ts](../infra/test/config.test.ts)
- [infra/test/dynamodb.test.ts](../infra/test/dynamodb.test.ts)
- [infra/test/hosting.test.ts](../infra/test/hosting.test.ts)
- [infra/test/operations.test.ts](../infra/test/operations.test.ts)
- [infra/test/resource-inventory.ts](../infra/test/resource-inventory.ts)
- [infra/test/shared-production-contract.test.ts](../infra/test/shared-production-contract.test.ts)
- [infra/test/stack.test.ts](../infra/test/stack.test.ts)

Generated packages/builds/templates/evidence remain under ignored `.tools/`.
No `dist/`, `node_modules/`, cache, virtual environment, old release artifact,
diagram, secret, mailbox address or real user data is added to Git.

## D. Infrastructure architecture

Each environment has its own table, Lambda, HTTP API, Amplify app/branch, pool,
public client, hosted domain, signing secrets and operational resources. Production
is a shared application for both product modes, not a separate Demo stack.

Production sets `ENVIRONMENT=production`, `AUTH_MODE=cognito`,
`AUTH_CAPABILITIES=demo,cognito`, `DEMO_SESSION_TTL_HOURS=24` and
`COGNITO_SELF_REGISTRATION_ENABLED=false`. Explicit production
`productionAuthCapabilities=cognito` remains available for a reviewed Cognito-only
target; default mixed CREATE/release reviewers deliberately require both modes.
Staging keeps its existing Demo anchor with explicit mixed capabilities.

One on-demand table retains the same PK/SK and GSI1/GSI2/GSI3 schema. Production
keeps PITR, deletion protection, DeletionPolicy/UpdateReplacePolicy Retain and
`expires_at` TTL. Durable Personal data has no Demo TTL. The pool remains protected
and retained. Two existing Secrets Manager signing secrets remain distinct,
role-resolved and outside Vite/browser configuration. No startup schema/control
mutation, new datastore, scheduler, paid detailed metrics or new IAM role is added.

Lambda remains Python 3.14/x86_64, 1024 MB, 15 seconds, reserved concurrency 5 stage /
10 production. HTTP API integration timeout remains 20 seconds. Production
dashboard is omitted; staging keeps its dashboard. Both keep two finite log groups
and five alarms, optional three-resource notification group and existing budget.

## E. IAM permissions

Actual synthesized Lambda policy:

- `GetItem` and `ConditionCheckItem` on this environment's table ARN only.
- `PutItem`, `UpdateItem`, `DeleteItem`, `BatchWriteItem` on that table, conditioned
  by `ForAllValues:StringLike dynamodb:LeadingKeys` allowing only `USER#*`,
  `DEMO_IDEMPOTENCY#*`, `DEMO_ADMISSION#DAY#*`, `DEMO_ADMISSION#MINUTE#*`, with
  `Null: dynamodb:LeadingKeys=false` so absent condition keys cannot satisfy it.
- `Query` only on the table and exact three index ARNs. No Scan or table/schema IAM.
- Existing exact two-secret GetSecretValue, backend-log stream/write and
  same-pool AdminDeleteUser grants remain. No operator policy-write grant.

AWS authorizes transaction components via their underlying Get/Put/Update/Delete
actions; ConditionCheck needs ConditionCheckItem. Adding a fictitious generic
TransactWriteItems IAM action would not supply this boundary.
[AWS transaction IAM documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html)
supports the action mapping; the [service authorization reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_dynamodb.html)
and [DynamoDB conditions guidance](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/specifying-conditions.html)
support LeadingKeys/ForAllValues usage.

This allows atomic reservation counters, idempotency records, user namespace writes,
rollback/conflict handling and bounded conditional cleanup, while excluding writes
to `CONTROL#...` policy partitions. Policy reads/checks do not grant policy mutation.
Application ownership is still enforced in the server; table-scoped Query IAM does
not itself implement per-end-user authorization. No separate public control endpoint
or startup enabled-policy initializer exists.

Operator initialization/toggle must be a separately authorized exact-table/key,
version-checked workflow with finite limits and owner-preserved evidence. There is
no new public-role access to perform it. Local assertions and Moto prove source and
synthesized policy shapes; actual IAM condition evaluation, role boundaries and
transaction permissions still require a bounded live operational gate.

## F. API Gateway and runtime

New `BackendApiDemoIssuanceRoute3494DE53` explicitly matches the existing
`POST /api/v1/demo-sessions` endpoint and reuses the existing integration. No second
Lambda, API or permission is added. Route rate/burst is 1/2, detailed metrics off;
global stage 10/20 and production 20/40 are unchanged. Other Personal/Demo routes
continue through the existing default integration.

API Gateway-managed explicit-origin CORS remains the authority, including OPTIONS.
No catch-all or credential wildcard is introduced. The explicit POST route does
not route OPTIONS into Demo issuance or require authentication for API-managed
preflight. The same route/default integration target is asserted in both templates.
[HTTP API CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
and [throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html)
documentation distinguish managed preflight from best-effort throttle targets.
Throttles are not exact cost/concurrency caps; the finite transaction admission
policy is the separate new-work boundary. Previously issued identities remain valid
when new issuance is paused.

Packaged Linux mixed and Cognito-only startup passed, as did closed registration,
missing/invalid policy, provider/signing requirements, existing Demo and Personal
independence and expiry boundaries. Startup performs zero issuance-policy IO.
Invalid policy returns 503; missing deployed policy pauses mixed issuance (429);
Cognito-only rejects Demo issuance (503). Existing valid Personal/Demo access does
not need a healthy issuance-control store.

A Moto observation seeded 30 fictional applications in 2.219 seconds (factory
0.0116 seconds excluding imports): 138 GetItem, 19 Query, 71 TransactWriteItems,
2 PutItem logical calls. Pause and READY replay used two Gets each. This is local
synthetic timing, not AWS p95/cold-start or a timeout guarantee. Retain 15-second
Lambda/20-second integration settings; later bounded live latency/timeout evidence
must establish headroom before production exposure.

## G. Production authentication and public binding

The shared canonical registry is `frontend/src/deployment-targets.json`.
Its staging binding preserves the exact reviewed site, API, issuer, client, domain,
callback and logout tuple. Production is **null**. The same pure engine drives
browser resolution, header generation, Vite target projection and release review.
Unknown public origins, provider mismatches, missing configuration and a 404 config
response fail closed. Local loopback compatibility remains explicit.

Demo signature validation, Cognito JWT verification and ownership remain independent.
Pausing issuance neither disables signed existing Demo access nor Personal access.
No email/password/token is stored in the browser deployment contract.

Production startup primary is Cognito. Both pool AdminCreateUserOnly and backend
advertisement remain closed; generic production `selfRegistrationEnabled=true`
is rejected. `reviewProductionActivation` is a separate future inert paired review
contract. It binds exact account/region/stack, accepted closed template/package,
hashed deployment receipt and physical pool/client/app/API IDs, provider/binding,
new frontend bytes and four prerequisite receipt hashes. Only the two paired
pool/backend registration changes are permitted; partial opening or unrelated
change rejects. Owner-reviewed recovery, real-account, operations and privacy
evidence must precede any activation. Hash checks bind evidence bytes; they do not
prove external facts or grant authority. Real target binding and an executable
target-specific activation plan remain future gates; no production opening flag
was weakened in this batch.

## H. Hosting/header authority

Root `customHttp.yml` is unchanged (SHA-256 `d3e8f3dd3ef74e424bbe4ac1ddfb959cc345ef1fb618bf06cf60a1fb16311324`). It remains
authoritative. The proposed staging App.CustomHeaders is semantically equivalent
to this retained policy, including the old us-east-1 API source solely for
transition. It is not falsely described as an already-delivered exact API policy.
Production App headers are restrictive/self-only while unbound; after binding,
the shared renderer generates exact API/provider directives and security headers.

Preserved policies include HSTS, nosniff, DENY/frame-ancestors, no-referrer,
Permissions-Policy, COOP/CORP, no unsafe script execution and explicit connect-src.
Existing `style-src 'unsafe-inline'` is retained for current styling compatibility;
there is no claim it was removed. No broad production regional API fallback exists.
YAML uses tested monorepo applications/appRoot representation.

AWS documents that root customHttp.yml overrides stored app headers and a redeploy
is needed to apply header changes. Source/template equality is not delivered-header
evidence. [AWS header precedence](https://docs.aws.amazon.com/amplify/latest/userguide/setting-custom-headers.html),
[monorepo header format](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-custom-headers.html).

Required safe order: separately approve storage of equivalent stage app headers;
verify stored state without changing root; qualify exact stage policy and header
retirement together; separately approve root retirement/publication and its stage
build effect; verify actual stage delivery; separately bind/qualify exact production
app policy and build, then verify actual production delivery. Production may be
created closed/unbound beforehand but must not be published from the root-authority
state. An initial provider build can fail the guard; expected build effects must
be explicitly approved rather than hidden behind auto-build=false.

Production BuildSpec runs the publication scanner. `verifyHostedBuild` is only an
artifact scan, reporting publishable=false; `verifyPublicationBuild` requires the
canonical target and rejects production while root authority exists. The explicit
fixture-only API permits fictional production QA and never yields publishable=true.
Build-time projection removes the staging tuple entirely from fictional-production
artifacts instead of merely avoiding its use at runtime. Graph checks find no
CloudFormation dependency cycle; exact literal policy avoids App/API reference
cycles. Future live stored/delivered-header checks remain mandatory.

## I. Resource inventories

These are **local source/synth comparisons**, not fresh AWS inventory or a drift
report. Baseline HEAD synthesizes 29 staging declarations / 26 blank-email resources.
Proposed staging: **30 / 27**. Proposed production: **29 / 26**. Each blank email
excludes three conditioned SNS declarations (topic, subscription, topic policy).

Added staging: explicit Demo POST route. Removed staging: none. Changed existing
deployment declarations: Lambda explicit TTL24; execution policy transaction/write
boundary; default stage Demo RouteSettings; Amplify App stored equivalent headers.
Only nondeployment `aws:cdk:path` metadata added by CLI synthesis is normalized
against the programmatic baseline. No other template section drift is accepted.
Existing Code uses the same fresh ZIP in before/after comparison, so this comparison
does not hide or claim deployed backend-byte equality. Old deployed ZIPs stay intact.

All existing resource types, names, logical IDs, retention/update-replace policies,
table schema, pool/client/domain/branding, secrets, logs, API/integration/permission,
branch, alarm, SNS and budget properties are preserved except the four explicit
modifications above. No stateful replacement is proposed by this offline comparison;
only an actual future change set can establish AWS replacement reporting.

The complete proposed staging logical-ID map (production omits only dashboard):

- `WorkspaceTable68AC2584` — AWS::DynamoDB::Table
- `FrontendHostingApp3EC0FC15` — AWS::Amplify::App
- `FrontendHostingBranchB5734B41` — AWS::Amplify::Branch
- `CognitoAuthUserPoolAF093846` — AWS::Cognito::UserPool
- `CognitoAuthPublicClient5A05A7D7` — AWS::Cognito::UserPoolClient
- `CognitoAuthDomain0075BD90` — AWS::Cognito::UserPoolDomain
- `CognitoAuthManagedLoginBranding8935A739` — AWS::Cognito::ManagedLoginBranding
- `OperationalLogsBackendFunctionLogs44D131F8` — AWS::Logs::LogGroup
- `OperationalLogsHttpApiAccessLogs3515ABA0` — AWS::Logs::LogGroup
- `BackendApiCursorSigningSecret5EF895FB` — AWS::SecretsManager::Secret
- `BackendApiDemoSessionSigningSecretB7E1C367` — AWS::SecretsManager::Secret
- `BackendApiExecutionRoleF9E94D3B` — AWS::IAM::Role
- `BackendApiExecutionRoleDefaultPolicyDE57D6A3` — AWS::IAM::Policy
- `BackendApiBackendFunctionFFB5248D` — AWS::Lambda::Function
- `BackendApiHttpApiB4B1202A` — AWS::ApiGatewayV2::Api
- `BackendApiHttpApiDefaultRouteBackendIntegrationC791C627` — AWS::ApiGatewayV2::Integration
- `BackendApiHttpApiDefaultRouteBackendIntegrationPermission521AD465` — AWS::Lambda::Permission
- `BackendApiHttpApiDefaultRoute408A2CCF` — AWS::ApiGatewayV2::Route
- `BackendApiHttpApiDefaultStage89B5186D` — AWS::ApiGatewayV2::Stage
- `BackendApiDemoIssuanceRoute3494DE53` — AWS::ApiGatewayV2::Route
- `OperationsOperationalAlerts7AC1A668` — AWS::SNS::Topic
- `OperationsOperationalAlertSubscription953AAEA9` — AWS::SNS::Subscription
- `OperationsOperationalAlertPolicy4A085B4E` — AWS::SNS::TopicPolicy
- `OperationsLambdaErrors5904FFE2` — AWS::CloudWatch::Alarm
- `OperationsLambdaThrottles66F0659C` — AWS::CloudWatch::Alarm
- `OperationsHttpApiServerErrors8A0F4370` — AWS::CloudWatch::Alarm
- `OperationsDynamoDBThrottlesAF8DF63F` — AWS::CloudWatch::Alarm
- `OperationsDynamoDBSystemErrorsB63796D3` — AWS::CloudWatch::Alarm
- `OperationsOperationalDashboard098A469E` — AWS::CloudWatch::Dashboard
- `OperationsMonthlyCostBudgetFC194922` — AWS::Budgets::Budget

Production has the same logical construct layout within its distinct stack and
environment-specific names/lifecycle. It is an initial CREATE, not an UPDATE of
staging. No VPC, NAT, database engine, second Demo stack, polling service, WAF or
paid metric collection is introduced. Route/IAM/header changes add no standing
service; omission avoids a possible paid production dashboard charge.

## J. Release artifact evidence

Fresh backend ZIP: `.tools/phase7b-batch3-20261103/hireflux-backend-candidate.zip`.
SHA-256 `08933f7b30edc158e09ac2528bc6c66554087a6706694bcf8f0e7a320da45066`;
31,706,710 compressed bytes, 73,759,416 expanded bytes, 3,969 members,
35 installed distributions. Manifest SHA-256
`ca6a88440e84f428981dc3ed6689337a3f6e78144ab7c4845f415b57f56d79ee`.
Source/pyproject/uv.lock binding and two clean-build identical inventories verified.
Above the 30 MiB soft warning, below 40 MiB compressed / 200 MiB expanded hard gates.

Builder: Python 3.14.7, pinned uv 0.12.5, cached Linux wheels, UV_OFFLINE and no
Python downloads. Runtime: cached
`public.ecr.aws/lambda/python:3.14@sha256:b81a4aa3bc1d56999090333cefea611e5a84bb4e2638c1ae4107fdc9b8622da3`,
Linux Python 3.14.8, x86_64/glibc2.34. Non-root/read-only/network-none/cap-drop /
no-new-privileges, --pull never; eight native imports and 35 distributions checked.
The patch-version difference between build host and pinned runtime is recorded.

Qualified templates:

- before: `83c256bc3734a1758344f0ce50b5b3648a8975424ad3f560d3830a61988e0af9`.
- staging: `3f9154fd84607ba4831085f333990b8889b93530209df5a8411f6e0f269a2855`.
- production: `c13ec4588359d636282968deec10ce9f33096311758e9b016864d30e876e3f02`.

CDK CUSTOM asset destination fingerprints the hexadecimal ZIP hash again; the S3
key is that second SHA-256 plus .zip, not the raw ZIP digest. Artifact CLI verifies
staged ZIP bytes against the original digest and size. No upload occurred.

Actual staging frontend and isolated fictional-production frontend each contain
45 files under `.tools/phase7b-batch3-hosting-20261103/`. Stage uses current exact
stage binding. Fictional production excludes stage origins/provider IDs and stays
fixture_only=true / publishable=false. No real production artifact is publishable
without actual identities. No source maps, private material or local endpoints
were found by the scans.

`.tools/phase7b-batch3-20261103/final-receipt.json` indexes the complete source
snapshot, modified/new hashes, locks, backend/package manifest, template/asset
manifests, IAM/header policies, build contents/scans and previous-evidence checks.
`source-snapshot.json` records actual HEAD plus all dirty source bytes. The new
publication entrypoint requires the exact complete Git inventory and actual
component bytes; an arbitrary consistent hash tuple alone cannot qualify it.
Current normal production publication intentionally rejects the null binding.
Earlier reviewers `update-contract.ts` and `registration-update-contract.ts`
remain byte-identical to baseline.

## K. Test results

Commands were run through direct installed tools to avoid the Windows ampersand
path issue. Logs remain in the two task evidence directories.

- `backend/.venv/Scripts/python.exe -m ruff check backend`: PASS.
- Same interpreter `-m ruff format --check backend`: PASS (133 files).
- Same interpreter `-m mypy backend/src`: PASS (82 files).
- Same interpreter `-m pytest backend -q`: **811 PASS**, 111.67 seconds; one
  upstream Starlette/httpx deprecation warning. No dependency replacement.
- `node node_modules/eslint/bin/eslint.js . --max-warnings 0` from frontend:
  PASS; `node node_modules/typescript/bin/tsc -b`: PASS.
- `node node_modules/vitest/vitest.mjs run --maxWorkers=2` from frontend:
  **672 PASS / 68 files**, 141.60 seconds. Existing jsdom document-navigation
  diagnostic appears; no failed tests.
- `node --test scripts/render-hosting-headers.test.mjs scripts/verify-hosted-build.test.mjs scripts/public-deployment-projection.test.mjs`:
  **19 PASS**. Focused frontend policy/auth/config suite **108 PASS** is included
  in the full frontend result, not an additional unique-test total.
- `node node_modules/typescript/bin/tsc` in the infra package: PASS.
  `node scripts/test-unit.mjs`: final **164 PASS**, including the 17 new shared
  release reviewer cases. Frozen UPDATE reviewer tests remain active.
- `HIREFLUX_QUALIFIED_BACKEND_ARTIFACT=...` with
  `node --require ./build/test/block-network.js --test build/test/cli.integration.js`:
  **4 PASS**; repeated stage/prod synths, explicit fictional accounts, profile /
  mutation rejection, exact inventories and actual ZIP checks; no network attempts.
- Fresh `export_dynamodb_schema.py --output .../dynamodb-schema.json`, followed by
  network-blocked `scripts/check-schema-parity.mjs --schema ...`: both environments
  PASS for keys/types, three GSIs/projections, TTL and billing. Fresh OpenAPI export
  also passed; no application schema change was introduced.
- Persisted stage/prod synth through `scripts/cdk-local.mjs synth -c environment=...`
  and explicit qualified backendArtifact: PASS with inherited network blocker,
  no profiles/lookups, telemetry disabled and no audit events. Both candidate
  templates match prior persisted candidate synths byte-for-byte. Explicit JSON
  graph comparison: acyclic. Production actual CREATE review passes closed/default-paused.
- Backend build repeated twice: identical; packaging/runtime focused host tests
  **62 PASS** (subset of full backend); two isolated pinned Linux validations PASS.
- Target-specific Vite staging build/publication scan and fictional-production
  build/fixture scan: PASS, 45 files each. Twenty final intercepted browser scenarios
  PASS across both builds: exact config, unavailable/404/mismatched-provider closed
  trust, existing Demo, paused/quota/uncertain/in-progress issuance and same-key
  explicit retry, provider outage with Demo still available.
- `git diff --check`: PASS. Local documentation links/source/evidence checked.

Corrective iterations: early focused infrastructure goldens and one full DynamoDB
resource-count assertion assumed the old totals; updated to the exact environment
inventory without relaxing schema assertions. Initial schema parity used hardcoded
29 and stopped on staging30; it now uses the same reviewed inventory and passes.
Final release review caught incomplete source-manifest coverage and added exact
whole-inventory checks plus synthetic omission/addition/duplicate rejection.
No behavioral requirement or frozen evidence was weakened.

Docker was initially unavailable. A hidden normal Desktop launch was used; an
ordinary vmcompute start attempt was denied, with no elevation/settings change.
Desktop later became ready and the cached runtime passed; no image pull occurred.
An exploratory Windows-host mypy of the Linux probe was not the canonical app
gate and failed platform/import/socket typings; backend/src mypy passes. Two
historical runtime warning diagnostics remain in the preserved log.

The failed redirect fixture led to three unintended static callback GETs as recorded
in A/O. The corrected explicit synthetic callback navigation passes through the
interceptor. Its final 374 intercepted requests include 38 mock API and four mock
provider requests, 16 fictional failed Demo POSTs, zero forwarded requests/accounts.
These are isolated QA counters, separate from historical Phase 5E/5F live ledgers.

## L. Financial and operational impact

Reuse the accepted cost model, with **$0 assumed usable promotional credit**:
approximately **$5.44–$7.04/month lean shared architecture**, or
**$8.44–$10.04/month when a paid staging dashboard is retained**, subject to the
earlier modeled usage, account allowances/labs and pricing assumptions. These are
estimates, not new Bills observations, quotes, future credit guarantees or caps.
This batch retains the staging dashboard and omits only production's dashboard.
The retained-stage scenario crosses the $10 review line at its upper edge; owner
review is required before indefinite hosting if that exposure is expected/observed.

Standing exposure includes signing secrets, applicable alarm metrics/dashboard,
storage/PITR and retained assets; requests, new seeds/transactions, logs, builds,
bandwidth and users drive additional usage. No new fixed-cost infrastructure is
introduced. Five alarms use three simple metrics plus two six-input math alarms;
allowances and whole-account use determine charges. Do not assert all monitoring
is free. Build/push effects must be budgeted independently; disabled prod auto-build
is not a guarantee that initial branch provisioning cannot build.

For approximately 2–7 interested visitors this remains proportionate if bounded
admission, default pause and supervised rollout are kept. No concurrency/cost claim
is established by local seed timing. Keep $2 incremental review, $5 initial-test
stop, unexplained ~$1/day investigation and >$10/month hosting review. Budgets are
notifications, not caps. No CE/Billing query or new pricing campaign occurred.
Three static callback GETs may have negligible usage impact, but no exact charge
or zero-cost assertion is made. Retain essential logs, alarms and protection.

## M. Future deployment sequence

Every live mutation/publication below requires separate concrete owner approval;
none is standing authorization from this offline handoff.

1. Review/financial preflight: approve exact target and fresh bounded identity,
   inventory, quota and cost reads. Preserve cash-funded assumptions/thresholds.
   Review current Git source snapshot and future commit/publication effects rather
   than substituting the old HEAD alone.
2. Staging compatibility: qualify exact fresh ZIP/template against accepted deployed
   state; approve scoped upload, unexecuted UPDATE change set, independent review
   and a separate execute gate. Store equivalent stage App headers first. Review
   the new route throttle and write IAM. Avoid unrelated resource changes.
3. Issuance initialization: missing deployed policy already pauses the new code.
   An explicit operator PAUSED policy with finite versioned limits may be initialized
   only under separate exact-table/key approval; test control-boundary permissions
   without leaving enabled policy. A policy record cannot pause OLD deployed code
   that does not read it. Any temporary old-code exposure needs separately reviewed
   containment/update sequencing; route throttling alone is only best effort.
4. Production CREATE: approve real account/region/name/quota and source-bound
   template/ZIP with signup closed and no enabled issuance policy. One reviewed
   CREATE change set must show expected inventory/Retain/PITR/IAM. Review repository
   authorization and possible initial branch build. Do not reuse expired/revoked
   historical PATs or recover secret values. New App authorization, if required,
   needs a personally supplied transient private NoEcho input and separate approval.
   AWS documents AccessToken authorizes the GitHub App and is not stored.
   [Amplify App credential contract](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-amplify-app.html)
5. Exact production binding/header migration: read actual app/API/pool/client/domain
   identities; owner-review the full tuple; separately qualify source, template,
   header and real production build bytes. Preserve signup closed. Retire root
   authority only after staged-equivalent app configuration is verified and the
   exact stage header migration/build is approved. One normal main push can also
   build staging; budget/review that effect. Production build remains blocked until
   the real canonical tuple and correct app policy are present.
6. Operational/recovery qualification: bounded checks of IAM transaction/CONTROL
   denial, default pause and finite issuance, CORS/throttles, logs/alarms/delivery,
   actual backend latency and hosted headers. Recovery must restore to a NEW table,
   review cutover, reapply/verify TTL, PITR, deletion protection, IAM, tags, alarms
   and app wiring; initialize PAUSED control before reopening. Reconcile admission,
   manifests/erasure and any resurrected records from the restore point. Restoring
   bytes is not account deletion or a safe traffic cutover by itself.
   [AWS restore behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/pointintimerecovery_restores.html)
7. Real Cognito acceptance only after separately approved supervised test window:
   exact two-account persistence/isolation, confirmation/recovery/export/lifecycle
   checks and explicit destructive-action gate where needed. Personal signup and
   Demo issuance have distinct enable/close decisions; do not couple them.
8. Public opening only after established Phase 7C–7G recovery, operational, account,
   privacy/support and launch obligations pass. Review exact paired pool/backend
   activation and matching frontend advertisement. Approve finite Demo admission
   separately. Define closure/incident/credit-expiry response; no automatic opening.

Stopping tests does not stop standing charges. A future shutdown plan must separately
approve branch/build controls and resource retirement, review retained table/pool/
secrets/logs/assets, data backup/erasure obligations and irrecoverable deletion risk.
PITR/Retain/deletion protection must not be silently removed to save small costs.

## N. Remaining gates

Established Phase 7B–7G roadmap is unchanged. Remaining accepted work is actual
cloud/source publication authorization, exact production identity/header binding,
live IAM/routing/hosting verification, recovery/operations, genuine Personal Account
persistence/isolation/lifecycle acceptance and privacy/support/public-launch gates.
No Phase 7C–7G implementation or broad audit restarts here. Prior accounts, ledgers,
attempt limits and testing pause remain untouched. Live staging registration state
is not freshly read in this task; local source and templates are closed.

## O. Final execution ledger

- Final source HEAD/branch unchanged; dirty Batch 3 files listed in C. Zero commits,
  pushes, remote Git/GitHub calls, releases or changes to old ledgers.
- Backend clean builds: 2 identical; pinned offline Linux validations: 2 successful.
- Qualified frontend targets: actual stage and fictional production, 45 files each.
- Persisted synthesis outputs: baseline stage1, preliminary candidate stage/prod2,
  inherited-network-blocked candidate stage/prod2. Artifact CLI additionally tested
  six successful synths (two per environment plus two explicit-account fixtures),
  invalid-command cases and isolated schema constructs. Unit tests also synthesize
  fixtures; those are not cloud deployments. Repeated qualification followed real
  source/assertion corrections, not a deployment retry loop.
- Final browser: 20 scenarios / 374 intercepted requests; 38 mock API / four mock
  provider, 16 fictional failed Demo POSTs, zero accounts or forwarded requests.
- **Unintended hosted requests: 3 static callback GETs in earlier failed fixtures.**
  No live application API requests, OAuth exchanges, accounts/emails/passwords or
  real sessions were used. The discrepancy from the requested zero-hosted budget
  is preserved; prior zero-traffic wording is explicitly invalidated.
- AWS service API requests: 0. Cloud resource changes: 0. Credential/profile changes:
  0. Uploads/change sets/build triggers/signup toggles: 0. Public AWS documentation
  reads occurred to verify semantics; they are not signed service operations.
- Packaging downloads/image pulls: 0. No provider installation/dependency repair.
- Main evidence: `.tools/phase7b-batch3-20261103/` and
  `.tools/phase7b-batch3-hosting-20261103/`; final receipt and complete source/build
  manifests preserve actual outputs/hashes. Historical Phase 5E/5F counters unchanged.

## P. Final recommendation

1. **Option A represented:** yes, shared mixed production with separate staging.
2. **Personal plus Demo backend support:** yes locally and in the actual packaged
   synthetic runtime; genuine live provider acceptance remains unproved here.
3. **Admission/IAM controls represented:** yes, atomic finite policy and restrictive
   write scope; real AWS IAM evaluation/operational toggle still need live evidence.
4. **Production storage protected:** yes in synthesized PITR/protection/Retain/TTL
   contracts; no cloud resource was changed.
5. **Signup closed:** yes source, both synthesized controls and package tests.
   Live state is historical, not freshly verified by this batch.
6. **Staging preserved:** every existing logical ID/type/lifecycle preserved offline;
   expected four modifications plus one route only, not a live drift guarantee.
7. **Header migration gated:** yes; root preserved, equivalent stage app policy,
   exact production renderer and unbound/root-authority publication STOPs.
8. **Actual artifacts qualified:** current backend ZIP and stage frontend yes;
   fictional production proves projection/behavior only, not deployability.
9. **Unknown live facts:** identity/inventory/permissions/quota, provider provisioning,
   delivery/header authority, real IAM/latency, recovery/account behavior and costs.
10. **Batch 3 locally qualified:** yes, all final affected checks pass, with the
    three-static-GET execution-boundary incident and synthetic/live limits explicit.
11. **Smallest next live step:** separately authorize bounded target/financial/state
    preflight and staging compatibility review using this exact source/artifact set.
    No live action is authorized or started by this recommendation.

**STOPPED BEFORE LIVE PROVISIONING, PUBLICATION OR PHASE 7C–7G.**
