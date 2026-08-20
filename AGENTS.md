# HireFlux agent instructions

These instructions apply to the entire repository. More specific instructions
in a nested `AGENTS.md` may add to or override them for that subtree.

## Product and repository context

HireFlux is a portfolio-grade job application tracker. The implemented local
system is a React/Vite single-page application, a FastAPI modular monolith, and
DynamoDB Local. A visitor launches an isolated, signed 24-hour demo workspace
seeded with fictional data. AWS staging is the next milestone; do not describe
planned AWS resources as already deployed.

- `frontend/`: React, TypeScript, Vite, React Router, TanStack Query, Zod, and
  Tailwind CSS.
- `backend/src/hireflux_backend/`: FastAPI routes, application services,
  repository protocols, domain code, and DynamoDB adapters.
- `backend/tests/`: unit and Moto-backed integration/API tests.
- `backend/scripts/`: explicit local table initialization, reset, and
  reconciliation commands.
- `docs/`: product rules, access patterns, roadmap, and decision records.
- `Diagrams/`: original design artifacts. Preserve them unless a task directly
  requests diagram changes.
- `ARCHITECTURE.md`: canonical system overview and current-versus-target
  architecture boundary.

## Architecture boundaries

- Preserve backend dependency direction:
  `routes -> application services -> repository protocols -> adapters`.
- Routes translate HTTP, validated schemas, and authenticated identity. They do
  not contain DynamoDB expressions or business policy.
- Application/domain services own authorization-sensitive rules, cross-field
  validation, transitions, milestones, metrics, and activity meaning.
- Repository protocols must not expose boto3 or DynamoDB key shapes.
- DynamoDB adapters own keys, expressions, transactions, index maintenance,
  cursor encoding, and AWS error translation.
- React renders server-owned policy and metrics. It must not independently
  decide valid transitions, ownership, rate denominators, or milestone facts.
- Keep frontend API access centralized and validate untrusted responses with
  Zod before UI code consumes them.
- Normal request paths use `GetItem`, `Query`, conditional writes, and
  transactions. Do not introduce `Scan`. The guarded local reconciliation
  script is the only deliberate scan path.

## Coding conventions

- Python, JSON, and query parameters use `snake_case`; React components use
  `PascalCase`; TypeScript functions and variables use `camelCase`.
- Use UUID strings for identifiers.
- Store instants as timezone-aware UTC ISO 8601 timestamps. Store calendar-only
  concepts such as follow-up dates as ISO `YYYY-MM-DD` values.
- Display instants in the workspace's validated IANA time zone. Never convert a
  date-only value through UTC.
- Use Pydantic request/response models at the API boundary and reject unknown
  request fields where established schemas do so.
- Prefer small, typed services and explicit protocols over cross-layer helper
  imports.
- Preserve the existing error envelope:
  `{"error":{"code","message","request_id","details?"}}`.
- Keep comments focused on non-obvious constraints and decisions.
- Preserve semantic HTML, visible focus, labeled controls, 44-pixel practical
  touch targets, and explicit loading, empty, error, and retry states.

## Business rules that must remain server-owned

- Ownership always comes from the verified identity. Never accept or trust
  `owner_user_id` from a request body, query string, or browser state.
- Missing and foreign-owned resources return the same `404` behavior.
- Application status changes only through the dedicated transition service;
  the general edit route cannot change status.
- Preserve the centralized transition matrix in
  `backend/src/hireflux_backend/domain/status_policy.py` and its complete tests.
  In particular, `REJECTED -> INTERVIEW` is forbidden,
  `INTERVIEW -> OFFER` is allowed, and `REJECTED -> OFFER` is an intentional
  correction path.
- Archive rather than permanently delete applications. Restore only to the
  exact `archived_from_status` value.
- Repeating the current status is an idempotent no-op with no version or
  activity change.
- Require `applied_date` after a record leaves `DRAFT`; an archived former draft
  may still have no applied date.
- Treat application activity as append-only during ordinary behavior.
- Use optimistic concurrency (`expected_version`) for mutable resources.
- Keep canonical resource changes and their required activity/projection
  changes atomic.
