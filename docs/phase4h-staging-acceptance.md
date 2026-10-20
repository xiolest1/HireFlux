# Phase 4H — final staging acceptance and evidence freeze

**October 20, 2026: PASS WITH EXPLICIT QUALIFICATIONS — supervised staging
accepted under documented restrictions.** The evidence supports limited,
owner-supervised private evaluation of the existing fictional demo. The original
Phase 4A–4H staging qualification sequence is complete at this qualified boundary.
This is not full verification of every original live test or production readiness.

Three conclusions remain distinct:

1. The deployed infrastructure and application passed their applicable **bounded**
   Phase 4D–4G checks, subject to the unverified elements recorded below.
2. The owner explicitly accepted those limits, the Settings defect and cash
   funding for this supervised staging decision. No material issue in the saved
   evidence prevents that restricted evaluation.
3. Broader or unattended use requires separate authorization, safeguards and
   evidence. **Additional agent-generated tests remain paused.** This decision
   authorizes no invitations, link promotion, maintenance release or Phase 5.

## Evidence boundary and frozen identities

This review used local source, artifacts and preserved receipts only. It made
**zero AWS/GitHub API reads, hosted requests, builds, deployments or credential
operations**. Authentication was not renewed. Infrastructure/hosting observations
are dated October 19; the root Billing review and cash decision are October 20
(America/New_York). Offline hash checks on October 20 establish local consistency,
not a fresh guarantee against subsequent remote changes.

- Target: AWS account **ending 9465**, **us-east-1**; approved non-root temporary
  profile `hireflux-operator`. Stack `hireflux-staging` was last verified
  **CREATE_COMPLETE, exactly 22 expected resources**.
- Qualified backend/Lambda revision:
  `6396f89e8a5eccc7f21b5f699833dd85a1e48409`.
- Canonical Linux Lambda ZIP SHA-256:
  `4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`.
- Corrected account-bound staging template SHA-256:
  `106222638171615bfdedaa1e99f612381c6dfcc4c105ac22aec05a1f359aa21d`.
- Official CI run **38930507231**, attempt **1**, artifact **12059180559**;
  all five quality jobs passed. Outer artifact archive SHA-256:
  `f71d9095669b8afbde4f5469e44b233c7210260fe72d479b5b3670c2f46af9bc`.
  Its inner ZIP matches the canonical Lambda hash. Recorded artifact expiry is
  **January 14, 2027, 16:15:29 UTC**; this is finite evidence retention.
- Latest previously verified Amplify app **d31vp0nq9fzl6q**, branch **main**,
  **job 2 SUCCEED**, hosted revision
  `d3a8fb1a9b959d4dddbc6d1c32e3eac459b0f945`.
- Job 2 artifact archive SHA-256:
  `4867b5bf5fab0badc3c61730a0b3d6675ff02a1922fc6b1bda3ef5c4d43c0e71`
  (**39 files; 1,600,373 bytes compressed**). Its complete verification is
  receipt-backed; that downloaded archive was removed after verification and was
  not downloaded again. Initial job 1 is separate historical evidence.
- Local HEAD: `2146fc3870f027c3d6d8f06720c46bb0b29b51a2`.
  Committed differences across these three revisions are documentation/guidance
  only. All three have identical Git trees: backend
  `f679ae830a033de5a535f97049f77eae8d6e720e`, frontend
  `2817708809e54c8e2c4b7e64349594bd6bed98b7`, infra
  `678376a6eb381185d0de80253956285f5ffe1ce8`.
  Current working changes are documentation only; no commit or push was made.
