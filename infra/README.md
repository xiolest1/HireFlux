# HireFlux infrastructure

Phase 3A provides a standalone TypeScript AWS CDK v2 package, a shared environment
stack, and local validation. Phase 3C defines one DynamoDB table per environment; Phase 3D now defines
its Lambda, IAM, signing secrets and HTTP API request path. Phase 3E adds independent
static Amplify apps/branches and exact token-derived frontend/API wiring.
Phase 3F wraps that topology in explicit logs, focused alarms, dashboard,
scaling limits and advisory cost controls.
Nothing is deployed. The product still runs
through Vite, FastAPI, and DynamoDB Local.

Phase 3G's [complete A–AF review](../docs/production-account-readiness.md#46-phase-3g-final-synthesized-review-and-handoff)
is complete locally: **PASS WITH EXPLICIT PHASE 4 CONDITIONS**. Two backend
interview pagination/transaction-capacity defects were fixed; default/max capacity
is now 25 and the verified ZIP was rebuilt. Fresh full runtime/frontend checks,
119 infrastructure tests, four offline real-artifact CLI tests, both synths and
schema parity pass. Inventory remains 25 declarations/22 with blank email and
zero outputs. Twenty live qualifications remain; no AWS action or remote CI ran.
The high CDK bundled advisory and anonymous issuance cost risk remain open.
Initial staging qualification requires active supervision and authorized stop
controls; production is still deferred. The detailed resource, IAM, replacement,
cost and all 86 exit-gate answers are in the linked handoff.

## Install and validate

Use Node.js 22.12 or newer and npm. Commands below run from the repository root;
the repository-local CDK CLI is canonical. AWS credentials and AWS CLI are not
required. Installing dependencies needs npm registry access; synthesis after
installation is local.

```bat
npm --prefix infra ci
npm --prefix infra run typecheck
npm --prefix infra run build
npm --prefix infra test
rem Build and validate the real ZIP explicitly before actual synth (see backend guide).
npm --prefix infra run synth:staging
npm --prefix infra run synth:production
npm --prefix infra run test:artifact
```

Scripts are `typecheck`, `build`, `test`, `cdk`, `synth:staging`, and
`synth:production`, plus the explicit `test:schema-parity` check. Tests use Node's built-in runner and CDK assertions against
compiled TypeScript. TypeScript runs directly through Node to support Windows
paths containing spaces and ampersands. No separate test framework is needed.

## Environment contract

Only exact `staging` and `production` selections are supported. The app has no
default, aliases, or branch/profile-based environment selection. Local and test
are runtime/test contexts, never deployed CDK environments.

```bat
npm --prefix infra run cdk -- synth -c environment=staging --output cdk.out/staging
npm --prefix infra run cdk -- synth -c environment=production --output cdk.out/production
```

`lib/config/environment.ts` owns the readonly configuration: `environmentName`,
`stackName`, `resourceNamePrefix`, `awsRegion`, optional `awsAccount`, and common
tags, immutable `data` lifecycle policy, readonly `backend` auth/secret/CORS policy
and explicit `hosting` repository/branch/build and `operations` policies.
Stacks and prefixes are `hireflux-staging` and `hireflux-production`.
Both use the existing repository region `us-east-1`; changing it requires a
reviewed source change. Origins derive from each App.DefaultDomain token and the
validated configured main branch, with no literal sentinel or guessed hostname. Data policy
sets PITR, deletion protection and removal policy declaratively; validation rejects
cross-wiring or weakening the selected environment's accepted posture.

The AWS account is unbound by default (`unknown-account` in assembly manifests).
Optional explicit context keys `stagingAccount` and `productionAccount` accept
12-digit strings and apply only to the selected environment. They are non-secret
local inputs; no real account IDs belong in committed configuration. For example,
this uses an obviously fictitious account and still synthesizes locally:

```bat
npm --prefix infra run cdk -- synth -c environment=staging -c stagingAccount=111111111111 --output cdk.out/staging
```

The app does not consume `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`, `.env`, AWS
profiles, or backend local fake credentials. Future deployment must deliberately
bind and review the intended account for each environment; an unbound assembly
is not a production deployment qualification. Separate accounts are supported
without duplicating the stack implementation or sharing mutable resources.

## Offline synthesis and generated files

The `cdk` script wraps the local CLI in `scripts/cdk-local.mjs`. It allows only
`synth`/`synthesize`, `ls`/`list`, and `--version`; profiles and deployment commands
are rejected. The child process receives empty temporary credential/config files,
no inherited AWS/CDK default binding variables, disabled instance-metadata access,
disabled CLI telemetry, disabled notices, and `--no-lookups`. The user's AWS
configuration is never changed. `cdk.json` also disables lookups and version
reporting. Do not bypass the wrapper for normal validation.

