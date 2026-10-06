# Environment and deployment plan

HireFlux uses three intentionally separate environments. The repository currently implements and validates the local environment; no AWS resources are created automatically.

## Local

- Vite serves the React application at `http://localhost:5173`.
- FastAPI serves the API at `http://localhost:8000`.
- Docker runs DynamoDB Local on loopback port `8001`.
- `AUTH_MODE=demo` enables one-click isolated workspaces with a visibly local-only signing key.
- `AUTH_MODE=local` supplies a server-configured durable owner for backend development.
  Call `POST /api/v1/me/bootstrap` before ordinary workspace endpoints. Bootstrap
  creates empty profile/settings/readiness records without TTL and preserves
  compatible existing data. Pair `VITE_WORKSPACE_MODE=local` in development to
  bootstrap automatically before protected browser pages. Local and demo remain
  separate configurations; production local browser mode fails closed. Leaving
  the local frontend preserves saved server data and is not authentication logout.
- The explicit table initializer enables DynamoDB TTL on `expires_at`.

Phase 2A needs no table reset, new index, or AWS resource. Temporary demo items
carry `expires_at`; durable workspace data omits it. Local authentication fails
outside local/test and when deployment runtime markers are present. Never enable
it as a staging/production authentication shortcut.

## Staging

This is a planned environment. Phase 3 is CDK definitions/synth only; Phase 4
deploys the existing demo to staging. Real Cognito accounts follow in Phase 5,
after frontend sessions and the Phase 2C persistent-account safety foundation.

Phase 3A now defines the environment/configuration foundation under `infra/`;
no application resources exist. Select exact `environment=staging` context, or
run `npm --prefix infra run synth:staging`. Stack `hireflux-staging` and namespace
`hireflux-staging` are distinct from production. Region is explicitly `us-east-1`.
The account is unbound by default; optional `stagingAccount` context must be a
12-digit string. Branch and AWS profile do not select the CDK environment.

- A `develop` or `staging` branch deploys to its own Amplify branch environment.
- The API, DynamoDB table, demo-session signing key, cursor key, CORS origin, logs, alarms, and throttles are separate from production.
- The frontend receives staging-only `VITE_API_BASE_URL` and `VITE_PUBLIC_SITE_URL` values. Every `VITE_*` value is public and must never contain a secret.
- Hosting-level access protection may be enabled while changes are being reviewed.

## Production

This is a planned environment. Production deployment is Phase 7, after hardening
and release qualification; the local durable bootstrap milestone does not claim
personal-account production readiness.

The same Phase 3A stack implementation accepts explicit `environment=production`,
or `npm --prefix infra run synth:production`. Stack/namespace are
`hireflux-production`, region is also `us-east-1`, and optional `productionAccount`
context is separate from staging's binding. Local synth isolates credential files,
disables lookups/telemetry, and never deploys. Separate accounts are supported;
future deployment must bind/review each target deliberately. See
[infra guide](../infra/README.md) for the exact contract and open dependency finding.

- Only reviewed `main` changes deploy to the public candidate-demo origin.
- Production uses a separate DynamoDB table and secret values supplied by the deployment platform.
- Lambda uses its IAM execution role; deployed configuration omits local endpoints and explicit AWS credentials.
- API Gateway throttling, constrained Lambda concurrency, a workspace record limit, short log retention, low budget alerts, and monitoring are release gates rather than assumptions in browser code.
- Application CSV export is available to the local demo as a human-readable sample download. Full JSON account-data export is reserved for non-demo identities and remains synchronously bounded. Production-scale portability should move to an asynchronous job that reads DynamoDB resources in controlled pages, writes the complete artifact to S3, and returns a short-lived presigned download URL rather than aggregating a maximum workspace into one API response.

## DynamoDB lifecycle contract (defined locally, Phase 3C)

Each environment now synthesizes one independent single-region table with the
same exact local/cloud key/index/TTL contract, PAY_PER_REQUEST, STANDARD class,
and AWS-owned encryption. The physical name is generated; no shared table or
cross-environment lookup exists. The stable WorkspaceTable construct is directly
available to future Phase 3D, which will inject its name into the proven Lambda.

- Staging: PITR and deletion protection disabled; removal and replacement Delete.
- Production: PITR and deletion protection enabled; removal and replacement Retain.

