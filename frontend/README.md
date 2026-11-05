# HireFlux frontend build and hosting

## Phase 7B local trust and hosting contract

Batch 2 additionally preserves the same Demo operation key through admission
uncertainty or control-store unavailability. Retry remains explicit. A denied
reset restores only its still-valid previous Demo; a failed deliberate switch
never resurrects cleared Personal credentials. Existing error UI presents pause,
quota and unavailable messages without polling or an invented reopening time.
No frontend policy toggle, additional API client or registration change exists.

The canonical [deployment/header registry](src/deployment-targets.json) contains
the exact website, single API, environment, capability set, Cognito
issuer/client/domain, fixed callback/logout URLs and expected registration flag.
[publicDeployment.ts](src/publicDeployment.ts) exposes typed access through the
shared pure [policy module](src/publicDeploymentPolicy.mjs). Browser validation,
header rendering and CDK App headers consume this same contract. Staging IDs come
from retained sanitized deployment evidence, not a new live inspection.
Production remains explicitly unbound (`null`); fictional production targets
exist only in programmatic test fixtures.

The build-only [Vite projection](scripts/public-deployment-projection.mjs) keeps
only the exact target selected by the existing site/API build inputs. An unknown
or unbound public pair retains neither target and cannot pass publication checks.
A production artifact therefore cannot inherit staging trust. Loopback builds
retain the local staging fixture for isolated tests. The projected staging value
is nullable; callers must check it rather than invent a provider fallback. There
is no browser/runtime registry override, extra build variable or identity lookup.

Public API/site validation runs before configuration fetch, stored-session
restoration or credential leasing. Missing/mismatched inputs, unavailable or
malformed metadata, and public HTTP 404 fail closed for Demo and Personal entry.
Only two loopback origins retain the development API default and legacy 404 Demo
compatibility. `VITE_WORKSPACE_MODE=demo` remains the managed session convention;
it does not force Demo-only authentication. Local durable mode also requires a
loopback site and development build.

Configuration retry fences old continuations, clears private caches/credentials,
and requires deliberate entry afterward; dirty work requires explicit discard.
A provider/session outage does not invalidate independently trusted Demo config.
The existing PKCE, state/nonce, refresh, ownership and identity-switch protections
are preserved. Registration is CLOSED in the public binding and examples.
See the [Batch 1 handoff](../docs/phase7b-batch1-local-handoff.md) for its historical
qualification and the [hosting decision amendment](../docs/adr/0012-amplify-hosting-origin-wiring.md#phase-7b-batch-3-amendment-2026-11-03)
for current local header/publication gates. Root-header migration and production
publication remain separately authorized work.

The older release notes below are historical checkpoints. In particular, the
former staging-only shape-based provider validation and public legacy fallback
are superseded by this source contract; no new hosted state is claimed here.

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
Artifacts are dist/**. The staging build spec is preserved. The production build
spec additionally runs `node scripts/verify-hosted-build.mjs --publication
--environment production`; it must fail while production is unbound or root
header authority remains. No Python/backend/infra install/build is involved.

To validate a deployment-style build from the repository root in Command Prompt:

```bat
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run test:hosting-headers
npm --prefix frontend run test:hosting-build
node --test frontend/scripts/public-deployment-projection.test.mjs
set VITE_API_BASE_URL=https://phase3e-example.execute-api.us-east-1.amazonaws.com
set VITE_PUBLIC_SITE_URL=https://main.phase3e-example.amplifyapp.com
set VITE_WORKSPACE_MODE=demo
npm --prefix frontend run build
npm --prefix frontend run verify:hosting-build
```

These synthetic URLs exercise only the artifact scanner. Their public trust
binding is deliberately absent, so this build is not an authenticated/publication
candidate. For a locally built exact staging candidate, use the reviewed site/API
pair in `src/deployment-targets.json`, keep `VITE_WORKSPACE_MODE=demo`, then run
`node frontend/scripts/verify-hosted-build.mjs --directory frontend/dist
--publication --environment staging`. This performs local file validation only;
it does not publish or authorize deployment. Production requires a separately
reviewed real binding and root-header migration before the corresponding guard
can pass. Fictional production qualification uses explicit programmatic fixture
input, never normal runtime configuration, and always returns `publishable:false`.

Clear the shell variables before ordinary local preview. On this Windows workspace path,
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

Repository-root `customHttp.yml` remains the effective hosted header authority,
using `applications/appRoot=frontend`; AWS gives it precedence over app-level
headers. Batch 3 prepares `CfnApp.CustomHeaders` locally without changing or
removing that file. Staging's prepared app policy is semantically equivalent to
the retained root policy, including its historical regional API wildcard and
exact recorded staging Cognito domain. This equivalence is transitional, not the
final exact-origin production policy.

The shared policy module also renders the final exact staging policy from the
registry: self plus the one reviewed API and provider. Production currently has
no binding and renders self-only connect-src, with no staging/API/provider trust.
Future real provider/API origins must be literal reviewed registry values;
App headers must not reference API/Branch tokens and create an App→API→App cycle.
No new CSP wildcard, arbitrary HTTPS source, browser JWKS/userInfo origin or
provider fallback is introduced. Inline scripts stay blocked, the existing
inline style allowance remains, and Vite source maps remain disabled by default.

Referrer-Policy is `no-referrer` to minimize subsequent callback-query exposure;
the initial hosting request can still contain the OAuth code/state. Form action
remains self-only, frames denied, and COOP/CORP same-origin. Vite development and
preview allow the exact staging Cognito fixture only for the accepted staging
public site or loopback, deriving from existing VITE_PUBLIC_SITE_URL; there is no
new Amplify branch setting.

Render proposals separately from the retained root authority:

```text
node frontend/scripts/render-hosting-headers.mjs --environment staging --policy exact --output .tools/staging-exact-headers.yml
node frontend/scripts/render-hosting-headers.mjs --environment production --output .tools/production-headers.yml
```

The output parent must already exist. Exact/production output must be explicit
and cannot overwrite root `customHttp.yml`. The default staging renderer still
validates and preserves the retained legacy policy. Rendering a proposal does not
retire root authority or publish anything. A future approved migration must remove
the overriding root policy, qualify each app's exact effective headers and
artifact, and record that authority change before production publication.

Header tests parse YAML and reject wrong roots, missing/duplicate headers and
weakened CSP. `verify:hosting-build` is the compatibility artifact scanner: it
checks index/assets, public URLs, private material, local endpoints, placeholders
and source maps, and returns `artifact_scan_only:true, publishable:false`.
The explicit `--publication --environment ...` guard additionally requires the
exact reviewed target/provider metadata and CLOSED registration; production
rejects staging identifiers and retained root authority. A successful local guard
is evidence for a later release decision, not permission to publish. Neither
scanner performs network or live API configuration verification.

Offline browser fixtures must intercept every navigation as well as assets/API
requests. Do not implement a synthetic provider callback using an intercepted
HTTP redirect: redirect continuations can escape Playwright routing. Use an
explicit locally routed callback navigation and preserve any failed-run evidence.

See [ADR 0012](../docs/adr/0012-amplify-hosting-origin-wiring.md),
[infra guide](../infra/README.md) and the
[complete handoff](../docs/production-account-readiness.md#44-phase-3e-implementation-and-handoff).
