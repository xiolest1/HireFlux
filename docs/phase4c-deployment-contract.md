# Phase 4C deployment preparation and Phase 4D contract

## Current disposition

**PASS WITH DOCUMENTED PHASE 4D CONDITIONS — READY FOR SUPERVISED 4D.**
On 2026-10-15 the owner explicitly approved the regional GitHub App installation,
completed GitHub's Confirm access check, and its saved settings were verified:
AWS Amplify (us-east-1), xiolest1, Only select repositories, exactly HireFlux.
The approved permissions are write access to amplify.yml, read code/metadata,
and read/write checks, pull requests and repository hooks. GitHub also notes
read-only access to public repositories. No broader private/writable repository
selection was granted. Installation does not prove a live Amplify clone/build.

The owner renewed the expired native AWS login; CLI and pinned-CDK live checks
match the intended non-root account/us-east-1. Other profiles and the shared
credentials file are preserved. The protected toolkit remains healthy at version
32/11 resources; application stack and Amplify apps remain absent, with 1,000
unreserved concurrency. No AWS application asset/resource or real PAT was created.

The remaining conditions have specific owners and stop criteria:

- **Owner, immediately before separately authorized 4D:** review classic PAT hook
  exposure and finite expiry, create it personally, and use the reviewed hidden-entry
  bridge. Revalidate source/helper hashes and preflight first; stop on unsafe entry,
  wrong scope/identity/assembly, provider failure or unexpected existing resources.
- **Owner/operator, after normal 4D tagged resources:** wait for Project/Environment
  keys, request separate activation approval, allow propagation, then prove coverage
  in 4G. Stop attribution/operational acceptance on missing or incorrect coverage;
  use whole-account manual Bills review meanwhile, without enabling Cost Explorer.
- **Owner, before 4D:** refresh Bills/lab baseline and explicitly accept the supervised
  window, USD2 review/USD5 first-week gross stop envelope, bounded idempotent transport
  retries and the exact asset/change-set/execution/build actions. Completing 4C
  authorizes none of those deployment or emergency-recovery mutations.

The initial 2026-10-14 preparation checkpoint awaited GitHub authorization; that
gate is now closed. No real PAT has been created, and Phase 4D has not begun.

