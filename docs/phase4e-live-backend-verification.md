# Phase 4E — live AWS backend verification

**October 19, 2026: PASS WITH EXPLICIT QUALIFICATIONS for bounded, supervised
staging.** The deployed backend passed the authorized live application checks.
No application defect or AWS-specific contract deviation was found. Natural
signed-session expiry, physical TTL cleanup, live signing-secret failure behavior
and Lambda log delivery remain unverified as described below. This is not
production, load/scaling or browser E2E acceptance. Phase 4F has not started.

This dated outcome supersedes the partial Phase 4E handoff under
`.tools/phase4e/current-handoff.md`. Earlier STOP receipts remain preserved.

## Authorization, baseline and exact source

The owner explicitly authorized Phase 4E and subsequently one additional
fictional workspace after the first runner stopped on a defective assertion.
The continuation used a separate one-run ledger, at most one issuance and 48
sequential requests spaced by at least 0.5 seconds. Neither the first application
test ledger nor the consumed Phase 4D deployment/build ledgers was reset.

Fresh temporary STS identity matched the previously verified non-root operator
exactly: profile `hireflux-operator`, account ending **9465**, `us-east-1`.
No login renewal, static credentials or permission changes were needed.
The owner's accepted October 19 Bills/Credits/personal-lab baseline and supervision
were carried forward; no new credit balance or actual billed total was asserted.

The baseline had exactly 22 expected stack resources, CREATE_COMPLETE and all
40 configuration checks passing. The original live CloudFormation template
matched the reviewed corrected template exactly, with no active or failed change
sets. Final bounded reads reconfirmed unchanged stack identity/update time and
unchanged qualified Lambda code, runtime, role and successful state.

- Qualified Lambda/backend revision:
  **`6396f89e8a5eccc7f21b5f699833dd85a1e48409`**.
- Lambda ZIP SHA-256:
  `4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`.
- Corrected bound template SHA-256:
  `106222638171615bfdedaa1e99f612381c6dfcc4c105ac22aec05a1f359aa21d`.
- Current local/remote main and successful Amplify job 2 revision:
  **`d3a8fb1a9b959d4dddbc6d1c32e3eac459b0f945`**.
  Its six-file change from `6396f89` is documentation only; backend, frontend and
  infra Git trees are identical. An external documentation push triggered job 2;
  this verification did not request it. Job 2's metadata reports success; no new
  hosted-artifact byte comparison or browser acceptance is claimed here.
- API: <https://0z0fpmukik.execute-api.us-east-1.amazonaws.com>.
- Hosted frontend: <https://main.d31vp0nq9fzl6q.amplifyapp.com>.

Lambda remains Python 3.14/x86_64, 1024 MB, 15-second timeout, reserved concurrency
5, no VPC, the approved execution role and expected HTTP API integration. The
table is active, on-demand, has the three accepted GSIs and enabled `expires_at`
TTL. Both signing-secret resources and expected scoped runtime policy passed
metadata checks. CORS remains the explicit hosted-origin allowlist. No
infrastructure, application source, dependency, secret, IAM, deployment or
monitoring configuration changed during Phase 4E.

## Observed API behavior against the accepted contracts

There were **70 API requests and two health requests** across both live runs.
Every HTTP result matched its expected status. The original runner's separate
semantic assertion error is explained below. The continuation passed all **263
live assertions**, including response, behavior, persistence and log guards.

- **PASS — runtime and permitted secret access.** Both health requests returned
  200 with the exact safe body and matching request ID. The deployed handler
  resolves both signing secrets when constructing its application; actual signed
  demo issuance and valid signed pagination operated successfully. This supports
  effective execution-role access to both secrets and functioning codecs.
  The operator made no GetSecretValue call, retrieved no signing values and
  did not claim a fresh Secrets Manager read on every warm invocation.
