# Backend Lambda packaging (Phase 3B)

The local ASGI entry point remains `hireflux_backend.main:app`. Lambda uses
`hireflux_backend.lambda_handler.handler`, which calls the same `create_app`
factory once per execution environment and retains the app/SDK client for warm
calls. Importing the reusable factory does not create an app or AWS client.
Mangum 0.21.0 uses `lifespan="off"`: there are currently no startup/shutdown hooks
or asynchronous resource lifecycles. Revisit this setting if that changes.
Mangum initializes an event loop when Python 3.14 has none. A narrow adapter-log
filter prevents Starlette's post-response re-raise from logging raw exceptions
and tracebacks; the existing safe 500 envelope and application error log remain.

## Runtime contract

Phase 3D must use **Python 3.14, x86_64, ZIP**, with handler
`hireflux_backend.lambda_handler.handler`. This choice is based on the
[AWS supported runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html),
the existing `>=3.13,<3.15` project range, CPython 3.14 Linux wheel availability,
and successful native imports and invocations in the official AL2023 Lambda
image. AL2023 provides glibc 2.34. The wheel target is
`x86_64-manylinux_2_34`, standard CPython 3.14, not free-threaded Python.
ARM64 is not validated or selected. A runtime/architecture change requires a
new packaging/validation decision; do not change just the future CDK setting.

Lambda reads process environment variables, **never `.env`**. All of these must
be explicitly nonempty: `ENVIRONMENT`, `AUTH_MODE`, runtime-provided `AWS_REGION`,
`DYNAMODB_TABLE_NAME`, `CORS_ALLOWED_ORIGINS`, `LAMBDA_CORS_POLICY`,
`CURSOR_SIGNING_SECRET_ARN`, and `DEMO_SESSION_SIGNING_SECRET_ARN`. Only staging/production environments are accepted.
Phase 3D supplies staging `AUTH_MODE=demo`, production `AUTH_MODE=cognito`, and
stack-local table/secret references and CORS configuration. Secrets Manager
generates raw 64-character alphanumeric signing keys; Lambda resolves both via
GetSecretValue before composing the app. Production protected/demo routes remain
503 until Cognito verification exists; health can initialize. No production
readiness or deployment is claimed. Existing Settings
validation rejects local authentication, custom DynamoDB endpoints, weak/local
signing keys, wildcard CORS and invalid values. SDK environment overrides
`AWS_ENDPOINT_URL` and `AWS_ENDPOINT_URL_DYNAMODB` are also rejected.
Errors name missing variables or describe invalid configuration without echoing
input values. Documentation routes stay disabled by default when deployed.

The deployed SDK client receives the configured region, with no explicit
endpoint/credential arguments. AWS's normal execution-role credential chain
remains responsible for access; automatically supplied temporary role variables
are supported. No static credentials, table name, origin, environment-specific
secret, or account ID is baked into the ZIP. `AWS_REGION` may be runtime-provided.
Optional quotas/time bounds and API documentation controls retain their existing
Settings defaults/validation. Secret resolution is isolated to the Lambda boundary;
local development does not invoke it. Empty/weak/binary/JSON values, wrong ARN/region/
account, unreadable secrets and plaintext-key configuration fail closed with safe
diagnostics. Values are not written back to environment variables.

## Build from Windows or Linux

Prerequisites: standard CPython 3.14 and **uv 0.12.5**. The builder uses only
Python's standard library. From the repository root, in Command Prompt or a
Linux shell:

```text
uv run --no-project --python 3.14 python backend/scripts/build_lambda_artifact.py --verify-reproducible
uv run --no-project --python 3.14 python backend/scripts/validate_lambda_artifact.py
```

The second command needs a running **Linux Docker engine** and access to pull
the pinned official validation image. Docker is not needed for ordinary backend
unit/API tests. The image is local test equipment, not a Lambda container-image
deployment architecture. Neither command invokes CDK, AWS CLI, deployment,
bootstrap, table setup or a running local product service.

