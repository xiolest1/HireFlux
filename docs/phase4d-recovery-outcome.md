# Phase 4D narrow executor recovery — 2026-10-16

**BLOCK — DEPLOYMENT INCOMPLETE OR UNSAFE.** The authorized executor correction
worked: the original change set reached actual CloudFormation provisioning.
Creation then failed independently in AWS Budgets and Amplify. AWS-managed
rollback completed; no functional staging application or hosted build exists.
Phase 4E must not begin.

This supersedes the current-state summary in the
[October 15 blocked handoff](phase4d-deployment-outcome.md), which remains the
historical record of the original noninteractive CLI defect.

## Authorized correction and qualification

The owner explicitly authorized only `--require-approval never` on the existing,
secret-free `execute-change-set` command, followed by one corrected attempt
against the original reviewed change set. No hidden-input, publisher, template,
IAM, rollback, application, architecture or account-setting change was allowed.

Only those two executor arguments changed in the ignored local entry helper.
Removing them reproduces the original helper bytes/hash. The corrected SHA-256
is `847a728c57c075c020b42128f93e9a6e7bb0d633d86c05ca49e82035e96c838b`;
the bridge and core retain their accepted hashes. All fourteen existing synthetic
groups passed. Focused tests using the pinned native diff/IO host reproduce the
original non-TTY failure and the corrected security-confirmation success, while
unexpected rollback and destroy prompts still fail closed. Exact target,
change-set name, preflight gates, DEVNULL streams, telemetry suppression and
single-launch/no-retry behavior remain intact.

Frozen deployment HEAD remains `8f2e39b0a453f810779de2f99d3cc3b8fe8c08fc`.
GitHub main and all five jobs in exact-source CI run `38686294308`, attempt 1,
were freshly reverified. No runtime/infra/dependency/workflow source change,
artifact rebuild, asset publication, new PAT or change-set creation occurred.

## Fresh pre-execution evidence

The owner renewed temporary native `hireflux-operator` authentication for the
same non-root account ending 9465, explicit `us-east-1`. The original staging
placeholder and change-set UUIDs matched; state remained REVIEW_IN_PROGRESS and
CREATE_COMPLETE/AVAILABLE with zero resources and no competing change set.
Original template, execution role, three tags, masked parameters, bootstrap 32,
blank-email selection and exactly 22 Add actions passed fresh review.
STANDARD/DisableRollback=false metadata and the omitted executor override were
unchanged under the owner's accepted normal AWS rollback policy.

Version-pinned full-body reads again verified both published objects, their
accepted version IDs/lengths/SHA-256 values, private/public-block settings,
versioning and AWS-managed KMS encryption. Exactly two object versions remain,
with no delete markers or multipart uploads. Nothing was republished.

The scoped configuration comparison found 41 of 42 checks unchanged. The sole
difference was three retained unrelated AMI/metadata/WordPress lab log groups,
about 22 KB combined, without retention. The owner explicitly confirmed these
expected personal-lab changes and accepted the Billing/lab baseline. No lab
resource or retention setting was changed. Toolkit/template/version/protection
and all five bootstrap-role trust/attached/inline configurations matched.

The filtered write-event window from the earlier failure through the recovery
check completed eight pages/367 unique events, consistent with those confirmed
lab lifecycles and sign-in. No unexplained write-event class remained. This is
scoped metadata evidence: CloudTrail can lag; it is not an all-region audit or
complete actor/resource attribution, nor a blanket EC2/EBS absence certificate.

## Actual execution and failures

Exactly one corrected invocation ran **05:30:48–05:33:58 UTC / 01:30:48–01:33:58
EDT on October 16**. It executed `hireflux-staging-reviewed-first`, UUID
`52379284-3b4c-4318-bfe7-631d2da2d26b`, and finished exit 1. This is the second
executor invocation overall: the first stopped before provisioning on October 15;
the one newly authorized corrected attempt is now consumed.

Two primary CREATE_FAILED events explain the failure:

1. **AWS Budgets rejected `Budget.Metrics`.** The qualified construct/template
   sends `UNBLENDED_COST`; the service's returned allowed enum includes
   `UnblendedCost`. The exact synthesized assertion repeated the invalid value,
   so earlier tests did not catch this provider contract defect. CloudFormation
   and CDK type this property as unrestricted strings. The official
   [Budget API enum](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_budgets_Budget.html)
   agrees with the installed SDK model and actual rejection. Some official
   [CreateBudget examples](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_budgets_CreateBudget.html)
   still use uppercase, so documentation is inconsistent; live validation resolves
   the spelling accepted by this service. This is a source defect, not merely a
   read-side display normalization.
2. **Amplify repository setup failed with GitHub `401 Bad credentials`.**
   Amplify returned HTTP 400/InvalidRequest wrapping that authentication failure.
   The token value was not inspected or retrieved. The error does not establish
   whether the owner's token was expired, revoked, incorrectly entered or otherwise
   unusable, and does not justify broader scopes. No new token, permission change,
   app recreation or build retry was attempted.

