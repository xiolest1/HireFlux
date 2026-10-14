# Phase 4B shared-account permission proposals

**Review drafts only. No AWS IAM policy, boundary, role or resource has been
created from these drafts. These files are not deployment inputs.** The existing qualified stack
cannot use them unchanged. These drafts do not authorize later phases.

The [2026-10-11 recovery](../../production-account-readiness.md#50-phase-4b-recovery-temporary-login-and-quota-request)
prefers a separately approved standard bootstrap for the owner-confirmed personal
lab account. All fourteen drafts remain unapproved alternatives; none is required
by or imported into the qualified stack. The historical assessment below is
preserved. Temporary login and a later quota request do not install these drafts.

The [2026-10-14 completion](../../production-account-readiness.md#51-phase-4b-applied-quota-and-bootstrap-approval-checkpoint)
separately approved and verified standard CDKToolkit without implementing any
draft. The owner confirmed a personal learning account and accepted that model's
broad administrative risk. The historical assessment below describes the older
restricted-policy alternative, not the current bootstrap state. Its technical
gaps remain unresolved if that alternative is chosen later.

The owner has one shared account and forbids a new account, Organizations,
Control Tower and a plan upgrade. Read-only GetAccountPlanState contradicts the
owner's Free-plan assumption: PAID / ACTIVE. The owner explicitly requested that
this result be preserved and mutations remain blocked pending manual Billing
verification. Full private receipts and the thirteen-field remediation handoff
are under ignored `.tools/phase4b-remediation/`.

## Proposed authority split

- `cfn-execution-core.draft.json`: named staging DynamoDB, signing secrets,
  Lambda, logs, bound HTTP API and Amplify IDs, alarms, exact asset reads and
  runtime-role PassRole. Creation requires Project=HireFlux and
  Environment=staging request tags where modeled. Regional actions use us-east-1.
- `cfn-execution-iam.draft.json`: an optional tightly bounded runtime-role
  creation route. Exact `/hireflux/staging/runtime` path/name; mandatory immutable
  runtime boundary at creation; inline policy edits only on that role. Denies
  changing trust, boundaries, managed policies and creating users/access keys.
- `cfn-execution-operations.draft.json`: exact dashboard and monthly budget.
  Denies automated budget actions and broad legacy billing-write permission.
- `cfn-execution-boundary.draft.json`: maximum authority for the execution role,
  paired with the three execution policies. Grouping actions/resources uses each
  AWS service's resource type; an ARN in another service does not authorize an
  operation. The boundary is 6,021 non-whitespace characters before binding,
  near the 6,144-character managed-policy limit. Optional extensions require a
  new size and security review, not simple concatenation.
- `runtime-boundary.draft.json`: existing runtime data operations on one named
  table and its three exact GSIs, two signing secrets and backend log streams.
  Explicit denial of other actions and foreign data/log resources also caps a
  hypothetical overly broad inline policy. This boundary grants nothing alone;
  preserve the existing scoped runtime identity policy.
- `deployment-role.draft.json`: only hireflux-staging stack/change-set scope,
  designated execution-role PassRole to CloudFormation, bootstrap version read,
  exact asset reads. Stack creation/update requires the designated RoleArn.
  Stack deletion is explicitly excluded from routine deployment authority;
  recovery/deletion would need a separately reviewed operator role/action.
  Proposed change-set name prefix differs from a default CDK change-set name;
  prove CLI naming and tag/dependent-action behavior before applying the policy.
- `file-publishing-role.draft.json`: only the exact qualified ZIP and a separately
  bound template object in a proposed HireFlux-only bootstrap bucket. No lab
  bucket/object mutation or object deletion.
  An object key cannot enforce the uploaded bytes' SHA. Later qualification must
  bind/verify actual object version/checksum and Lambda code hash, not only its name.
- `image-publishing-role.draft.json`: exact proposed bootstrap ECR repository.
  GetAuthorizationToken needs Resource="*"; that action grants no repository
  push rights alone. The current Lambda asset is a ZIP and needs no image push.
- `resource-shell-creation.draft.json`: isolated proposed API/App creation
  authority. API creation constrains its name and request tags. Amplify CreateApp
  requires Resource="*" and request tags; it cannot enforce a unique physical
  app ID or a name through these modeled conditions. This is deliberately NOT
  included in the normal execution boundary.
- `optional-sns-review.draft.json`: exact topic lifecycle and email endpoint.
  AWS documents topic scoping for Get/SetSubscriptionAttributes and Unsubscribe.
  The synthetic owned-topic Unsubscribe positive simulation returned implicit
  deny; the foreign-topic negative returned deny. This discrepancy remains open.
  The main execution boundary does not admit SNS yet. Prefer the already
  qualified blank-email branch while reviewing the extension.
- `optional-asset-kms.draft.json`: proposed S3 AWS-managed-key usage, restricted
  by exact key ARN, S3 ViaService, account and encryption context. This is not
  included in the current execution or publisher ceilings. Its exact key and
  required caller/action path must be verified before deployment; do not assume
  the reviewed aws:kms bootstrap bucket uses SSE-S3 or create a customer key.
- Three `*-trust.draft.json` files: exact operator principal for routine roles,
  CloudFormation service for execution, Lambda service for runtime. No account
  root delegation, external account, organization or GitHub OIDC trust proposal.

## Mandatory binding and source changes

Replace every `${...}` review placeholder privately after the owner authorizes
the relevant preparation. `${ACCOUNT_ID}` must resolve to the STS-verified
existing account, not a sample account. API/App IDs, template object key, KMS
key ARN, operator principal and optional email require actual reviewed values.
IAM policies do not interpret these review placeholders as supplied values.

Proposed names are NOT current qualified names:

- CDK qualifier `hfstage01`, with exclusive bucket/repository/version namespace;
  the qualified synthesizer currently uses `hnb659fds`.
- `hireflux-staging-workspaces` table; `/hireflux/staging/runtime` IAM role;
  `hireflux-staging-backend` function; `/hireflux/staging/backend` and
  `/hireflux/staging/http-api` log groups; `hireflux/staging/cursor-signing` and
  `hireflux/staging/demo-signing` secrets.
- `hireflux-staging-api` API name; qualified HTTP API name is currently `HttpApi`.
  Amplify's qualified app name is `hireflux-staging-frontend`, but its app ID is
  generated. Existing fixed dashboard/budget/alarm names are retained.

Before any later implementation, check exact names and generated-secret suffix
families for collisions. Reserve the namespace for HireFlux; never adopt,
retag, import, modify or delete an unrelated lab resource to satisfy a policy.
Explicit names can turn changes into replacements and prevent create-before-
delete replacement under the same name. Review every change set and rollback
path. No name, qualifier, boundary or source edit has been applied in this task.

## Gaps that prevent drop-in use

1. The current role has no explicit RoleName/Path/PermissionsBoundary and most
   core resource names are generated. It fails the draft creation constraints.
2. The pinned modern bootstrap template's boundary parameter applies only to
   its CloudFormation execution role. It does not bound the app role or all
   bootstrap roles. The standard deployment role also contains wildcard
   CloudFormation writes and broad reads. A customer execution policy alone is
   insufficient. A future custom bootstrap must replace those grants and
   same-account-wide assume-role delegation; preserve TLS/public-block/version/
   lifecycle and version-parameter contracts. Do not patch node_modules.
3. HTTP API routes/integrations and Amplify children have generated IDs.
   [API tagging documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-tagging-supported-resources.html)
   documents inheritance for REST V1; it does not establish HTTP V2 child
   inheritance for this stack. Avoid `/apis/*` destructive authority. A separately
   qualified staged shell/import or other reviewed binding workflow is required.
   The creation policy alone cannot complete shell stabilization: GetApp/GetApi
   and tagging of the new IDs also need a bounded, reviewed path. Tag-resource
   endpoints/provider behavior remain to be verified. No shell is created now.
4. [CloudWatch Logs authorization](https://docs.aws.amazon.com/service-authorization/latest/reference/list_logs.html)
   has no resource ARN for PutResourcePolicy/CreateLogDelivery. Normal execution
   deliberately omits these account-level writes. HTTP API logging may require a
   separately approved, one-time owner operation with exact resource-policy
   document review and preservation of every existing lab statement. A resource
   policy granting log delivery only to the staging group does not scope the
   caller's PutResourcePolicy IAM authority. Do not grant that write permanently.
5. Registry handler permission lists are supersets, including optional CodeCommit,
   VPC, Kinesis, EFS, replicas, code signing, KMS grants and account log delivery.
   They do not mean those permissions are all exercised here. No blanket grants
   were added. Classic Budgets has no handler-permission list in the fetched
   schema. Verify the exact GitHub static-hosting and Budget provider paths.
   Do not add aws-portal:ModifyBilling or arbitrary PassRole to make them pass.
6. IAM conditions cannot inspect CreateRole trust-policy JSON or inline policy
   contents. The bounded role creation option still needs trusted template/
   change-set review. Prefer a separately owner-created immutable runtime role
   imported by the app if this limitation is unacceptable; this also requires
   explicit source/lifecycle requalification. PutRolePolicy cannot escape its
   immutable data-only boundary. No execution policy can change either boundary.
7. Tags are labels, not ownership proof. Exact resources/names and immutable
   ceilings are the primary limits. Current AdministratorAccess credentials can
   bypass the proposed roles; browser login changes credential duration, not
   privilege. A separate routine operator/assume-role restriction and AWS resource
   policies remain necessary for meaningful separation. Boundary behavior for
   direct grants to session principals needs review; no absolute isolation from
   the account administrator is claimed.
8. Alarm actions and Lambda invocation principal are constrained. IAM cannot
   inspect all Budget filters/amounts, code contents, topic policy documents or
   Lambda invocation SourceArn bodies. Preserve the qualified five-alarm SNS
   SourceAccount/SourceArn contract and API-specific Lambda source ARN in the
   reviewed template. These proposals give no hard spending limit.

## Simulation evidence and release gate

The read-only IAM engine evaluated 37 modeled action/resource cases: 36 matched
expectations, one SNS positive did not. Cases cover bounded/missing/wrong role
boundaries, foreign roles/tables/APIs/Amplify/budgets/buckets, PassRole service,
role/policy escalation, untagged creation, region, runtime Scan, alarm actions,
invocation principal, staging stack and exact ZIP publication. Fixtures are
synthetic; no resource existence or creation capability is proved. Context keys
are supplied by the model, not observed provider calls. Two additional current-
principal sign-in actions modeled allowed. No IAM policy was installed.

[IAM simulation limits](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html)
include differences from real service calls and incomplete resource/trust/session
modeling. Missing-tag/boundary denials are intentional positive security findings.
The SNS result remains a failed positive, not a successful deployment claim.

All draft JSON parses, has no real account/principal/email/credential values and
fits the managed-policy size ceiling before binding. Recheck bound sizes,
condition-key support, action/resource applicability, provider paths, trust,
least privilege, positive/negative simulations and rollback before owner approval.
Any approved implementation must repeat Phase 3F/3G/4A checks and qualification.
Policy syntax and model checks alone do not close Phase 4B's permission blocker.
