# HireFlux frontend build and hosting

The recorded October 23 Phase 5E frontend deployment is release
`ff18c6762aa1a1f5f423667659cfae83f74f786e`, Amplify job 4. Its real authenticated-user
acceptance is paused/incomplete. Phase 5F's registration changes below are local
only; no hosting or AWS setting was changed. See the current
[implementation plan/status](../docs/phase5f-self-service-registration-plan.md).

## Phase 5F local account entry

Explore Demo remains primary; capability-gated Create Account is secondary and
Sign In is in the header. Signup reuses the SDK state/nonce/S256 PKCE transaction
and changes only its pinned Cognito destination to `/signup`. Sign In and sensitive
reauthentication keep `/oauth2/authorize`. The controller and client both reject
closed signup. Passwords and verification/recovery codes remain on provider pages;
there are no new frontend environment variables or password forms.

The five-minute OAuth state bound is unchanged. An expired signup callback consumes
the old state without exchanging its code and explains that registration may
already have completed. Start a fresh Sign In; never repeat signup automatically.
After admission, the existing empty/idempotent persistent bootstrap runs before
protected content. Personal Home has no demo title/tour and keeps the existing
Record an application action. Demo records are never transferred.

The existing fake-provider suite now also models signup/confirmation, delayed
verification and account-aware Home. Preserve older evidence by selecting its
new output directory from the repository root (PowerShell):

```powershell
$env:HIREFLUX_AUTH_FIXTURE_PHASE = '5F'
node frontend/node_modules/@playwright/test/cli.js test --config frontend/playwright.auth.config.ts
```

This uses port 4177 and `.tools/phase5f-auth-browser/`, with external/API/provider
requests intercepted and OAuth tracing disabled. It is not live Cognito acceptance.
Entry checks cover 320/390/768/1280 widths, actual light/dark theme selection,
keyboard focus, touch targets, reduced motion and scoped browser axe checks.
Clear the task-specific variable before selecting historical 5C/5D fixture modes.
On Windows paths containing `&`, use direct Node entry points if npm's `.bin`
wrappers fail. From `frontend/`, run `node node_modules/typescript/bin/tsc -b`,
`node node_modules/vitest/vitest.mjs run` and
`node node_modules/eslint/bin/eslint.js . --max-warnings 0`.

The October 23 local security repair pins Zod 4.6.6, Vite 8.1.6 and Vitest 4.1.12,
with matching Vitest internals and jsdom's undici 7.30.1 in the lockfile. No major
was changed. An explicitly approved isolated npm 11.21.1 worked around npm 10's
lock-generation peer-resolver defect; npm 10.9.3 `ci` and installed-tree validation
passed with the resulting format-3 lock. Global tooling, project package-manager
requirements and normal locked-install workflow are unchanged. Fresh audit and
the affected frontend/browser/build checks passed; evidence is in the linked
implementation status. A future dependency update may still encounter npm 10's
resolver bug; this does not require npm 11 for the verified locked install.

Each environment has a separate WEB app and one main branch. Staging uses
BETA with auto-build; production uses PRODUCTION with auto-build disabled.
Production's existing demo build setting does not imply production account
readiness. Cognito was deployed in 5E; real signup/authentication acceptance and
production launch remain separate gates.

The [Phase 5C handoff](../docs/phase5c-frontend-cognito-handoff.md) describes the
single workspace controller, OAuth transactions, credential storage and bounded
recovery. Account entry requires validated `/api/v1/auth/config` metadata from the
configured API; no new frontend build variables supply Cognito identifiers.
The domain is pinned to the recorded staging deployment. Local tests intercept it;
do not use them to contact a real provider or the paused staging application.

The [5D handoff](../docs/phase5d-account-lifecycle-handoff.md) adds one-use,
same-account recent-auth intents for full JSON export and confirmed deletion,
restricted `/account` progress/recovery and terminal local identity clearing.
The existing controller remains the only session owner. Closed registration
metadata hides Create Account; no account-management simulation is shown.
The extended local suite preserves historical 5C outputs in a separate folder:

```bat
node frontend/node_modules/@playwright/test/cli.js test --config frontend/playwright.account.config.ts
```

Its fake-provider server uses port 4176 and `.tools/phase5d-auth-browser/`;
screenshots contain fictional data. No real provider or hosted staging traffic.

The isolated fake-provider browser suite uses desktop/mobile Chromium and blocks
unmocked external requests:

```bat
node frontend/node_modules/@playwright/test/cli.js test --config frontend/playwright.auth.config.ts
```

It builds/previews only under `.tools/phase5c-auth-browser/`, without replacing
the canonical build or deployment evidence. OAuth network tracing is disabled.
Its synthetic tokens prove local behavior, not real Cognito compatibility.

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
aligned template/helper render the reviewed **staging artifact**. CSP connect-src
permits self, the unchanged regional API source
https://*.execute-api.us-east-1.amazonaws.com, and the exact offline Cognito proposal
`https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com`.
The domain is an offline 5A fixture, not evidence that it exists. No broad Cognito
wildcard, browser JWKS/userInfo origin or arbitrary HTTPS source is allowed.
The regional API source supports generated API IDs
without an App→API cycle. It does not permit arbitrary HTTPS or wildcard egress.
Other directives and security headers are preserved. Inline scripts remain
blocked; the existing inline style allowance remains. Source maps remain disabled
by Vite's default. A future reviewed custom API domain could narrow CSP further.

Referrer-Policy is `no-referrer` to minimize subsequent callback-query exposure;
the initial hosting request can still contain the OAuth code/state. Form action
remains self-only, frames denied, and COOP/CORP same-origin. Vite development and
preview allow the exact staging Cognito fixture only for the accepted staging
public site or loopback, deriving from existing VITE_PUBLIC_SITE_URL; there is no
new Amplify branch setting.

The renderer has an explicit per-environment origin map. Production currently has
no reviewed Cognito domain and is separately rendered **without staging trust**:

```text
node frontend/scripts/render-hosting-headers.mjs --environment production --output .tools/production-headers.yml
```

The output parent must already exist. Production output must be explicit and
cannot overwrite root customHttp.yml. Rendering does not publish that file; a
future production release must separately bind and qualify its actual provider
origin. The checked-in staging file does not automatically provide isolated
production publication. Phase 5C changes no AWS resource or API CORS policy.

Header tests parse YAML and reject wrong roots, missing/duplicate headers and
weakened CSP. The build verifier checks index/assets, expected public URLs, no
private config, credentials/signing material, local API endpoints, unresolved
placeholders or source maps. It prints summary evidence, not bundle contents.

See [ADR 0012](../docs/adr/0012-amplify-hosting-origin-wiring.md),
[infra guide](../infra/README.md) and the
[complete handoff](../docs/production-account-readiness.md#44-phase-3e-implementation-and-handoff).