Tests preload a network blocker into the CLI and app subprocesses. Any attempted
TCP/TLS connection, DNS lookup, or fetch records a failure, even if CDK catches
the error. Both environments synthesize twice and their template bytes match.
Determinism means the same locked graph, reviewed source, and explicit inputs
produce the same template; toolchain upgrades require renewed review.

`build/`, `node_modules/`, and `cdk.out/` are generated/ignored. Staging and
production outputs have separate directories. Do not edit or commit assemblies,
CloudFormation JSON, or context lookup caches. No lookup cache is required here.

Each template contains **25 reviewed declarations and zero outputs**: the existing
DynamoDB table, two generated signing secrets, execution role and data policy,
one Lambda, HTTP API, integration, invoke permission, route/stage and static
Amplify App/Branch, two log groups, five alarms, one dashboard, one budget and
three conditional SNS declarations. Blank alert email selects 22 resources;
a supplied email selects 25. Parameters are the NoEcho GitHub input,
NoEcho optional OperationalAlertEmail and BootstrapVersion. Assemblies
also reference the future bootstrap asset bucket/roles. No application bucket or
AWS lookup is created. These local references do not upload assets or bootstrap
an account. Real synth requires the verified ZIP/manifest; it never invokes Python,
Docker, dependency installation or a bundler. Bootstrap remains Phase 4.

## DynamoDB definition and schema parity (Phase 3C)

`lib/hireflux-stack.ts` creates `workspaceTable` with CDK's mature single-region
`Table` L2. Both environments have the same logical schema: PK/SK strings; three
indexes named GSI1/GSI2/GSI3, string GSI1PK/GSI1SK, GSI2PK/GSI2SK, GSI3PK/GSI3SK,
and ALL projections with no INCLUDE attributes. Only these eight key attributes
are declared. No LSI or extra GSI exists. The physical schema is identical to the
current backend local initializer; [access patterns](../docs/dynamodb-access-patterns.md)
explain index purposes. No application data model or query behavior changed.

Both use PAY_PER_REQUEST, STANDARD and TTL enabled on `expires_at`. The application
assigns optional numeric epoch-seconds TTL to demo items; durable records omit it.
Infrastructure neither supplies a default expiry nor provisions cleanup workers.
Authorization still expires at the signed-token boundary, independently of TTL.

