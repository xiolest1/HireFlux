# Assignment 1 release qualification and staging procedure

Recorded November 10, 2026. **Local release qualified; remote CI publication
pending.** This procedure authorizes no Git publication or AWS operation.

The accepted delivery order remains: (1) one qualified release, (2) actual
staging deployment and acceptance, (3) protected production and operational
readiness, (4) production acceptance and explicitly controlled public launch.
Production signup activation, binding, header migration and public launch are
not Assignment 1 work.

## Selected local release

Base commit is `a1b4df4d2f4f8de676eae7151b44dd26777b31c5`, plus the
uncommitted Assignment 1 test/dependency and documentation changes. This is
not an immutable new commit or a green remote CI revision.

Infrastructure owns development dependency `js-yaml` exactly `4.3.2`; the hosting
test uses ordinary package resolution. Its clean installation and 164 unit
tests passed without any frontend installation. Typecheck, both offline synths,
four real-artifact CLI tests, both-environment schema parity and 19 focused
hosting/publication script tests passed. The latter appropriately use the
frontend's own dependency installation. No application behavior changed.

The selected backend remains the untouched Batch 3 artifact:

- ZIP: `.tools/phase7b-batch3-20261103/hireflux-backend-candidate.zip`.
- SHA-256: `08933f7b30edc158e09ac2528bc6c66554087a6706694bcf8f0e7a320da45066`.
- Size: 31,706,710 bytes; expanded size: 73,759,416 bytes; 3,969 members.
- Manifest SHA-256: `ca6a88440e84f428981dc3ed6689337a3f6e78144ab7c4845f415b57f56d79ee`.
- Python 3.14 / Linux x86_64, handler `hireflux_backend.lambda_handler.handler`.
- CDK custom asset destination key:
  `49d01c461a851745d45e2cc44452738af56d1be81bbaea99e7e00e71391fb1de.zip`.

The November 5 CI run `42098137503`, artifact `13447589460`, was downloaded
read-only. Its inner ZIP is `abb1519534c1c98fd3cf5cdb3b430e24582be223a45b2a0a21b91018215121ab`,
31,708,454 bytes. All extracted bytes, member order, canonical timestamps/modes
and 35 distribution versions match the selected ZIP. Compression sizes differ
for 686 members. Recompressing the selected members in memory with Python
3.13.15 / classic zlib 1.3.2 reproduced that exact CI ZIP. This demonstrates a
compression-toolchain difference, not a demonstrated Python patch-level behavior
change. No wheel or application file differs.

The manifests also differ in `lock_sha256`: the selected manifest hashes Windows
CRLF bytes; CI hashes the LF Git blob. Normalizing only CRLF to LF reproduces
CI's lock hash exactly. Do not rewrite either historical manifest, relax the
existing raw-byte verifier, or substitute one ZIP at the other's asset key.
All 82 packaged application Python sources match current source after the
builder's established LF normalization. Current project/lock semantics match.

Evidence is retained in ignored `.tools/assignment1-20261110/`, including the
complete source inventory, release manifest, archive comparison and validation
receipts. Historical runtime qualification remains attributed to Batch 3; fresh
checks did not rerun the unchanged full backend/frontend campaigns or Docker.

## Templates and staging compatibility

Fresh isolated, unbound synths reproduce the historical bytes exactly:

- Staging: `3f9154fd84607ba4831085f333990b8889b93530209df5a8411f6e0f269a2855`.
- Production reference only:
  `c13ec4588359d636282968deec10ce9f33096311758e9b016864d30e876e3f02`.

For staging, prefer the additionally qualified **explicit-account** synthesis
in `.tools/assignment1-20261110/staging-account-bound/`. Its template hash is
`ba2b06fc1d776ebbb98cbbcff84e99ed9e0dea5d2b475ad09038be0814b39c4a`.
Use the existing `stagingAccount` context with the separately approved full
account; no infrastructure source workaround is needed. Against the retained
October 27 closed template, it preserves the entire Lambda invoke permission,
including the literal-account `SourceArn`, and conditional SNS policy exactly.
This removes the demonstrated representation-only permission delta. It does
not predict or approve a future CloudFormation change set.

The offline expectation is one Demo route addition and four existing-resource
modifications: Lambda code plus explicit 24-hour TTL, restricted table-write
IAM, API stage route-specific throttle, and equivalent stored Amplify headers.
There are 30 declarations / 27 selected with blank alert email, zero outputs,
and no removed resources or changed stateful logical identities/lifecycles.
The current table is staging's existing DESTROY/no-PITR definition; do not
mistake it for production's protected/PITR/Retain definition or destroy it.

Staging API/site/Cognito bindings remain those in
`frontend/src/deployment-targets.json`. The browser build uses workspace mode
`demo`, with mixed Demo/Cognito capability admitted through the validated public
configuration. Cognito IDs, callback/logout paths, client and domain remain
unchanged. Registration stays CLOSED in Cognito, Lambda and the public binding.
CORS includes `Idempotency-Key`. The explicit POST reuses the existing integration;
its 1 RPS / burst 2 throttle is best effort, not a spending cap or admission stop.