The first command exports the committed `backend/uv.lock` with `--locked`,
`--no-dev`, and `--no-emit-project`. A fresh temporary target is populated with
`uv pip install --python-version 3.14 --python-platform x86_64-manylinux_2_34
--only-binary :all: --require-hashes --no-deps --no-config`. Missing wheels or
hash mismatches fail; source distributions are never compiled. Windows
site-packages, editable installs and the existing backend virtual environment
are never copied. The actual build interpreter is passed explicitly to uv.
No separate production version list or production lock is maintained.

Output:

```text
artifacts/lambda/hireflux-backend-lambda.zip
artifacts/lambda/hireflux-backend-lambda.manifest.json
```

The ZIP root contains `hireflux_backend/` and the 31 production distributions,
including their `.dist-info`, native `.so` libraries, botocore service data,
certificate-related runtime assets and timezone data. There is no enclosing
`backend/`, `src/`, or `python/` directory. The complete locked boto3 1.43.53 /
botocore 1.43.78 graph is bundled: the artifact does not depend on the runtime's
SDK version. Uvicorn's production extras remain included because the same
canonical production graph also supports local ASGI; dev extras are excluded.

Repository tests/docs/scripts, frontend, infra, tools, `.env`/credentials,
bytecode/caches, Windows binaries, console launchers and uv's staging lock do
not enter the ZIP. SDK subpackages such as `boto3/docs` and `botocore/docs` are
runtime helpers and are preserved. Required package metadata/assets are retained.
`RECORD` entries are rebuilt with relative paths/hashes after launcher exclusion.
Symlinks and paths escaping staging fail. ELF headers must identify Linux x86_64.

## Determinism and size

ZIP members use case-sensitive sorted POSIX paths, fixed 1980 timestamps,
Unix regular-file mode 0644, no directory entries, and DEFLATE level 9. Project
Python source line endings are normalized to LF. The manifest is outside the
ZIP and contains runtime/architecture/handler, lock hash, pinned uv version,
distribution versions, sizes/count, ZIP hash and each member's path/size/hash.
It contains no build timestamp, temporary path, machine identity, or settings.

`--verify-reproducible` performs two independent clean installs/builds and requires
the entire manifest to match, including the ZIP SHA-256 and file inventory.
Reproducibility is asserted for the same source/lock, target, uv version and
Python/zlib compression toolchain. A different compression implementation can
change ZIP bytes; do not assume arbitrary host/toolchain versions share a hash.
Record the new evidence whenever source, lock, builder or runtime changes.

Project budgets: warn above 30 MiB compressed / 150 MiB expanded; fail above
40 MiB compressed / 200 MiB expanded. These reserve at least 10 / 50 MiB against
[AWS ZIP limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html):
50 MiB direct-upload compressed and 250 MiB expanded including layers.
The current artifact is comfortably below both budgets; exact acceptance bytes
and SHA-256 are recorded in readiness section 41 and the generated manifest.
No layer is required. Larger artifacts would need an explicit new decision.

## Artifact validation

`validate_lambda_artifact.py` pins:

```text
public.ecr.aws/lambda/python:3.14@sha256:b81a4aa3bc1d56999090333cefea611e5a84bb4e2638c1ae4107fdc9b8622da3
```

Verified image: Python 3.14.8, x86_64, glibc 2.34. The validation process uses
`-I -S -B`, so no PYTHONPATH, user site, runtime site-packages/SDK, editable
project or repository source can satisfy imports. Only the ZIP and standalone
probe are mounted read-only; the checkout is not mounted. The container has
`--network none`, a read-only root, no capabilities, no privilege escalation,
and uid/gid 1000. It extracts into an ephemeral executable tmpfs so native
libraries can map, then makes the entire package tree read-only and proves a
write fails. This is a test extraction location; application code does not
write to `/tmp` or to its deployment directory.

Synthetic environment settings and a minimal Lambda context exercise real
HTTP API v2 events: cold/warm health, query strings, request IDs, CORS response
and preflight, missing route, unauthenticated route, generic safe 500/logging,
and unsupported event rejection. A separate temporary ASGI transport probe
checks POST path/method, repeated encoded query values, base64 input, cookies,
text CSV and Content-Disposition output, without adding product routes.
All six native dependencies load from the ZIP: pydantic-core, httptools,
PyYAML, uvloop, watchfiles and websockets. Config failure cases include local
auth under Lambda, endpoints, missing required values, short keys and wildcard
CORS. Network/DNS hooks record even attempted access; the result is zero.
No DynamoDB table or AWS credentials are needed for health and these fixtures.