`TableEncryption.DEFAULT` emits `SSEEnabled: false`, selecting AWS-owned encrypted
storage under [CloudFormation's documented semantics](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-dynamodb-table-ssespecification.html).
No customer-managed KMS key is required or created. There is no stream, global
table/replica, seeding/custom resource, resource policy or output. Phase 3D adds
explicit application IAM and compute/API resources described below. The table
remains `WorkspaceTable68AC2584: AWS::DynamoDB::Table`.

- **Staging:** PITR false, deletion protection false, DESTROY. DeletionPolicy and
  UpdateReplacePolicy both Delete; deliberate teardown can remove disposable data.
- **Production:** PITR true, deletion protection true, RETAIN. DeletionPolicy and
  UpdateReplacePolicy both Retain. No recovery-period override is introduced.

The semantic ID **WorkspaceTable**, construct path ending in
`WorkspaceTable/Resource`, and logical ID **WorkspaceTable68AC2584** are stateful
contracts. Do not casually rename or reparent them. Tests pin identity in both
stacks; key/physical-name changes require explicit replacement/migration review.
Physical TableName is intentionally omitted so CloudFormation generates separate
names in separate stacks/accounts. Phase 3D receives `stack.workspaceTable`
directly and can use `tableName`/`tableArn` tokens, with no lookup/output parsing.
Future index evolution needs deliberate deployment/backfill review.

For parity, freshly export the backend's actual `create_table_request` and TTL
constant, then compare both synthesized table schemas. With a locked backend
environment installed, run from the repository root (Windows Command Prompt):

```bat
backend\.venv\Scripts\python.exe backend\scripts\export_dynamodb_schema.py --output artifacts\hireflux-dynamodb-schema.json
npm --prefix infra run test:schema-parity -- --schema ../artifacts/hireflux-dynamodb-schema.json
```

CI exports with `uv run --project backend python ...` in its locked Python 3.14
job. Local acceptance used the separate `.tools/phase3b-validation` Python 3.14.7
environment and preserved `backend/.venv`. Export does not instantiate Settings,
an SDK client or app and reads no local data. The JSON is ignored generated
evidence, not a committed duplicate schema. Always regenerate it before checking.
The comparison validates primary/index names and scalar types, every projection
and INCLUDE attribute set, TTL name/enabled flag and billing. Array order and
environment-only lifecycle differences are normalized away. Drift tests exercise
renamed keys, changed types, omitted/extra/duplicate indexes, projection changes,
missing INCLUDE attributes, TTL aliases/disablement and extra attributes/LSIs.
The parity process also blocks and records network attempts. Normal infra unit tests and synth do not invoke Python or read this generated
file. Unit tests inject a fixture; the explicit parity command composes the actual
backend stack with the verified real artifact and inspects only its table schema.

PITR historical recovery data has separate privacy semantics from Phase 2C live
erasure. Delete Account is not proven to remove every historical copy. Phase 6
must define retention, restore procedures, tombstone handling after restore and
erasure reconciliation. This limitation does not disable production PITR.

## Naming, identity, and tags

Use stable semantic construct IDs when adding resources, such as `WorkspaceTable`.
CDK derives CloudFormation logical IDs from construct paths within a stack. Keep
those IDs/paths stable, especially for retained state; renaming a TypeScript
variable alone need not change a construct ID. Logical IDs can match in separate
environment templates because the stacks remain separate deployments.

Physical names are AWS service identifiers. Prefer CDK-generated physical names.
Use `explicitResourceName(config, suffix)` only when external reference or a clear
operational need justifies a physical name and replacement/collision behavior is
understood. It yields `hireflux-<environment>-<suffix>`, accepts lowercase letters,
digits and single hyphens, and rejects names exceeding the conservative 63-character
project limit. Future constructs must additionally validate their service's rules;
this generic helper does not promise validity for every AWS service.

The stable top-level construct IDs are `HireFlux-staging` and
`HireFlux-production`; physical stack names are `hireflux-staging` and
`hireflux-production`. Tests distinguish construct/logical identity from physical
stack naming without adding dummy AWS resources.

Common tags are `Project=HireFlux`, `Environment=staging|production`, and
`ManagedBy=AWS-CDK`. They appear in the assembly's stack tags and will propagate
to supported taggable resources when those are added. Current supported resources have resource-level tag assertions. Never tag personal details or secrets.

## Extending the foundation

`bin/hireflux.ts` only composes and synthesizes. `lib/app.ts` resolves explicit
context; `HireFluxStack` is the shared insertion point for focused constructs.
Extend typed configuration as real requirements appear rather than scattering
environment conditionals through constructs.

- **3B (completed locally):** [backend-owned Lambda ZIP packaging](../backend/README.md),
  Python 3.14/x86_64, isolated runtime validation; Phase 3D now binds the verified ZIP.
- **3C (completed locally):** exact DynamoDB schema and validated lifecycle policy,
  stable identity, schema parity and one table per environment. No deployment.
- **3D (completed locally):** Lambda, explicit least-privilege IAM, generated signing secrets and HTTP API.
- **3E (completed locally):** static Amplify app/branch, deployment input, exact
  origin/API token wiring, acyclic graph and SPA/header/build validation.
- **3F (completed locally):** finite logs, scoped logging IAM, focused alarms,
  dashboard, optional notifications, API/Lambda scaling limits and tagged budgets.
- **3G (next):** final synthesized infrastructure/security/cost-readiness review.
- **Phase 4:** bootstrap/deployment prerequisites and actual staging deployment.
- **Phase 5:** Cognito and real accounts. Production follows hardening/release gates.

`VITE_*` configuration is public. Server signing keys are secrets. Future execution
and deployment use roles, with no static AWS access keys in Lambda or environment
files. Secret values must never enter templates, outputs, Vite variables, Git, or
test snapshots. Phase 3D adds references, not committed secret values.

## Dependency review

Direct versions and the full graph are locked. CDK library 2.272.0 and CLI
2.1144.0 use independent version sequences; the successful CLI synth tests verify
their compatibility. TypeScript 5.9.3 and Node types 24.10.1 match the frontend
tooling pins; constructs is 10.8.1.

The 2026-10-06 npm audit reports one high-severity vulnerable dependency:
CDK's bundled `brace-expansion` 5.0.9 (nested under `aws-cdk-lib`; advisory set
includes [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7)
and [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr)).
Npm cannot replace this bundled dependency through `audit fix` or an override.
No ineffective override or manual dependency patch is retained. This is an open
toolchain finding, not a passing security audit. Phase 3A defines no assets or
untrusted glob inputs. Recheck upstream and update/revalidate the locked CDK graph
before later CDK asset work; do not treat synth success as an audit pass. The
pre-3B recheck still found library 2.272.0 / CLI 2.1144.0 as the latest releases
and the same open finding (`minimatch` 10.2.5 -> `brace-expansion` 5.0.9).
Phase 3B's Python builder never calls CDK, supplies no untrusted glob input to
that Node graph, and bundles no Node dependency. It adds no new reachable
runtime exposure to this advisory. No manual patch or ineffective override is
retained. The Phase 3C recheck again found no newer release and the same open
finding. Table definition/parity uses reviewed source/schema values and introduces
no asset packaging or untrusted glob inputs. Recheck before later asset/toolchain
work; no clean audit is claimed. Product and infra locks are unchanged.

