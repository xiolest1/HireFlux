# Phase 4D supervised staging deployment — blocked before execution

Historical October 15 checkpoint. The owner later authorized the narrow executor
correction and one corrected execution, which reached provisioning but ended in
AWS-managed rollback. See the [current October 16 outcome](phase4d-recovery-outcome.md).
The available change set/unchanged-helper statements below describe the earlier
stop, not current AWS state.

## Outcome on 2026-10-15

**BLOCK — DEPLOYMENT INCOMPLETE OR UNSAFE.** The qualified application has not
been created. One authorized asset publication and one review-only CREATE
change-set preparation succeeded. The single authorized executor invocation
returned exit 1. Direct subsequent AWS reads show `hireflux-staging` remains
`REVIEW_IN_PROGRESS`, with zero application resources; its reviewed change set
remains `CREATE_COMPLETE / AVAILABLE`. Phase 4E must not begin.

The owner's consolidated authorization covered the complete qualified sequence,
including execution and one initial Amplify build after successful checks. This
is an unexpected executor defect, not a missing routine approval. That same
authorization requires stopping after unexpected failures, with no silent helper
change, recovery retry, cleanup, deletion or force operation. None occurred.

## Qualified source and published inputs

- Frozen deployment HEAD: `8f2e39b0a453f810779de2f99d3cc3b8fe8c08fc`.
- GitHub Actions run `38686294308`, attempt 1: all five exact-source jobs passed.
- Downloaded artifact `11950561407`; outer SHA-256
  `a5e0af248f8f23cdcf4a81494477589bc8f64635bb39a51e5736b4f03a499fc9`.
- Canonical Linux Lambda ZIP: 26,642,450 bytes, SHA-256
  `4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`.
  S3 key `ee374ad8661035832c785da52fc5ad600c40f8989129b3d62ddd6b18bcf68202.zip`;
  version `fDpJO0cYS2GtDu4RRd15BexRD1EamOqL`.
- Bound template: 42,915 bytes, SHA-256
  `1a7e59135e3467810fd2be2bf9e283f4ee2545744fb7fd67aa400a14705b9760`.
  Same digest with `.json` is its S3 key; version
  `27Q7dE6L2L_K1J.s36xqI1i1OoLEVxHv`.

One publisher invocation uploaded exactly these two objects to the existing
approved bootstrap bucket. Independent complete-body readback verified lengths,
digests and version IDs. Objects use AWS-managed S3 KMS encryption; public access
is blocked, bucket policy status is not public, and no abandoned multipart upload
or delete marker was observed. A later listing confirmed the same two versions,
with no repeated publication. No application artifact was rebuilt or repacked.

All three accepted local helper hashes remain unchanged. Their fourteen grouped
synthetic checks passed before deployment; those checks did not catch the native
CLI approval incompatibility described below. No qualification result should be
read as proof that the complete live execution path succeeded.

## Actual preparation and independent review

The intended non-root native-login profile `hireflux-operator`, account ending
9465 and explicit `us-east-1` were reverified. Native pinned CDK resolved the
accepted publishing/deployment roles without operator fallback. Existing
CDKToolkit remains protected `CREATE_COMPLETE`, with eleven resources and SSM
version 32. Total/unreserved Lambda concurrency remains 1,000/1,000; reservation
5 is qualified but no function exists to hold it yet.

The first owner-terminal launch used Windows PowerShell with its effective
`Restricted` script policy and never reached the helper receipt. AWS independently
confirmed stack absence. The same unchanged launcher was opened with installed
PowerShell 7, without changing an execution policy. The actual preparation helper
ran once, recorded exit 0, and the owner reported `PREPARED_REVIEW_ONLY`.

The owner personally created/entered the PAT through hidden input. The instructed
contract was a dedicated classic `admin:repo_hook` token with seven-day expiry;
its actual value and token settings were not inspected. The token was not passed
in CLI arguments, environment variables, context or local evidence. The separate
GitHub installation settings were rechecked: AWS Amplify (us-east-1), xiolest1,
Only select repositories, exactly HireFlux, with the previously approved
permissions. No repository authorization was changed during 4D.