- Hosted origin: [HireFlux staging](https://main.d31vp0nq9fzl6q.amplifyapp.com).
  API origin: [staging HTTP API](https://0z0fpmukik.execute-api.us-east-1.amazonaws.com).
  These identify the deployment; they are not an invitation to start testing.

The [sanitized evidence index](phase4h-evidence-index.json) maps evidence IDs to
relative paths, byte lengths, SHA-256 values and L01–L20 coverage. `D*`, `E*`,
`F*`, `G*` and `H*` references below are evidence-index IDs; production findings
use the explicit prefix **finding**.

## Accepted Phase 4D–4G results

**4D — PASS for bounded deployment/HTTPS readiness.** Reviewed corrected
change set: 22 additions, approved execution role, masked credential parameter,
blank email, normal rollback. All 22 resources completed and 40 configuration
checks passed. The actual Lambda code and template matched qualification;
table, scoped runtime IAM, two secrets, API, hosting and operational wiring passed.
The protected standard CDKToolkit, assets and approved broad deployer model were
preserved. The expected API Gateway service-linked role is outside the 22-resource
stack inventory. Seven bounded HTTPS checks established TLS, static entry/assets,
headers, SPA routing, missing-asset behavior and API CORS. [D01–D13]

**4E — PASS WITH QUALIFICATIONS.** Seventy API requests plus two health requests,
three fictional workspaces and one issuance replay exercised authorization,
isolation, conditional conflicts, transitions, archive/restore, notes/interviews,
pagination/cursor scope and persistence. The continuation passed 263 assertions.
Strong projected reads sampled 65 temporary items with correct signed expiry
across five partitions, without Scan. Controlled API correlation was established
across the initial and final bounded reads; neither log pagination nor this sample
is an exhaustive privacy audit. [E01–E05; full limits in the
backend handoff](phase4e-live-backend-verification.md)

**4F — PASS WITH QUALIFICATIONS.** One actual browser workspace exercised the
hosted routes, search/filter/pagination, edits, transitions, follow-up, notes,
interviews, analytics, preferences, reload/history, exit and guarded 404 behavior.
Desktop/tablet/mobile samples at 1280×900, 768×1024 and 390×844 showed no horizontal
overflow; keyboard/modal-focus samples passed. Complete build-artifact verification
and selected served-byte hashes passed. CSV download and reset execution were
not performed; cancelling reset is not reset verification. [F01–F05;
browser handoff](phase4f-hosted-browser-verification.md)

**4G — PASS WITH EXPLICIT QUALIFICATIONS, cash-funded.** Existing metrics showed
268 Lambda/API requests, zero published Lambda errors/throttles and API 5xx,
23 API 4xx, and peak concurrency 4 against reservation 5. Lambda uses 1,024 MB,
15-second timeout and no VPC. API mean/max latency was 151.87/5,771 ms;
Lambda duration mean/max 60.83/2,662.39 ms excludes initialization. These are
low-volume observations, not a capacity guarantee. DynamoDB table and three GSIs
were active, on-demand, with TTL enabled and staging PITR disabled. Sparse absent
DynamoDB error/throttle series do not prove zero errors. Five alarms were OK;
one six-widget dashboard existed. No alarm/SNS/budget recipients are configured.
Public hosting had already received unsolicited probes. [G01–G10;
operations/cost handoff](phase4g-operations-reliability-cost-verification.md)

Historical STOPs are preserved and classified separately from application defects.
The original HTTPS checker incorrectly required script/style paths to live under
`/assets/`, rejecting the valid root theme bootstrap; its minimal correction passed
local positive, negative and tamper cases before the bounded HTTPS PASS. The 4E
runner incorrectly expected ordinary edits to append activity; the service's
existing contract was correct. Browser preflight/CORS reader assumptions were
also corrected without changing the app. Earlier actual provider budget-enum and
repository-credential failures were remedied before the accepted deployment.
The remaining demonstrated application defect is the Settings behavior below;
it was accepted, not fixed. [D03, D12, D13, E07, E08, F06–F08]

## L01–L20 final reconciliation

**PASS** establishes the stated bounded requirement. **PASS WITH QUALIFICATIONS**
records accepted restricted-staging evidence while keeping the named elements
**UNVERIFIED**. **NOT APPLICABLE** means the optional capability was omitted;
it never proves delivery. No unperformed test is upgraded to PASS. The owner's
Phase 4H instruction expressly accepts the prior limitations; this qualified
closure does not silently change the original full live/production test matrix.

1. **L01 — PASS WITH QUALIFICATIONS:** exact CI/source/artifact scope and recorded
   90-day artifact lifetime established. Finding F03 remains open; no permanent
   remote archive or fresh repository retention-policy audit claimed. [D01, D02, H01]
2. **L02 — PASS:** dated non-root identity, staging account and region matched
   the reviewed target. No current-session validity claim. [D04, E01, F02]
3. **L03 — PASS WITH QUALIFICATIONS:** lab context, supervised windows and current
   cash-funded financial acceptance recorded. Exact project spending delta remains
   UNVERIFIED. [D04, G01–G03]
4. **L04 — PASS WITH QUALIFICATIONS:** toolkit version 32, 11 resources,
   termination protection, five role baselines, published assets and scoped runtime
   IAM verified under the approved broad deployer model. Lambda warning/error
   delivery remains UNVERIFIED under L15. [D04, D07–D10]
5. **L05 — PASS:** actual total/unreserved concurrency was 1,000/1,000 before the
   deployment reserved five; required headroom passed. Reservation five was
   verified afterward. This is dated headroom, not a new quota request. [D04, D07]
6. **L06 — PASS WITH QUALIFICATIONS:** HireFlux-only regional GitHub App,
   private credential transfer and successful provider/build use recorded.
   Present PAT state and expiration effects are UNVERIFIED. [D01, D11, D14, F01]
7. **L07 — PASS:** blank optional email and active manual monitoring accepted;
   no recipient inferred. [D05, D08, G01]
8. **L08 — PASS WITH QUALIFICATIONS:** resource tags verified, billing allocation
   keys last observed Inactive. Manual whole-account review is the accepted
   supervised alternative; effective project attribution remains UNVERIFIED and
   unattended use is blocked. [D08, G01–G04]
9. **L09 — PASS:** exact corrected template/ZIP, 22 additions, approved role,
   masked parameters, blank email and normal rollback reviewed. [D02, D05, H01]
10. **L10 — PASS:** all expected resources CREATE_COMPLETE, no failed events,
    40 configuration checks and later unchanged baseline reads. [D06–D08, F02, G04]
11. **L11 — PASS WITH QUALIFICATIONS:** actual role/secret metadata, signing,
    successful health and bad-token 401 passed. Forced cold-versus-warm timing and
    live invalid/unavailable-secret 503 behavior remain UNVERIFIED. [D07, E01–E03]
12. **L12 — PASS:** actual successful build/revision, complete artifact inspection,
    bounded TLS/headers/assets/SPA/404/CORS and browser refresh passed. This is
    neither every file fetched independently from the edge nor every browser.
    [D11–D13, F01–F03, G09]
13. **L13 — PASS WITH QUALIFICATIONS:** bounded backend/browser workflows,
    ownership, API 409 and CORS passed. UI 409 recovery, natural expired-session
    behavior, retry faults, CSV download and executed reset remain UNVERIFIED.
    [E01–E05, F01–F05]
14. **L14 — PASS WITH QUALIFICATIONS:** live schema/TTL configuration and temporary
    item expiry samples passed. Natural signed expiry rejection and physical TTL
    deletion remain UNVERIFIED; delayed cleanup is not authorization. [E04, E05, G04]
15. **L15 — PASS WITH QUALIFICATIONS:** API JSON delivery and all 72 controlled
    request correlations established across bounded reads, with no observed
    credential/content leak. Lambda WARN/error delivery and a complete native
    cross-service ID bridge remain UNVERIFIED. [E05, G05, F05]
16. **L16 — PASS WITH QUALIFICATIONS:** exact dimensions/math/policies, dashboard
    and positive native request/duration/capacity series verified. Fault-series
    publication and alarm delivery remain UNVERIFIED; OK with missing-data policy
    is not failure-path proof. [D08, G04, G05]
17. **L17 — NOT APPLICABLE:** email omitted; no SNS subscription or budget-email
    delivery claim. [D08, G04]
18. **L18 — PASS WITH QUALIFICATIONS:** configured reservation/throttles and bounded
    synchronous behavior were acceptable in the sample. Forced 429, overload,
    scaling, retries and recovery remain UNVERIFIED. [D07, E02, G05]
19. **L19 — PASS WITH QUALIFICATIONS:** budget filters, retained assets/backlog,
    account Billing and human cash/stop ownership recorded. Tags inactive,
    recipients absent, billing delayed and physical cleanup UNVERIFIED. [G01–G08]
20. **L20 — PASS WITH QUALIFICATIONS:** this handoff and index freeze identities,
    results, risks and owner stop/recovery responsibilities. No shutdown/recovery
    drill or permanent off-machine archive was performed. [H01–H03, this document]

## Final risk and qualification register

- **Anonymous issuance / finding F04:** acceptable only within an explicitly
  bounded supervised fictional exercise; **blocker to unattended/broader use**.
  Signed isolation passed the sampled authorization checks, but there is no
  per-IP/global issuance quota. A seed attempts 71 transactions/236 transactional
  update actions. Throttles and concurrency limit rate, not cumulative cost;
  unsolicited traffic can continue during the pause.
- **Authentication/lifecycle:** accepted supervised qualification; natural signed
  expiry rejection, live secret-failure handling and physical TTL cleanup remain
  UNVERIFIED. Do not promise these live fault paths to external users. Broader
  release needs appropriate evidence; real Cognito accounts remain deferred.
- **Diagnostics/operations:** accepted with active human review; unattended use
  is blocked by absent recipients and unqualified failure/overload/recovery paths.
  API log samples passed; Lambda warning/error delivery is UNVERIFIED. The two
  log groups retain diagnostics; five alarms/dashboard and the $10 budget have
  no automatic email warning or shutdown. Retain existing monitoring unchanged.
- **Browser:** sampled integration acceptable; live UI 409 recovery, complete
  network instrumentation and the other L13 limits remain UNVERIFIED. Low-priority
  **Settings defect**: saving an unrelated preference sends unchanged `time_zone`,
  switching detection to manual while preserving the correct zone value. Accepted
  for this review, unrepaired. Future changed-field patch with `expected_version`,
  tests and separately authorized build is maintenance; no infra repair indicated.
- **Public traffic / auto-build / cash:** active supervision required and a blocker
  to unattended use under this acceptance. Public HTTPS/API remain reachable;
  main-branch auto-build is enabled, so even a documentation push may incur a build.
  Cost allocations are inactive and invoices lag. No credit subsidy is assumed.
- **Finding F03:** high tooling dependency denial-of-service advisory remains open,
  accepted only for controlled trusted CDK inputs; absent from deployed application
  dependency graphs. Compatible remediation/recheck is production-hardening work;
  this review does not certify a new dependency release.
- **Findings F07/F08/F10:** future production hardening remains open: backup/restore
  erasure governance and retained-resource ownership; mutable CI action major tags;
  signing-key rotation/overlap and warm-cache lifecycle. Do not rotate casually or
  treat staging Delete/PITR-off policies as production recovery.
- **Finding F11:** working Cognito/production authorization and release remain
  deferred to original Phases 5–7; **blocker to production/persistent accounts**.
  No historical production finding is closed by this staging decision.

The controlled-correlation, latency and retention results address findings
F05/F06/F09 only within these samples. They do not certify retry faults, complete
cross-service tracing or indefinite CI retention. Accepted regional execute-api
CSP scope remains unchanged (finding F13); exact API CORS passed bounded checks.

## Financial decision and continuing cost exposure

October 20 root Bills: **Pending, $0.00 estimated payable/tax, about $1.77 credits
applied**. Net plus credits implies about $1.77 gross at displayed cent precision.
Billing Home separately showed **$1.78 month-to-date and $4.94 forecast** for the
whole account; the one-cent difference is unresolved. EC2 $1.61 and VPC $0.16
lines are outside HireFlux's architecture and consistent with personal labs;
their current running state was not refreshed. These are estimates, not a final
invoice or a proven HireFlux cost allocation. [G01–G03]

Root Credits displayed **$118.07 estimated remaining**, but both grants' details
said **Expired October 6, 2026**. Active-category/history displays disagree.
The owner expressly chose **cash funding with $0 assumed usable promotional
coverage**, retaining the test pause. No new acceptance is requested. Root was
personally signed out and the temporary tab closed; no root session material
was retained. Precise project delta remains unknown with inactive allocation tags.

Gross modeled monthly costs, before tax, labs and unexpected usage: **$1.30–$2.30
idle plus small retained storage; $1.60–$2.60 with maintenance; $3.20–$4.20 for
limited testing** under the original workload assumptions. These are projections,
not invoices or caps. Two secrets contribute about $0.80/month. Fifteen alarm
metric units cost $1.50/month at list, or about $0.50 if ten qualifying shared
free units remain; a qualifying dashboard is expected free. Low log volume fits
observed shared allowances, while storage, builds, requests and outside traffic
can add charges. The 24 underlying dashboard series do not automatically become
24 paid custom metrics. Preserve the existing inexpensive diagnostic configuration;
no architecture or monitoring change is justified by the saved cost evidence.

Pausing deliberate tests leaves hosting, secrets, alarm metrics, retained assets
and public requests chargeable. The **$10 AND-tag-filtered budget** has no
recipients, inactive billing allocation keys when last inspected, and no spending
cap. A filtered zero is not zero total spending. No usable-credit runway or exact
monthly bill has been established. [G04–G10]

## Owner operating and stop checklist

The **repository/account owner** supervises and owns cash exposure, stop decisions
and separately authorized recovery. This checklist is a procedure, not execution
authorization; nothing was restricted or removed during 4H.

1. **Before any separately authorized testing window:** explicitly unpause only
   the agreed scope; set a small named tester/workspace budget counting resets
   and reseeds; use fictional data only; refresh whole-account Bills/Credits/lab
   baseline and ensure a human can stop activity. Do not infer invitations from
   acceptance. Use the existing approved non-root path for any later AWS action.
2. **During active external testing:** inspect basic errors, latency, concurrency,
   issuance and resource usage at the start, during and end of each supervised
   window. Review whole-account Billing at least daily and after unusual traffic
   or a push/build. Billing lags; do not wait for an absent automatic notification.
3. **Review/stop triggers:** review near **$2 incremental gross**; stop first-week
   testing near **$5**; investigate unexplained **~$1/day** growth; review projected
   ongoing charges **>$10/month** before indefinite hosting. These are manual
   thresholds, not caps. Stop deliberate activity/sharing for ownership/auth/privacy
   anomalies, credential leakage, unexplained errors/throttles, sustained latency,
   issuance bursts, unexpected builds/configuration or material cost uncertainty.
4. **First response:** pause intentional requests and link sharing; retain only
   sanitized minimum diagnostics if safe. This does not stop bots or direct API
   access and does not remove fixed charges.
5. **Stronger restriction, separately authorized:** disabling Amplify auto-build
   prevents future push-triggered builds, not existing hosting/storage. Reserving
   Lambda concurrency zero stops executions, not chargeable API rejects, static
   traffic, secrets, monitoring or storage. Review exact target and consequences
   through the [existing stop plan](production-account-readiness.md#aa-rollback--stop-plan).
6. **Shutdown, separately authorized:** removing the API/hosting or staging stack
   is a stronger stop. Stack deletion can delete fictional DynamoDB data, signing
   secrets and log history; staging PITR is off. Secret deletion/session invalidation
   can be irreversible. **Teardown is not a reversible pause.** Protected CDKToolkit,
   delegated roles, versioned S3 asset objects, any ECR contents, GitHub authorization
   and unrelated labs may survive and continue costs. Never automatically delete
   these remnants or use local reset/reconciliation scripts against AWS.
7. **Recovery:** retain evidence, identify the cause and obtain a concrete reviewed
   action scope using qualified versions/hashes. Recreating disposable staging may
   require new signing keys, sessions, deployment and hosting build. Do not reset
   consumed attempt ledgers, assume a backup exists or automatically retry failure.

## Credential maintenance and next-step conditions

Last recorded original classic PAT expiry: **October 22, 2026**; replacement:
**October 23, 2026**. On October 18 the original still appeared unused and no
revocation was recorded. Replacement validation and subsequent provider/build
success are historical, not proof of present validity. Whether its expiration
affects future Amplify integration/builds is **UNVERIFIED**; no failure or continued
operation is assumed. [D14]

The owner should separately authorize review of the original token's remaining
dependencies/revocation and the replacement's expiry before future integration or
build operations. No token value, new PAT, revocation or GitHub permission change
is needed for this freeze, and none was performed. Do not test expiry by triggering
a build. Permanent evidence archival/publication also needs a separate privacy
and auto-build-impact review.

The handoff/index are local documentation edits. Most authoritative receipts,
scripts, screenshots, artifact archives and ledgers are **Git-ignored local
`.tools`/`infra/cdk.out` files**. Another checkout will not automatically contain
them. The job 2 archive is represented by preserved verification receipts, not an
available archive here. Hashes detect differences but do not authenticate AWS,
prove absence of later drift or replace missing files. Prior phase documents and
STOP receipts retain their dated history; this document is the latest decision.

The [index](phase4h-evidence-index.json) and local
`.tools/phase4h/final-disposition.json` record validation and preservation scope.
No evidence was copied externally, committed or pushed. Source/application/infra
trees and consumed ledgers remain unchanged. The owner retains responsibility
for machine-local preservation until separately reviewed archival occurs.

**Next action is an owner decision:** remain paused, authorize one concrete
bounded supervised evaluation window, or authorize maintenance/stop actions
separately. Broader/unattended access requires measured issuance/abuse controls,
effective cost/notification ownership and evidence appropriate to the unverified
auth, lifecycle and failure paths above. This is not authorization to add services
or redesign now. Original **Phase 5 Cognito accounts → Phase 6 production hardening
→ Phase 7 production deployment** remains deferred and unchanged. None starts
automatically from this qualified completion of Phase 4H.