See [ADR 0008](../docs/adr/0008-aws-cdk-environment-foundation.md),
[AWS synthesis documentation](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-synth.html),
and [CDK CLI compatibility](https://github.com/aws/aws-cdk-cli/blob/main/COMPATIBILITY.md).

## Backend API definition and artifact binding (Phase 3D)

`lib/backend/backend-api.ts` composes `BackendApi`, with stable child IDs
BackendFunction, ExecutionRole, CursorSigningSecret, DemoSessionSigningSecret and
HttpApi. Stack properties `backendFunction`, `httpApi` and `workspaceTable` expose
references directly; `httpApi.apiEndpoint` is Phase 3E's VITE_API_BASE_URL input.
No output parsing, AWS lookup or shared mutable resource is needed. Generated
physical function/table/role/secret names are retained; HTTP API's CDK display
Name HttpApi is not a fixed API identifier.

`lib/backend/artifact.ts` requires the canonical prebuilt ZIP and adjacent manifest:
artifacts/lambda/hireflux-backend-lambda.zip and .manifest.json. It validates
Python 3.14/x86_64/handler/wheel target, pinned builder uv, ZIP and every member
hash/size, canonical ZIP layout/native ELF architecture, 40/200 MiB budgets,
lock/project hashes and exact normalized current runtime source inventory/content.
Missing/stale/arbitrary artifacts fail with an explicit build diagnostic. This
is build consistency verification, not a signed provenance attestation.

CDK Code.fromAsset uses the verified ZIP SHA-256 as its custom hash input (CDK
hashes that input to derive its asset identifier). Both environments stage the
same bytes; integration tests rehash the staged ZIP. No backend/src asset,
bundling, automatic build, upload or application S3 bucket exists.

Run packaging separately from synth, from the repository root:

```text
uv run --no-project --python 3.14 python backend/scripts/build_lambda_artifact.py --verify-reproducible
uv run --no-project --python 3.14 python backend/scripts/validate_lambda_artifact.py
npm --prefix infra run typecheck
npm --prefix infra test
npm --prefix infra run synth:staging
npm --prefix infra run synth:production
npm --prefix infra run test:artifact
```

`npm test` uses injected temporary fixtures and blocked network access; it needs
no real ZIP, Python or Docker. `test:artifact` runs the real credential-isolated
CLI offline twice per environment, checks byte repeatability, bindings, staged
asset hashes and invalid-command rejection. Neither path builds the artifact.
The Python schema-export/parity commands above remain a separate regression gate.

Lambda uses python3.14, x86_64, hireflux_backend.lambda_handler.handler, ZIP,
1024 MB and 15s timeout. Default ephemeral storage is 512 MB. No VPC, layers,
Function URL, provisioned concurrency, SnapStart, X-Ray, DLQ or async
destination is defined. Phase 3F adds reserved concurrency 5/10 and explicit
log resources/retention, native alarms/dashboard and traffic/cost controls.

An explicit role trusts lambda.amazonaws.com only. Phase 3F replaces
AWSLambdaBasicExecutionRole with scoped logging access. Its policy has exactly
four statements:

- GetItem, PutItem, UpdateItem, DeleteItem, BatchWriteItem and ConditionCheckItem
  on workspaceTable.tableArn only.
- Query on that table and exact /index/GSI1, /index/GSI2, /index/GSI3 ARNs.
- secretsmanager:GetSecretValue on the two stack-owned secret ARNs only.
- logs:CreateLogStream and logs:PutLogEvents on the explicit Lambda log-group
  ARN (including its stream suffix) only. No CreateLogGroup or managed policy.

The audit found these in normal repositories and workspace guards. UpdateItem
is used through transaction Update operations; ConditionCheckItem authorizes
transaction ACTIVE/existing-item guards. TransactWriteItems has underlying-item
IAM authorization, not a separate broad transaction action. BatchGetItem and
TransactGetItems are unused. Scan belongs to guarded local reconciliation and
test tooling; DescribeTable/create/TTL schema calls belong to operator setup.
None is granted to Lambda. Tests inspect all effective custom/inline/managed
role policy attachments, positive scopes and negative permissions.

Two CloudFormation-generated 64-character alphanumeric signing secrets use the
normal Secrets Manager encryption posture, with no custom KMS key. Staging uses
Delete/Delete; production Retain/Retain. No rotation schedule exists. Only ARNs
enter Lambda configuration. Runtime GetSecretValue occurs once per secret at
app composition, with safe failures and warm reuse; local ASGI remains unchanged.

Environment variables supplied by CDK are ENVIRONMENT, AUTH_MODE,
DYNAMODB_TABLE_NAME, CORS_ALLOWED_ORIGINS, LAMBDA_CORS_POLICY,
CURSOR_SIGNING_SECRET_ARN, DEMO_SESSION_SIGNING_SECRET_ARN,
MAX_SYNC_EXPORT_BYTES=4000000, MAX_SYNC_EXPORT_WORK_SECONDS=5 and
ACCOUNT_ERASURE_MAX_SECONDS_PER_REQUEST=2. AWS_REGION and temporary execution-role
credentials come from Lambda, never our explicit environment configuration.
No static credential or local endpoint is supplied. Tests conservatively budget
768 bytes per secret ARN and 255 for the table name; the total is below 3 KiB,
leaving at least 1 KiB against the 4 KiB aggregate limit.

Staging uses demo; production uses cognito and returns the existing safe 503
authentication-unavailable response on protected/demo routes. Production health
is liveness, not readiness. No Cognito verifier or coexistence refactor is added.

HTTP API has one AWS_PROXY integration, explicit payload 2.0, 20s integration
timeout, one $default route with NONE authorization, and an auto-deploy $default
stage. Invocation permission trusts only apigateway.amazonaws.com and scopes
SourceArn to the stack's API/account/region with /*/* route/method suffix. There
is no direct public function ingress, authorizer, custom domain or API key.

One readonly CORS policy drives gateway and runtime. Origins are
the configured main branch plus the stack-local Amplify App.DefaultDomain token;
methods GET/POST/PATCH/
DELETE/OPTIONS; request headers Accept, Authorization, Content-Type,
Idempotency-Key, X-Request-ID; exposed X-Request-ID and Content-Disposition;
allowCredentials false. The frontend uses bearer headers, no credentialed cookies,
and version fields in bodies rather than If-Match/ETag. Gateway manages deployed
CORS/preflight; FastAPI receives the same policy for parity/direct ASGI behavior.
Phase 3E replaces the sentinel with that exact token expression. No domain is live.

The 4,000,000-byte public export limit is unchanged. Lambda's 6 MiB synchronous
envelope is narrower than API Gateway's 10 MB payload limit. Large quote/backslash
JSON doubles during proxy serialization, so the runtime wrapper switches to
base64 as needed; Gateway restores the original browser bytes. A 64 KiB reserve
and safe 413 fallback protect the envelope. No streaming is enabled.

CI now orders backend quality/schema evidence -> reproducible artifact build and
official-image validation -> infra tests/parity/real artifact synth inspection.
Artifact download/upload is GitHub workflow evidence, never AWS upload. Permissions
remain contents:read; no credentials, OIDC, bootstrap or deployment is introduced.

The Phase 3D audit recheck still reports bundled brace-expansion 5.0.9 under
minimatch 10.2.5; 2.272.0/2.1144.0 remain the latest library/CLI. No safe upstream
fix is available, no override/patch/suppression is used, and no clean CDK audit is
claimed. Asset input is one verified fixed-path ZIP, with no caller-provided glob
pattern or bundling. This Node dependency is absent from the Python artifact.

See [ADR 0011](../docs/adr/0011-lambda-http-api-security-boundary.md) and
[current handoff](../docs/production-account-readiness.md#43-phase-3d-implementation-and-handoff).

## Static frontend hosting and origin wiring (Phase 3E)

`lib/hosting/frontend-hosting.ts` uses CfnApp/CfnBranch for exact property and
dependency control. Each stack owns FrontendHosting/App and Branch, with stable
logical IDs FrontendHostingApp3EC0FC15 and FrontendHostingBranchB5734B41.
Names are hireflux-staging-frontend and hireflux-production-frontend. Platform
is WEB. Repository is the verified https://github.com/xiolest1/HireFlux.
Both source main; staging is BETA/auto-build true, production PRODUCTION/false.
No role, basic auth, SSR/backend, auto-created branch or PR preview is added.
Both hosting resources use Delete removal/replacement; protected data/secret
lifecycles remain unchanged.

The stack defines AmplifyGitHubAccessToken: String, NoEcho true, no default,
length 1–4096; only App.AccessToken references it. No credential value is needed
for synthesis. App's only environment value is AMPLIFY_MONOREPO_APP_ROOT=frontend.
Its monorepo build selects Node 22 through nvm install/use, npm ci, npm run build,
publishing dist/** from appRoot=frontend. No repository amplify.yml overrides it.

Branch receives only VITE_API_BASE_URL=the local HTTP API endpoint token,
VITE_WORKSPACE_MODE=demo, and VITE_PUBLIC_SITE_URL=the local frontend-origin token.
All are public. Production remains non-launch-ready with unavailable cognito
backend auth and auto-build disabled. No new frontend adapter is invented.

The origin is constructed once from the configured branch string and
App.DefaultDomain: https://main.<DefaultDomain>. Both gateway and Lambda CORS
use the same expression. App has no API/Branch reference, backend has no Branch
reference, and Branch references App/API: prerequisite order App → backend →
Branch. Tests traverse all Ref/GetAtt/Sub/DependsOn edges and reject both endpoint-
on-App and origin-from-Branch cycle regressions. No copied URL, lookup, import,
custom domain or .invalid sentinel remains in deployed templates.

Repository customHttp.yml alone owns headers in applications/appRoot=frontend
format. App.CustomHeaders is absent; the aligned template/helper use static
regional execute-api CSP egress rather than an exact API-ID token. Other headers
and directives remain. The SPA 200 regex rewrite excludes Vite/static extensions.
[Frontend guide](../frontend/README.md) records build/header/scan commands,
source-map posture and the Windows npm shell workaround.

Phase 3E added two resources to the previous eleven; Phase 3F's current total
is 25 declarations, zero outputs and three parameters. Unit fixtures remain ZIP-independent;
real synth consumes the unchanged verified Phase 3D ZIP. Frontend build is an
independent CI/local check, never executed by CDK. No GitHub/AWS account API is
called during validation. Frontend CI adds synthetic public build inputs and
hosted-artifact negative/real scans; deployment credentials remain absent.

The Phase 3E npm registry recheck still reports one high bundled brace-expansion
finding, with library 2.272.0 / CLI 2.1144.0 still current. No compatible upstream
fix, override, patch or suppression is used. Review remains open; the frontend
audit is clean, and js-yaml 4.3.2 is only promoted from the existing lock graph
to an explicit development parser dependency.

Phase 4 prerequisites, not performed: select/review account and CDK bootstrap,
authorize the regional Amplify GitHub App for this repository, securely supply
the NoEcho deployment credential through a reviewed operator workflow, require
clean CI/qualified controls, deploy staging only, observe Amplify's build,
confirm the generated origin and smoke-test deep links/static 404s/headers/CORS/
demo identity isolation/reset/expiry end-to-end. No token shell recipe is included.
Phase 3F controls are defined locally; 3G qualification, Phase 5 Cognito and
Phase 6 hardening remain.

See [ADR 0012](../docs/adr/0012-amplify-hosting-origin-wiring.md) and
[current handoff](../docs/production-account-readiness.md#44-phase-3e-implementation-and-handoff).

## Operational guardrails (Phase 3F)

`lib/operations/operational-guardrails.ts` defines OperationalLogs before compute
and OperationalGuardrails after the existing API/function/table. Environment
policy is immutable and validated in `lib/config/environment.ts`. These are
local definitions, not evidence of live log delivery, notification delivery or
account cost coverage. Phase 3G final synthesized review is next.

Both environments have separate STANDARD log groups with generated physical
names: OperationalLogs/BackendFunctionLogs/Resource →
OperationalLogsBackendFunctionLogs44D131F8 and
OperationalLogs/HttpApiAccessLogs/Resource →
OperationalLogsHttpApiAccessLogs3515ABA0. Staging retains 14 days with
Delete/Delete; production retains 30 days with Retain/Retain. Retained production
groups keep their finite event retention but require an operator's later cleanup
decision; replacement creates a new generated group rather than colliding.
No log-retention custom resource is needed. See [CloudFormation log-group properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-logs-loggroup.html).

Lambda LoggingConfig explicitly selects JSON, ApplicationLogLevel WARN and
SystemLogLevel WARN. WARN is deliberate: Mangum 0.21.0 logs method/raw request
path/status at INFO (`mangum/protocols/http.py`); enabling INFO would expose
resource identifiers in raw paths. Existing application errors use a constant
message plus sanitized request_id/error_type, and the Lambda adapter filter
removes exception text/tracebacks. Application code does not override the logger
level. [Lambda's Python JSON logging and level filtering](https://docs.aws.amazon.com/lambda/latest/dg/python-logging.html)
remain a service-side Phase 4 qualification. The unchanged ZIP is not rebuilt.
AWSLambdaBasicExecutionRole is removed; CreateLogStream and PutLogEvents are
scoped to this explicit group's ARN, including its stream suffix. CreateLogGroup,
PutMetricData, SNS and billing permissions are absent from runtime IAM.

The existing HTTP API default stage sends this exact single-line JSON format to
its own access group (values are strings because missing API values can be `-`):

```json
{"requestId":"$context.requestId","routeKey":"$context.routeKey","httpMethod":"$context.httpMethod","status":"$context.status","responseLength":"$context.responseLength","responseLatency":"$context.responseLatency","integrationLatency":"$context.integrationLatency","protocol":"$context.protocol","integrationStatus":"$context.integration.status"}
```

Only supported [HTTP API access-log variables](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-logging-variables.html)
are used. Route key is the configured `$default` route, not the request's raw
path. Tokens, cookies, authorization claims, bodies, query strings, IP, user
agent, email and raw resource identifiers are excluded. DetailedMetricsEnabled
is false; native API aggregate metrics suffice. There is no REST API account
logging role. Phase 4 must qualify the deployment principal's documented
[CloudWatch log-delivery permissions](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-logging.html)
(Create/Update/Delete/Get/ListLogDelivery, PutResourcePolicy,
DescribeResourcePolicies, DescribeLogGroups and CreateLogGroup), scope them
where supported, and verify actual delivery. These are deployment permissions,
not application execution grants.

Staging's API rate/burst is 10 RPS / 20 requests; production's is 20 / 40.
[HTTP API throttling is best-effort](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html),
not an exact admission or billing limit. Lambda reserved concurrency is 5/10.
It allocates and limits concurrent execution without prewarming or provisioning
capacity. Phase 4 must verify each region/account's concurrency quota and
existing reservations while leaving the [required 100 unreserved executions](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).
No quota lookup occurs during synthesis. No WAF, provisioned concurrency, X-Ray,
Lambda Insights, RUM, Synthetics, telemetry collector or extra request path exists.

Five alarms use five-minute native metric sums, threshold >=1 and notBreaching
for missing data. Names are hireflux-<environment>-<suffix>:

- OperationsLambdaErrors5904FFE2: lambda-errors, AWS/Lambda Errors, FunctionName,
  1 of 1 evaluation periods.
- OperationsLambdaThrottles66F0659C: lambda-throttles, AWS/Lambda Throttles,
  FunctionName, 1 of 1.
- OperationsHttpApiServerErrors8A0F4370: api-5xx, AWS/ApiGateway lowercase 5xx,
  ApiId, 1 of 1.
- OperationsDynamoDBThrottlesAF8DF63F: dynamodb-throttles, SUM of
  AWS/DynamoDB ThrottledRequests, TableName+Operation, 1 of 1.
- OperationsDynamoDBSystemErrorsB63796D3: dynamodb-system-errors, SUM of
  AWS/DynamoDB SystemErrors, TableName+Operation, 2 of 3 (persistent events
  across two windows within fifteen minutes).

Both DynamoDB sums cover GetItem, PutItem, DeleteItem, Query, BatchWriteItem and
TransactWriteItems, the actual deployed adapter API operations. Transaction
Update/ConditionCheck IAM operations are not separate API metric operations.
[DynamoDB documents these metric dimensions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html);
table-only SystemErrors would silently select no data. Missing data avoids
idle-demo alarm noise; it is not proof that telemetry is healthy. 4xx,
ConditionalCheckFailedRequests, UserErrors, latency and AWS/Billing alarms are
excluded: expected validation/optimistic conflicts are not infrastructure
incidents, no latency baseline exists, and the budget avoids a duplicate billing
alarm. Partial BatchWriteItem throttling can return unprocessed items without
incrementing ThrottledRequests; ReadThrottleEvents/WriteThrottleEvents are
manual diagnostic follow-ups, not claimed complete coverage by this alarm.

OperationalDashboard → OperationsOperationalDashboard098A469E is named
hireflux-<environment>-operations. Six graphs use a six-hour default view and
five-minute period: HTTP Count/4xx/5xx Sum; HTTP Latency/IntegrationLatency
Average; Lambda Invocations/Errors/Throttles Sum; Duration p95 and
ConcurrentExecutions Maximum with the reservation annotation; the two DynamoDB
error/throttle sums; Query SuccessfulRequestLatency Average and
TransactionConflict Sum. There are 14 visible series and 24 underlying native
metrics (including twelve inputs to the two sums). All use only the same-stack
API ID, function name and table name in the current region. No Logs Insights
query, custom metric or cross-environment reference is present.

OperationalAlertEmail is an optional deploy-time String, default empty, NoEcho,
maximum 254 characters, accepting empty or the checked email shape. It enters
neither Lambda nor Amplify/Vite configuration. HasOperationalAlertEmail
conditions three declarations: OperationsOperationalAlerts7AC1A668 (SNS Topic),
OperationsOperationalAlertSubscription953AAEA9 (email Subscription) and
OperationsOperationalAlertPolicy4A085B4E (TopicPolicy). Empty input removes all
three, removes all five alarm actions and omits budget subscribers; alarms,
dashboard and budget still exist. Nonempty input connects alarms to that
environment's topic. Only cloudwatch.amazonaws.com may publish through the
topic policy, constrained to the current account and the five exact alarm ARNs.
No runtime publish permission or SES/application email feature exists.
[SNS email subscriptions require confirmation](https://docs.aws.amazon.com/sns/latest/dg/sns-email-notifications.html)
and Phase 4 must test delivery; synthesized configuration cannot prove it.

MonthlyCostBudget → OperationsMonthlyCostBudgetFC194922 uses COST/MONTHLY/USD,
UNBLENDED_COST and names hireflux-<environment>-monthly-cost. Staging amount is
10; production is 30. These are starting alert thresholds, not cost forecasts.
The exact new CloudFormation FilterExpression is:

```json
{"And":[{"Tags":{"Key":"Project","Values":["HireFlux"],"MatchOptions":["EQUALS"]}},{"Tags":{"Key":"Environment","Values":["<selected environment>"],"MatchOptions":["EQUALS"]}}]}
```

This is an explicit [AND expression](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-budgets-budget-expression.html),
not two OR-valued legacy TagKeyValue entries. With email, actual spend greater
than 80% and 100% sends direct budget email to the same deployment parameter;
without email, the budget provides visibility only. No forecast notification,
BudgetsAction, automatic shutdown, IAM mutation or SNS budget publisher exists.

An authorized Phase 4 billing operator must activate Project and Environment
cost-allocation tags, allow propagation and verify the actual budget scope with
observed tagged charges. [Tag appearance and activation can each take up to
24 hours](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html).
Not every service/charge is tag-attributable: shared or untaggable costs can
fall outside this filter, and tagging the budget itself does not fix coverage.
Inspect overall account costs too. [Budgets use delayed cost data and do not
cap spending](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).
No billing/tag activation or notification subscription has been performed.

Cost posture: finite STANDARD log storage plus volume-dependent ingestion;
native metrics without paid detailed-route/custom collection; one compact
dashboard; five alarms priced according to their underlying metrics (three
single metrics plus two six-metric math alarms = 15 standard-resolution alarm
metrics, not five). Retained production logs still expire events after 30 days.
Dashboard/alarm charges and email-topic use depend on account allowances and
current pricing; SNS delivery is optional. Monitoring-only budgets do not add
BudgetsAction charges. No fixed monthly total or universal free-tier claim is
made. Consult [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)
and [Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)
when Phase 4 reviews actual region/account charges.

Tests pin the full 25-resource logical-ID map in `test/resource-inventory.ts`,
evaluate the real empty/nonempty CloudFormation conditions, assert least-privilege
IAM, alarm dimensions/statistics, privacy fields, dashboard scope and environment
isolation. Existing schema, hosting graph and CORS tests remain active. Actual
CLI synthesis consumes the currently verified ZIP and makes no AWS lookup.
See [ADR 0013](../docs/adr/0013-operational-guardrails.md) and
[complete handoff](../docs/production-account-readiness.md#45-phase-3f-implementation-and-handoff).

The Phase 3F npm recheck found library 2.272.0 / CLI 2.1144.0 still latest and
the same one high bundled brace-expansion 5.0.9 finding. Advisory fixes exist
upstream for brace-expansion, but no newer compatible CDK release was available.
No lock change, override, manual patch or suppression was used. The frontend
audit reports zero vulnerabilities. Final review must carry this finding forward.