- **PASS — authentication and isolation.** Missing, malformed and wrong-scheme
  credentials returned safe 401 responses; a changed session signature was
  rejected. Two original workspaces had distinct verified owners. Foreign and
  missing application GETs returned the same 404 envelope; a foreign PATCH also
  returned 404. Tokens existed only in process memory and were never recorded.
- **PASS — issuance and pagination.** Signed sessions had a 24-hour lifetime
  with matching response expiry. One replay of the same issuance idempotency key
  returned the identical session. Real list pages were disjoint. Tampered,
  foreign-workspace and wrong-query-scope cursors returned 400. No retry storm or
  duplicate-workspace issuance was used to test retry behavior.
- **PASS — application persistence and validation.** Fictional application
  creation/read/update succeeded and responses validated against the accepted
  schema. An ordinary title edit advanced the version without inventing an
  activity event. Client-supplied ownership and general-edit status changes were
  rejected with 422. Leaving DRAFT without `applied_date` returned the contract's
  409 policy conflict.
- **PASS — optimistic concurrency and required activity.** Stale application,
  note and interview writes returned 409. After a stale application update, the
  canonical response and activity were unchanged. A valid DRAFT-to-APPLIED
  transition advanced the version and added its required activity together.
  These are observed conditional/transaction outcomes; no mid-transaction fault
  or infrastructure failure was deliberately injected.
- **PASS — status policy and archive semantics.** INTERVIEW-to-OFFER succeeded;
  REJECTED-to-INTERVIEW returned 409; the intentional REJECTED-to-OFFER correction
  succeeded. The historical first-offer timestamp survived later changes. The
  application DELETE alias archived rather than erased. Restoration to the wrong
  status returned 409; restoration to the exact prior OFFER status succeeded.
  Repeating the current status left the response, version and activity unchanged.
- **PASS — related resources and follow-ups.** A note was created, updated,
  retrieved and deleted through its supported API. An interview was created,
  updated, canceled and retrieved. Follow-up rescheduling preserved the calendar
  date, completion cleared it, and repeated completion was an idempotent no-op.
- **PASS within the exercised paths — indexes and projections.** Ordinary list
  pagination, status-filtered membership, dashboard and analytics succeeded
  through the real table. The unchanged adapters map these to GSI1, GSI2 and
  schedule/GSI3 access paths; baseline schemas/projections matched. The added
  application appeared in its OFFER index query. This is not an exhaustive
  validation of every index item or dashboard denominator scenario.
- **PASS within the sample — response privacy and correlation.** Expected
  errors used the established envelope with matching request ID and no observed
  AWS exception/stack trace/credential disclosure. Every checked response had
  the explicit staging CORS origin and matching X-Request-ID. Intended token and
  cursor responses were consumed in memory, never copied into evidence.

Observed API status totals: 43 × 200, 8 × 201, 1 × 204, 3 × 400, 4 × 401,
3 × 404, 6 × 409 and 2 × 422. This includes the idempotent issuance replay;
201 count is not the number of newly created workspaces.

## DynamoDB, expiration and diagnostics

**PASS — bounded real persistence/TTL samples.** Five strong projected Query
reads returned 65 distinct sampled items across the original two owner partitions,
the continuation owner partition and the two added application partitions. Every
sample had exactly its workspace's signed expiration timestamp; no sample was
truncated. The added records' canonical status/version and required activity were
observed through the API and strong DynamoDB reads. A separate three-item strong
read diagnosed the first assertion error. There were no Scan calls, operator
DynamoDB writes, table resets, hard workspace deletion or recovery-history changes.
Not every seeded application's partition was inspected.

**UNVERIFIED live — valid signed expiry and physical deletion.** No valid token
was held for 24 hours, no clock was altered and no signing key was retrieved to
manufacture expiry. Signed expiry, rather than delayed TTL deletion, remains the
authorization boundary. Enabled TTL and sampled timestamps do not demonstrate
either natural token rejection at the boundary or eventual physical deletion.
The owner explicitly allowed this bounded-session qualification to remain open.

