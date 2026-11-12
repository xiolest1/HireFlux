# ADR 0012: Static Amplify hosting and acyclic origin wiring

- Status: accepted for Phase 3E, local synthesis and validation only
- Date: 2026-10-06

## Assignment 2 staging-header recovery amendment (2026-11-11)

Defer only staging's optional stored `CfnApp.CustomHeaders` addition. The shared
construct emits it for production and omits it for staging. Staging keeps the
unchanged root `customHttp.yml` and its complete security-header policy; the
existing staging App definition therefore does not need this update. Tests pin
property absence and root/shared-policy equivalence. Production behavior remains
unchanged, including its separate binding, root-header migration and delivered
header gates.

The November 11 staging attempt failed when Amplify rejected repository
authorization with an upstream GitHub 401; normal CloudFormation rollback
completed. Neither malformed header YAML nor a particular token/expiry was
established as the cause. Avoiding the optional App update removes that dependency
from this recovery; it does not repair credentials for future App changes.

This is a local, uncommitted correction to be synthesized and reviewed as a new
unexecuted recovery candidate. The old backend remains quarantined with reserved
concurrency zero. No root file, deployed headers, production resource, token or
backend artifact is changed by this amendment. The dated Batch 3 contract below
records the earlier stored-staging proposal and is superseded only on that point.

## Phase 7B Batch 3 amendment (2026-11-03)

This amendment updates the local hosting/header contract. The Phase 3E decision
and evidence below remain historical; they do not describe fresh deployed state.

The [canonical registry](../../frontend/src/deployment-targets.json) and
[shared pure policy module](../../frontend/src/publicDeploymentPolicy.mjs) now
supply browser trust, offline header rendering and `CfnApp.CustomHeaders`.
Staging retains its exact recorded site/API/provider tuple. Production is `null`;
no placeholder IDs or runtime override create a public binding. Build-only target
projection includes only the selected exact public tuple and removes staging
identity from a bound production artifact. Explicit fictional fixtures remain
test-only and cannot return a publishable result.

The root `customHttp.yml` remains unchanged and effective. The locally prepared
staging App headers are semantically equivalent to it, including its historical
regional API source. The final exact renderer narrows connect-src to self and
the selected reviewed API/provider; unbound production is self-only. Literal
reviewed values avoid an App→API→App dependency cycle. No App logical-ID,
origin-wiring or staging build-spec change is needed for this preparation.

