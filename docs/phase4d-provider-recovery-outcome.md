# Phase 4D provider remediation — 2026-10-16

**Current October 19 disposition: infrastructure and initial build verified;
Phase 4D public HTTPS readiness remains blocked.** The already-prepared change
set was executed once, all 22 resources completed, and Amplify job 1 succeeded
for the qualified revision. Its artifact passed verification. The bounded HTTPS
reader returned STOP; the specific failing assertion has not been isolated.
See [October 19 results and resume boundary](#october-19-staging-deployment-and-initial-build).
No deployment/build retry or Phase 4E work is authorized by this status note.

## Historical October 16–18 checkpoint

**BLOCK — DEPLOYMENT INCOMPLETE OR UNSAFE.** The fresh change set has not been
independently reviewed or executed; current AWS authentication remains unverified.
See the [full October 18 handoff](phase4d-provider-recovery-handoff.md). The owner authorized
a narrow correction of the two demonstrated provider failures, one ordinary
removal of the exact failed stack after fresh guards, and one new reviewed
CREATE deployment attempt. Phase 4E remains deferred.

## Qualified source correction

Only `infra/lib/operations/operational-guardrails.ts` and
`infra/test/operations.test.ts` change infrastructure source. The budget metric
is now `UnblendedCost`, matching the case-sensitive AWS Budgets service contract.
The regression checks rendered templates in both environments and both email
selections, and rejects the old spelling and invalid metric cardinality.

The monthly USD10 budget, Project AND Environment filter, blank notification
email, dashboard, five alarms, IAM, resource dependencies, tags and lifecycle
policies are unchanged. Other budget properties were checked against current
provider documentation without speculative changes. Staging and production
synths and an account-bound staging synth differ only at the budget metric.
There are still 25 declarations and 22 selected resources with blank email.

Infrastructure qualification passed: typecheck, 122 unit tests, four real-artifact
offline CLI tests, schema parity for both environments and isolated synths with
zero network attempts. The bound staging template is 42,914 bytes, SHA-256
`106222638171615bfdedaa1e99f612381c6dfcc4c105ac22aec05a1f359aa21d`;
its new asset key is that digest plus `.json`. The old published template remains
historical failed-deployment evidence and must not be reused as corrected.

The canonical Linux ZIP remains SHA-256
`4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`.
Its existing S3 object must be freshly verified and reused; a new exact-revision
CI artifact must independently prove byte identity before deployment.

## Credential and recovery gates

Official Amplify guidance still specifies the regional GitHub App plus a classic
PAT with `admin:repo_hook`. Read-only GitHub settings review confirms the installed
us-east-1 App still selects only xiolest1/HireFlux. One classic token named
“HireFlux AWS Amplify Staging” is listed with only that scope, expiry October 22,
and “Never used.” Metadata alone does not establish the prior 401 cause or prove
the entered value was valid. The owner later clarified that the original value
was unavailable; the authorized one-token replacement path is recorded below.

A separate owner-terminal candidate validates strict classic format, intended
identity, exact scope, finite expiry and repository administration using two
read-only GitHub requests. It can pass the same verified in-memory value through
the unchanged anonymous-pipe preparation bridge. No secret is accepted through
chat, argv, environment or files; raw responses and exceptions are suppressed.
Offline tests exercise Windows hidden input, controls, failure responses and
single preparation. Existing fourteen secret-flow groups remain passing.
The owner could not recover the original token and cancelled the first new
prompt without entering a value. One expressly authorized replacement was then
created personally. The same frozen helper validated its format, authenticated
owner, exact hook scope, future expiry and repository administration before
preparing the CREATE change set; exit 0 and PREPARED_REVIEW_ONLY were recorded
at 16:39:21 UTC on October 16. No token value was printed or saved in local files.
Amplify provider acceptance remains pending actual execution.

Source correction is committed and pushed as
`6396f89e8a5eccc7f21b5f699833dd85a1e48409`. All five jobs passed in run
`38930507231`, attempt 1. Official artifact `12059180559` matches GitHub's outer
SHA-256 `f71d9095669b8afbde4f5469e44b233c7210260fe72d479b5b3670c2f46af9bc`.
Its ZIP and manifest match canonical files and the previous official artifact;
all 3,756 member hashes and CRCs verified.

Fresh deletion guards passed all 29 checks, preserving sanitized failure events
and proving the exact original stack/eight deleted rows/no surviving resources.
One STANDARD DeleteStack was accepted at 16:20:26 UTC; at 16:21:17 UTC the old
stack is DELETE_COMPLETE and the name is available. No force, Toolkit, asset or
lab deletion occurred. The protected Toolkit/11/version32 and all five bootstrap
role trust/attached/inline sets match the accepted baseline.

One publisher invocation uploaded only the corrected template. A publication-only
local assembly view preserved original manifest/template/metadata bytes and
selected just the template asset; the original deployment assembly stayed intact.
Native offline graph tests prove no ZIP publication node, including after a
failed existence lookup. Version-pinned full-body readback passed. New template
version: `OcNyPz2JzhpIDslH1IceMIts2OnmIcQI`. Exactly three asset versions remain;
the prior ZIP and failed-template versions are unchanged, with no multipart uploads
or delete markers. The Lambda ZIP was not republished.

The original-value prompt was cancelled without token entry. A distinct,
separately reviewed single-use launcher accepted the one owner-created replacement
and returned PREPARED_REVIEW_ONLY. Actual CREATE change-set review, execution and
hosted build verification remain pending; no functional staging deployment is
claimed.

## October 18 resumption after usage limit

The owner accepted refreshed current Bills/Credits/lab baseline and supervision.
HEAD and all five CI jobs are unchanged/green; the official artifact is unexpired.
Fresh GitHub metadata confirms the regional App still selects only HireFlux and
the replacement is classic, only admin:repo_hook, expiring October 23. The old
unused token remains listed through October 22; no automatic revocation occurred.
The browser usage label is not treated as proof of credential validity or failure.

The AWS session expired over the two-day pause. The owner-controlled native login
attempt encountered a browser Bad Request; the owner was guided to use its current
URL in a private window. Its final local receipt records exit 255 at 16:31:12 UTC
/ 12:31:12 EDT on October 18. That attempt has ended unsuccessfully. No auth
URL/code/password was read or stored by the agent. STS must verify a successful
renewal before fresh read-only stack,
asset and lab checks, and every gate must pass before the single authorized
execution. No new deployment invocation has occurred during this resumption.
No automatic retry, force cleanup or workaround is authorized after another
unexpected failure. No Phase 4E tests have begun.

The [October 15 local CLI stop](phase4d-deployment-outcome.md) and
[October 16 provider rollback](phase4d-recovery-outcome.md) remain historical
records. Accepted manual cost thresholds remain USD2 review, USD5 first-week
stop and investigation near unexplained USD1/day, with USD0–5 monthly target
and review above USD10 recurring gross hosting. These are not spending caps.

## October 19 staging deployment and initial build

The owner requested continuation under the existing authorization, completed a
fresh `aws login`, and refreshed Bills/Credits/personal-lab acceptance and
supervision. The October 18 authorization URL was not reused. STS and native
credential-source checks matched the intended non-root identity, account ending
9465, profile `hireflux-operator`, region `us-east-1`.

Qualified source remains `6396f89e8a5eccc7f21b5f699833dd85a1e48409`. Remote main,
all five successful jobs in run `38930507231`, and unexpired official artifact
`12059180559` were rechecked. Canonical ZIP/manifest and corrected bound template
hashes matched the October 18 handoff. There was no source commit/push, new token,
new change set, repeated asset publication, stack deletion or bootstrap action.

The already-prepared `hireflux-staging-provider-recovery` change set
`c07014a8-f8af-4320-b740-3cc1c2307b15` was independently reviewed: exactly 22
expected Adds, exact corrected template, approved bootstrap execution role,
masked PAT/email, blank-email selection, SSM version 32, staging account/region,
STANDARD mode and normal rollback. The placeholder had zero resources and no
competing set. Bootstrap, five role policy/trust baselines, labs, headroom and
three version-pinned asset bodies passed fresh read-only checks.

The single execution completed successfully. Stack UUID
`1ca3a6c0-c980-11f1-87b2-12ffc0bbd847` and all 22 resource rows are
`CREATE_COMPLETE`, with no failed events. All 40 configuration checks passed:
Lambda code/runtime/environment/IAM/reserved concurrency, DynamoDB schema/three
GSIs/TTL ENABLED on `expires_at`, two secret metadata records, API integration,
CORS, throttling and logs, and Amplify repository/branch/public environment.
Five alarms, six dashboard widgets, the USD10 tag-filtered budget using
`UnblendedCost`, no notifications and staging PITR DISABLED match the template.
Actual tags were verified on 18 resources; four have no independent tag property.

Postdeployment bootstrap/role revalidation passed. All three bootstrap-bucket
versions and full-body hashes remained unchanged after execution, without delete
markers or multipart uploads. Scoped inventory has nine log groups, three active
stacks and 15 roles: 13 baseline roles, one application role and the automatically
created `AWSServiceRoleForAPIGateway`. The initial count guard expected 14 and
stopped. Read-only review verified the additional role's exact account/path,
service-only `ops.apigateway.amazonaws.com` trust, single standard AWS-managed
`APIGatewayServiceRolePolicy` v9, no inline policy/boundary/custom tags and creation
during this deployment. This is a documented API Gateway service effect outside
the 22 CloudFormation declarations, not a manual IAM change or generic waiver.
The original STOP receipt remains preserved.

Local read-only verifier assumptions also required correction: Amplify's physical
CloudFormation ID is an ARN, CORS header names are case-insensitive, and the log
destination uses the ARN without `:*`. Separate candidate readers preserved the
frozen originals, API allowlists and all substantive guards. Four positive and
28 negative offline cases passed. No infrastructure/executor was changed.

The initial-build helper made exactly ONE StartJob call after two empty-job reads
and a fresh GitHub main receipt. It returned STOP after the request because its
job-ARN check expected `/jobs/1`, while AWS uses `/jobs/0000000001`. No retry was
made. Independent reads verified job `1` SUCCEED, with BUILD/DEPLOY/VERIFY all
SUCCEED and the exact qualified commit. The actual managed build selected Node
22.23.3, ran `npm ci` and `npm run build`. Its 39-file artifact passed the existing
hosted-build verifier; source maps, private material and local endpoints were
absent. Archive SHA256:
`3064ee6afb706bb3cf09c148f35143b94281afb26c436a085a081ed555da620c`.
Raw logs, signed download URLs and temporary extracted assets were not retained.

Amplify app: `d31vp0nq9fzl6q`, branch `main`.
Configured hosting domain: `https://main.d31vp0nq9fzl6q.amplifyapp.com`.
Configured API endpoint: `https://0z0fpmukik.execute-api.us-east-1.amazonaws.com`.
These endpoints are recorded configuration, not a public-readiness PASS.

The bounded HTTPS reader then returned `BOUNDED_READINESS_REVIEW_REQUIRED`.
Its specific failed assertion was not isolated before the owner requested this
handoff. DNS/TLS/root/assets/headers/SPA fallback/missing-asset/CORS checks are
therefore not collectively certified. No deployment/build retry, resource repair,
backend GET, demo issuance, browser JavaScript/E2E or Phase 4E work followed.

Costs: the owner accepted today's manual baseline. The actual new gross/net bill
was not measured. Prior allowance-dependent estimates remain approximately
USD1.70–2.70/month mostly idle, USD3.30–4.30 for small testing, or USD6–8 if
monitoring allowances are unavailable/consumed. Credits and Free Tier coverage
are not guarantees. Standing secret/alarm/storage charges can continue while
testing is stopped. Preserve USD2 review/USD5 first-week stop, investigation near
unexplained USD1/day and review above USD10 recurring; the USD10 budget has no
notifications or spending cap. Billing tag activation/coverage remains unverified.

**Resume boundary:** inspect the existing successful job/artifact and diagnose
the bounded HTTPS reader's exact failing check using safe read-only projections.
Do not redeploy, rebuild, re-enter a token or reset attempt ledgers. A demonstrated
resource/source fix needs separately reviewed authorization; no automatic retry
or teardown. Enter Phase 4E only after remaining Phase 4D readiness is evidenced,
any security/cost discrepancy is resolved and the owner explicitly starts 4E.
Original 4E–4H scope remains live backend, hosted browser E2E,
operations/scaling/cost and final staging evidence freeze. Runtime effectiveness,
ownership/404/conflicts/expiry, log delivery/privacy, live metrics and cost
acceptance remain pending. The old unused PAT has not been revoked; owner review
and revocation can proceed once its lack of other use is confirmed. No production
or account-plan changes occurred.

Local evidence remains ignored under `.tools/phase4d-provider-recovery/`:
`source-ci-revalidation-20261019.json`, `date-lapse-20261019T151406568293Z/`,
`change-set-review/`, `execution-attempt.json`, `execution-result.json`,
`postdeployment/`, `postdeployment-observability/`, `postdeployment-tags/`,
`postdeployment-inventory-resolution-20261019.json`,
`apigateway-service-role-review-20261019.json`,
`read-only-identifier-correction-20261019.json`,
`asset-postdeployment-20261019/`, `amplify-initial-build/one-attempt.json`,
`initial-build-stop-jobs-20261019.json`, `amplify-build/` and
`https-readiness-stop-20261019.json`. Preserve these on this machine; Git does not
transfer them. The execution and initial-build allowances are consumed.

At handoff, HEAD remains `6396f89`. Existing staged recovery documentation was
preserved; this continuation's outcome/devlog/historical-pointer edits are
uncommitted and unpushed. Additional edits appeared in the dashboard, domain-model
and DynamoDB-access-pattern documents during the session; they were not made or
altered by this deployment continuation. Do not reset or include them casually.
The working-tree whitespace check passed. The cached check reports the existing
staged handoff's trailing blank line; the Git index was not changed to repair it.