Backend source has no startup table mutations, local filesystem writes, file
logging, signal/process assumptions or required long-running tasks. Existing
bounded synchronous export behavior is unchanged; transport coverage does not
claim deployment-scale export qualification. Signed demo authorization and TTL
remain server-owned; health is liveness, not database readiness.

## Quality and phase boundaries

Phase 4A verified the actual Linux CI artifact for the accepted post-3G source.
Its SHA-256 is
`4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`
(26,642,450 compressed bytes); the Windows zlib-ng build remains
`a7d89abc928d7e87dc445df03da4d17811d013d3f193aa0e289478995ba7b72e`
(26,646,194 bytes). Every one of the 3,756 expanded members, all 31 dependency
records, all 71 application sources and lock/project inputs match. Recompressing
the Windows members with classic zlib in the pinned official Lambda image
reproduces the exact CI ZIP hash. Two clean builds within each toolchain match;
cross-compressor ZIP-byte equality is not asserted. Preserve the chosen ZIP and
its matching manifest together, record its full hash, and renew evidence after
compression-toolchain changes as ADR 0009 requires. See the
[complete comparison](../docs/production-account-readiness.md#47-phase-4a-source-control-and-remote-ci-qualification).

CI retains the audit/SBOM/OpenAPI gates and now runs the full backend job on
both 3.13 and 3.14. A separate credential-free Linux job builds twice, validates
the ZIP and uploads local evidence. Phase 3D CI downloads this validated artifact before real infrastructure synthesis.
Infra unit tests inject a tiny fixture; real synth/parity/CLI integration require
the canonical verified ZIP and manifest. Synth still needs no Python or Docker.
Readiness section 41 records full local results and the actual-artifact audit.

The CDK bundled brace-expansion advisory remains open. The pre-3B recheck found
no newer CDK release; the Python builder does not invoke that Node toolchain,
accept its glob inputs, or bundle it into the runtime. Recheck before later CDK
asset/resource work. Passing packaging tests are not a clean CDK audit claim.

Phase 3C defines DynamoDB policy/infrastructure; 3D adds the real Lambda/IAM/HTTP
API and secret references using this exact runtime/architecture/handler; 3E
handles hosting/origins; 3F/3G handle monitoring/controls/review. Actual bootstrap
and staging deployment remain Phase 4, Cognito Phase 5, production later.

See [ADR 0009](../docs/adr/0009-lambda-runtime-and-deterministic-packaging.md),
[runtime packaging requirements](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html),
[HTTP API v2 events](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html),
and [uv command reference](https://docs.astral.sh/uv/reference/cli/).

## Phase 3D deployed runtime composition

`lambda_settings.py` requires complete stack-local signing-secret ARNs. It uses
only Secrets Manager GetSecretValue, bounded SDK connect/read timeouts and two
maximum attempts, then supplies validated SecretStr values directly to Settings.
The module-level handler retains the app, DynamoDB client and signing keys across
warm invocations. No per-request secret read or automatic rotation occurs.
AWS-injected temporary role credentials are supported; custom endpoints and
plaintext signing-key environment inputs are rejected.

`cors_policy.py` validates the single typed deployed policy JSON passed by CDK;
the factory's optional policy preserves existing local defaults. API Gateway
and backend share origins/methods/headers/exposure/credential decisions.

The Lambda wrapper measures the full proxy response before return. Large escaped
JSON bodies can exceed 6 MiB even when public UTF-8 bytes are below 4,000,000.
When needed, it base64-encodes the body and sets isBase64Encoded; HTTP API restores
the browser's original bytes. It reserves 64 KiB and returns a safe 413 envelope
if the response still cannot fit. Product budgets and local ASGI output are unchanged.
Quote/backslash/control/Unicode export fixtures and the official-image probe
cover this behavior.

The external build manifest also records pyproject.toml SHA-256. Infra verifies
current source against each packaged project member, the lock/project hashes,
ZIP/per-file hashes, target and budgets before binding the asset. Generated
manifests are provenance consistency evidence, not cryptographic attestations.
See [ADR 0011](../docs/adr/0011-lambda-http-api-security-boundary.md).
