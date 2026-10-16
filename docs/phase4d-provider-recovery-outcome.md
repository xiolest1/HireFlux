# Phase 4D provider remediation — 2026-10-16

**AWS deployment recovery in progress — not yet qualified.** The owner authorized
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
the entered value was valid. The owner reports the original value is available
privately; no replacement token is presently needed.

A separate owner-terminal candidate validates strict classic format, intended
identity, exact scope, finite expiry and repository administration using two
read-only GitHub requests. It can pass the same verified in-memory value through
the unchanged anonymous-pipe preparation bridge. No secret is accepted through
chat, argv, environment or files; raw responses and exceptions are suppressed.
Offline tests exercise Windows hidden input, controls, failure responses and
single preparation. Existing fourteen secret-flow groups remain passing.
Live credential validation and provider acceptance are still pending.

At this checkpoint no new AWS mutation has occurred. The previous stack remains
ROLLBACK_COMPLETE pending fresh exact-identity/no-survivor deletion checks.
New exact-SHA five-job CI, official artifact verification, source/asset checks,
ordinary failed-stack deletion, new-template-only publication, CREATE change-set
review, execution and hosted build verification remain required before any PASS.
No automatic retry, force cleanup or workaround is authorized after another
unexpected failure. No Phase 4E tests have begun.

The [October 15 local CLI stop](phase4d-deployment-outcome.md) and
[October 16 provider rollback](phase4d-recovery-outcome.md) remain historical
records. Accepted manual cost thresholds remain USD2 review, USD5 first-week
stop and investigation near unexplained USD1/day, with USD0–5 monthly target
and review above USD10 recurring gross hosting. These are not spending caps.
