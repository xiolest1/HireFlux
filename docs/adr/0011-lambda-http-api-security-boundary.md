# ADR 0011: Lambda, IAM, signing secrets and HTTP API boundary

- Status: accepted for Phase 3D, local definition and validation only
- Date: 2026-10-06

## Context

Phase 3B established the reproducible Linux ZIP and Phase 3C established the
unchanged table schema and lifecycle. The next step connects them without AWS
lookups, bootstrap, uploads or deployment. Frontend hosting remains Phase 3E.

## Decision

Use the focused `BackendApi` construct with stable `BackendFunction` child ID.
Bind the separately built ZIP using its SHA-256 as the CDK custom asset-hash
basis. The real application path verifies the adjacent manifest, lock and
project hashes, normalized current source inventory, per-file hashes, runtime,
architecture, ZIP metadata and 40 MiB compressed / 200 MiB expanded budgets.
Unit tests explicitly inject tiny temporary fixtures; the CLI cannot substitute
one. This verifies build consistency, not a signed supply-chain attestation.
Synthesis never installs Python packages, invokes Docker or rebuilds the ZIP.

Use Python 3.14, x86_64, ZIP, handler
`hireflux_backend.lambda_handler.handler`, 1024 MB and 15 seconds. No VPC,
layers, Function URL, concurrency, tracing, SnapStart, DLQ or async destination
is configured. Default ephemeral storage is 512 MB. Function names are generated.

The explicit Lambda execution role trusts only `lambda.amazonaws.com`. The
sole managed policy is `AWSLambdaBasicExecutionRole`; application permissions
are three explicit statements. Audited request adapters call GetItem, PutItem,
DeleteItem, Query, BatchWriteItem and TransactWriteItems. Transaction Put,
Update, Delete and ConditionCheck require their underlying IAM actions. Grant
GetItem, PutItem, UpdateItem, DeleteItem, BatchWriteItem and ConditionCheckItem
only on this table; grant Query only on this table and its exact GSI1/GSI2/GSI3
ARNs. Local schema/reset/reconciliation operations are outside the role. Grant
no Scan, admin, wildcard DynamoDB, cross-table or generic index access.

Create exactly `CursorSigningSecret` and `DemoSessionSigningSecret` using
CloudFormation-generated 64-character alphanumeric material and generated
physical names. Staging deletes on removal/replacement; production retains on
both. No plaintext, dynamic-value injection, output or customer KMS key is
created. Grant GetSecretValue only for these two ARN references. At cold start,
validate distinct same-account/same-region references, retrieve with bounded
SDK timeouts/retries, validate ARN and SecretString shape, then construct the
application once. Warm invocations reuse settings and make no additional reads.
Failure is sanitized and fail-closed. Rotation/refresh policy remains Phase 6.

Staging uses demo authentication. Production uses the existing unavailable
cognito mode: health remains public, protected/demo routes return 503 rather
than accepting credentials. No Cognito verifier or coexistence architecture is
implemented. Lambda settings reject local mode, plaintext signing-key inputs,
endpoint overrides and cross-wired environment modes; `.env` is ignored.
AWS region/credentials come from Lambda and its execution role.

Define an HTTP API with `$default` route and auto-deploy `$default` stage,
explicit Lambda proxy payload 2.0, 20-second integration timeout, and no gateway
authorizer/API key. FastAPI retains authentication/authorization. Invocation is
limited by this API's account-qualified execute-api ARN, with stage/method
wildcards emitted by the supported L2 integration. No outputs are added.

One frozen environment policy drives gateway and deployed FastAPI CORS.
Staging allows only `https://staging.invalid`; production only
`https://production.invalid`. Methods are GET/POST/PATCH/DELETE/OPTIONS;
request headers Accept/Authorization/Content-Type/Idempotency-Key/X-Request-ID;
exposed headers X-Request-ID/Content-Disposition; credentials false. Phase 3E
replaces each sentinel centrally with the actual reviewed frontend HTTPS origin
and updates assertions. CORS is not authorization. Existing local CORS remains.

## Verified service constraints and consequences

[Lambda runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
and [architecture](https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html)
support the selected contract. [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
include 50 MiB direct ZIP upload, 250 MiB expanded packaging, 4 KiB aggregate
environment configuration and 6 MiB synchronous payloads. Local packaging budgets
are stricter; focused tests reserve comfortable environment headroom.
[HTTP API quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html)
allow 30-second integrations and 10 MB payloads. The selected 15/20 seconds
leave room above the existing 5-second export and 2-second erasure work budgets;
these remain bounded synchronous operations, not completion guarantees under load.

The existing 4,000,000-byte JSON export budget alone is insufficient to prove
proxy-envelope fit: quotes/backslashes can double-escape. The Lambda-only adapter
measures the complete serialized response with 64 KiB headroom below 6 MiB,
switches an oversized text response to base64 when that fits, and otherwise
returns a sanitized 413. API Gateway decodes the original response bytes.
Large quote-heavy, control-character and Unicode cases pass, including the
official isolated Lambda image. No public export contract or local ASGI behavior
changes; no streaming/asynchronous export is introduced.

[Proxy integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
requires explicit payload-format selection.
[Managed CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
handles preflight and controls gateway CORS headers, so both layers share policy.
[Transaction authorization](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html)
and [index scoping](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/iam-policy-specific-table-indexes.html)
support the exact audited grants.
[Execution roles](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html),
[runtime secret retrieval](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets-python-sdk.html)
and [generated secret strings](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-secretsmanager-secret-generatesecretstring.html)
support role-based retrieval without plaintext in templates.

## Validation and remaining boundaries

Both environments synthesize exactly 11 resources and zero outputs, with the
original table identity and schema intact. Positive/negative policy assertions,
artifact mutation tests, cold/warm secret failures and payload tests pass. CI
builds/validates the ZIP before real synthesis; unit tests remain independent.
See the [complete handoff](../production-account-readiness.md#43-phase-3d-implementation-and-handoff)
for hashes, inventories and check results.

The bundled CDK brace-expansion advisory remains open at the newest verified
library/CLI versions. No override, manual patch or suppression is added; the
fixed verified ZIP asset introduces no user-controlled glob. This is not a clean
CDK audit or deployed-risk qualification. Hosting/origins, observability/cost
controls, final environment review, staging deployment, Cognito and production
privacy/rotation qualification remain Phases 3E, 3F, 3G, 4, 5 and 6 respectively.
