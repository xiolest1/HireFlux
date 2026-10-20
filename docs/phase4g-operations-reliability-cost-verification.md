# Phase 4G — AWS operations, reliability and cost verification

## October 20 — root Billing reverification and financial decision

**Current verdict: PASS WITH EXPLICIT QUALIFICATIONS for cash-funded, supervised
staging.** After reviewing the figures below, the owner explicitly selected
**"Accept cash-funded baseline; keep tests paused."** This accepts possible cash
charges without relying on promotional coverage. It authorizes no new tests,
resource changes or Phase 4H. Root access resolved the Bills permission barrier. It did
not establish usable promotional coverage: the root Credits summary shows
**$118.07 estimated remaining**, but both grant detail pages explicitly say
**Expired**, with **October 6, 2026** expiration. Do not count that displayed
balance as current funding. The earlier IAM view's zero is preserved as a
limited-access observation, superseded for credit visibility by this review.

The owner authorized this specific read-only reconciliation in account ending
**9465**. The owner personally established root authentication; the browser showed
the same account. Reads were limited to Bills/Credits and the Billing landing
page reached during sign-in. No root credentials, cookies, session tokens,
recovery information or CLI root authentication were requested or retained.
`hireflux-operator` was not used or changed. The owner signed out after review;
the browser then showed the public AWS Console page with **Sign in**, and the
temporary tab was closed. No backend/static test traffic, operational retesting,
deployment, rebuild, GitHub action, resource/IAM/Billing change, export, payment
or service activation occurred. The existing test pause and original 4H boundary
remain in force.

### Current October estimated bill

The selected period was **October 1–31, 2026**, account ending 9465, status
**Pending**, with the Bills page refreshed around **1:01 AM EDT on October 20**:

- Estimated grand total / current estimated payable: **USD0.00**.
- Total tax: **USD0.00**; total post-offset pre-tax service charges: **USD0.00**.
- Savings → Credits: **USD1.77 applied**, spread over seven service entries.
- Consequently, charges before the displayed credit offset reconcile to
  approximately **USD1.77 at Bills' displayed cent precision**. This is a
  derivation from net plus credits, not a separately exposed precise gross total.
- Billing Home separately displayed **USD1.78 month-to-date** and a **USD4.94
  current-month forecast**. Preserve the one-cent difference rather than choosing
  a supposedly exact common total. Different precision/update timing is a
  possible explanation, not an established cause.
- These are **metered-to-date estimates**, not a posted/final October invoice.
  Later or unbilled usage can increase them. No payment was made or inspected.

The Bills Savings panel identified no other savings category in this snapshot.
Its seven applied-credit rows were EC2 **$1.61**, VPC **$0.16**, and S3, KMS,
CloudWatch, Data Transfer and Secrets Manager each **$0.00 at display precision**.
Rounded zero rows can include sub-cent amounts; they are not proofs of free usage.

### Service breakdown and lab attribution

All 13 service-level net rows displayed $0.00 after applicable credits/free usage.
Expanded gross regional lines identified:

- **EC2: $1.61**, consisting of NAT Gateway **$0.14 / 3 hours**, Linux t3.micro
  compute **$0.25 / 24.177 hours**, and EBS **$1.22**. EBS included gp3
  **15.302 GB-month** and gp2 **0.012 GB-month**, with the latter rounding to $0.00.
- **VPC: $0.16**, comprising public IPv4 **$0.13** and a VPC endpoint
  **$0.03 / 3 hours**. IPv4 usage included **1.149 idle** and **24.805 in-use hours**.
- CloudFormation, CloudTrail, CloudWatch, Data Transfer, Glue, KMS, Lambda,
  Secrets Manager, SNS, SQS and S3 displayed $0.00 net. Expanded KMS/S3/secret
  API and CloudWatch request rows include priced usage rounding below a cent;
  not all are necessarily free.

EC2/NAT/EBS/public IPv4/VPC endpoint costs are outside the accepted HireFlux
architecture, which has no EC2/VPC/NAT/endpoint resources. They are consistent
with the owner's personal labs, not charges created by the deployed application
stack. Their billing entries establish past usage, **not whether those lab
resources are still running now**; this review did not refresh lab inventory.
EBS is the largest displayed component and merits attention in the owner's
ongoing lab review if the relevant volumes are still retained. Nothing was stopped.

Shared S3, KMS, logs, CloudFormation and other account-level usage cannot be
precisely assigned to HireFlux from this page. Project/Environment cost-allocation
tags were last verified **Inactive on October 19** and were not changed or
requeried. No precise HireFlux/lab dollar split is invented. The $2 incremental
HireFlux review threshold cannot be evaluated from the $1.77–$1.78 whole-account
month-to-date figure alone; a pre-deployment dollar baseline/delta is unavailable.

### Promotional credit visibility and expiry

Root Credits showed these aggregate amounts:

- Nominal amount remaining **$119.99** and amount used **$0.01**.
- Estimated remaining **$118.07** and estimated used **$1.93**.
- A section headed **Active credits (2)** contained two rows whose own statuses
  and separate detail pages both explicitly said **Expired**.
