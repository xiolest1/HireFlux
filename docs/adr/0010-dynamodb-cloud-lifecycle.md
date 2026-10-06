# ADR 0010: DynamoDB cloud schema and environment lifecycle

- Status: accepted for Phase 3C
- Date: 2026-10-06

## Context

The local single-table backend already owns its key formats, three sparse indexes
and optional demo TTL. Cloud infrastructure must preserve that physical contract
and establish deliberate stateful protections before compute is wired to it.
The first resource is defined and synthesized locally; nothing is deployed.

## Decision

Use the mature CDK v2 `aws_dynamodb.Table` L2 in `HireFluxStack`, with the stable
semantic ID `WorkspaceTable` and public readonly `workspaceTable` reference.
Its fixed logical ID is `WorkspaceTable68AC2584`; tests pin the construct path
and logical identity in both environments. Renaming/reparenting or changing key/
physical-name contracts requires explicit replacement/migration review. Generated
physical names avoid unnecessary name constraints and environment collisions.
Phase 3D can consume `stack.workspaceTable` and its name/ARN tokens directly.

Each staging/production stack owns exactly one independent single-region table in
`us-east-1`. Both use string PK/SK and GSI1PK/GSI1SK, GSI2PK/GSI2SK,
GSI3PK/GSI3SK; indexes are exactly GSI1/GSI2/GSI3 with ALL projection. These are
the current initializer/query contracts, not new indexes or broader projections.
Only these eight key attributes are declared. Enable TTL on optional numeric
epoch-seconds `expires_at`; demos assign it, durable items omit it. TTL cleanup
is eventual and does not decide authorization or account-erasure completion.

Use PAY_PER_REQUEST, STANDARD class and default AWS-owned encryption. With this
CDK version, DEFAULT emits `SSESpecification: { SSEEnabled: false }`, which selects
AWS-owned encryption rather than disabling encryption at rest. No customer key,
stream, replica, custom resource, resource policy, seeding or application grant
is added. The `Table` L2 covers the current lifecycle/index/direct-reference needs
without the global-table abstraction or its operational machinery.

Typed, immutable environment `data` policy is validated before stack construction:

- Staging: PITR off, deletion protection off, DESTROY; CloudFormation deletion
  and update-replacement policies are both Delete. It is deliberately replaceable.
- Production: PITR on, deletion protection on, RETAIN; CloudFormation deletion
  and update-replacement policies are both Retain. The safeguards protect
  different deletion/replacement paths and are asserted separately.

The schema-parity check freshly exports the actual Python `create_table_request`
and `TTL_ATTRIBUTE`, then compares meaningful synthesized physical properties
for both environments: key names/types, index names/keys/types/projections,
INCLUDE attributes, TTL and billing. Array ordering and environment lifecycle
are ignored. Mutation tests detect real drift. Normal CDK synth remains standalone;
only the explicit parity command/CI step needs the backend environment. No runtime
Python source or Phase 3B artifact input changes are necessary.

## Consequences and privacy boundary

Future GSI/schema changes require separate migration/backfill/deployment review.
Retain policies are not a migration engine; retained-resource ownership/recovery
must be planned deliberately. There is no shared database stack or fixed shared
physical name, and no cross-environment table lookup/reference.

PITR protects recovery from accidental/corrupting changes. Phase 2C proves erasure
of live-table workspace content only; historical recovery data is a separate
privacy surface. No claim is made that deleting an account immediately removes
all historical copies. Phase 6 must settle backup retention, restore procedures,
deletion tombstones after restore and privacy/account-erasure reconciliation.
Production PITR stays enabled while that hardening work remains outstanding.

Only one AWS::DynamoDB::Table and zero outputs exist in each local template.
IAM/compute/API/secret references remain Phase 3D, hosting 3E, monitoring/controls
3F/3G and actual bootstrap/staging deployment Phase 4. No cloud or local data is
migrated, seeded or mutated. The open CDK bundled dependency advisory is tracked
in the infra guide; the recheck found no newer compatible release.

See [infra guide](../../infra/README.md),
[schema/access patterns](../dynamodb-access-patterns.md),
[readiness section 42](../production-account-readiness.md#42-phase-3c-implementation-and-handoff),
[CDK Table](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb.Table.html),
[CloudFormation Table](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-dynamodb-table.html),
and [CloudFormation encryption semantics](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-dynamodb-table-ssespecification.html).
