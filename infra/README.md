# HireFlux infrastructure

Phase 3A provides a standalone TypeScript AWS CDK v2 package, a shared environment
stack, and local validation. Phase 3C defines one DynamoDB table per environment; Phase 3D now defines
its Lambda, IAM, signing secrets and HTTP API request path in each local template. Nothing is deployed. The product still runs
through Vite, FastAPI, and DynamoDB Local.

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
tags, immutable `data` lifecycle policy and readonly `backend` auth/secret/CORS policy. Stacks and prefixes are `hireflux-staging` and `hireflux-production`.
Both use the existing repository region `us-east-1`; changing it requires a
reviewed source change. Origins are distinct reserved `.invalid` sentinels until Phase 3E. Data policy
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

Each template contains **11 reviewed resources and zero outputs**: the existing
DynamoDB table, two generated signing secrets, execution role and data policy,
one Lambda, HTTP API, integration, invoke permission, route and stage. Assemblies
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
- **3E:** frontend hosting/Amplify integration and actual public origin contracts.
- **3F/3G:** observability, throttling/cost controls, comprehensive isolation
  assertions, and synthesized-template review.
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
Function URL, reserved/provisioned concurrency, SnapStart, X-Ray, DLQ or async
destination is defined. Explicit log resources/retention, metrics/alarms and
traffic/cost controls are Phase 3F.

An explicit role trusts lambda.amazonaws.com only. Its sole managed policy is
service-role/AWSLambdaBasicExecutionRole for normal logging. The custom data
policy has exactly three statements:

- GetItem, PutItem, UpdateItem, DeleteItem, BatchWriteItem and ConditionCheckItem
  on workspaceTable.tableArn only.
- Query on that table and exact /index/GSI1, /index/GSI2, /index/GSI3 ARNs.
- secretsmanager:GetSecretValue on the two stack-owned secret ARNs only.

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
https://staging.invalid and https://production.invalid; methods GET/POST/PATCH/
DELETE/OPTIONS; request headers Accept, Authorization, Content-Type,
Idempotency-Key, X-Request-ID; exposed X-Request-ID and Content-Disposition;
allowCredentials false. The frontend uses bearer headers, no credentialed cookies,
and version fields in bodies rather than If-Match/ETag. Gateway manages deployed
CORS/preflight; FastAPI receives the same policy for parity/direct ASGI behavior.
Phase 3E replaces sentinel origins before any Phase 4 staging deployment.

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