No stream, replica, KMS resource, seed, IAM grant or application compute exists.
These are local CDK definitions/tests, not deployed tables. Normal synth needs
neither Python nor the Lambda artifact; the explicit parity check needs a fresh
backend schema export. See [infra guide](../infra/README.md) and
[ADR 0010](adr/0010-dynamodb-cloud-lifecycle.md).

Production recovery history is outside Phase 2C's live-table erasure guarantee.
Phase 6 must define historical retention, restore procedures, deletion-tombstone
handling after restore and privacy/account-erasure reconciliation. Enabling PITR
does not establish immediate erasure of every historical copy.

## Lambda package contract (implemented locally, Phase 3B)

The ZIP is built and tested locally; no Lambda AWS resource exists yet.
Phase 3D must use Python 3.14/x86_64 with
`hireflux_backend.lambda_handler.handler`. Staging/production reuse identical
code/dependencies and receive separate runtime values. Lambda ignores `.env`
and requires explicit ENVIRONMENT, AUTH_MODE, AWS_REGION, DYNAMODB_TABLE_NAME,
CORS_ALLOWED_ORIGINS, CURSOR_SIGNING_KEY and DEMO_SESSION_SIGNING_KEY.
Local auth and custom application/SDK endpoints fail closed. No secret value
or environment-specific origin/table is baked into the artifact. The SDK client
uses the IAM execution-role chain; no keys are passed explicitly. Future secret
injection remains Phase 3D; this phase does not retrieve or provision secrets.
Build commands, size/determinism rules and the isolated official-image check are
in the [backend guide](../backend/README.md). CDK synth remains independent of
the artifact, Python and Docker. Frontend hosting remains Phase 3E.

## Single-page application rewrite

Amplify must serve `/index.html` with status `200` for routes that do not look like real static assets. This lets direct visits and refreshes work for `/applications`, `/applications/new`, and application detail/edit URLs. Missing `.js`, `.css`, image, and other asset paths must remain real `404` responses.

## Hosted security headers

The repository root `customHttp.yml` is the fail-closed Amplify Hosting policy
for the `frontend/` monorepo app. It applies a strict CSP, HTTPS enforcement,
clickjacking protection, MIME sniffing protection, referrer and permissions
policies, and cross-origin isolation headers to hosted responses. Its committed
`connect-src` permits only `'self'`, so an unrendered deployment cannot send a
demo bearer token to any external API. Before packaging each hosted environment,
set that branch's exact `VITE_API_BASE_URL` and run
`npm --prefix frontend run render:hosting-headers`. The command renders
`customHttp.template.yml` into `customHttp.yml`, rejects HTTP, paths, and
wildcards, and fails when the origin is missing. The rendered deployment policy
then permits only `'self'` and that environment's exact HTTPS API origin.

The pre-React theme bootstrap lives in `frontend/public/theme-bootstrap.js`,
so the policy does not need `unsafe-inline` in `script-src`. The existing
`unsafe-inline` allowance is limited to styles because the current UI uses
runtime style attributes. HSTS is intentionally present only in the hosted
policy; local Vite development serves HTTP and uses a separate API allowlist.
The local development server allows Vite's own inline React-refresh bootstrap;
the production build preview and hosted policy keep inline scripts blocked.
The bearer token remains a temporary demo credential in `sessionStorage`, so
the CSP reduces script-injection risk but does not replace server-side token
validation or a future HttpOnly production session design.

## API documentation exposure

`API_DOCS_ENABLED` uses the backend's centralized environment configuration.
When unset, Swagger UI, ReDoc, and `/openapi.json` are enabled in local/test and
disabled in staging/production. A deployed environment may opt in explicitly,
but public exposure is never a framework-default accident. CI generates the
same OpenAPI contract with `backend/scripts/generate_openapi.py` and uploads it
as a build artifact even when deployed documentation routes are disabled.

Before a release, verify direct navigation and refresh for every client route, a protected route without a demo session, the not-found screen, and one deliberately missing static asset.

## Promotion sequence

1. Run backend lint, format, type checks, and tests.
2. Run frontend lint, type checks, tests, and production build.
3. Deploy to staging with staging-only values and data.
4. Smoke-test demo launch, ownership isolation, reset, expiry handling, deep-link refresh, CORS, and missing assets.
5. Review alarms, throttles, concurrency, TTL, log retention, and budget alerts.
6. Promote the same reviewed revision to production and repeat the smoke checks.
