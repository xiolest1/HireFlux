# Environment and deployment plan

HireFlux uses three intentionally separate environments. The repository currently implements and validates the local environment; no AWS resources are created automatically.

## Local

- Vite serves the React application at `http://localhost:5173`.
- FastAPI serves the API at `http://localhost:8000`.
- Docker runs DynamoDB Local on loopback port `8001`.
- `AUTH_MODE=demo` enables one-click isolated workspaces with a visibly local-only signing key.
- The explicit table initializer enables DynamoDB TTL on `expires_at`.

## Staging

- A `develop` or `staging` branch deploys to its own Amplify branch environment.
- The API, DynamoDB table, demo-session signing key, cursor key, CORS origin, logs, alarms, and throttles are separate from production.
- The frontend receives staging-only `VITE_API_BASE_URL` and `VITE_PUBLIC_SITE_URL` values. Every `VITE_*` value is public and must never contain a secret.
- Hosting-level access protection may be enabled while changes are being reviewed.

## Production

- Only reviewed `main` changes deploy to the recruiter-facing origin.
- Production uses a separate DynamoDB table and secret values supplied by the deployment platform.
- Lambda uses its IAM execution role; deployed configuration omits local endpoints and explicit AWS credentials.
- API Gateway throttling, constrained Lambda concurrency, a workspace record limit, short log retention, low budget alerts, and monitoring are release gates rather than assumptions in browser code.
- Synchronous workspace export is intentionally bounded for the demo workspace. Production-scale export should move to an asynchronous job that reads DynamoDB resources in controlled pages, writes the complete artifact to S3, and returns a short-lived presigned download URL rather than aggregating a maximum workspace into one API response.

## Single-page application rewrite

Amplify must serve `/index.html` with status `200` for routes that do not look like real static assets. This lets direct visits and refreshes work for `/applications`, `/applications/new`, and application detail/edit URLs. Missing `.js`, `.css`, image, and other asset paths must remain real `404` responses.

## Hosted security headers

The repository root `customHttp.yml` is the deployable Amplify Hosting policy
for the `frontend/` monorepo app. It applies a strict CSP, HTTPS enforcement,
clickjacking protection, MIME sniffing protection, referrer and permissions
policies, and cross-origin isolation headers to hosted responses. The CSP
allows only same-origin scripts and the planned us-east-1 API Gateway origin;
if staging or production uses a custom API domain or another region, update
the `connect-src` origin before deploying that environment.

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

Before a release, verify direct navigation and refresh for every client route, a protected route without a demo session, the not-found screen, and one deliberately missing static asset.

## Promotion sequence

1. Run backend lint, format, type checks, and tests.
2. Run frontend lint, type checks, tests, and production build.
3. Deploy to staging with staging-only values and data.
4. Smoke-test demo launch, ownership isolation, reset, expiry handling, deep-link refresh, CORS, and missing assets.
5. Review alarms, throttles, concurrency, TTL, log retention, and budget alerts.
6. Promote the same reviewed revision to production and repeat the smoke checks.