**PASS within bounded samples — API logs.** Five small FilterLogEvents calls
were used across the two runs and final observation, with a 100-event ceiling per
call and restricted time windows. Original reads correlated the 22 initial API
requests and two health requests; a later read correlated all 48 continuation
requests. Only allowlisted operational fields were retained. Credential/token
patterns and the private test-content marker were absent from the sampled
messages. No raw log messages, private payloads or Insights queries were saved.
Some responses advertised pagination; no exhaustive log-history inspection is
claimed. All 72 controlled requests were correlated across these bounded samples.

**UNVERIFIED — Lambda log delivery.** Both bounded Lambda log reads returned no
events with ApplicationLogLevel/SystemLogLevel WARN. This is consistent with
successful requests and does not prove delivery or privacy for hypothetical
future Lambda errors. No deliberate outage or warning was generated merely to
produce an event. API diagnostics are demonstrated; Lambda error delivery remains
a qualification for operations work.

**UNVERIFIED live — unavailable/invalid signing secret.** Resources or IAM were
not broken to force this path. The focused local Lambda/session/cursor suite
passed 53 tests, including sanitized secret failures, invalid secret material,
expiry rejection and cursor binding. Those tests support the implementation,
not live fault injection. Existing deprecation warnings were reported and no
dependency changes or suppressions were introduced.

## Runtime measurements and test-data retention

The first two health client wall times were **3653.30 ms** and **95.64 ms**.
Across 70 API requests, client minimum/median/maximum was **64.79 / 106.935 /
5906.52 ms**. The three actual demo issuances took **2725.56 / 2604.92 /
5906.52 ms**; the same-key replay took **126.68 ms**. These small sequential
samples include network, API Gateway and Lambda work. They are not p95/SLO,
concurrency, cold-start or capacity guarantees. No environment recycle was forced.

Exactly **three fictional workspaces** were created: two initially and one
explicitly approved recovery workspace. Normal seeding creates 30 fictional
applications per workspace plus related sample entities. Two additional
applications, one additional note and one additional interview were created by
the tests beyond those normal seeds.

- Workspace A: `84a6fbd6-8f34-4966-bbe7-7f3b388aaa6a`, signed expiry
  **2026-10-20 16:31:33 UTC**. Added application
  `7efe5ba0-8bfb-4ba5-a694-429b2b525e3d` remains **DRAFT, version 2** because
  its session token disappeared when the first runner stopped. No additional
  note or interview was created in that run.
- Workspace B: `0b2cd1cd-36ef-47fa-9672-c9b3a90377e5`, signed expiry
  **2026-10-20 16:31:37 UTC**. Only its normal seed data remains.
- Workspace C: `8e4f7906-056c-49e1-a121-192757a1c8e2`, signed expiry
  **2026-10-20 16:44:33 UTC**. Added application
  `a0206dea-0e67-4088-8e39-55c1785e6583` is **ARCHIVED** with history preserved.
  Interview `dc521ab2-fdd6-4313-b54e-11f25e913f10` is **CANCELED**.
  Note `bfa031f8-ee35-442f-86ad-67ea79edd5c6` was API-deleted and its empty
  note list verified. Retained application/interview/activity and seed records
  have workspace TTL; physical deletion is eventual, not claimed complete.

No session tokens or idempotency keys remain available for resuming those
workspaces. Do not recover them from logs, retrieve signing keys, bypass auth or
reset a ledger to repeat this test. The generic cleanup sentence in the original
inventory described intended retirement, not an achieved archive in workspace A;
the actual states above control the handoff.

## Verifier stop, correction and preservation

The original live runner stopped after 22 API requests at
`update_and_activity_atomic`. It incorrectly expected a generic activity event
from a title edit. Source shows ordinary details use `replace_details`; required
activity belongs to transition/follow-up paths. A strong read showed version 2,
DRAFT and only APPLICATION_CREATED, exactly as the accepted contract requires.
Root-cause confidence is high: source, real persistence and a corrected full
local sequence agree. No application/source repair was made.