- **AWS Free Tier**: issued **$100**, start **September 9, 2026**, expiration
  **October 6, 2026**; nominal remaining **$99.99**, estimated remaining **$98.07**.
- **Explore AWS: Launch an instance using EC2**: issued **$20**, start
  **September 18, 2026**, expiration **October 6, 2026**; nominal and estimated
  remaining **$20.00**.
- Both applicability dialogs listed Lambda, HTTP API/API Gateway, DynamoDB,
  CloudWatch, Secrets Manager, Amplify, S3 and KMS among covered products.
  Product eligibility does not override expiration.
- The separate **last-six-months inactive-credit tab showed zero rows**, despite
  the two expired statuses above. Credit allocation history reported incomplete
  September/October retrieval and did not reconcile the balances to Bills.

These are contradictory category/history displays, not proof of active credits
or of new credit redemption. The root detail statuses and dates prohibit relying
on the numerical remaining balance for current hosting. **No usable promotional
balance or future five-month coverage was established.** The expired dates precede
HireFlux's October 19 deployment. Bills' October credits can concern earlier
eligible activity; the exact application dates could not be verified from the
incomplete history. The $1.93 estimated cumulative use also does not reconcile
exactly with the $1.77 October Bills credit and $0.01 nominal prior use; no cause
or missing allocation is invented.

The prior GetAccountPlanState result remains PAID/ACTIVE with $0 account-plan
credit. It is a different scope from these visible promotional records and was
not rerun under root or changed. The previous roughly $110 report now has a
visible nominal/estimated credit context, but **usable-credit availability and
the inconsistent credit classification remain unresolved**. The financial gate
initially stayed BLOCK pending funding that did not depend on these credits, or
reconciled usable coverage. The subsequent explicit cash-funded decision below
removes reliance on the disputed balance; it does not resolve the credit data.

### Actual versus projected HireFlux costs

Billing does **not yet validate or contradict** the prior full-month HireFlux
projections. HireFlux deployed October 19, while the visible bill still lists
only **36 Lambda requests / 20.693 GB-seconds**, compared with **268 invocations**
in the already collected operational metrics. Amplify, HTTP API and DynamoDB were
absent from the 13-service bill; alarm and secret-storage rental lines were also
not visible. Their absence is incomplete/delayed billing evidence, not zero
cost. CloudWatch ingestion at the displayed **0.001 GB**, storage rounded to zero,
Lambda usage and KMS request rows explicitly show applicable free usage. Shared
allowances reduce qualifying usage charges independently of promotional credits.

Retain the existing **gross**, pre-credit/tax projections and their assumptions:

- Pure idle approximately **$1.30–$2.30/month**, plus small retained storage and
  external usage.
- Mostly idle with maintenance approximately **$1.60–$2.60/month**.
- Limited testing approximately **$3.20–$4.20/month**, with **$3–$5** planning room.

Standing exposures remain two secrets **$0.80/month**, 15 standard alarm-metric
units **$1.50 list / expected $0.50 with ten qualifying shared free units**, the
expected qualifying free dashboard, about **$0.0006/month** retained S3 assets,
and small hosted/log/table storage. Public/bot traffic and future automatic builds
can add usage while intentional tests are paused. No new architecture or monitoring
change is justified by this bill. Billing Home's $4.94 whole-account forecast is
not a measured steady-state HireFlux price or a spending guarantee.

For a conservative funding decision, assume **$0 usable promotional coverage** and
be prepared to pay gross modeled charges, plus tax/labs/usage beyond assumptions.
The current $0.00 estimated payable does not establish that future HireFlux charges
will be credit-covered. No demonstrated unavoidable HireFlux recurring component
exceeds $10/month; uncontrolled public use or lab resources can still push the
account above that level. Keep the **$2 incremental gross review / $5 first-week
testing stop / unexplained ~$1/day investigation** controls; none is a hard cap.

### Financial acceptance and original 4H gate

**Owner financial acceptance is recorded.** The owner explicitly selected
**"Accept cash-funded baseline; keep tests paused"** after the concrete Billing
figures, expired-grant discrepancy, cost projections and manual thresholds were
presented. The accepted funding premise is **$0 assumed usable promotional
credit**, with possible out-of-pocket charges for gross modeled costs, tax/labs
and usage beyond assumptions. The prior financial acceptance BLOCK is superseded
by this decision. Credit availability/history remains an unresolved qualification,
not a newly verified credit entitlement.

**Recommendation:** retain the accepted architecture and essential monitoring
unchanged for the owner's bounded, cash-funded supervised staging. The modeled
cost remains reasonable for limited testing, but current Billing does not prove
a full month's HireFlux price or bound public traffic. Keep agent-generated tests
paused; review whole-account Bills with existing owner access and apply the
accepted gross-spend thresholds. No unused test allowance overrides the pause.
Do not interpret this recommendation as an unattended public/production launch
or permission to execute emergency controls. The root session is signed out and
may not be reused for ordinary operations.