AWS documents [repository-header precedence](https://docs.aws.amazon.com/amplify/latest/userguide/setting-custom-headers.html)
and the [monorepo application format](https://docs.aws.amazon.com/amplify/latest/userguide/custom-header-YAML-format.html).
Consequently the prepared App policy cannot become authoritative while the root
file overrides it. A later approved migration must retire that root authority,
qualify exact effective headers for each app and establish a reviewed production
binding before publication. No root deletion or hosting update occurs here.

Production's disabled-auto-build Branch is preserved. Its build spec now runs
the explicit publication guard after the normal frontend build, blocking an
unbound target, staging identity or retained root authority. The ordinary build
scanner validates artifact hygiene only and is not a publication approval. This
separation preserves historical synthetic-build CI while preventing those
fixtures from qualifying a production release. See the
[frontend guide](../../frontend/README.md#public-build-configuration).

## Context

Phase 3D defines the backend request path with verified packaging and scoped
permissions. Static hosting now needs an exact frontend CORS origin and a public
API endpoint without a circular CloudFormation dependency or manual URL copying.
Nothing is deployed; Amplify App IDs/default domains do not yet exist.

## Decision

Use `aws_amplify.CfnApp` and `CfnBranch` for exact stable CloudFormation property
and reference control. Each stack owns `FrontendHosting/App` and
`FrontendHosting/Branch`, plus a stack-local `AmplifyGitHubAccessToken` String
parameter with NoEcho, no default and 1–4096 character bounds. Its sole reference
is App.AccessToken. No credential enters build variables, Lambda, metadata,
outputs, source or tests. GitHub App installation and secure token availability
are explicit Phase 4 prerequisites, not actions performed in this phase.

Use the verified canonical repository `https://github.com/xiolest1/HireFlux`
(local remote has the equivalent `.git` suffix), static WEB platform, and
environment-prefixed app names. No compute/service role, Amplify backend,
SSR, basic authentication, PR preview or automatic branch creation is added.
Explicit hosting source is `main` for both separate apps. Existing CI targets
main; older develop/staging documentation was a proposed workflow, not an
implemented branch convention. Staging uses BETA/auto-build true; production
PRODUCTION/auto-build false. Hosting is reproducible, Delete on removal and
replacement; DynamoDB and signing-secret production retention remain intact.

Build only `frontend/`, with matching appRoot and static app-level
AMPLIFY_MONOREPO_APP_ROOT. The build spec selects the same Node 22 major as CI
using `nvm install 22`/`nvm use 22`, then `npm ci` and `npm run build`, publishing
dist/**. No backend build, schema initialization, packaging or deployment command
is included. No repository amplify.yml overrides this defined build spec.

Only Branch receives VITE_API_BASE_URL from the same stack's HttpApi.apiEndpoint,
VITE_WORKSPACE_MODE=demo, and VITE_PUBLIC_SITE_URL from the computed frontend
origin. All are public. Production retains the existing demo build adapter only
because auto-build is disabled and backend cognito mode remains unavailable;
Phase 5 must establish the actual account/session model before production launch.

Construct the origin once from the validated configured branch string plus
App.DefaultDomain: `https://main.${DefaultDomain}`. Both API Gateway and Lambda
CORS receive this same token. Never use Branch attributes upstream. Preserve
all Phase 3D CORS methods/headers/credentials and runtime code unchanged.

Dependency order (arrows mean prerequisite → dependent):

```text
Amplify App → HTTP API and Lambda CORS → Amplify Branch
     └───────────────────────────────────────↑
```

App has no API/Lambda/Branch references. Branch references App.AppId and API
endpoint. Putting the API endpoint on App, or deriving API CORS from Branch,
would create a cycle. Tests traverse all resource references/DependsOn, verify
the intended edges, and deliberately inject both invalid cycles to prove failure.
The original table/function/role/secret/API logical IDs remain unchanged.

Use the documented SPA regex 200 rewrite to index.html, extended with jpeg,
mjs, avif, html, pdf, wasm and webmanifest asset extensions. Route paths rewrite;
known static assets retain normal file/404 behavior. No second routing system.

Repository-root customHttp.yml remains the sole hosted header authority using
applications/appRoot=frontend syntax; App.CustomHeaders is absent. The template
and rendering helper now preserve the same static policy without a generated
API ID. CSP connect-src allows only self and
`https://*.execute-api.us-east-1.amazonaws.com`, the narrow regional pattern
needed for the current single-region generated API endpoint. CORS remains exact;
CSP is an egress defense, not ownership/authentication. No broad connect-src
wildcard/scheme or other directive weakening is introduced. A future reviewed
custom API domain could tighten egress, but no custom domain is added now.

HSTS, MIME/frame/referrer/permissions policies and cross-origin headers remain.
Scripts stay self-only; existing style inline allowance remains intentional.
Source maps retain Vite's disabled default. Header tests parse YAML and assert
the monorepo structure and full security policy. The already locked js-yaml
4.3.2 parser is explicitly declared as development tooling, with no new package
resolution/runtime dependency graph. A separate build verifier checks public
URLs, assets, no private inputs/local endpoints/placeholders and no source maps.
No frontend runtime/session or backend source change is required.

## Verified AWS constraints

[App properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-amplify-app.html)
provide WEB, AccessToken and DefaultDomain.
[Branch properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-amplify-branch.html)
provide branch-level build variables, stage and auto-build controls.
[GitHub connection](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html)
requires GitHub App installation and a personal access token for CloudFormation
creation; the parameter is only a secure deployment input contract.
[Default-domain URLs](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html)
use branch-name.AppDefaultDomain.
[Monorepo builds](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html)
require matching appRoot and AMPLIFY_MONOREPO_APP_ROOT.
[Node selection](https://docs.aws.amazon.com/amplify/latest/userguide/custom-build-image.html)
supports explicit versions rather than latest.
[SPA rewrites](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html)
support the regex extension exclusion pattern.
[Header format](https://docs.aws.amazon.com/amplify/latest/userguide/custom-header-YAML-format.html)
and [monorepo precedence](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-custom-headers.html)
require the repository-root application form and make repository headers override
console headers. Build/header source overrides must be reviewed before deployment.

## Boundary and consequences

Both templates define 13 resources, zero outputs and two parameters (GitHub
input plus existing CDK bootstrap version). Synth uses no credential values,
AWS/GitHub lookup or frontend build. The Phase 3D ZIP remains unchanged and is
verified by actual synth. No hosting authorization, AWS bootstrap/upload/
mutation/deployment, custom domains, Cognito or Phase 3F controls are implemented.
The CDK bundled brace-expansion advisory remains open at the latest verified
versions, with no patch/override/suppression. It is not a clean security audit.

See the [Phase 3E handoff](../production-account-readiness.md#44-phase-3e-implementation-and-handoff)
for validation counts, resource inventories and remaining qualification gates.
