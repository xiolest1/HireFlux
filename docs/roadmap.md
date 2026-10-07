# Roadmap

## Current execution order

The accepted production-account phase sequence below supersedes the ordering of
the earlier product milestone descriptions. Those milestones remain scope
references. The local demo and Phase 2A backend foundation are implemented;
AWS resources and real persistent browser accounts are not deployed.

- **Phase 1 — completed:** architecture/readiness audit.
- **Phase 2A — completed:** provider-neutral durable principal/data lifetime,
  authenticated empty atomic bootstrap, central durable readiness, compatible
  local adoption/recovery, and shared demo/durable product services. See
  [ADR 0005](adr/0005-durable-local-workspace-bootstrap.md).
- **Phase 2B — completed:** provider-neutral frontend sessions, demo and development-only
  durable local adapters, validated bootstrap before protected rendering, fresh
  generation caches, stale async-result fencing, and server-owned durable preferences.
  See [ADR 0006](adr/0006-frontend-workspace-session-boundary.md).
- **Phase 2C — completed:** strong durable application manifest, verified local
  backfill, commit-time ACTIVE guards, one-way bounded resumable erasure with a
  minimal tombstone, and record/byte/work-bounded strong JSON export. See
  [ADR 0007](adr/0007-durable-workspace-manifest-and-erasure.md).
- **Phase 3A — completed:** standalone TypeScript CDK v2 foundation, explicit
  staging/production configuration, shared empty stack, isolated offline synth,
  naming/tags, tests, and local CI checks. See [infra guide](../infra/README.md)
  and [ADR 0008](adr/0008-aws-cdk-environment-foundation.md). The CDK bundled
  dependency advisory is open and must be rechecked before asset packaging.
- **Phase 3B — completed:** dedicated Mangum entry point and deterministic,
  self-contained Python 3.14 Linux x86_64 ZIP; locked wheels, isolated native
  imports/cold/warm HTTP API tests, read-only/runtime security checks and CI.
  See [backend guide](../backend/README.md) and
  [ADR 0009](adr/0009-lambda-runtime-and-deterministic-packaging.md). No AWS
  function or CDK asset is added. The pre-packaging CDK advisory recheck found
  no new release; backend packaging does not invoke or bundle that toolchain.
- **Phase 3C — completed locally:** one DynamoDB table per environment with exact
  local schema/TTL, on-demand capacity, AWS-owned encryption, stable identity,
  Python/CDK parity, replaceable staging and protected/retained production.
  See [ADR 0010](adr/0010-dynamodb-cloud-lifecycle.md). No AWS deployment.
- **Phase 3D — completed locally:** verified prebuilt Python 3.14/x86_64 ZIP,
  one Lambda/HTTP API per environment, explicit least-privilege execution role,
  generated signing secrets read at cold start, shared fail-closed CORS policy,
  production Cognito-unavailable semantics and bounded proxy response encoding.
  See [ADR 0011](adr/0011-lambda-http-api-security-boundary.md). Nothing deployed.
- **Phase 3E — completed locally:** independent static Amplify app/branch,
  NoEcho deployment credential input, frontend monorepo build, token-derived
  exact CORS origin, branch-level API injection, acyclic references, SPA/header
  validation and deployment-style artifact scans. See
  [ADR 0012](adr/0012-amplify-hosting-origin-wiring.md). No hosting deployed.
- **Phase 3F — completed locally:** explicit finite JSON log groups, privacy-safe
  access logs, scoped logging IAM, five native alarms, one dashboard, API throttles,
  reserved concurrency, optional operator notifications and AND-tagged budgets.
  See [ADR 0013](adr/0013-operational-guardrails.md). No operational resource is live.