- Historical milestone timestamps are server-owned and remain true even if the
  current status later changes.
- Dashboard and analytics counts, denominators, ranges, and sample warnings are
  backend contracts, not calculations invented in React.
- Demo workspaces remain isolated, expire at the signed-token boundary, and
  carry DynamoDB TTL on every temporary item. TTL cleanup is eventual and is
  not authorization.
- Clear client query data before changing, resetting, expiring, or exiting a
  demo identity so data from one workspace cannot flash in another.

## Security invariants

- Never store passwords or password hashes in this demo architecture.
- Never commit `.env`, tokens, real AWS credentials, uploads, or private user
  data. Values in `.env.example` must be visibly fake.
- Never accept client changes to ownership, roles, generated IDs, timestamps,
  milestones, or activity metadata.
- Never log tokens, credentials, attachment contents, raw internal exceptions,
  or stack traces.
- `AUTH_MODE=local` must fail outside local/test and when deployment runtime
  markers are present.
- A deployed DynamoDB client must omit local endpoints and explicit credentials
  and use its IAM execution role.
- CORS is an explicit allowlist; never permit `*`.
- Do not expose DynamoDB keys, signed-cursor internals, AWS errors, or exception
  details to clients.
- Ordinary repository methods have no admin bypass. Future administrative work
  requires a separate role-gated service and access path.
- Do not weaken authorization, validation, types, lint rules, tests, or business
  policy merely to make a check pass.

## What not to change casually

- Do not add PostgreSQL, RDS, SQLAlchemy, Alembic, Redis, OpenSearch, ECS,
  Fargate, EC2, ALB, or a NAT Gateway without an approved architecture decision.
- Do not add DynamoDB indexes without documenting the access pattern and local
  migration/reset consequence.
- Do not create or mutate tables during application startup. Schema operations
  remain explicit operator commands.
- Do not turn planned Cognito, S3, EventBridge, SES, CDK, or CI/CD work into a
  hidden dependency of the local demo.
- Do not permanently delete applications or ordinary activity history.
- Do not edit generated `dist/`, `node_modules/`, virtual environments, caches,
  or unrelated dirty-worktree changes.
- Do not rewrite or remove `Diagrams/` because code and diagrams differ; update
  authoritative documentation instead.

## Local commands (Windows Command Prompt)

Run from the repository root. Use separate Command Prompt windows for the two
long-running development processes.

```bat
docker compose up -d dynamodb-local
backend\.venv\Scripts\python.exe backend\scripts\init_local_table.py

backend\.venv\Scripts\python.exe -m uvicorn hireflux_backend.main:app --app-dir backend\src --reload --port 8000
npm --prefix frontend run dev
```

An older disposable local table with schema drift must be reset explicitly:

```bat
backend\.venv\Scripts\python.exe backend\scripts\reset_local_table.py --confirm-table HireFluxLocal
backend\.venv\Scripts\python.exe backend\scripts\init_local_table.py
```

Never point reset or reconciliation scripts at a deployed table.

## Testing expectations

Run targeted tests while iterating. Before handing off a completed change, run
all checks affected by that change; for a cross-stack change, run the full set:

```bat
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m ruff format --check backend
backend\.venv\Scripts\python.exe -m mypy backend\src
backend\.venv\Scripts\python.exe -m pytest backend

npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run build

git diff --check
```

Backend tests must cover ownership, foreign-resource behavior, validation,
optimistic conflicts, transaction rollback, index/cursor scope, TTL, and domain
policy when those areas change. Frontend tests must cover response validation,
loading/error/empty behavior, cache invalidation or identity clearing, route
behavior, and keyboard/focus interactions when those areas change. Use live
browser QA for meaningful layout, theme, responsive, or navigation changes.

Do not require Docker for unit/API tests: backend integration tests use Moto and
frontend tests mock the HTTP boundary.

## Definition of done

A change is complete only when server ownership and validation remain intact,
changed behavior has focused tests, relevant full checks pass, documentation and
`.env.example` match reality, no secret or generated artifact is added, the
diff contains no unrelated changes, and current local behavior is not confused
with future AWS architecture.
