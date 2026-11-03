# HireFlux — Phase 7B Batch 2: Demo Admission & Cleanup Protection Implementation

November 3, 2026 — local implementation and qualification only.

## A. Executive result

**BATCH 2 LOCALLY QUALIFIED — UNCOMMITTED / UNPUBLISHED.**

New Demo creation now requires a finite atomic admission decision in the existing
table. An operator pause stops new reservations while existing Demo credentials,
valid READY replay and Personal Accounts remain independent. Failed provisioning
cleanup requires the exact FAILED reservation and conditional item deletion;
unproved or incompatible records remain intact for TTL or later operator review.

Final qualification: **810 backend tests**, **672 frontend tests / 68 files**,
affected lint/format/type checks, isolated frontend build and artifact scan pass.
There are no outstanding test failures. The simulator, orphan-namespace and
retained-failure replay qualifications below remain explicit.

No live AWS, hosted traffic, real identities, cloud changes, release packaging,
commit, push or Batch 3 operation occurred. This does not establish production
readiness or authorize deployment.

## B. Baseline and preservation

The original pre-Batch-1 commit was
`efcd8afddcde93103637c6476a632245c431a141`. On starting this task, the checkout was
clean at `ff1ecad2db564c0a9781dc922646f1c398224873`, titled
`7B: Batch 1 - Shared production trust`. Its 24 changed files exactly matched all
24 accepted Batch 1 SHA-256 entries. The intervening commit already existed;
this task did not create it or infer who published it. No remote was contacted.

Recorded `.tools/phase7b-batch2-20261103/starting-baseline.json` before editing.
All Batch 2 changes are relative to that clean local commit. No reset, checkout,
stash, rebase or discard was used. Batch 1 source behavior, new source files,
handoff and ignored qualification evidence were preserved. Current docs and two
relevant Batch 1 files gain explained Batch 2 changes below; the historical Batch 1
report/receipt is not rewritten. Its 662 frontend tests remain in the passing suite.

## C. Files changed

New production source:

- [demo_admission.py](../backend/src/hireflux_backend/application/demo_admission.py):
  typed bounded policy, default limits, validation, UTC windows and capacity policy.
- [demo_cleanup.py](../backend/src/hireflux_backend/infrastructure/dynamodb/demo_cleanup.py):
  bounded inventory, reservation proof and conditional failed-Demo deletion.

Modified production source:

- [demo_sessions.py](../backend/src/hireflux_backend/application/demo_sessions.py):
  required deployed idempotency, reuse before control reads, policy decision before
  reservation/seed, and cleanup only after a confirmed FAILED transition.
- [ports.py](../backend/src/hireflux_backend/application/ports.py): explicit replay,
  policy-read and admission/reservation contracts; cleanup takes original reservation.
- [errors.py](../backend/src/hireflux_backend/application/errors.py) and
  [error_handlers.py](../backend/src/hireflux_backend/api/error_handlers.py): private
  pause/quota/unavailable/uncertain envelopes and bounded quota wait.
- [app_factory.py](../backend/src/hireflux_backend/app_factory.py): explicitly
  scope finite missing-policy compatibility to local/test; no startup control I/O.
- [models.py](../backend/src/hireflux_backend/domain/models.py): optional immutable
  reservation ID on DemoWorkspace, compatible with legacy READY decoding.
- [demo_workspace_repository.py](../backend/src/hireflux_backend/infrastructure/dynamodb/demo_workspace_repository.py):
  strong reconciliation, policy/counter CAS transaction, collision guards, protected
  lifecycle transitions and cleanup delegation.
- [workspaceSessionController.ts](../frontend/src/auth/workspaceSessionController.ts):
  retain the same operation key through uncertain/unavailable admission results.

New tests:

- [test_demo_admission.py](../backend/tests/integration/test_demo_admission.py):
  70 transaction, concurrency, policy, counter, replay and fault cases.
- [test_demo_admission_api.py](../backend/tests/integration/test_demo_admission_api.py):
  21 API/service, collision, failure and identity-independence cases.
- [test_demo_cleanup.py](../backend/tests/integration/test_demo_cleanup.py):
  49 cleanup/collision/mutation/bounded-progress cases.