- **Phase 3G — completed locally:** complete synthesized security/isolation/
  cost/lifecycle review, two concrete interview pagination/transaction-bound
  corrections, rebuilt qualified ZIP and fresh full checks. Decision:
  **PASS WITH EXPLICIT PHASE 4 CONDITIONS**; zero open local pre-4 defects,
  20 pending live qualification rows and six production finding groups.
  See [complete handoff](production-account-readiness.md#46-phase-3g-final-synthesized-review-and-handoff).
  All Phase 3 slices stop at local definition/synthesis/tests; the advisory and
  anonymous issuance risk remain open for supervised staging acceptance only.
- **Phase 4 — deferred:** AWS staging infrastructure and the existing demo running
  end-to-end, with cost/security controls and manual smoke validation.
- **Phase 5 — deferred:** real Cognito accounts in staging; direct verified Cognito
  `sub` ownership remains the approved direction.
- **Phase 6 — deferred:** production hardening and release qualification.
- **Phase 7 — deferred:** production deployment after the preceding gates.

Each phase is bounded work, not authorization to implement subsequent phases.
Attachments, real reminders/email, and other optional product services remain
separate future capabilities. The detailed Phase 2A evidence and remaining safety
limits are in [readiness audit section 37](production-account-readiness.md#37-phase-2a-implementation-and-handoff).

## Earlier product milestone scope references

## Milestone 1 - local vertical slice

Deliver the complete local path `React -> FastAPI -> DynamoDB Local`.

Acceptance criteria:

- Root configuration, local setup, architecture, data access patterns, status policy, ADRs, and developer commands are documented.
- DynamoDB Local has persistent Compose storage and an explicit idempotent table initializer.
- Local auth supplies a fixed durable owner and fails closed outside local/test and deployed runtimes. Phase 2A requires explicit bootstrap before ordinary profile/workspace operations.
- `/health`, `/api/v1/me`, versioned application CRUD/archive/status/activity routes, OpenAPI, CORS, request IDs, and the stable error envelope are implemented.
- Owner-scoped create, list, get, edit, archive, restore, and status transitions work with cursor pagination and optimistic concurrency.
- Application creation and every status change append activity.
- The responsive React UI exercises the full application flow with accessible loading, empty, validation, and error states.
- Isolated backend/frontend tests cover configuration failure, ownership, transitions, pagination, API errors, validation, and critical UI flows; lint, type checks, and production build pass; a local smoke test is attempted when Docker is available.

## Milestone 1.1 - isolated demo workspace (implemented)

Acceptance criteria: public candidate-focused landing page; one-click signed 24-hour workspace; uniquely derived owner identity; fictional seeded applications and activity; protected application routes; bearer-token API calls; reset/exit and expiry behavior; query-cache clearing on identity changes; unsaved-form navigation warning; DynamoDB TTL metadata; and isolation, tamper, expiry, routing, and reset tests.

## Milestone 2 - local workspace home and richer workflow (implemented)

Dependencies: stable Milestone 1 keys and service boundaries.

Acceptance criteria: production-style protected workspace Home at `/dashboard`; expanded nine-status workflow; deterministic 30-application candidate dataset; owner-scoped notes and interviews; actionable follow-ups; dashboard and filterable analytics with server-owned historical milestones and explicit denominators; dashboard status/funnel counters; GSI3 scheduling; status/search/source/work-mode filters and sorting; persisted temporary-workspace settings; richer activity history; idempotent local reconciliation; and transactional projection maintenance. No scans in request paths.

AWS infrastructure, persistent accounts, attachments, email delivery, and real notification delivery remain outside this local milestone.

## Milestone 3 - optional persistent accounts with Cognito

Execution: Phase 5, after frontend sessions, persistent-account safety, CDK synth,
and staging of the existing demo. The Phase 2A local durable backend does not
implement this account authentication capability.

Dependencies: stable identity port and deployed-environment configuration design.

This milestone is needed only if HireFlux expands beyond the temporary demo workspace. Acceptance criteria: signup, verification, login, reset flows; server-side JWT signature/issuer/audience/token-use/expiry validation; Cognito `sub` profile linking; role claims; and proof that local auth cannot start in deployed environments.

## Milestone 4 - private attachments

Dependencies: stable owner identity and application child-record authorization; persistent personal uploads additionally require persistent accounts.

Acceptance criteria: private S3, short-lived presigned operations, metadata-only DynamoDB items, content-type/size/key restrictions, ownership checks, blocked public access, encryption, lifecycle cleanup, and clear UI errors.

## Milestone 5 - AWS infrastructure

Execution: Phase 3 defines/synthesizes infrastructure; Phase 4 deploys the staging
demo. Production deployment is Phase 7 after hardening, not part of local bootstrap.

Dependencies: local functional baseline and configuration contracts.

Acceptance criteria: TypeScript CDK for separate staging/production Amplify branches, HTTP API, one Lambda/Mangum API, separate DynamoDB tables, secrets, and CloudWatch; SPA rewrite rules; structured logs, alarms, throttling, constrained concurrency, and 7-14 day demo log retention; least-privilege IAM; explicit retention/deletion decisions; no NAT Gateway or embedded credentials. Cognito and S3 are included only when their optional product milestones are selected.

## Milestone 6 - reminders and email

Dependencies: interviews/follow-ups, deployed identity, and infrastructure.

Acceptance criteria: owner-scoped EventBridge schedules, an explicit non-HTTP event handler/worker, idempotent reminder handling, SES configuration, retry/failure visibility, schedule cleanup, notification records, and a notification center with read/unread behavior.

## Milestone 7 - CI/CD

Dependencies: repeatable tests/builds and CDK environments.

Acceptance criteria: GitHub Actions test/lint/build gates, AWS OIDC with scoped roles, environment protections, deployment checks, migration ordering, and rollback guidance. No stored long-lived AWS access keys.

## Milestone 8 - public-demo hardening

Dependencies: deployed end-to-end app and measured behavior.

Acceptance criteria: low budget alerts, API throttling, appropriate concurrency/throughput guards, short log retention, data lifecycle rules, safe seeded demo/reset approach, per-user and attachment limits, cleanup automation, accessibility/performance review, and candidate-focused public-demo documentation.

## Deferred production evolution

Only measured needs should trigger relational reporting/search infrastructure, multi-region recovery, WAF, or more compute services. Budget alerts are not hard spending caps, and the stated low monthly target remains usage-dependent.