For original **Phase 4H** entry, the cash-funded financial gate is now accepted.
Still require explicit acceptance of the existing technical/monitoring
qualifications and Settings defect for the freeze,
a supervised stop owner/current thresholds, review of any intervening discrepancy,
and a separate explicit instruction to begin the original final evidence freeze.
The October 19 technical observations below are preserved, not newly certified by
this Billing-only visit. Natural expiry, physical TTL deletion, secret-failure and
Lambda WARN/error delivery, browser 409/network limits, and scaling/notification
fault paths remain unverified. No Phase 4H work has begun, and additional billable
test activity requires its own explicit resumption.

This update uses only aggregate read-only Billing observations; no invoice,
credit identifier, payment/contact detail, root credential or browser session
material was exported into evidence. A separate root-reverification receipt and
manifest preserve the original 4D–4G evidence and consumed attempt ledgers.
For interpretation, see [AWS Bills guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/getting-viewing-bill.html)
and [AWS credit status and balance guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/useconsolidatedbilling-credits.html).

## October 19 — preserved operational investigation and financial hold

Evidence date: **October 19, 2026, America/New_York**. Machine receipts use UTC;
the principal collection ran October 20 at 02:16–02:24 UTC, still October 19
locally. Account **ending 9465**, profile **hireflux-operator**, **us-east-1**.

**Disposition: BLOCK on final cost/funding acceptance; technical operations
checks passed with explicit qualifications.** Bills access is denied to the
signed-in non-root identity. Credits displays zero active credits and zero
estimated remaining, which conflicts with the earlier owner report of about
$110. The account-plan API separately reports PAID/ACTIVE, $0 account-plan
credits and no expiration date. Actual deployment-period gross charges and
promotional coverage therefore remain unverified. Do not assume a $0 cash bill
or accept indefinite hosting on the earlier credit premise.

This is a completed bounded investigation, not a deployment failure. No technical
evidence justifies rebuilding or redeploying the accepted application. Phase 4H
has **not** started. The owner has answered: the available identity still cannot
verify Bills, applied credits, the earlier promotional balance or its expiry.
The financial baseline is explicitly **UNVERIFIED**, and additional billable
Phase 4G test activity is **paused at the owner's request** until reconciliation.
The unused API-request allowance does not override this pause. The owner will
try existing authorized account-owner access; no IAM/Billing change is authorized.

## Scope and preserved baseline

The owner explicitly authorized the original 4G operations/reliability/cost scope,
accepted the bounded 4F result and Settings limitation, and permitted at most
30 additional harmless non-issuance API requests if existing evidence proved
insufficient. **Zero of those 30 requests were used.** No new workspace, backend
write, load test, secret-value read, fault injection, build, deployment, PAT,
GitHub push, ledger reset or AWS configuration change occurred. Four sequential
static HTTPS GETs checked accepted entry-file hashes after evaluating available
billing sources. Existing metrics and logs supplied the operational evidence.

Fresh STS identity matched the exact previously accepted non-root identity using
native temporary login. No credential method, IAM permission, TLS behavior or
account configuration changed.

- Stack `hireflux-staging` remains **CREATE_COMPLETE**, with the same identity,
  update timestamp and exactly **22 CREATE_COMPLETE resources**. No SNS resource
  is selected with the approved blank email.
- Backend code remains qualified revision
  `6396f89e8a5eccc7f21b5f699833dd85a1e48409`. Lambda code hash, role, runtime,
  modification time and operational settings match the accepted baseline.
- Amplify job **2** remains SUCCEED at
  `d3a8fb1a9b959d4dddbc6d1c32e3eac459b0f945`; only jobs 1 and 2 are listed.
  Local HEAD remains `2146fc3870f027c3d6d8f06720c46bb0b29b51a2`, an unpushed
  documentation-only commit. Backend/frontend/infra Git trees match the qualified
  revision across local HEAD, remote main and the hosted revision.
- The bound template file still hashes to
  `106222638171615bfdedaa1e99f612381c6dfcc4c105ac22aec05a1f359aa21d`.
  The live template's sanitized projection matches. The reviewed transport
  deliberately redacts the credential-bearing `AccessToken` property; its value
  or reference was not recertified by this projection comparison.