Both resource-handler errors report SDK attempt count 1. Other initial resources
were cancelled as a consequence; no independent service defect is inferred from
those cancellation messages. Raw CLI output stayed suppressed, while the actual
sanitized CloudFormation events provide these provider errors. No operator retry,
manual rollback, force, cleanup or deletion was initiated.

## Terminal state and residual inventory

CloudFormation reached **ROLLBACK_COMPLETE**. All eight listed attempted resource
rows show **DELETE_COMPLETE**; the remaining selected resources never reached a
successful deployment. The final independent read-only snapshot at **05:37:01 UTC
/ 01:37:01 EDT** confirms:

- No Lambda functions, Amplify apps, DynamoDB tables or signing-secret metadata,
  including planned secret deletion, in the queried regional inventory.
- No staging alarms, dashboard or monthly budget. No build or public staging
  URL exists, and no connectivity/behavioral test was performed.
- Toolkit remains protected CREATE_COMPLETE, eleven resources, SSM version 32;
  Lambda total/unreserved concurrency remains 1,000/1,000.
- Seven log groups and thirteen roles remain, matching the pre-execution scoped
  inventory including the owner-confirmed labs; no application survivor is
  inferred from a cancelled CREATE event.
- The exact two accepted S3 versions remain unchanged.
- The original change set is no longer returned (`ChangeSetNotFound`). The failed
  stack record remains. Its PAT parameter metadata is present and masked; this
  does not prove provider-side deletion of the stored input or GitHub revocation.

These are the checked service boundaries, not an exhaustive certificate about
every AWS/GitHub service or asynchronous provider side effect.

## Next recovery boundary — proposal only

The current authorization is exhausted. Another execution of the old change set
is impossible because it is absent. The ROLLBACK_COMPLETE stack is not an empty
REVIEW_IN_PROGRESS placeholder; the trusted first-create guard must continue to
refuse it. Do not bypass that guard or let a generic deployment delete it.

A separate reviewed recovery would need to:

1. Authorize the minimum budget source/test correction to `UnblendedCost`, plus a
   regression tied to the service enum. Preserve amounts, monthly period, exact
   Project AND Environment filters, notifications, tags and selected count.
2. Requalify affected infra checks and both staging/production synths, establish
   a new source/CI/template identity and review its asset/change-set implications.
   The Linux runtime ZIP need not be rebuilt if its actual inputs remain unchanged;
   any new artifact provenance must still be verified.
3. Resolve the independent GitHub credential failure through an expressly
   authorized owner-controlled process. Never request a token in chat or recover
   the stored value. Do not broaden permissions or assume token expiry.
4. Obtain explicit authorization for handling the failed stack record and any new
   template publication, secure input, CREATE change set or deployment. Review
   retained state and privacy/cost consequences before a deletion decision.

None of these source, credential, stack-lifecycle or deployment actions has been
performed automatically. This report is not authorization to perform them.

## Cost, privacy and roadmap

Owner-confirmed baseline and manual controls remain: USD2 incremental gross
review, USD5 first-week testing stop, unexplained approximately USD1/day
investigation, USD0–5 monthly target and review above USD10 ongoing hosting.
They are not caps. Short-lived resource/API/KMS usage and retained bootstrap
assets can incur charges; no exact deployment-window dollar amount was measured.
Projected hosting costs are not actual Bills. No live application alarms,
secrets, dashboard, build or budget survived to form the modeled recurring app
baseline. Shared labs remain outside the app's cost filter and were not changed.

No signing-secret value, stored GitHub token, password or MFA code was requested.
The original hidden-input boundary was preserved; the correction touched only
the secret-free execution command. No new IAM permissions, account-plan/Billing
setting, cost-tag activation, repository access selection or architecture change
was made. No automatic PAT revocation occurred. Bounded source/evidence screening
and actual masked-parameter metadata are reported separately from any claim
about owner clipboard, browser or process memory.

L09's original assets/change-set review passed, but its template is now known to
need correction and its change set is gone. L10 deployment is blocked. L11–L16 and
L18–L20 remain pending/incomplete; optional-email L17 remains N/A for blank email.
Phases 4E–4H and inherited production findings F03/F04/F07/F08/F10/F11 remain open.
No broader runtime, browser, load or authentication verification has begun.

Outcome documentation is updated locally after the terminal stop. No commit or
push occurred; no documentation-triggered build exists. The complete forty-field
handoff and screened receipts remain under ignored `.tools/phase4d-recovery/`.

**Did the qualified application deploy successfully so Phase 4E may begin? No.
The executor defect is corrected and qualified, but Budgets and repository
authentication failures caused complete AWS-managed rollback.**