- [DemoAdmission.test.tsx](../frontend/src/auth/DemoAdmission.test.tsx):
  10 explicit retry/reset/identity/error regressions.

Existing tests updated:

- [test_demo_sessions.py](../backend/tests/integration/test_demo_sessions.py):
  prove exact retained legacy-counter contents/TTL instead of requiring unsafe deletion.
- [test_workspace_bootstrap.py](../backend/tests/integration/test_workspace_bootstrap.py):
  independently assert replay-retention TTL and unchanged signed data deadline.
- [test_cognito_accounts.py](../backend/tests/integration/test_cognito_accounts.py):
  explicit synthetic production policy/key setup for existing mixed-production
  isolation/outage cases; original ownership/concurrency assertions remain.

Documentation: [access patterns](dynamodb-access-patterns.md),
[backend README](../backend/README.md), [frontend README](../frontend/README.md),
[architecture index](architecture.md), [roadmap](roadmap.md), [devlog](devlog.md)
and this handoff. No dependency, infrastructure or generated release file changed.
Batch 2 totals **24 files: 17 modified and 7 new**, relative to `ff1ecad`.

## D. Admission-control architecture

**Policy record:** `PK=DEMO_ADMISSION#CONTROL`, `SK=POLICY`. Exact schema:

```json
{
  "PK": "DEMO_ADMISSION#CONTROL",
  "SK": "POLICY",
  "entity_type": "DEMO_ISSUANCE_POLICY",
  "schema_version": 1,
  "enabled": false,
  "version": 1,
  "daily_limit": 10,
  "minute_limit": 2
}
```

This is a future reviewable paused initialization shape, not an executed write.
No policy TTL or GSI fields are allowed. `enabled` is a real boolean; version is
an integer 1–2,147,483,647; daily limit is 1–1,000; minute limit is 1–60. Nonintegral,
boolean-as-number, missing, corrupt and unsupported fields fail closed. Upper
validation bounds are not approved operating limits: any increase above 10/2
needs separate owner/cost review. Clients supply none of these fields.

**Buckets:** `PK=DEMO_ADMISSION#DAY#<UTC-midnight-epoch>` or
`DEMO_ADMISSION#MINUTE#<UTC-minute-start-epoch>`, `SK=COUNTER`. Each has explicit
entity type, numeric window start/length, integer nonnegative `used`, and numeric
TTL exactly window end + 172,800 seconds. One server clock reading supplies the
admission's UTC windows and session issuance time. These are fixed windows, so
adjacent-window bursts are possible. Counter removal is eventual and cannot
depend on prompt TTL cleanup.
[AWS TTL guidance](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ttl-expired-items.html)
also distinguishes expired-but-pending items from authorization decisions.

Control/bucket keys are outside ordinary user partitions and all customer GSIs,
manifests, lists, exports and erasure. No Scan, new index or table is introduced.

**Default behavior:** staging/production require an Idempotency-Key and missing
policy is paused. Local/test alone use an enabled finite 10/day, 2/minute fallback
while the control record is absent; its transaction also checks continued absence.
A local explicit policy overrides that fallback. No enabled control record is
created automatically in any environment. Configuration GET and application
startup do not read or initialize policy. No public administrative route exists.

**Normal keyed admission transaction: 18 distinct actions.**

1. One policy ConditionCheck: enabled, schema, version and both limits still match;
   local compatibility instead checks policy absence.
2. Two conditional counter Updates: the validated observed count/period/TTL must
   still match, or the bucket must still be absent on first use.
3. Thirteen absence checks: PROFILE, SETTINGS, WORKSPACE_QUOTA, FUNNEL and all nine
   status counters, preventing seeding from modifying partial durable roots.
4. One conditional PROVISIONING workspace Put, plus one conditional replay Put.

Strong counter reads validate types and retention before constructing CAS updates.
Capacity decisions live in the application policy; DynamoDB conditions live in
the adapter. No profile or seed write runs until this transaction reports success.
Snapshot conflicts may safely deny an otherwise available slot; there is no
automatic mutation retry. An explicit retry uses the same key and current state.

