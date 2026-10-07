# HireFlux frontend build and hosting

The React/Vite application still runs locally. Phase 3E defines static Amplify
hosting but does not create a live app/domain or authorize GitHub access.

Each environment has a separate WEB app and one main branch. Staging uses
BETA with auto-build; production uses PRODUCTION with auto-build disabled.
Production's existing demo build adapter does not imply working production auth:
the backend remains cognito/unavailable until Phase 5 and launch gates are met.

## Public build configuration

Amplify Branch receives VITE_API_BASE_URL from its own HTTP API endpoint,
VITE_WORKSPACE_MODE=demo and VITE_PUBLIC_SITE_URL from its own frontend-origin
token. All are public. No signing material, secret ARN, AWS credential or GitHub
token enters the build. Existing development defaults and session code remain.

The monorepo build uses appRoot=frontend and matching static app-level
AMPLIFY_MONOREPO_APP_ROOT, then nvm install/use 22, npm ci and npm run build.
Publish dist/**. No Python/backend/infra install/build is involved.

To validate a deployment-style build from the repository root in Command Prompt:

```bat
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run test:hosting-headers
npm --prefix frontend run test:hosting-build
set VITE_API_BASE_URL=https://phase3e-example.execute-api.us-east-1.amazonaws.com
set VITE_PUBLIC_SITE_URL=https://main.phase3e-example.amplifyapp.com
set VITE_WORKSPACE_MODE=demo
npm --prefix frontend run build
npm --prefix frontend run verify:hosting-build
```

These are visibly synthetic public URLs, not deployed resources. Clear these
shell variables before ordinary local preview. On this Windows workspace path,
npm's Command Prompt shims mishandle the ampersand for executable scripts;
`npm --prefix frontend --script-shell pwsh run build` (likewise lint/typecheck/test)
uses PowerShell without changing persisted npm settings. Linux Amplify/CI uses
the normal commands. For constrained local machines, tests can use --maxWorkers=2
without changing assertions or timeouts.

## Routing and headers

Amplify's 200 SPA regex rewrite preserves known static extensions and routes
direct navigation to index.html. Regex tests cover protected deep links and
missing static files. Actual Amplify refresh/preflight behavior is Phase 4 smoke
validation; local synthesis is not a live hosting test.

Repository-root customHttp.yml is the only hosted header authority, using
applications/appRoot=frontend. No App.CustomHeaders duplication exists. The
aligned template/helper render this static reviewed policy without environment
URLs. CSP connect-src permits self plus
https://*.execute-api.us-east-1.amazonaws.com; this supports generated API IDs
without an App→API cycle. It does not permit arbitrary HTTPS or wildcard egress.
Other directives and security headers are preserved. Inline scripts remain
blocked; the existing inline style allowance remains. Source maps remain disabled
by Vite's default. A future reviewed custom API domain could narrow CSP further.

Header tests parse YAML and reject wrong roots, missing/duplicate headers and
weakened CSP. The build verifier checks index/assets, expected public URLs, no
private config, credentials/signing material, local API endpoints, unresolved
placeholders or source maps. It prints summary evidence, not bundle contents.

See [ADR 0012](../docs/adr/0012-amplify-hosting-origin-wiring.md),
[infra guide](../infra/README.md) and the
[complete handoff](../docs/production-account-readiness.md#44-phase-3e-implementation-and-handoff).