The original runner, its 121 passing assertions, defective assertion, STOP receipt
and one-run ledger remain intact. A separate corrected candidate used a separate
directory/ledger, tested the real transition/activity contract and expected
409 for policy conflicts versus 422 for schema violations. It passed 48 local
requests/256 assertions against real services with Moto, no external network or
real AWS calls. The owner then authorized one additional live workspace.
The exact qualified runner SHA-256 was
`e11df513595c00ede7c1986780d919eef3dc1439c54531bfe6fb31dc360db771`.
Its one live execution passed 48 requests/263 assertions, including the added
persistence/log guards. No mutation was automatically retried.

## Costs, remaining risks and Phase 4F entry

Observed activity was 72 HTTP requests, four issuance requests including one
replay, three real seeds, small projected DynamoDB reads and bounded log reads.
Each seed performs many underlying transactions; these HTTP totals are not write
capacity or billed-charge measurements. **Actual incremental gross spend and
current credits remain unmeasured.** No infrastructure, paid monitoring feature,
new service or build was requested by this verification. The documentation push's
automatic job 2 is an observed repeat-build consideration, not a requested test.

Keep manual review near **USD2 incremental gross spend**, first-week stop near
**USD5**, and investigation of unexplained growth near **USD1/day**. The existing
USD10 budget has no recipients and is not a cap. Current tags do not prove
activated cost-allocation coverage. The accepted low monthly cost objective and
prior cost checkpoint are unchanged; these bounded results do not establish a
new monthly price, Free Tier entitlement or credit-coverage guarantee.

Inherited production findings **F03/F04/F07/F08/F10/F11 remain open**: the
recorded CDK tooling advisory, anonymous issuance/cost amplification, retained-data
and restore governance, mutable CI action tags, signing-key rotation/cache
lifecycle and real production authentication/release. Their current remediation
status was not re-audited here. No unattended public or production launch is
accepted by this outcome.

**Phase 4F entry conditions:** the owner explicitly starts hosted browser E2E
and accepts the bounded Phase 4E result with the unverified items above; an
accepted supervised Billing/lab window remains current; the hosted frontend
revision/API origin is confirmed for the then-current build (observed job 2 is
`d3a8fb1`, not a new Lambda deployment); and any intervening source, deployment,
security or cost discrepancy is resolved. No additional backend build/deployment
is justified by the checks performed. Natural expiry and Lambda delivery must
remain labeled unverified until directly observed, not silently promoted to PASS.

Preserve the original roadmap: **4F hosted browser E2E; 4G operations/scaling/cost;
4H final staging evidence freeze**. Each requires its own authorized scope.

## Evidence and documentation checks

The Git-ignored `.tools/phase4e/` directory holds sanitized evidence and exact
hashes in `final-disposition.json`, including:

- `baseline/summary.json`, `source-baseline.json`, `stack-source-check.json`;
- `health.json`, original `http-journal.json`, `backend-summary.json`,
  `api-run-once.json`, `edit-activity-diagnosis.json`;
- `initial-readonly-observations/`, `harness-correction.json`,
  `continuation-authorization.json`;
- `continuation/api-run-once.json`, `http-journal.json`, `backend-summary.json`,
  `dynamodb-observations.json`, `diagnostics.json`, `test-data-inventory.json`;
- original `test-data-inventory.json`, `final-readonly-observations.json` and
  `final-disposition.json`.

The final disposition verifies the original ledger hash is unchanged and the
live runner matches the qualified hash. Evidence is local and is not transferred
by Git alone. No raw API bodies, signing values, bearer tokens, PATs, credentials
or raw log messages were added to reports. No application code changed, so full
application rebuilds were unnecessary. The local runner qualification, focused
53-test suite, bounded live checks and documentation diff/link/evidence checks
are the relevant validation. Unrelated dirty files were preserved; no commit or
push was made.