The transaction stays well within the documented action limit and targets no item
twice; AWS enforces its atomicity/size limits. Those are service guarantees relied
on by the design, not live measurements from Moto.
[AWS TransactWriteItems](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
documents atomic all-or-nothing writes, 100 distinct actions and 4-MB aggregate size.

**Pause ordering:** an already committed reservation may finish seeding. A pause
committing before a later reservation defeats its version/enabled/limit condition.
The operator contract requires monotonic version increments and never resetting
current counters. Direct control writes remain future authorized operator work.

**Replay and ambiguity:** strong primary reads first resolve existing keys.
READY returns the original identity/token deadline without seeding or a slot;
PROVISIONING returns 409/in-progress; FAILED returns 409 while its matching lifecycle
is retained; expired authorization returns 409 without extending it. New replay
records last original expiry + 24 hours, independently of the session deadline.
Legacy valid READY records retain their old retention/deadline semantics.

Each write call has one SDK transaction token/payload. It supplements, rather than
replaces, durable application replay state. SDK retry idempotency lasts ten minutes.
[AWS's token contract](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
requires identical request parameters within that interval.

Lost/unknown responses trigger bounded strong reconciliation, never another write
or permission to seed PROVISIONING. No-key deployed requests are rejected before
admission; local no-key ambiguity fails without a replacement. A failed seed consumes
its slot, with no refund. Missing cancellation reasons are not treated as proof of
quota failure. Only confirmed current pause/quota becomes expected denial; unknown
outcomes preserve the key and return unavailable/uncertain.

Retention qualification: after a shortened FAILED workspace marker is eventually
removed but its replay record remains, same-key resolution fails unavailable rather
than recreating work. This is safe retention, not automatic recovery. It does not
extend data access. Unsupported deletion/corruption of replay evidence cannot be
treated as proof that a historical key was never used.

## E. Failed-Demo cleanup protection

Previously, absence of WORKSPACE could permit reservation over partial durable
metadata, followed by unconditional BatchWrite deletion by owner prefix after a
profile/seed failure. Public callers cannot choose generated UUIDs; no live breach
or practical collision exploit was demonstrated.

Reservation now rejects existing root records and discovers known application
collisions through bounded GSI presence checks. Known roots are conditionally
absent in the admission transaction, including counters that seeding may update.
The workspace stores a random immutable `reservation_id` and original
`data_expires_at`. State changes compare exact owner, hash, reservation, issuance,
expiry and PROVISIONING state, rejecting durable/lifecycle marker additions.

Only a confirmed FAILED transition authorizes cleanup. The original reservation
object remains the authority even when the failure marker's TTL is shortened.
Cleanup requires exact FAILED marker provenance; legacy markers lacking it remain.

Candidates come from strong USER/application partition queries and known created
IDs. GSI2 is eventual discovery only, followed by primary-table inspection. Each
eligible deletion is its own two-action transaction: unchanged FAILED marker check
plus conditional item deletion. It checks expected entity/key/owner, exact numeric
original temporary expiry, present snapshot attributes and absent known incompatible
ownership/lifecycle markers. Changes to ownership, expiry, version or compared
metadata cause rejection. No unconditional BatchWrite fallback remains.

Allowed existing mappings include profile/settings and owned application/activity/
note/interview/context records. Legacy counters and RESOURCE_QUOTA without explicit
owner provenance remain with their original TTL, as do missing/malformed/foreign/
durable items. No record is rewritten to become eligible. The whole cleanup is
not atomic: safely committed earlier deletes may remain after a later conflict.
Repeated cleanup inventories only remaining eligible records.

Limits: 64 query calls, 500 inventoried items, 30 application partitions and 250
deletions, with a three-second monotonic budget checked before each I/O. An already
in-flight request still depends on existing SDK/Lambda timeouts; three seconds is
not a guaranteed wall-clock ceiling. Timeouts, partial inventory, conflicts or
throttling stop cleanup and leave safe TTL remnants. This never invokes durable
erasure, provider deletion or a broader administrative path.

AWS does not support per-item conditions in BatchWriteItem; the new conditional
transaction path is deliberate.
[AWS BatchWriteItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html)
documents that limitation.

**Precise namespace limit:** strong root checks and GSI presence discovery cannot
prove that every orphan-only child partition is absent. There is no atomic GSI
absence check. Normal durable roots and forced known orphan fixtures are protected;
an entirely orphaned, GSI-invisible namespace remains a pre-existing theoretical
UUID-alias limitation of the unchanged owner-key model. We do not claim universal
namespace-emptiness proof or introduce a Scan/key migration to suggest otherwise.
Deletion authorization remains conditional on actual temporary provenance.

## F. API and frontend compatibility

The single existing `POST /api/v1/demo-sessions` remains. Responses use the existing
safe envelope and request ID:

- New admission or valid READY reuse: existing **201** session response.
- Explicit/default pause: **429 DEMO_ISSUANCE_PAUSED**, no invented Retry-After.
- Known exhausted window: **429 DEMO_QUOTA_EXHAUSTED**, bounded 1–86,400-second
  Retry-After and matching `details.retry_after_seconds`.
- Invalid/unreadable policy/counter or confirmed transaction failure:
  **503 DEMO_ADMISSION_UNAVAILABLE**.
- Unconfirmed write/lifecycle outcome: **503 DEMO_ADMISSION_UNCERTAIN**.
- PROVISIONING: existing **409 DEMO_PROVISIONING_IN_PROGRESS**; confirmed FAILED/
  expired replay: **409 CONFLICT**; missing/invalid deployed key: **422**.
- A seed failure with a confirmed FAILED transition retains existing **503
  PERSISTENCE_UNAVAILABLE** behavior. An unconfirmed failure transition cannot
  authorize cleanup or a replacement and uses uncertainty instead.

Intentional denial does not manufacture a backend 5xx incident. Genuine control
failure stays 503. Internal keys/conditions, raw request keys, tokens and personal
attributes are not disclosed. The frontend presents existing safe error UI rather
than adding a policy reader, polling loop or unverified countdown. It does not
consume Retry-After, so no CORS exposure change is required here.

The controller retains a key across network, in-progress, uncertain and unavailable
admission failures, including uncertainty followed by a reconciliation read outage.
Retries are explicit. A rejected reset restores only its still-valid previous Demo
and original deadline. An expired Demo is not restored. A failed deliberate Personal
to Demo switch never resurrects cleared Personal credentials or silently downgrades
authentication. Dirty consent, generation fences and cache clearing remain.

Existing valid Demo reads/writes and Personal bootstrap/CRUD/export do not consult
issuance policy. Tests prove both remain usable through pause/control-read failure.
Cognito registration defaults and the public trust binding remain CLOSED; no live
registration state was read or changed.

## G. Testing evidence

Final results, using existing installed Python 3.13.15 and Node 22.20.0 tools:

- New admission repository suite: **70 passed**.
- New API/service suite: **21 passed**.
- New conditional cleanup suite: **49 passed**.
- New frontend denial/retry suite: **10 passed**; its broader focused run also
  retained the existing session/configuration/landing regressions.
- Final admission + bootstrap/lifetime recheck: **106 passed**.
- Final full backend: **810 passed**, one existing Starlette/httpx deprecation
  warning, **191.51 seconds**.
- Full frontend: **672 passed / 68 files**, **135.48 seconds**, two workers. One
  existing jsdom unsupported-document-navigation notice; no test failure summary.
- Ruff: **PASS**; format: **133 files correct**; Mypy: **82 source files, PASS**.
- Full frontend ESLint and TypeScript: **PASS**.
- Isolated production-mode Vite build: **PASS**; existing artifact verifier:
  **45 files**, expected public URLs, no maps/private material/local endpoints.
- Final diff and documentation/source evidence checks: **PASS**.

Concurrency tests preserve concurrent preliminary reads and serialize only Moto's
complete mocked transaction, following the established fixture. They prove the
application protocol against atomic mock execution, not AWS conflict timing.
Deterministic injected cancellation/conflict/throttle/read failures, before-commit
timeouts, lost committed responses, malformed success replies, disappearing replay
records and pause/version races supplement normal Moto behavior. Full serialized
records, not counts alone, are compared for collision/mutation preservation.

Forced cases include ACTIVE durable roots, profile-only/settings-only/legacy counter
roots, durable applications/support, post-reservation incompatible profile insertion,
mid-seed failure, failed FAILED transition, stale GSI discovery, delete conflicts,
changed owner/expiry/lifecycle markers, partial cleanup, repeats and expired items.

Issues found and resolved: malformed transaction success replies initially granted
new work; malformed decoded items leaked an internal exception; lifecycle updates
initially lacked exact owner/hash guards. Tests exposed each and retain the corrected
assertions. Early cleanup expectations were updated to prove exact safe retention;
the lifetime regression now distinguishes operational replay TTL from authorization.
One frontend lazy-route fixture needed an awaited selector, without UI workaround.

The first full backend run was **806 passed / 4 failed**: three tests had loaded the
previous unavailable-versus-uncertain expectation while their corrected assertion
was being finalized; the fourth was the old replay TTL assertion. After focused
qualification, a fresh full run passed all 810. Initial targeted runs and the first
full-run log remain in the task record; failures are not presented as original passes.

No DynamoDB Local instance or Docker image was added. AWS documents that DynamoDB
Local does not emit real transactional conflict exceptions; injected failures are
necessary even with a second simulator.
[AWS local limitations](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html)
support that qualification. No live SDK retries, latency, IAM permissions, TTL
delivery timing, throttles or production capacity were proven here.

## H. Source and infrastructure boundary

No new AWS service, table, GSI, ownership namespace, public admin route, subscription
or dependency was introduced. The physical schema remains unchanged. New operational
records and additive Demo reservation provenance are documented source contracts;
existing Personal records are not migrated. Existing valid legacy READY sessions
keep their original deadlines, and unproved legacy failed remnants are retained.

CDK, CloudFormation, hosting headers, Cognito settings, release reviewers and old
artifacts are untouched. No account login, credential review or Billing activity
occurred. Batch 1 exact trust, mandatory production Cognito and the Phase 6 product
experience remain. The current backend source needs a newly qualified release ZIP
later; existing accepted ZIPs cannot be relabeled as this candidate.

## I. Local qualification and cost impact

Normal new keyed issuance performs 14 bounded discovery/control reads/queries:
one replay GetItem, one policy GetItem, two strong counter GetItems, one strong
owner-root Query and nine single-status GSI presence Queries. It then performs the
18-action admission transaction, existing seed operations, and the existing final
lifecycle transaction. These are logical normal-path calls, excluding SDK internal
attempts, not measured billed units or live prices.

READY reuse takes two strong primary reads and no new budget/seed. A new paused
request normally needs only replay/policy reads. Known quota denial reads counters
before namespace discovery and does one final same-key reconciliation where needed;
it does not perform the ten namespace Queries. Failure cleanup adds bounded work
only on a proved FAILED reservation. This is a modest per-admission overhead chosen
to bound much larger repeated seed work and protect shared durable data.

The 10/day and 2/minute defaults limit committed new reservations, not total AWS
spending. Failed seeds retain consumed slots. Rejected requests, control reads,
conditional conflicts, existing workspace activity, Personal/Cognito operations,
logs/monitoring and shared quotas still cost or consume capacity. Bots can exhaust
the shared allowance. No availability guarantee or spending cap is claimed.

No new pricing/financial study was run. Preserve $0 assumed usable credit, $2 review,
$5 approved initial-test stop, approximately $1/day unexplained-growth investigation,
and over-$10/month hosting review. No AWS cost was intentionally incurred here.

## J. Future staging/production preparation and operator contract

All steps below require later explicit live authorization:

1. Bind the exact account/non-root identity, region, environment/table and qualified
   source/ZIP/template. Do not relabel staging as production.
2. Inspect existing records without resetting them. Initialize the exact policy
   shape above **paused**, using conditional absence; no startup/public initialization.
3. Review counters/replay retention and backend/control/operator IAM scopes. Existing
   table actions cover the operation families in source; this is not fresh permission
   proof. Review whether deployment policy should separate control-read/condition
   access from operator-only control writes and counter updates.
4. Enable only in an approved window with the accepted limits, supervision, budget,
   rollback and stop plan. Update policy atomically with expected old version and
   incremented version. Recheck the full record/target; never blindly overwrite it.
5. Pause by conditional versioned policy update. Do not disable Demo authentication,
   reduce shared Lambda concurrency or change Cognito to implement the pause.
6. Determine prior outcome from protected primary replay/workspace records and
   counters, preserving the original key. PROVISIONING/unknown is not permission
   to reseed. Never delete a current counter or refund a failed seed automatically.
7. Restore/cutover must force issuance paused before traffic reaches a restored
   table. Reconcile admissions after the restore point using protected evidence;
   if current-window usage is unknown, keep paused until a clean UTC day/minute.
   A restored old enabled policy/count must not reopen an already-consumed budget.
8. Existing valid signed sessions retain their expiry and ordinary ownership rules;
   eventual TTL is cleanup, not authorization. Personal recovery/deletion
   reconciliation remains in the established later recovery gate.

The currently recorded staging deployment has no new control records. Publishing
this backend without separately approved initialization would intentionally pause
new staging Demo creation, while preserving valid existing credentials. No live
compatibility change was made by this local task.

## K. Concrete Batch 3 dependencies

Separately authorize only the existing Batch 3 local infrastructure/release scope:
wire primary Cognito plus explicit Demo for production, preserve closed registration,
qualify default-paused issuance initialization/operator contracts and relevant role
scopes, and review a route-specific issuance throttle without constraining all
Personal traffic. No new service is justified by this batch.

Finish the already-planned exact per-app hosting/header/release binding, protected
production resources, deterministic fresh backend ZIP/Linux runtime qualification,
offline CDK/source/artifact/schema/API-contract checks and bounded release manifest.
Actual resource counts come from that future qualified synth, not a reused estimate.
No frozen reviewer hash is weakened. Later live provisioning, recovery, real
two-account acceptance and signup opening remain established 7C–7G work.

## L. Final execution ledger

Local work: focused and full Python/Vitest checks, lint/format/types, one isolated
frontend build and artifact scan, and current documentation/evidence checks.
Evidence: `.tools/phase7b-batch2-20261103/`. Official public AWS documentation was
consulted; it is not a service/API or staging request.

Git: unchanged `main` HEAD `ff1ecad2db564c0a9781dc922646f1c398224873`; Batch 2
working-tree changes remain uncommitted. Historical ledgers/release evidence remain.

AWS service/CLI/login/Billing requests: **0**. Hosted HireFlux requests: **0**.
Real Demo sessions/accounts/emails: **0**. Cloud resource changes: **0**.
GitHub/remote operations, commits and pushes: **0**. CDK synths, backend ZIP builds
and artifact uploads: **0**. All test records are fictional and simulator-local.

## M. Final recommendation

1. **Bound creation:** yes, under a valid retained policy/counter state and AWS's
   atomic transaction semantics; this is not a hard spending cap.
2. **Pause independently:** yes; operator policy/version fencing stops new commits
   without consulting or disabling Personal Account operations.
3. **Keep valid Demo sessions:** yes; original signed expiry and READY reuse remain.
4. **Preserve durable/incompatible data:** all injected collision, failure and
   mutation fixtures preserve full records. Unknown ownership/lifetime retains data;
   orphan-only namespace absence is explicitly not claimed.
5. **Qualify locally:** atomicity/protocol races, ambiguous commits and failure
   handling are covered by deterministic local tests, with simulator limits stated.
6. **Still unproven:** actual deployed IAM, service conflicts/retries/latency, TTL
   scheduling, live source/config/cost/availability and production account journeys.
7. **Accept Batch 2 locally:** recommended, with the explicit retention/simulator/
   orphan qualifications above. No remaining test failure is hidden.
8. **Next:** the concrete Batch 3 scope in K, under separate authorization. Do not
   deploy this source, initialize controls or enter Phase 7C automatically.

**Stop here: BATCH 2 LOCALLY QUALIFIED — UNPUBLISHED — BATCH 3 NOT STARTED.**