Prepared change set:

- Name: `hireflux-staging-reviewed-first`.
- UUID: `52379284-3b4c-4318-bfe7-631d2da2d26b`.
- Stack UUID: `c73a0560-c8aa-11f1-8478-0affe0e3c727`.
- One page, exactly 22 expected Add actions, matching every selected logical ID
  and resource type. No modifications, removals, replacements or imports.
- Original template equals the qualified bound template. Correct execution role,
  account/region, three stack tags, masked PAT/email and resolved bootstrap 32.
- Blank-email selection is also proven by the exact condition and absence of all
  three SNS resources. Five alarms, dashboard and budget remain selected.
- `IncludeNestedStacks=true` and IAM/NAMED_IAM/AUTO_EXPAND capabilities match
  pinned native defaults; this exact template has no nested stack, macro or
  transform and the actual additions contain none.

Two independent local reviews passed before execution. Actual failure metadata
was `OnStackFailure=null`, placeholder `DisableRollback=false`, and change-set
`DeploymentConfig={Mode:STANDARD, DisableRollback:false}`. The unchanged executor
omits a top-level `DisableRollback` override. The owner accepted normal verified
AWS-managed failure/rollback, including removal of newly created resources; no
preservation guarantee or silent policy change was introduced. See the official
[deployment configuration](https://docs.aws.amazon.com/sdkfornet/v4/apidocs/items/CloudFormation/TDeploymentConfig.html)
and [ExecuteChangeSet](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_ExecuteChangeSet.html)
references; record actual returned fields rather than assuming every API default
describes the prepared operation.

## Failed execution and proven local blocker

The accepted executor ran once, **15:15:26–15:15:41 UTC / 11:15 EDT**. It returned
fixed `STOP` and exit 1. Its raw CDK output was intentionally discarded by the
trusted privacy boundary. No live emitted error code or text was retained.

Read-only diagnosis and independent offline reproduction establish a concrete
incompatibility in that executor:

1. Actual stack-only `GetTemplate(Original)` succeeds with `TemplateBody=""` for
   the unexecuted review placeholder. Pinned CDK converts that empty body to `{}`.
2. The pinned native security diff classifies the exact qualified template and
   actual change set against `{}` as permission **broadening**.
3. CLI `deploy --method execute-change-set` still passes through the normal
   security-approval request. Its default is `requireApproval=BROADENING`.
4. The accepted wrapper supplies `DEVNULL` for stdin/stdout/stderr and no approval
   override. Pinned `CliIoHost` cannot ask for approval without a terminal and
   rejects this request with `TtyNotAttached` before `ExecuteChangeSet`.
5. An offline control with explicit approval mode `never` accepts that already
   reviewed security request. No CLI deployment or AWS mutation was replayed.

This proves a blocker consistent with the observed unchanged AWS state; it does
not claim to recover the original discarded stderr or uniquely exclude every
earlier historical CLI failure. The later state reads remain authoritative:
review placeholder, zero resources, available original change set. The final
15:18:53 UTC snapshot also reports zero Lambda functions and Amplify apps, healthy
toolkit, unchanged concurrency and the same two S3 versions. No ExecuteChangeSet
audit event was returned for the checked window, but CloudTrail delivery can lag.

## Smallest proposed recovery — not applied or authorized

Add exactly `--require-approval never` **only to the secret-free executor's
existing-change-set command**, after the completed independent template/IAM
review. Keep the hidden PAT preparation, publisher, template, deployment roles,
failure policy, exact change-set guard and output suppression unchanged. Do not
add `--yes`, force, cleanup or deletion behavior. Unexpected rollback prompts
would continue to fail closed.

Before any further AWS mutation, review the candidate diff/new helper hash,
rerun the original fourteen synthetic groups and a native default-versus-never
approval regression, and revalidate exact command/stream/template/state/role
guards. Then obtain separate owner recovery authorization for **one** corrected
execution of this still-available change set, with fresh AWS/source checks. A
helper-only correction does not by itself justify rebuilding the unchanged
Linux artifact. Changes to qualified source inputs require the corresponding
Phase 3F/3G/4A, synth, artifact and exact-source CI requalification.

No candidate helper change or retry has been made. The owner instruction to stop
after an unexpected defect is the reason further execution needs a new decision.

## Cost, privacy and retained state

The refreshed Bills/Credits/lab baseline was accepted by the owner. Approximate
owner-reported promotional credits remain distinct from the API's PAID/ACTIVE,
zero account-plan-credit result. No Billing setting, account plan, Cost Explorer
or cost-allocation activation was changed.

Focused pricing review recommended retaining the qualified monitoring unchanged:
two 14-day log groups and the qualifying 24-series dashboard can fit shared
allowances; the three simple alarms plus two six-operand metric-math alarms total
15 billed alarm metrics. Expected CloudWatch increment is about USD0.50/month if
ten shared alarm metrics remain, or USD1.50 with none; dashboard fallback is
USD3/month. These are allowance-dependent projections, not charges for deployed
resources: none of the five alarms/dashboard/log groups exists for HireFlux yet.

Modeled whole-app gross monthly costs remain roughly USD1.70–2.70 mostly idle and
USD3.30–4.30 for a small testing group, before credits/tax, with about USD6–8 if
relevant CloudWatch allowances are unavailable. Preserve the USD0–5 target,
review projections above USD10, incremental USD2 review / USD5 first-week testing
stop and unexplained approximately USD1/day investigation. These are manual
controls, not caps. Bills can lag; no exact incremental dollar amount was measured
for this window. See [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/).

Retained state is the existing toolkit, two private versioned asset objects and
the unexecuted PAT-bearing NoEcho change set. Storage/KMS/request charges can
remain; there is no application idle alarm/secret/build charge yet. The proposed
USD10 application budget is not live. No actual clone method or first build exists
to support a PAT-revocation decision. No automatic revocation or cleanup occurred.
Owner input, clipboard and browser memory are outside the evidence scan.

Pattern screening found no GitHub PAT in tracked text or Phase 4D evidence.
It identified temporary AWS login-session identifiers in three IAM tag names in
one ignored read-only receipt; those unnecessary tag entries were omitted locally,
without changing AWS tags. No access-key secret or session token was found. Masked
CloudFormation parameters and structural hidden-input/no-argv/no-env controls
remain evidence of the intended boundary, not a universal memory-forensics claim.

No production, unrelated-lab, account-plan, quota, IAM trust, repository-permission
or budget mutation was performed by this deployment attempt. Later whole-account
and deployed-policy qualification cannot be substituted for the zero-resource
observation. Existing administrative powers were not expanded.

## Remaining roadmap and documentation boundary

- **L09:** artifact publication and exact change-set review passed; execution is
  blocked by the executor incompatibility, so the full deployment gate is open.
- **L10–L16:** resource configuration/IAM, runtime secrets/schema/TTL, public
  wiring, clone/build and hosted/browser qualification remain pending.
- **L17:** optional email delivery remains N/A for blank email; actual monitoring
  resource/delivery verification is pending.
- **L18–L20:** bounded load/latency/throttling, costs/backlog and final evidence/
  stop/recovery acceptance remain pending. Phases 4E–4H have not started.
- Production findings **F03/F04/F07/F08/F10/F11** remain inherited and open.
  Cognito, production deployment and broader testing remain outside this task.

Documentation was updated locally after this clear blocked stopping point.
No commit or push was made, so the frozen deployment HEAD and accepted CI remain
unchanged and no documentation-triggered Amplify build occurred. A future main
push after hosting exists can trigger another automatic staging build and must
be recorded and qualified.

The complete forty-field local handoff and sanitized evidence index are retained
under ignored `.tools/phase4d/`; private account identifiers, token values and raw
provider logs do not belong in committed documentation.

**Was the exact qualified staging application successfully created so Phase 4E
may begin? No. Assets and change-set preparation passed; application creation and
hosting have not occurred. Resolve and separately authorize the narrow executor
recovery before continuing Phase 4D.**
