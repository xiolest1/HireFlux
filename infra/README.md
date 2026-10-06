# HireFlux infrastructure

Phase 3A provides a standalone TypeScript AWS CDK v2 package, a shared environment
stack, and local validation. Phase 3C now defines one DynamoDB table in each
environment's local template. Nothing is deployed. The product still runs
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
npm --prefix infra run synth:staging
npm --prefix infra run synth:production
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
tags, and immutable `data` lifecycle policy. Stacks and prefixes are `hireflux-staging` and `hireflux-production`.
Both use the existing repository region `us-east-1`; changing it requires a
reviewed source change. Origins remain a later integration concern. Data policy
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

Both templates contain exactly **one AWS::DynamoDB::Table** and no outputs. They contain
environment metadata plus the default CDK `BootstrapVersion` parameter and
`CheckBootstrapVersion` rule. Assemblies describe future bootstrap role/asset
locations; those references do not create resources, query SSM during synth, or
mean an account is bootstrapped. The Phase 3A empty-resource warning no longer
applies. Bootstrap prerequisites belong to Phase 4. No synth step needs Python,
Docker, the Lambda ZIP or backend configuration.

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
table/replica, seeding/custom resource, resource policy, application IAM grant,
Lambda, API or output. The complete resource inventory per environment is:
`WorkspaceTable68AC2584: AWS::DynamoDB::Table`.

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
The parity process also blocks and records network attempts. Normal infra tests
and synth do not invoke Python or read this generated file.

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
to supported taggable resources when those are added. No resources exist for
resource-level tag assertions yet. Never tag personal details or secrets.

## Extending the foundation

`bin/hireflux.ts` only composes and synthesizes. `lib/app.ts` resolves explicit
context; `HireFluxStack` is the shared insertion point for focused constructs.
Extend typed configuration as real requirements appear rather than scattering
environment conditionals through constructs.

- **3B (completed locally):** [backend-owned Lambda ZIP packaging](../backend/README.md),
  Python 3.14/x86_64, isolated runtime validation. No CDK asset binding exists.
- **3C (completed locally):** exact DynamoDB schema and validated lifecycle policy,
  stable identity, schema parity and one table per environment. No deployment.
- **3D:** Lambda, least-privilege IAM, API Gateway, and secret references.
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