- The public [staging site](https://main.d31vp0nq9fzl6q.amplifyapp.com) returned
  200 for root HTML, `theme-bootstrap.js`, accepted entry JS and accepted entry
  CSS. All four bytes hashes match the artifact already verified in 4F, totaling
  **429,042 downloaded bytes**. TLS validation remained enabled; redirects were
  refused. This is current served-byte evidence, beyond build status alone.
- The HTTP API remains
  `https://0z0fpmukik.execute-api.us-east-1.amazonaws.com`.

An initial local checker STOP was caused by comparing the transport's redacted
`AccessToken` string with the unredacted template's reference object. The corrected
comparison applies the same sanitizer to both sides, preserves the original
receipt, and reuses its three recent metadata responses. Four offline cases
passed: the accepted projection and rejection of changed memory, a removed
resource and changed alarm dimensions. No deployed source/resource repair or
automatic deployment retry occurred.

## Billing: observations versus missing facts

Read-only sources evaluated before additional hosted traffic:

- **Bills console:** the intended account is visible, but the page explicitly
  says the identity lacks permission to access billing information. No invoice,
  current month total, service charge breakdown or deployment-date delta was
  available. No access setting or IAM permission was changed.
- **Credits console:** active credits **0**, estimated remaining **$0.00**,
  displayed used **$0.00**; the inactive-credit tab also shows **0** in its
  six-month window. These are displayed results under this identity, not proof
  that the owner's earlier credit report was false or that credit was consumed.
  An existing owner-access check is needed to resolve the discrepancy.
- **GetAccountPlanState:** PAID / ACTIVE, account-plan remaining credit **USD0**,
  no expiration returned. Account-plan credit is distinct from other promotional
  programs; this response alone cannot establish their balance.
- **Cost-allocation metadata:** both `Project` and `Environment` are **Inactive**.
  Resource tags exist, but the budget's AND filter cannot currently serve as
  reliable HireFlux billing attribution. Activation was not performed.
- **Budget:** USD10 monthly COST / UnblendedCost, exact
  `Project=HireFlux AND Environment=staging` filter, **ActualSpend USD0**, health
  HEALTHY, last update October 19 at 5:07 PM New York; **zero notifications**.
  This filtered zero is **not** a measured zero HireFlux or whole-account bill.
- Cost Explorer was not enabled and no `GetCostAndUsage` request, cost-tag
  activation, paid analysis service or Billing setting change was performed.

AWS requires user-defined tags to be activated for billing reports and describes
propagation delays. Even activated tags do not capture every shared or untaggable
charge. Keep whole-account review alongside resource attribution.
[AWS tag guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html).

Credits apply only to eligible charges before exhaustion/expiry. The Credits
detail estimate refreshes approximately daily, whereas final balances can follow
the invoice cycle. Neither delayed Bills nor a credit balance is a real-time
spending cap. [AWS credit guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/useconsolidatedbilling-credits.html).

### Shared Free Tier observations

`GetFreeTierUsage` returned a complete, unpaginated current account snapshot:

- Lambda: **36 / 1,000,000 requests**, **20.69325 / 400,000 GB-seconds**.
- CloudWatch eligible API requests: **13 / 1,000,000**.
- Log ingestion: **0.0008149 / 5 GB**; log storage:
  **0.00010718 / 5 GB-month**.
- KMS: **137 / 20,000 requests**.

These are **shared account-level, delayed usage rows**, including personal labs;
they are not HireFlux-only usage or reserved future allowances. In particular,
the same-day CloudWatch operational count is 268 Lambda invocations, demonstrating
that the Free Tier snapshot has not caught up. Absence of an Amplify, API Gateway,
dashboard, alarm or DynamoDB row does not prove zero usage or entitlement.

The regional alarm inventory contains only HireFlux's five alarms. The global
dashboard inventory contains one qualifying dashboard. Historical/other-region
alarm consumption was not exhaustively audited; the model retains an allowance
sensitivity instead of assuming all ten free alarm metrics are unused.

No current Amplify 12-month or HTTP API introductory allowance was demonstrated,
so the estimates charge their usage at standard rates. DynamoDB's free provisioned
RCU/WCU allowance is **not** an allowance for this on-demand table's requests.
Its Standard storage allowance is separate and shared.

### Usage-derived price proxies, not billed charges

Existing CloudWatch data covers **October 19 15:15 UTC through October 20
02:18:26 UTC**, at five-minute resolution. Receipt timestamps can display the
same instants with New York offsets. The four new static GETs occurred afterward
and are outside that measurement window.

- DynamoDB consumed **944 read units and 5,234 write units**, summing table and
  all three GSIs. Standard on-demand rates yield a **$0.003389** request-cost
  proxy. This is not a billing line, complete monthly usage or every billable
  storage/transaction detail.
- Amplify served **2,144,779 bytes** over **626 requests**: standard transfer
  pricing gives approximately **$0.000322** before any applicable allowance.
- Existing jobs 1 and 2 have **215.322 seconds / 3.5887 minutes** of BUILD-step
  wall time combined, approximately **$0.0359** at standard instance pricing.
  Wall time is not a metered build-minute invoice or rounding guarantee.
- Lambda duration aggregates correspond to **16.30334 GB-seconds** at 1 GB;
  initialization/billing rounding are excluded. Do not equate this with billed
  compute. The delayed account Free Tier snapshot is a different measurement.
- The bootstrap bucket holds **three unchanged versions / 26,728,279 bytes**,
  approximately **$0.000615/month** at S3 Standard storage pricing, plus requests.
  Its ECR repository is empty. This does not inventory or price unrelated labs.

Exact actual gross spend since deployment, shared lab allocation, tax, credits
applied and remaining promotional coverage remain **UNVERIFIED**.

## Recurring model for the current architecture

### Owner-confirmed pause: costs that continue

The October 19 follow-up used **only existing local evidence**. No AWS API,
hosted request, new test, deployment or Billing/permission change was performed.
The pause stops agent-generated test activity; it does **not** stop the deployed
environment, automatic builds or public requests. No live shutdown was performed.
These are recurring **price exposures**, not verified October billed charges:

- **Two Secrets Manager secrets: $0.80 per full month** at $0.40 each, with
  partial-month proration and API-call charges separate. This standing storage
  cost continues without tests or Lambda invocations.
- **Five CloudWatch alarms / 15 standard alarm-metric units: $1.50/month list
  price**, or an expected **$0.50/month** if ten qualifying shared free units
  apply. Alarm evaluation continues while the alarms exist, even with no traffic
  or notification recipients. Exact account-level allowance allocation remains
  unverified in Bills.
- **One dashboard: expected $0** under the published qualifying allowance,
  based on the observed one global dashboard / 24 native series. If it ceased
  to qualify, list-price exposure would be $3/month.
- **Retained CDK S3 assets: about $0.0006/month storage**, based on the already
  measured 26,728,279 bytes; request fees are separate. The bootstrap ECR
  repository was empty at collection. Bootstrap roles/stack do not themselves
  impose hourly compute charges.
- **Amplify stored files continue accruing storage usage** at the previously
  verified $0.023/GB-month without assuming an introductory allowance. Stored
  hosting GB-months were not independently measured; the 1.6 MB downloaded
  artifact is not a billed-storage measurement. Public requests, including bots,
  may continue transfer charges at $0.15/GB under the conservative model.
- **CloudWatch retained logs and DynamoDB table/index storage remain.** Recorded
  volume was tiny and log allowances had substantial delayed shared headroom;
  no additional charge is expected at that footprint if allowances apply.
  Retention/TTL cleanup is eventual, and a traffic pause does not instantly
  remove stored data. Existing public traffic may generate more usage.
- **Lambda, HTTP API and on-demand DynamoDB have no configured standing compute
  or provisioned-capacity rental**, but public backend traffic or anonymous
  issuance may still create request, duration, transactional/index write,
  secret/KMS-call and log costs. Reserved concurrency and API throttles are not
  spending caps.
- **Auto-build remains enabled.** No build is being requested by this follow-up;
  a future push can still trigger $0.01/minute standard builds. The two completed
  builds are historical usage, not a continuous monthly fee.

The standing baseline is therefore still approximately **$1.30–$2.30 gross per
month**, plus small retained hosting/storage and any external usage. It is not a
guarantee that actual total paused-environment charges stay in that range.
Use **no assumed promotional offset** for planning. The $10 tag-filtered budget's
zero remains unreliable because both cost-allocation tags are inactive, and it
has no notification recipients. Actual charges, applied credits and expiration
remain UNVERIFIED. No additional billing/service requests are needed or authorized
by this follow-up; wait for the owner's existing-access reconciliation.

### Monthly workload projections

All amounts below are **USD gross per month before promotional credits/tax**,
assuming us-east-1, limited usage and the observed small storage footprint.
They are projections, not an invoice or spending guarantee.

**Pure idle: about $1.30–$2.30/month plus tiny retained storage.** Two secrets
account for $0.80. Alarm allowance sensitivity accounts for $0.50–$1.50.
The single eligible dashboard is expected to be free under the published offer;
there is no per-log-group rental fee. Native basic metrics are free. There is no
NAT, VPC endpoint, load balancer, provisioned Lambda concurrency, customer KMS key,
SSR compute or PITR standing charge in the accepted staging configuration.

**Mostly idle with maintenance: about $1.60–$2.60/month.** Assumptions: 20 standard
build minutes, 0.25 GB served, at most 0.1 GB hosted storage, 1,000 API calls,
10,000 write/5,000 read units and 2,000 secret API calls. Existing Lambda/log/KMS
allowance headroom is assumed to remain sufficient. No unverified Amplify/API
introductory discount is subtracted.

**Limited testing: about $3.20–$4.20/month; plan $3–$5.** Assumptions: 10–20 testers,
200 workspace issuances, 30,000 API calls, 100 standard build minutes, 3 GB served,
500,000 write/250,000 read units including seed transactions and index writes,
6,000 secret API calls, at most 0.1 GB logs/storage, and average Lambda execution
0.25 seconds at 1 GB. These workload allowances are modeled, not measured user
behavior. If Lambda's shared allowance were consumed elsewhere, this execution
assumption adds roughly $0.13; exhausted log headroom adds only cents at this volume.

If shared dashboard/alarm allowances were unavailable, the recurring monitoring
list price would be **$4.50** ($3 dashboard + $1.50 alarms), and modeled testing
would move toward **$6–$8/month**. Current dashboard inventory supports the free
case. None of these bounded scenarios demonstrates an unavoidable recurring
cost above $10/month or a need for architecture redesign.

Pricing inputs: [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/)
($0.40/secret-month, $0.05/10,000 API calls),
[Amplify](https://aws.amazon.com/amplify/pricing/) ($0.01/standard build minute,
$0.023/GB-month hosted, $0.15/GB served),
[DynamoDB](https://aws.amazon.com/dynamodb/pricing/) ($0.625/million write and
$0.125/million read units), [HTTP API](https://aws.amazon.com/api-gateway/pricing/)
($1/million first-tier requests), [Lambda](https://aws.amazon.com/lambda/pricing/)
and [KMS](https://aws.amazon.com/kms/pricing/).
The retained S3 model uses the official regional price-list rate
[$0.023/GB-month](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json).

**Cash exposure:** eligible active credits could offset eligible gross charges;
this investigation cannot verify such coverage. Budget for the gross amounts
as possible out-of-pocket charges now. After credits expire or are exhausted,
remaining service allowances may still reduce gross charges, but no credit offset
remains. Do not extrapolate credit runway without including personal labs.

### CloudWatch-specific cost decision

`infra/lib/operations/operational-guardrails.ts` and deployed definitions agree:

- Two STANDARD log groups, both **14-day retention**, no custom metric filters
  or subscriptions added. Low-volume ingestion/storage is likely covered by the
  demonstrated shared allowances. Excess standard ingestion/storage is
  $0.50/GB and $0.03/GB-month.
- One six-widget dashboard references **24 underlying native series** with
  **14 visible plotted series**. It fits the published three-dashboard /
  50-metrics-per-dashboard allowance. Native service metrics do not become paid
  custom metrics simply because the dashboard references them.
- Three simple alarms reference three standard alarm metrics. Two metric-math
  alarms reference six native metrics each, producing **15 billable alarm-metric
  units before allowances**, not five alarm units and not seventeen including
  the two SUM expressions.
- At $0.10/metric-month, list price is **$1.50/month**, hourly prorated. Applying
  the published ten qualifying standard alarm-metric allowance to these explicit
  metric lists gives **$0.50/month** expected incremental monitoring rent if
  shared headroom is available. The two six-input alarms account for $1.20 at
  list price. Confirm actual allowance allocation when Bills becomes readable.
- No Metrics Insights, GetMetricData, new custom metric, query alarm, anomaly
  band or paid monitoring feature was introduced. Reads used
  GetMetricStatistics, with shared eligible API-request allowance headroom.

[CloudWatch prices and allowances](https://aws.amazon.com/cloudwatch/pricing/)
and [AWS metric-math billing explanation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_billing.html)
support the distinction. **Recommend retaining the existing configuration.**
There is no measured material monitoring-cost problem. If the owner later wants
to remove both DynamoDB alarms, the maximum list-price saving is $1.20/month;
with ten free units available, net saving is only $0.50. That would require a
separately authorized source change, infra tests/typecheck, staging/production
synth and artifact checks, a reviewed 22-to-20 resource change set and controlled
deployment. It is not justified automatically by this small potential saving.

## Actual monitoring effectiveness and reliability

Lambda remains **1024 MB, 15 seconds, reserved concurrency 5, x86_64 Python 3.14,
no VPC**. API Gateway has **rate 10 / burst 20**, route detailed metrics disabled.
DynamoDB is ACTIVE, on-demand, with three ACTIVE GSIs; TTL is ENABLED on
`expires_at`, deletion protection false and PITR disabled as qualified for
disposable staging. Approximate table statistics show 652 items and 365,820
bytes, plus 352,955 index bytes. These delayed statistics do not prove cleanup.

Observed metrics over the stated window:

- Lambda **268 invocations**, **0 Errors**, **0 Throttles**, peak concurrency **4**.
  Duration weighted mean **60.83 ms**, maximum **2,662.39 ms**. Five-minute p95
  values range **52.72–2,559.66 ms**; this is not a whole-window p95.
- HTTP API **268 Count**, **23 4xx**, **0 5xx**. Gateway latency weighted mean
  **151.87 ms**, maximum **5,771 ms**; integration mean **146.54 ms**, maximum
  **5,767 ms**. Earlier 4E intentionally exercised 4xx contracts and 4F exercised
  missing-resource recovery. Aggregate metrics do not attribute every response
  to a particular runner or prove every 4xx was intentional.
- No datapoints were returned for the six-operation DynamoDB ThrottledRequests
  and SystemErrors series, table/GSI throttle-event series or TransactionConflict.
  **No recorded event** is the bounded conclusion, not a proven zero or a tested
  failure-delivery path. Positive table/GSI capacity and Query latency data show
  the successful workload did publish. Query service latency weighted mean is
  **2.10 ms**, maximum **29.55 ms**; it excludes application/SDK/network overhead.
- API logs have **268 IncomingLogEvents / 63,097 IncomingBytes**. Five latest
  streams show delivery from earlier testing, and 4E/4F already sampled safe
  access records. DescribeLogGroups still reports storedBytes 0, demonstrating
  why that delayed field cannot establish absence of delivery.
- Lambda log group has **no streams or incoming-event datapoints**, with
  application/system WARN thresholds. Successful invocation/error-zero metrics
  do not demonstrate warning/error-log delivery. This remains **UNVERIFIED**;
  no deliberate failure was generated.

All five alarm configurations match the template, including exact dimensions,
periods, thresholds and metric math. Lambda Errors/Throttles and API 5xx alarm
at Sum >=1 in one five-minute period; DynamoDB throttles do the same over six
operations, and DynamoDB SystemErrors uses two of three periods. Every alarm
is currently OK, with no notification actions. Missing data is non-breaching;
an OK state alone is not evidence of recovery, delivered data or an alert.

DynamoDB operations are GetItem, PutItem, DeleteItem, Query, BatchWriteItem and
TransactWriteItems, with TableName+Operation dimensions. The matching native
dimension contract is documented by AWS. A partially throttled batch can affect
WriteThrottleEvents without ThrottledRequests incrementing, so native event
metrics remain useful diagnostic complements. Neither alarm fault path nor
scaling at the concurrency ceiling was induced.
[DynamoDB metric semantics](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html).

The dashboard's six widget definitions exactly match deployed configuration.
API, Lambda and successful DynamoDB native series have actual data. Sparse
failure series may legitimately be empty. Dashboard rendering and notification
delivery were not end-to-end fault tested. With no SNS recipients or budget
notifications, this is **manual operational visibility**, not unattended alerting
or an automated cost stop. The inactive budget tags further weaken cost visibility.

### Hosting 4xx and external traffic

Amplify records **626 requests, 298 4xx and zero 5xx** over the same window.
One existing access-log report for 16:15–21:05 UTC yielded **607 records / 262,136
downloaded bytes**. Only status/category counts were retained: no IP, query,
cookie, raw URL, signed download URL or raw log row was saved.

The sample includes **103 404s for unrelated technology/configuration probes**,
143 other-path 404s, seven asset-path 404s and 28 root/known-static-category 404s
(the category includes optional favicon/robots requests). Successful 200/304
responses include the application's assets and SPA routes. This is consistent
with unsolicited public probing mixed with deliberate missing-asset checks and
normal browser traffic; it does not identify every requester or prove every 404
was harmless. The four current exact entry-file GETs all passed. No hosted-code
or asset regression was demonstrated.

Access logs are best-effort and need not reconcile exactly with metrics or Bills.
Amplify also retains its managed access-log history until app deletion; the two
14-day CloudWatch groups do not govern that separate history. Keep credentials
and private data out of URLs. [AWS access-log guidance](https://docs.aws.amazon.com/amplify/latest/userguide/using-access-logs.html).

### Capacity and abuse boundary

Peak concurrency 4 leaves one slot at that observed peak; it is not an acceptance
test of the five-slot ceiling. Earlier 4E client request median was 106.94 ms,
maximum 5,906.52 ms, with three real seed operations about 2.60–5.91 seconds.
The 15-second Lambda timeout was not approached in these samples, but cold-start,
retry and seed tail behavior under concurrency remain unqualified. No sustained
scaling, overload recovery or 429 retry-loop claim is made.

Anonymous issuance can repeatedly seed many transactional/index writes. API
rate/burst and reserved concurrency limit portions of throughput, **not total
cost or per-person issuance**; CORS is not abuse prevention. For scale alone,
10 HTTP API requests/second sustained for a 30-day month would be 25.92 million
requests, approximately $25.92 in first-tier API charges before Lambda, writes,
static transfer and allowances. This illustration is not observed traffic or a
maximum bill. The existing public probes make ongoing owner supervision material.

No extra reliability traffic was necessary. If ceiling behavior later becomes a
release requirement, separately qualify a read-only `/health` experiment: at most
30 total requests in six rounds of five, no issuance, no automatic retries,
manual stop on any unexpected 429/5xx, followed by existing metrics review.
At most 30 one-GB invocations reaching the full 15-second timeout would model
450 GB-seconds, under $0.008 compute plus API/request/log overhead before
allowances. Such a harmless experiment still would not qualify write/seeding
capacity, deliberately force a throttle or establish a production SLO.

## Safeguards and operator stop/rollback plan

Manual controls remain **$2 incremental gross review**, **$5 first-week testing
stop**, and investigate unexplained growth near **$1/day**. They are human
thresholds with delayed billing, not caps. Review likely recurring charges above
**$10/month** before agreeing to indefinite hosting.

The owner remains the stop/recovery decision-maker. Before accepting ongoing
testing, ensure the owner has an existing way to review the whole account and
will inspect daily during active testing and near credit expiry. Lack of billing
access for this agent is not a reason to change permissions automatically.

1. On unexplained cost growth, errors, privacy/auth concerns or unexpected builds,
   pause intentional testing and sharing immediately. Capture only the minimum
   safe existing metrics/status evidence that does not prolong exposure.
2. Review whole-account Bills/credits with owner access, separate lab changes,
   examine build job count, transfer, issuance/invocations, table/GSI writes and
   log ingestion. Do not enable a paid analysis path as a diagnostic shortcut.
3. **Separately authorized build control:** disable main-branch auto-build.
   It is currently true. A documentation-only push can trigger another standard
   build, as job 2 did. Disabling auto-build does not remove public hosting or
   its storage/transfer charges. No documentation was pushed in 4G.
4. **Separately authorized rapid backend restriction:** reserved concurrency zero
   can prevent Lambda execution, but does not stop chargeable rejected API traffic,
   static traffic, secrets, alarms or retained storage. Removing the site link
   does not restrict direct API access. There is no qualified private tester gate
   or hard cost cap to switch on under this read-only scope.
5. **Separately reviewed stronger shutdown:** removing the staging API and hosting,
   or deliberately deleting the staging stack after dependency/data review,
   stops more exposure. The actual template uses Delete for staging table,
   both secrets and both log groups. Table deletion loses fictional records and
   indexes, with PITR disabled; log deletion loses diagnostic history. CloudFormation
   normally deletes secrets without a recovery window, invalidating sessions and
   cursors. Do not describe stack deletion as a reversible pause.
6. A later reversion requires the accepted source, pinned qualified ZIP/template,
   public environment, approved role and reviewed change set/build sequence.
   Never reset cloud tables using local scripts, rotate keys casually or replay
   consumed one-attempt deployment ledgers. No rollback exercise was performed.
7. Inventory remnants after any separately authorized shutdown. The protected
   **11-resource CDKToolkit**, versioned asset bucket, empty ECR repository and
   delegated roles are separate from the application stack. Three S3 versions
   remain chargeable and may be needed for rollback; no garbage collection,
   bootstrap deletion or protection change is authorized. Other-region assets,
   personal lab logs/buckets, orphaned resources, GitHub App access and PAT
   lifecycle are separately owned and do not disappear with an app deletion.

CloudFormation's secret deletion behavior is documented in
[DeletionPolicy guidance](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-deletionpolicy.html).
No shutdown, notification change, hosting disablement or security change was
performed or implicitly authorized by this plan.

## Findings and original Phase 4H entry conditions

**Current staging acceptance blocker:** resolve Bills/credit visibility and the
funding discrepancy through existing owner access. Record the current month gross
total, any credits applied, remaining promotional balance/expiry if present, and
the owner's acceptance of possible cash charges and current lab baseline. A
permission change is not required by this report; if needed, it requires its own
scope. Exact HireFlux/lab attribution may remain a documented delayed limitation,
but filtered budget $0 and previously reported credits cannot substitute for the
whole-account review. No further traffic is needed to close this gate.
Additional billable test activity also requires the owner to explicitly resume
it after reconciliation; no unused test budget is exercised automatically.

**Acceptable qualifications for supervised fictional staging, not new PASSes:**

- Natural signed-session expiry rejection: UNVERIFIED; prior sessions had not
  reached their signed October 20 expiry during these checks. Local contract
  evidence remains; no clock alteration or new workspace was used.
- Eventual TTL physical deletion: UNVERIFIED. TTL is enabled and prior strong
  item samples were correct; delayed item-count metadata does not prove deletion.
- Invalid/unavailable signing-secret live failure: UNVERIFIED; no secret read,
  rotation or deliberate service failure was used. Successful ordinary signing
  does not prove the failure path.
- Lambda warning/error-log delivery: UNVERIFIED; WARN settings plus empty logs
  are compatible with success, not evidence of working diagnostic delivery.
- Live browser 409 display/recovery: UNVERIFIED; backend conflict behavior passed
  earlier, but browser handling was not induced.
- Exhaustive browser network instrumentation: UNVERIFIED; prior bounded browser,
  static-byte and log evidence does not establish full network/privacy coverage.
- Scaling/overload/notification fault paths: UNVERIFIED; low-traffic observations
  are not fault injection, alert delivery or performance qualification.

**Accepted future maintenance:** the Settings automatic time-zone marker defect
remains unchanged and owner-accepted for 4G. Saving unrelated follow-up preferences
marks the same zone manual. Preserve a later separately authorized partial-field
frontend repair with focused tests and hosted build requalification. It does not
justify an infrastructure change or restarting 4D–4F.

**Restrictions on broader availability:** no unattended public/production
acceptance while whole-account visibility, manual stop ownership and anonymous
issuance/cost amplification remain unresolved. Missing notification recipients,
inactive budget attribution and public bot traffic are operational qualifications
that require an explicit supervised operating decision, or separately approved
monitoring/access changes. Prior production findings F03/F04/F07/F08/F10/F11
remain open and were not re-audited or silently closed.

**Phase 4H may begin only when** the owner explicitly starts the original final
staging evidence-freeze phase after the cost blocker is resolved; accepts these
bounded technical/monitoring qualifications and the known Settings defect;
retains current gross-spend thresholds and a supervised stop owner; and confirms
no intervening source, deployment, security or cost discrepancy. Freeze the exact
backend/hosted/template/asset identities and existing evidence. Production,
Cognito, new services and maintenance repairs remain outside that authorization.
The original **4G operations/reliability/cost → 4H final staging evidence freeze**
roadmap is unchanged.

## Evidence and validation

Git-ignored `.tools/phase4g/` contains the projected read-only collector, preserved
initial checker STOP, corrected continuation, billing/metric/retained/hosting
receipts, bounded log category counts, four static-entry results, offline aggregate
derivation and final hash manifest. Browser billing observations are recorded
as masked aggregate facts; no raw authentication, billing contact/payment details,
secret values, IPs, query strings or signed download URLs are included.

All **19** receipt/screenshot hashes in 4F's final manifest still match. Earlier
deployment/build/issuance ledgers remain consumed and unchanged. The dashboard
analysis is an offline local canvas with embedded data, no AWS/network actions.
Documentation checks cover links, stated receipt values, unchanged application
trees and `git diff --check`. No application build/test rerun is justified by
these documentation and read-only evidence changes. Documentation/evidence remain
local; Git alone does not transfer ignored receipts, and publication could trigger
Amplify auto-build.

The subsequent owner-confirmed financial hold is recorded in a separate
`owner-financial-hold.json` and follow-up hash manifest. Original collection
receipts and `final-disposition.json` remain historical and unchanged; the
follow-up supersedes their pending-question wording, not their measured facts.
