# Environment and deployment plan

HireFlux uses three intentionally separate environments. The repository currently implements and validates the local environment; no AWS resources are created automatically.

The [Phase 3G complete synthesized review](production-account-readiness.md#46-phase-3g-final-synthesized-review-and-handoff)
concludes PASS WITH EXPLICIT PHASE 4 CONDITIONS. It revalidated both full
environment graphs and a rebuilt Linux runtime after two interview correctness/
transaction-bound fixes. AWS staging remains uncreated. Phase 4A has verified
the accepted GitHub source, five green quality jobs, actual artifacts and fresh
local gates; see the [remote qualification record](production-account-readiness.md#47-phase-4a-source-control-and-remote-ci-qualification).
Phase 4B and later slices must obtain authorized account/bootstrap/GitHub/quota/billing prerequisites,
then qualify real hosting, IAM, timing, logs, metrics, TTL and costs under active
supervision. The local synth-only wrapper cannot deploy. Budgets/rate/reserved
concurrency are not a cumulative cost cap; anonymous issuance remains a risk.
Production authentication, restore/privacy and signing-key lifecycle stay deferred.

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

Phase 3A defines the environment/configuration foundation under `infra/`;
Phase 3D adds the backend and Phase 3E adds static frontend hosting/origin wiring. Select exact
`environment=staging` context, or
run `npm --prefix infra run synth:staging`. Stack `hireflux-staging` and namespace
`hireflux-staging` are distinct from production. Region is explicitly `us-east-1`.
The account is unbound by default; optional `stagingAccount` context must be a
12-digit string. Branch and AWS profile do not select the CDK environment.

- The explicit source branch is `main` in a separate staging Amplify app,
  BETA stage, auto-build enabled; no automatic branch creation or PR previews.
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

- The separate production app also uses `main`, PRODUCTION stage, auto-build
  disabled. No production build publication or working authentication is claimed.
- Production uses a separate DynamoDB table and secret values supplied by the deployment platform.
- Lambda uses its IAM execution role; deployed configuration omits local endpoints and explicit AWS credentials.
- API Gateway throttling, constrained Lambda concurrency, a workspace record limit, short log retention, low budget alerts, and monitoring are release gates rather than assumptions in browser code.
- Application CSV export is available to the local demo as a human-readable sample download. Full JSON account-data export is reserved for non-demo identities and remains synchronously bounded. Production-scale portability should move to an asynchronous job that reads DynamoDB resources in controlled pages, writes the complete artifact to S3, and returns a short-lived presigned download URL rather than aggregating a maximum workspace into one API response.

## DynamoDB lifecycle contract (defined locally, Phase 3C)

Each environment now synthesizes one independent single-region table with the
same exact local/cloud key/index/TTL contract, PAY_PER_REQUEST, STANDARD class,
and AWS-owned encryption. The physical name is generated; no shared table or
cross-environment lookup exists. The stable WorkspaceTable construct is directly
consumed by Phase 3D, which injects its name into the verified ZIP Lambda.

- Staging: PITR and deletion protection disabled; removal and replacement Delete.
- Production: PITR and deletion protection enabled; removal and replacement Retain.

No stream, replica, KMS resource or seed is added. Phase 3D adds scoped IAM and
application compute. These are local CDK definitions/tests, not deployed tables.
Normal synth needs the prebuilt verified ZIP but invokes neither Python nor
Docker; the explicit parity check needs a fresh
backend schema export. See [infra guide](../infra/README.md) and
[ADR 0010](adr/0010-dynamodb-cloud-lifecycle.md).

Production recovery history is outside Phase 2C's live-table erasure guarantee.
Phase 6 must define historical retention, restore procedures, deletion-tombstone
handling after restore and privacy/account-erasure reconciliation. Enabling PITR
does not establish immediate erasure of every historical copy.

## Lambda package contract (implemented locally, Phase 3B)

The ZIP and actual Lambda/HTTP API/IAM/secret definitions are validated locally;
no Lambda, API or secret is deployed.
Phase 3D uses Python 3.14/x86_64 with
`hireflux_backend.lambda_handler.handler`. Staging/production reuse identical
code/dependencies and receive separate runtime values. Lambda ignores `.env`
and requires explicit ENVIRONMENT, AUTH_MODE, AWS_REGION, DYNAMODB_TABLE_NAME,
CORS_ALLOWED_ORIGINS, LAMBDA_CORS_POLICY, CURSOR_SIGNING_SECRET_ARN and
DEMO_SESSION_SIGNING_SECRET_ARN. AWS_REGION is supplied by the Lambda runtime.
Local auth and custom application/SDK endpoints fail closed. No secret value
or environment-specific origin/table is baked into the artifact. The SDK client
uses the IAM execution-role chain; no keys are passed explicitly. Signing keys are generated by Secrets Manager at deployment and read/cached at
Lambda cold start. Only ARNs enter Lambda configuration; no plaintext keys do.
Build commands, size/determinism rules and the isolated official-image check are
in the [backend guide](../backend/README.md). Real CDK synth requires the verified prebuilt artifact but never builds it;
Python and Docker remain explicit packaging/validation tools. Phase 3E hosting
is defined locally, with no frontend job during synthesis.

## Single-page application rewrite

Amplify must serve `/index.html` with status `200` for routes that do not look like real static assets. This lets direct visits and refreshes work for `/applications`, `/applications/new`, and application detail/edit URLs. Missing `.js`, `.css`, image, and other asset paths must remain real `404` responses.

## Hosted security headers

The repository root `customHttp.yml` is the canonical Amplify Hosting policy
for the `frontend/` monorepo app. It applies a strict CSP, HTTPS enforcement,
clickjacking protection, MIME sniffing protection, referrer and permissions
policies, and cross-origin isolation headers to hosted responses. Its committed
connect-src permits only self and https://*.execute-api.us-east-1.amazonaws.com.
The narrow regional source supports generated API IDs while keeping App independent
of API references; exact origin enforcement remains in backend CORS. The aligned
template/render helper preserves the same static policy without URL inputs.
No App.CustomHeaders duplicates it. This supersedes the earlier exact-API rendering
workflow; header validation checks the complete parsed monorepo/CSP contract.

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

## Phase 3F deployment gates

The current templates declare 25 resources and no outputs per environment (22
selected with the default blank alert email, 25 with a supplied email). They
remain synthesis-only. CORS source of truth is the readonly environment backend
policy with explicit bearer-client methods/headers and allowCredentials false.
Each origin is https://main.<that stack's Amplify App.DefaultDomain>, represented
as CloudFormation tokens rather than an existing hosted URL. Lambda and HTTP API
receive the same expression. No .invalid sentinel appears in either template.
HTTP API manages deployed CORS/preflight.

Staging is demo; production is cognito with the existing authentication-unavailable
503 response. No JWT verifier, login or demo/Cognito coexistence is implemented.
Production is not deployable before its remaining authentication/operational gates.
Two signing secrets are generated server-side, with staging Delete/Delete and
production Retain/Retain lifecycle; only ARNs enter Lambda configuration. No
rotation or historical erasure guarantee is added. Phase 3F supplies explicit
14-day staging / 30-day production log groups, scoped runtime logging permissions,
five native alarms and a dashboard. Staging API rate/burst is 10/20 and Lambda
reservation 5; production is 20/40 and 10. Throttling is best-effort. Monthly
AND-tagged cost budgets are USD 10/30; they are notifications, not hard caps.

The static WEB App requires only an AmplifyGitHubAccessToken NoEcho/no-default
deployment parameter; its sole use is App.AccessToken. App contains the static
monorepo root; Branch contains API/site URL and demo workspace mode build inputs.
App → backend → Branch is acyclic. No compute/service role, custom domain,
Amplify backend or preview environment exists. See
[ADR 0012](adr/0012-amplify-hosting-origin-wiring.md) and
[frontend build checks](../frontend/README.md).

Phase 4 prerequisites are recorded, not performed: select/bind the AWS account,
review/bootstrap CDK, authorize the regional Amplify GitHub App for this repository,
securely supply its GitHub credential through the NoEcho input, require clean CI
and qualified controls, deploy staging only, observe the frontend build, confirm
the generated origin and smoke-test browser → API → Lambda → DynamoDB, including
deep links, missing assets, headers/CORS, identity isolation, reset and expiry.
Phase 4 must define the secure operator workflow; no token command/history recipe
or live authorization is provided here. Production remains behind later gates.

Operational qualification remains Phase 4: verify the regional concurrency quota
and available reservations while leaving Lambda's required 100 unreserved
executions; verify deployer HTTP API log-delivery permissions and actual JSON
delivery to both explicit groups; inspect logs for private content; exercise
throttling and alarms; optionally supply the NoEcho OperationalAlertEmail input,
confirm its SNS email subscription, and test delivery. With email omitted,
alarms/dashboard/budget exist without SNS resources or email actions.

Activate Project and Environment cost-allocation tags through the authorized
billing operator, allow propagation, and verify observed cost attribution and
the budget's Project=HireFlux AND Environment=<selected environment> filter.
Tag availability and activation can each take up to 24 hours. Tagged budgets
can miss shared/untaggable charges and billing data is delayed. Review actual
account totals as well; do not infer a complete cost forecast or hard cap.
No REST API Gateway account logging role, BudgetsAction or runtime SNS access
is defined. See [operational contract](../infra/README.md#operational-guardrails-phase-3f)
and [ADR 0013](adr/0013-operational-guardrails.md). Phase 3G local review and
Phase 4A source/remote-CI qualification are complete; AWS commissioning remains
separately authorized work beginning with Phase 4B.
