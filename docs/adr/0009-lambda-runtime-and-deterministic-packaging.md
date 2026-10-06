# ADR 0009: Lambda runtime and deterministic backend packaging

- Status: accepted for Phase 3B
- Date: 2026-10-06

## Context

The existing FastAPI application already supports Python 3.13/3.14 and locks
Mangum and native production dependencies. Development happens on Windows.
Phase 3A has empty CDK stacks; packaging must remove runtime uncertainty before
DynamoDB definition without provisioning AWS or coupling synth to a build.

## Decision

Use a self-contained **Python 3.14, Linux x86_64 ZIP**, handler
`hireflux_backend.lambda_handler.handler`. The entry point calls the reusable
factory once and reuses its app/SDK client. Mangum's lifespan is explicitly off
because there are no application startup/shutdown hooks. Adapter exception
tracebacks are sanitized without changing safe HTTP errors. Lambda configuration
comes only from explicit environment inputs, never `.env`; local auth and custom
endpoints fail closed. The SDK uses the execution-role chain, not passed keys.

One canonical `backend/uv.lock` supplies production-only hash-verified Linux
wheels, targeting standard CPython 3.14 and glibc 2.34. Builds never copy host
site-packages or compile sdists. Bundle the complete locked boto3/botocore graph
to avoid runtime SDK skew. Retain production Uvicorn extras and runtime package
data/metadata; omit console launchers, source tests/tools/configuration and caches.

Use sorted normalized ZIP members, fixed timestamps/modes and compression, plus
an external per-file/hash manifest. Require two clean builds to match. Enforce
project budgets of 40 MiB ZIP / 200 MiB expanded with earlier warnings.

Validate the extracted ZIP in the digest-pinned official Python 3.14 Lambda
image, outside the checkout, with no runtime site-packages, network, root access,
or writable application tree. Native imports and real cold/warm HTTP API v2
fixtures are required, together with config failures and safe error logging.
Docker is validation equipment only; the deployable product remains a ZIP.

## Evidence and consequences

AWS lists Python 3.14 on AL2023 and supports x86_64. All six native dependencies
have compatible locked wheels and load in the verified Python 3.14.8/glibc 2.34
image. Linux x86_64 is proven; ARM64/free-threaded Python are not implicit options.
Python 3.14.7 is the local full-suite/build interpreter. Compression-toolchain
changes may change ZIP bytes and require renewed evidence.

The CDK advisory was rechecked before packaging; no newer upstream release was
available. Backend-owned Python packaging has no dependency on CDK or its glob
libraries, and that Node dependency is absent from the artifact. The open finding
remains a later CDK review obligation, not a claimed clean supply-chain audit.

Phase 3D must match this runtime/architecture/handler and review secret injection,
least-privilege execution permissions, timeout/memory and HTTP API routing.
Lifespan must be reassessed if asynchronous startup/shutdown resources are added.
No AWS resource, asset binding, layer, container-image function or deployment is
authorized by this ADR. Local ASGI behavior and the existing lock remain intact.

Exact commands, image digest, tests and phase boundaries are in
[backend guide](../../backend/README.md) and
[readiness section 41](../production-account-readiness.md#41-phase-3b-implementation-and-handoff).
Primary references: [AWS runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html),
[Python ZIP packaging](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html),
[Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html),
and [uv platform installation](https://docs.astral.sh/uv/reference/cli/).