This record supplements [readiness section 52](production-account-readiness.md#52-phase-4c-deployment-inputs-and-cost-attribution)
and preserves the [verified Phase 4B record](production-account-readiness.md#51-phase-4b-applied-quota-and-bootstrap-approval-checkpoint).
Full identity/API/download/test receipts and the final revision/CI handoff are
ignored locally under `.tools/phase4c/`; no credential is audit evidence.

## Evidence reviewed on 2026-10-14

- Entry source: clean main at `96ce9fcafd1baabacfaea5662a1d439874c9426d`, intended
  `https://github.com/xiolest1/HireFlux.git` remote. Live GitHub main agrees.
  [Run 38598527632](https://github.com/xiolest1/HireFlux/actions/runs/38598527632),
  attempt 1, has all five backend 3.13/3.14, frontend, Lambda and infra jobs green.
  A later documentation commit requires its own exact-revision green CI.
- Native temporary `hireflux-operator` login still matches the original non-root
  principal/account ending 9465, with explicit us-east-1 and no static fallback.
  CDKToolkit is CREATE_COMPLETE, all 11 resources complete, termination protection
  enabled, qualifier hnb659fds and SSM version 32 (required minimum 6). Its Original
  template is byte-identical to the verified Phase 4B receipt. No bootstrap retry.
- Live staging stack remains absent; Amplify app list is empty. Lambda settings
  report total/unreserved 1,000/1,000 and zero functions. Reservation 5 is unchanged
  source configuration. These reads create no application resources or assets.
- Fresh isolated staging/production synth and 119 infra tests pass; eight hosted
  header/build-negative tests pass. Network-blocked synth attempts zero network
  connections. The full existing Linux artifact verifier passes. No runtime,
  infrastructure, dependency, CI permission, production or wrapper change.
- Actual artifact 11910763095 was downloaded independently. Its outer SHA-256 is
  `4cec774642cf2c439661a15a1054906667f161e18f9315982f0cd54f81ddfcee`; expiry is
  2027-01-12T16:29:37Z. Its inner ZIP byte-equals the preserved canonical Linux ZIP;
  adjacent manifest is semantically identical. Every member digest and ZIP CRC
  passed. ZIP SHA is `4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`;
  manifest SHA is `9e85bad3e4c8a312d56b99f877a676917ace152119226f204e561ea5464627c3`.
  Size: 26,642,450 compressed /57,541,431 expanded bytes, 3,756 members,
  31 distributions and 71 application sources. Nothing was rebuilt or uploaded.

The reviewed preparation checkpoint `7d1e81e22ce13d51723321f9717c9cecbf7fe1e3`
subsequently passed all five jobs in
[run 38656976715](https://github.com/xiolest1/HireFlux/actions/runs/38656976715).
Actual artifact 11936704057 was independently downloaded: outer SHA
`96c722204c569a5e0ee787e555d5e02925b7c726c71cbab9f732e3cef996b862`, expiry
2027-01-12T23:55:14Z. Its inner ZIP and manifest byte-equal the verified prior
archive. The completion documentation receives its own exact-revision CI; the
local final handoff records actual final HEAD/run/artifact rather than a future SHA.

## Repository authorization and sensitive input

AWS documents the regional App installation and separate PAT flow for
[CloudFormation/CLI/SDK](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html).
Use [AWS Amplify us-east-1](https://github.com/apps/aws-amplify-us-east-1/installations/new)
under xiolest1; inspect an existing installation before adding one. The selected
repository set contains only HireFlux. The actual requested permissions above were
reviewed and explicitly approved by the owner; saved installation scope is verified.
Any later expansion requires separate explicit approval. Stop before any AWS app creation,
Save and deploy, webhook creation or build. Installation alone does not prove clone,
webhook delivery or a successful build.

The synthesized GitHub provider uses App.AccessToken, not OauthToken. AWS's
documented `admin:repo_hook` scope belongs to a classic PAT. Do not substitute an
unqualified fine-grained token or add repo/workflow/organization scopes. Classic
PAT hook administration can cover other repositories the owner administers; the
App's HireFlux-only selection does not restrict that separate token. The owner
must review this exposure before personally creating it at the supervised 4D
window. See [GitHub scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
and [PAT management](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

Create a dedicated short-lived token immediately before the approved deployment,
with the shortest practical finite expiry covering supervised qualification and
recovery. Record purpose, creation/expiry dates and owner responsibility without
recording its value. Do not put it in chat, shell commands, .env, GitHub Actions,
files, assembly context, scripts, logs or a Secrets Manager holder. The same-stack
generated signing secrets are unrelated to this deployment credential.

Normal CDK `--parameters ...=<token>` is unsuitable: plaintext enters process
arguments/history. NoEcho alone does not fix that. The operator input procedure
requires synthetic qualification of masked terminal entry, in-memory delivery,
native pinned-CDK transport, redacted success/failure output and no file/assembly
persistence before any deployment approval. The future operator bridge is now
implemented and tested offline with synthetic values: **14 focused groups pass**,
including native serialization, transient same-token retries, actual existing-
stack states, denied mutations, echo/TTY, TLS/CA/debug/optimization and failure
output checks. All three helper hashes match the proof and independent review.
Real PAT entry and live preparation remain uninvoked. Exact reviewed proof and
commands are recorded locally under `.tools/phase4c/`; an unproven or changed flow
blocks Phase 4D.

The minimal proposed 4D adjustment preserves the CDK assembly, publishing roles
and CloudFormation architecture. After separate deployment authorization:

1. Revalidate source/identity/native profile/region/toolkit/headroom, the reviewed
   bound assembly digest and artifact. Stop on any existing staging stack,
   including REVIEW_IN_PROGRESS or recovery states, before secret entry.
2. Publish only reviewed secret-free assembly assets using the pinned CLI's
   publish-assets command. This version marks that command experimental and
   requires its explicit unstable feature flag; it is not a new stable interface.
   The reviewed publisher wrapper discards raw CLI input/output and disables
   telemetry, emitting fixed status only.
   No PAT is present for asset publishing or synthesis. No new dependency is added.
3. In the owner's interactive terminal, the reviewed Python entry bridge rejects
   non-TTY/echo fallback, optimization, debug/crash, endpoint, proxy and TLS/CA
   overrides and persistent AWS profile/default endpoint/credential overrides
   before masked getpass input. It sends an anonymous stdin pipe to a
   Node child; the PAT is an in-memory parameters object, never a CLI argument,
   environment value, temporary file or assembly context.
4. The pinned exported Deployments.prepareStack API resolves the same native
   profile/roles, with silent CDK IO and no SDK logger. Its CloudFormation facade
   permits only a staging CREATE change set without import or execution and
   rejects existing-stack, delete, update, cleanup or execute paths. Only fixed
   status fields are emitted. These lower-level exports are version-specific;
   do not assume compatibility after a CLI upgrade.
5. The pinned CloudFormation SDK hardcodes up to seven transport attempts.
   CreateChangeSet uses the same fixed ClientToken for those attempts. This is a
   bounded idempotent transport policy to include in 4D approval, not permission
   to retry the helper/CLI, recover/delete a stack or execute after returned failure.
   AWS_MAX_ATTEMPTS alone does not override that hardcoded policy.
6. Review the resulting unexecuted change set and expected 22 selected resources;
   execution is a separate secret-free pinned execute-change-set operation after
   review and approval. The executor wrapper discards raw CLI streams, checks the
   exact original template, role, paginated expected Adds and review-only stack
   state, and accepts masked NoEcho values without treating them as plaintext proof.
   No token is reintroduced through CLI parameters.

Synthetic native-path tests are necessary evidence, not a live create/clone test.
The operator bridge's future real mode must never run during 4C. Hidden entry does
not guarantee zeroization of immutable Python/JavaScript strings or prevent a
privileged host from inspecting memory/paging/crash dumps. Use an owner-controlled
trusted machine, no terminal recording/debug session and no clipboard-history
retention; do not claim universal fragmented-write protection from test probes.
NoEcho protects supported CloudFormation displays; it does not remove the value
from the necessary TLS request. CloudFormation documents omission of parameter
values from CloudTrail, while SDK/debug/application logging still needs the
explicit controls above.
[CloudFormation CloudTrail logging](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-api-logging-cloudtrail.html),
[CreateChangeSet idempotency](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_CreateChangeSet.html).

Amplify's AccessToken property states that Amplify does not store the token. This
does not prove that deleting it preserves integration: GitHub documents that
deleting a PAT which created a deploy key deletes that key. Do not revoke it
immediately merely because stack creation succeeded. Phase 4D must inspect the
actual clone method and successful App clone/webhook/build behavior before agreeing
a revocation/reconnection plan. Later CloudFormation updates may use previous
parameter values; that does not prove a stored token is still valid. Reconnection
or rotation uses the same secure path and fresh authorization. On suspected leakage,
revoke promptly, suspend further operations, accept possible clone disruption,
review relevant GitHub/AWS access metadata and reconnect only with fresh approval.
On first-deploy failure, inspect sanitized stack events and stop; no automatic
retry, force, deletion, change-set execution or token persistence.

## Actual CloudFormation inputs and selected resources

There are exactly three parameters and zero application outputs:

1. `AmplifyGitHubAccessToken`: String, NoEcho true, no default, length 1–4096;
   no scope/type validation in CloudFormation. Owner creates it only at the
   supervised 4D window. Its sole template reference is
   FrontendHostingApp3EC0FC15.Properties.AccessToken. It is absent from metadata,
   outputs, physical identifiers, tags, Lambda/Vite variables and BuildSpec.
2. `OperationalAlertEmail`: String, NoEcho true, default empty, maximum 254,
   pattern `^$|^[^\s@]+@[^\s@]+\.[^\s@]+$`. Intentionally supply/default blank.
   No real mailbox, subscription confirmation or delivery is needed. The pattern
   validates shape, not ownership.
3. `BootstrapVersion`: AWS::SSM::Parameter::Value<String>, default
   `/cdk-bootstrap/hnb659fds/version`, no NoEcho or credential. CloudFormation
   obtains the live version; the rule rejects versions 1–5. Current value is 32.

Both templates declare 25 resources. Not(Equals(email, empty)) selects only the
SNS topic/subscription/topic-policy when nonempty. Blank selects **22**; email
selects **25**. Blank also removes alarm actions and budget subscribers. Five
alarms, one dashboard and the budget remain. **No email notifications are delivered.**
The owner monitors CloudWatch and whole-account Bills throughout supervised testing.

The selected 22 comprise one table; Amplify App/Branch; two log groups; two signing
secrets; runtime role/inline policy; Lambda/invoke permission; HTTP API/integration/
route/default stage; five alarms; dashboard; budget. No extra Cognito, S3 application,
network, KMS or production resource. The graph is acyclic: App.DefaultDomain feeds
backend CORS; API endpoint and App domain then feed Branch. Secrets/table/logs/role
precede their consumers; scoped alarms/dashboard follow service identifiers.
Actual AWS provider timing, IAM and log delivery remain live qualifications.

## Frontend build and browser contract

App repository is `https://github.com/xiolest1/HireFlux`, Branch main, static WEB.
BuildSpec appRoot and AMPLIFY_MONOREPO_APP_ROOT both equal frontend; no buildPath
override. nvm install/use 22 meets frontend's >=22.12.0 engine when the managed
resolved version is confirmed. npm ci uses frontend/package-lock.json, then npm
run build runs TypeScript/Vite and publishes dist/**. No backend dependency install,
SSR role or extra build job. Record actual managed Node version/revision in 4D.

Branch variables are public API endpoint, demo workspace mode and
`https://main.<App.DefaultDomain>` site URL. Exact same-stack origin appears in
HTTP API/backend CORS, explicit methods/headers, credentials false. App has no API
reference, avoiding a cycle. Signing/PAT/AWS credentials do not enter VITE_ inputs.
Root customHttp.yml owns hosted CSP/security headers; scripts exclude unsafe-inline,
connect-src permits regional HTTPS execute-api hosts. The accepted regional CSP
wildcard is broader than the exact CORS origin. SPA fallback excludes real static
asset extensions. Actual HTTPS, headers including errors, missing-asset 404, deep
routes and edge caching still need hosted verification; synth proves no cache TTL.

Missing API env currently falls back to localhost; missing site env can retain
Vite placeholders. Do not describe that as runtime fail-closed. Before any build,
stop on absent/incorrect branch inputs. The existing verify-hosted-build.mjs rejects
local URLs, placeholders, missing expected public URLs and private credential
markers; its negative tests pass. BuildSpec does not invoke it automatically.
Apply equivalent checks to actual built assets before accepting publication.

Staging main EnableAutoBuild=true; production false. Automatic branch creation,
PR previews and branch auto-deletion are false. Later main pushes can incur staging
builds. App/Branch creation and any resulting first build must be included in 4D
approval. Never create an App to experiment with first-build behavior; observe its
job history and explicitly authorize a start only if no job began. Production
remains excluded and unavailable for launch.

## Tag coverage, billing and cost controls

CDK common tags materialize as explicit Tags/ResourceTags:
`Project=HireFlux`, `Environment=staging`, `ManagedBy=AWS-CDK`. Production separately
uses Environment=production. There are 19 tagged declarations, 18 of 22 selected
with blank email. The matrix is synthesized coverage, not measured billing:

- DynamoDB table, Lambda function, runtime IAM role, Amplify App/Branch, two signing
  secrets, two log groups, five alarms, dashboard and optional SNS Topic: explicit
  Tags arrays. Verify actual service tags after deployment and bill-line coverage.
- HTTP API and default Stage: explicit Tags maps. Their route/integration have no
  tag property; do not infer inherited billing attribution for children or transfer.
- Budget: explicit ResourceTags; these label the budget itself and do not allocate
  the charges of other resources. FilterExpression performs the cost selection.
- Inline IAM policy, Lambda permission, API integration/route and optional SNS
  subscription/topic-policy: no tag surface in this template. IAM has no direct
  usage charge; other child costs may accrue through parent service billing.
- Bootstrap S3/ECR/IAM/SSM: no Project/Environment. Four bootstrap roles use only
  aws-cdk:bootstrap-role. Bootstrap storage/requests/KMS and unrelated labs are outside
  the app AND filter. No retagging or claim of complete inherited tag coverage.

Fresh ListCostAllocationTags succeeded for Project/Environment but returned an
empty list. The keys are **unavailable**, not verified active/inactive. No activation
occurred. After normal 4D tagged resources exist, allow up to 24 hours for appearance;
then request separate owner approval to activate only those two keys. Activation
applies account-wide to all values using those keys, including labs. Allow up to
24 further hours for activation. Carry the action/actual billed-coverage review
into 4G; do not create dummy resources or claim attribution is operational.
[AWS tag activation](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html).

Do not enable Cost Explorer or optional Billing products. Avoid Billing home if CE
is disabled: AWS documents automatic enablement on visiting that home page. Use
direct Bills/Credits/cost-tag pages for authorized manual reviews.
[Billing home behavior](https://docs.aws.amazon.com/cost-management/latest/userguide/view-billing-dashboard.html).

Staging budget is USD10, COST, MONTHLY, FilterExpression
AND(Project EQUALS HireFlux, Environment EQUALS staging). Exact synthesized Metrics
is `[UNBLENDED_COST]`, with no CostTypes or explicit credit/refund exclusion. The
current CF schema accepts strings; provider metric mapping is not proven offline.
Verify actual budget metric/filter after creation; stop on provider rejection or
wrong scope. Do not silently amend it to a whole-account budget or claim it measures
gross incremental spend. Taxes/credits/refunds/fees, transfer, CloudWatch, Amplify
builds, untagged/shared charges and propagation can escape or affect selection.
Budget refresh is delayed, advisory, and has no action or hard cap.

Live account-plan API remains PAID/ACTIVE, USD0 account-plan credits, no expiration
field. Owner-reported promotional balance/runway and last manual Billing baseline
remain separate private evidence; this task has not freshly measured promotional
credit balance or the bill. Review gross incremental staging spend against account
Bills, not only credit-reduced net payable or tag estimates: approximately USD2
review, USD5 first-week stop, plus investigate unexplained approximately USD1/day
growth, repeated builds, excess logs/errors/throttling or uncontrolled demo issuance.
The owner must accept and supervise this window when authorizing 4D. These are
manual stop decisions, not real-time financial controls or guarantees.

## Phase 4D predeployment checklist

1. Use the final reviewed source revision and clean main; recheck GitHub remote.
2. Verify all five jobs on its exact final CI run; record actual IDs locally.
3. Record official artifact run/ID/expiry, outer ZIP and adjacent manifest provenance.
4. Require the Linux ZIP/member/source/input verifier and asset key
   `ee374ad8661035832c785da52fc5ad600c40f8989129b3d62ddd6b18bcf68202.zip`.
5. Revalidate original non-root native temporary identity/account ending 9465/us-east-1.
6. Recheck protected CDKToolkit/version >=6 and health; do not bootstrap again.
7. Verify owner-reviewed us-east-1 App installation with only HireFlux access.
8. Owner reviews classic PAT hook exposure, creates it near deployment with finite
   expiry, and enters it only into the qualified masked operator procedure.
9. Supply only the actual PAT parameter, blank email and SSM bootstrap default.
10. Preserve blank email/no SNS/no email; owner accepts manual monitoring.
11. Keep cost tags pending until visible; activation still requires separate approval.
12. Accept USD2 review/USD5 first-week stop and whole-account gross cost monitoring.
13. Review bound staging template/asset roles and exact CREATE change set: 22 selected
    application resources, no imports, replacements, production or unrelated labs.
14. Approval includes any initial Amplify build; avoid redundant jobs/repeat attempts.
15. Check actual App domain/API/Branch inputs and hosted artifact/security policy.
16. Verify initial log groups/delivery/retention/privacy before load or broader access.
17. Owner supervises and owns stop/recovery decisions; failure means inspect/report,
    not automatic retry, force, deletion or rollback mutation without authorization.
18. Exclude production, Cognito work, account/plan changes and all unrelated labs.
19. Obtain **separate explicit first-application-deployment approval** covering assets,
    change set/execution, build consequences, broad standard execution authority and
    the spend window. Completing 4C grants none of those actions.
20. Carry actual clone/build, deployed IAM/secrets/schema/TTL, browser/CORS, logs,
    alarms, tag/budget billing, latency/scaling and stop/rollback evidence to 4D–4H.

## Inherited qualification rows

- L06: regional App installed with explicit consent and saved HireFlux-only scope
  verified; operator transfer implemented/qualified offline. Preparation is complete;
  owner real PAT creation and live provider use remain supervised 4D conditions.
  No waiver for exposure and no live clone/build claim.
- L07: blank email selected by owner request; manual monitoring required in 4D.
- L08: keys unavailable; separately approved post-4D activation/propagation and 4G
  coverage review pending. Whole-account fallback is required.
- L09: local template/graph/Linux assets qualified; actual publication/change set pending.
- L10–L16: deployed resources/wiring, runtime signing/IAM, frontend revision/HTTPS/
  headers/routes, browser/API ownership/conflicts, schema/TTL/expiry, log privacy/
  correlation and live metrics/alarms/dashboard pending.
- L17: N/A for email delivery with blank choice; no automated notification claim.
- L18–L20: bounded load/throttle/reservation/latency, live cost/backlog and completed
  staging acceptance/evidence/stop/recovery qualifications pending.

Only the separately approved regional GitHub App installation/authorization and
normal repository documentation checkpoints changed external configuration.
Native AWS temporary authentication was renewed with owner interaction. No AWS
resource/Billing mutation, real PAT generation, application upload/deployment/build
or lab/production mutation occurred.
Normal reviewed repository documentation commit/push and read-only CI verification
are recorded separately in the final local handoff.
The known bundled CDK advisory, anonymous issuance cost risk and deferred production
findings remain open. Stop at Phase 4C; a pass cannot be inferred from offline synth.