Frontend source, lock, Vite settings, root headers and build configuration have
not changed in Assignment 1. Root `customHttp.yml` remains authoritative; do not
retire it or treat equivalent stored App headers as a completed migration.
Production binding remains null and production OPEN remains prohibited.

## Publication ordering and approvals

The following are proposed steps requiring fresh, explicit operational approval.
Historical request caps and bespoke upload executors are not reusable authority.
Use supported CLI/SDK/CloudFormation commands with bounded attempts and explicit
handling of uncertain outcomes. Do not introduce another executor.

1. Approve the exact pending source inventory, one normal commit/push and remote
   CI observation. Recheck actual GitHub target, tip and fast-forward ancestry
   immediately before publication; stop on drift rather than fetch/reset/force.
2. Include an explicit staging build hold in that approval: freshly verify the
   existing Amplify App/`main` branch and current hosted job; record auto-build
   state, then disable branch auto-build and confirm it **before** the push.
   This is a temporary, separately approved AWS mutation, not work already done.
   It prevents publication from unintentionally releasing a frontend ahead of
   the backend. No production branch/build is involved.
3. Observe the exact new commit's existing validation workflow to completion.
   Confirm all required jobs pass. Compare its downloaded Lambda members and
   source/lock provenance to the selected release; never silently replace the
   selected ZIP because CI emits another compression identity. Recheck the
   final source inventory and offline template identity if release inputs differ.
4. Assignment 2 starts only under its explicit authorization, with fresh identity,
   stack/template/resource/IAM/branch/registration evidence and an accepted current
   cash-funded cost baseline. Prior inventories are dated evidence, not live fact.
5. Establish the maintenance controls below before an update can expose old code.
   Publish/reuse only the selected ZIP at its custom asset key and accepted bucket.
   Use expected bucket owner, supported checksum and conditional-write controls.
   A response-lost upload is UNKNOWN: reconcile through an explicitly allowed
   bounded read; do not blindly PUT again. An object merely existing is not
   sufficient proof of identical content.
6. Create one unexecuted staging UPDATE change set using the exact approved
   account-bound template, existing CloudFormation execution role, previous
   NoEcho values, blank email baseline and normal rollback policy. Review the
   actual resource/property/replacement list, including Conditional replacements.
   Any difference from the expected scope requires review, not automatic repair.
7. Obtain explicit execution approval for that actual change set, maintenance
   mutations, observation budget and recovery decisions. Verify artifact, source,
   template, target and policy identities again; execute once and observe boundedly.
8. Verify deployed Lambda ZIP hash/configuration, exact role policies, routing,
   registration closure and physical resource identities. Establish/verify the
   correctly typed operator-owned Demo control record as PAUSED through a
   separately authorized conditional write; do not read or overwrite unrelated
   user data. Missing/invalid policy must remain fail-closed in the new backend.
9. Only after the controls and backend are accepted, authorize one intentional
   Amplify build of the frozen qualified revision while auto-build is held.
   Verify the actual job commit and delivered frontend/API/Cognito/header binding.
   Restore the recorded auto-build setting only under the same explicit approval
   and after accounting for any job observed on re-enable; never start a second
   build to compensate for an ambiguous first one.
10. Run only the bounded Assignment 2 Demo and real two-account acceptance that
    the owner separately authorizes: transaction IAM, CONTROL write denial,
    pause/replay/budget handling, cold/warm seeding latency, private persistence
    and cross-account isolation. Signup opening, emails, Demo control writes and
    test identities need explicit scope/counters and a supervised closure plan.

## Maintenance and rollback containment

**Recommended for owner review:** a brief whole-backend outage using reserved
concurrency zero, with an independent temporary datastore-write quarantine.
Zero alone is not a rollback-safe interlock: the template declares concurrency
5 and CloudFormation owns that property. Do not assume it preserves an out-of-band
zero during an update or UPDATE_ROLLBACK. Reapplying zero after detecting a change
would leave a race and is not sufficient containment.

The proposed independent control is a separately named, temporary inline **Deny**
on the existing backend execution role: one statement limited to the staging
table's PutItem, UpdateItem, DeleteItem and BatchWriteItem actions, and one denying
`cognito-idp:AdminDeleteUser` on the existing staging pool. The latter also blocks
provider finalization for an account already erased before maintenance. DynamoDB
transactions evaluate their component actions. Do not replace the managed data policy, deny unrelated
labs, grant authority, or create a new role/service. Neither the old nor candidate
role declares an embedded `Policies` list; the existing CloudFormation data policy
has its own name. Fresh review must confirm the temporary policy remains separate,
the role is not replaced, and rollback retains the restriction. This is a proposed
maintenance control, not freshly verified AWS behavior or approved IAM mutation.

