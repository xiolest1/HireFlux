# Roadmap

## Milestone 1 - local vertical slice

Deliver the complete local path `React -> FastAPI -> DynamoDB Local`.

Acceptance criteria:

- Root configuration, local setup, architecture, data access patterns, status policy, ADRs, and developer commands are documented.
- DynamoDB Local has persistent Compose storage and an explicit idempotent table initializer.
- Local auth creates/reads a fixed user's profile and fails closed outside local/test.
- `/health`, `/api/v1/me`, versioned application CRUD/archive/status/activity routes, OpenAPI, CORS, request IDs, and the stable error envelope are implemented.
- Owner-scoped create, list, get, edit, archive, restore, and status transitions work with cursor pagination and optimistic concurrency.
- Application creation and every status change append activity.
- The responsive React UI exercises the full application flow with accessible loading, empty, validation, and error states.
- Isolated backend/frontend tests cover configuration failure, ownership, transitions, pagination, API errors, validation, and critical UI flows; lint, type checks, and production build pass; a local smoke test is attempted when Docker is available.

## Milestone 1.1 - isolated demo workspace (implemented)

Acceptance criteria: public recruiter landing page; one-click signed 24-hour workspace; uniquely derived owner identity; fictional seeded applications and activity; protected application routes; bearer-token API calls; reset/exit and expiry behavior; query-cache clearing on identity changes; unsaved-form navigation warning; DynamoDB TTL metadata; and isolation, tamper, expiry, routing, and reset tests.

## Milestone 2 - local workspace home and richer workflow (implemented)

Dependencies: stable Milestone 1 keys and service boundaries.

Acceptance criteria: production-style protected workspace Home at `/dashboard`; expanded nine-status workflow; deterministic 16-application recruiter dataset; owner-scoped notes and interviews; actionable follow-ups; dashboard and filterable analytics with server-owned historical milestones and explicit denominators; dashboard status/funnel counters; GSI3 scheduling; status/search/source/work-mode filters and sorting; persisted temporary-workspace settings; richer activity history; idempotent local reconciliation; and transactional projection maintenance. No scans in request paths.

AWS infrastructure, persistent accounts, attachments, email delivery, and real notification delivery remain outside this local milestone.

## Milestone 3 - optional persistent accounts with Cognito

Dependencies: stable identity port and deployed-environment configuration design.

This milestone is needed only if HireFlux expands beyond the temporary demo workspace. Acceptance criteria: signup, verification, login, reset flows; server-side JWT signature/issuer/audience/token-use/expiry validation; Cognito `sub` profile linking; role claims; and proof that local auth cannot start in deployed environments.

## Milestone 4 - private attachments

Dependencies: stable owner identity and application child-record authorization; persistent personal uploads additionally require persistent accounts.

Acceptance criteria: private S3, short-lived presigned operations, metadata-only DynamoDB items, content-type/size/key restrictions, ownership checks, blocked public access, encryption, lifecycle cleanup, and clear UI errors.

## Milestone 5 - AWS infrastructure

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

Acceptance criteria: low budget alerts, API throttling, appropriate concurrency/throughput guards, short log retention, data lifecycle rules, safe seeded demo/reset approach, per-user and attachment limits, cleanup automation, accessibility/performance review, and recruiter-facing documentation.

## Deferred production evolution

Only measured needs should trigger relational reporting/search infrastructure, multi-region recovery, WAF, or more compute services. Budget alerts are not hard spending caps, and the stated low monthly target remains usage-dependent.
