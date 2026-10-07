# ADR 0013: Proportionate operational guardrails

Date: 2026-10-06

Status: accepted for local Phase 3F definition, synthesis and tests only.
No AWS resource, logging destination, subscription or billing configuration is live.

## Context

Phase 3E defines the complete static Amplify → HTTP API → single ZIP Lambda →
DynamoDB topology. This portfolio demo needs finite privacy-safe logs, actionable
native signals, bounded backend scaling and an honest cost warning without adding
services to the request path. Phase 3G performs final synthesized review; Phase 4
qualifies the account and deploys staging. Neither phase is implemented here.

## Decision

Use focused OperationalLogs and OperationalGuardrails constructs, with immutable
environment policy. Create two explicit STANDARD log groups before the Lambda
and API stage. Staging uses 14-day retention and Delete/Delete; production uses
30-day retention and Retain/Retain. Physical log-group names are generated to
avoid replacement/name collisions. Lambda directly references its group through
LoggingConfig, avoiding implicit infinite retention and custom retention resources.
Replace AWSLambdaBasicExecutionRole with CreateLogStream and PutLogEvents scoped
to that group's ARN. Existing DynamoDB and exact signing-secret grants remain.

Select Lambda JSON with application WARN and system WARN. The installed Mangum
0.21.0 emits raw request paths at INFO; enabling INFO would expose identifiers.
This deliberate narrower level preserves the existing sanitized error handler
and adapter exception filter without modifying or rebuilding runtime source.
HTTP API access logs supply request tracing: requestId, routeKey, httpMethod,
status, responseLength, responseLatency, integrationLatency, protocol and
integration.status. Raw paths, bodies, query strings, IP, user agent, credentials
and private claims are excluded. JSON values are strings to accommodate missing
API values. Detailed route metrics are disabled. No REST API account logging
role is introduced; HTTP API log-delivery permissions belong to the deployer.
See [Lambda Python logging](https://docs.aws.amazon.com/lambda/latest/dg/python-logging.html),
[HTTP API logging](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-logging.html)
and [supported access-log variables](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-logging-variables.html).

Use API stage rate/burst 10/20 for staging and 20/40 for production; reserve 5/10
Lambda executions. [Throttling is best-effort](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html).
[Reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
limits execution without prewarming; regional account quotas and the required
100 unreserved executions must be qualified in Phase 4.

Create five native alarms: Lambda Errors, Lambda Throttles, HTTP API 5xx,
DynamoDB ThrottledRequests and DynamoDB SystemErrors. All use Sum, five-minute
periods, >=1 threshold and notBreaching missing data. The first four evaluate
1 of 1 periods; SystemErrors requires 2 of 3. DynamoDB sums cover TableName and
each actual client API Operation (GetItem, PutItem, DeleteItem, Query,
BatchWriteItem, TransactWriteItems). [Table-only SystemErrors does not match
published metrics](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html).
Partial batch throttles can fall outside ThrottledRequests and need manual
ReadThrottleEvents/WriteThrottleEvents diagnosis. Routine 4xx, conditional
conflicts and UserErrors are expected product behavior; no alarm is added.
Latency has no measured baseline and remains dashboard-only. No duplicate
billing alarm, custom metrics, PutMetricData grant or telemetry collector exists.

Use one six-graph dashboard per environment: HTTP counts and average latency;
Lambda counts, p95 duration and maximum concurrency; DynamoDB operation error/
throttle totals, Query average latency and transaction conflicts. Fourteen
visible series use twenty-four underlying native metrics. No Logs Insights or
cross-environment reference is needed. Same logical IDs belong to separate
stacks; generated resources and environment-prefixed operational names isolate
their physical identities.

An optional NoEcho OperationalAlertEmail deployment parameter defaults empty.
Only nonempty input creates the SNS topic, email subscription and topic policy,
and adds alarm actions and budget email subscribers. The topic policy allows
CloudWatch publishing only from this account's five exact alarm ARNs. Lambda has
no SNS grant or dependency. [Email subscription confirmation](https://docs.aws.amazon.com/sns/latest/dg/sns-email-notifications.html)
and delivery tests are Phase 4 gates. Operator notifications do not implement
application email/reminders or SES.

Define a COST/MONTHLY/UNBLENDED_COST budget, USD 10 staging / USD 30 production,
with explicit FilterExpression AND(Project=HireFlux, Environment=selected).
Use the [supported expression property](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-budgets-budget-expression.html)
rather than ambiguous legacy multi-valued tag filtering. With email, notify on
actual spend greater than 80% and 100%; otherwise provide visibility only.
There is no BudgetsAction, automatic shutdown, IAM change or runtime billing
permission. These are starting thresholds, not a forecast or spending cap.

## Consequences and deployment gates

Each template declares 25 reviewed resources: thirteen preserved topology
resources, nine unconditional operational resources and three conditional SNS
resources. Default blank email selects 22; configured email selects 25. Outputs
remain empty. Parameters are the existing GitHub and bootstrap inputs plus the
optional email. The verified Phase 3D ZIP and all backend/frontend runtime source,
schemas, authentication modes, production data protection and hosting graph stay
unchanged. No new architecture decision about application services is needed.

Finite storage reduces accumulation, but log ingestion, dashboard and alarms
still cost money. The five alarms monitor fifteen underlying standard-resolution
metrics (three singles and two six-metric math sums). Native metrics and disabled
detailed metrics avoid custom collection costs; optional SNS adds delivery costs.
Use [current CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)
and [Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)
during account qualification; do not claim a universal free tier or fixed total.

Phase 4 must qualify regional concurrency, deployment log-delivery permissions,
actual privacy-safe JSON output, metric/alarm behavior and optional confirmed
notifications. An authorized billing operator must activate Project and
Environment cost-allocation tags, allow propagation, and verify observed scope.
[Tag appearance and activation can each take up to 24 hours](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html).
Shared or untaggable charges can escape the filter; inspect overall account
costs too. [Delayed budget data cannot cap spending](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).
These limitations are explicit, not silently deferred budget implementation.

Tests pin exact inventory, retention/lifecycle, privacy, metric dimensions,
alarm policies, dashboard scope, zero/one notification destinations and exact
AND budget filters. Existing real-ZIP offline CLI, schema parity, IAM and hosting
cycle checks remain required. The bundled CDK brace-expansion advisory remains
open despite the latest-compatible-version recheck; final review must retain it.

Production is still unavailable for real authentication until Phase 5 and cannot
launch before later hardening. Phase 6 owns backup/erasure reconciliation and
signing-key rotation. Phase 3F does not imply deployment or launch readiness.

See [operational contract](../../infra/README.md#operational-guardrails-phase-3f)
and [complete Phase 3F handoff](../production-account-readiness.md#45-phase-3f-implementation-and-handoff).