Before executing: approve its exact policy/name/target, put and verify it, set
concurrency zero, then allow already-running invocations to drain using the fresh
function timeout plus margin. IAM changes propagate eventually; do not treat a
successful PutRolePolicy/GetRolePolicy as proof of immediate enforcement. Require
a separately budgeted effect check and satisfactory quiescence before proceeding;
do not promise cancellation of already-running calls. Account for a possible
fictional workspace if a containment probe unexpectedly succeeds. Keep the
quarantine intact through all update/rollback outcomes, recheck it after relevant
events, and do not restore general write service to an admission-ignorant binary.
CloudFormation may make invocations possible if it changes concurrency; the
independent denial must still prevent Demo seeding, datastore mutations and
provider deletion. This is a mutation quarantine, not a guarantee of zero reads,
logs or invocation charges while CloudFormation manages concurrency.

Exact additional operator actions proposed are `iam:PutRolePolicy`,
`iam:GetRolePolicy`, `iam:DeleteRolePolicy`, `lambda:PutFunctionConcurrency` and
`lambda:GetFunctionConcurrency`, scoped to the accepted role/function. Staging
build hold needs `amplify:GetBranch` and `amplify:UpdateBranch`; the later single
build needs `amplify:StartJob` and bounded job reads. Existing publication/update
permissions also need fresh verification. **Availability of these permissions is
UNVERIFIED**; prior STS success proves identity, not authorization. If unavailable,
stop and obtain an approved safe containment alternative; do not escalate IAM.

After the new admission-aware code, configuration, IAM and PAUSED policy are
verified, explicitly approve removing only this temporary quarantine and restoring
the intended concurrency 5. Inspect the actual policy before removal. Recheck
controls and bounded PAUSED behavior before allowing test issuance. Healthy UI or
CloudFormation status alone cannot authorize removal. Valid existing Demo tokens
retain their signed expiry; maintenance may make their requests fail temporarily,
does not delete their data, and does not extend their lifetime.

- **Before upload / denied permission:** stop; no asset retry or privilege change.
  Release maintenance only if the owner accepts returning to the old known state;
  if preventing old-code admission is required, keep the outage/quarantine.
- **Uncertain upload:** retain UNKNOWN and reconcile identity/checksum once within
  an approved read allowance; no blind overwrite or second asset.
- **Change-set failure or rejection:** do not execute; retain evidence and asset.
  No deletion/recreation or source correction without approval.
- **UPDATE failure before/after Lambda changes:** keep maintenance and quarantine;
  inspect actual events/code/config once within the approved recovery budget.
  Normal CloudFormation rollback is expected; do not disable it silently.
- **UPDATE_ROLLBACK restores old code:** it is not eligible for public write
  service. Keep quarantine even if concurrency returns to 5; verify the exact
  role/control state. Repair forward or use an independently qualified
  admission-aware ZIP/configuration under new owner approval. The selected Batch
  3 ZIP is an eligible binary candidate, not an independently accepted live rollback.
- **Rollback stuck:** no force, delete, skip-resource or automatic second execute.
  Preserve the containment controls and request the smallest recovery approval.
- **Frontend ahead of backend or unexpected build:** keep backend containment;
  inspect actual job/revision. Choose an exact compatible hosted revision or a
  forward build under separate approval; do not trigger another build automatically.
- **Absent/PAUSED policy:** new issuance remains unavailable. Never restore old
  code to work around it. Existing identity behavior and user writes resume only
  after explicit verification and release of the independent maintenance guard.

AWS documents [zero reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html),
[sequential Lambda configuration/code updates](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-function.html),
[transaction component permissions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html),
and [IAM propagation limits](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot.html#troubleshoot_general_eventual-consistency).
The independent quarantine and its acceptance checks above are an engineering
proposal combining those constraints, not an AWS guarantee or a completed drill.

## Financial, security and completion qualifications

Use $0 assumed usable promotional credit. Preserve the manual $2 incremental
review, $5 initial-testing stop, approximately $1/day unexplained-growth
investigation and greater-than-$10/month hosting review. They are not hard caps.
No new financial investigation was run here. Stopping tests/setting concurrency
zero does not stop retained storage, Secrets Manager or monitoring costs. Build
hold and temporary inline IAM policy add no new permanent resource; request,
artifact-storage and intentional build usage must be budgeted in the next approval.

The focused infra npm audit has no high/critical finding; existing bundled
CDK/minimatch advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
remains moderate and outside the parser fix. Added `js-yaml`/`argparse` are not
listed as affected. No unrelated dependency upgrade, override or forced downgrade
was made. This is not a blanket clean-audit statement.

No Assignment 1 signed AWS request, resource mutation, hosted request, user/email
activity, commit, push or build occurred. The separately authorized preceding
authentication maintenance used three explicitly approved CLI login attempts and
one successful STS identity check; it is accounted separately. Current deployed
state, maintenance permissions/effectiveness, future remote CI and staging
application acceptance remain live prerequisites, not claims established offline.
