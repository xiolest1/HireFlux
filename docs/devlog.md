# HireFlux development log

This log records the engineering work, decisions, problems, and validation completed for HireFlux. It is written so the project can be discussed clearly in portfolio reviews and technical interviews.

## 2026-08-10 - Milestone 1 local vertical slice

### Objective

Build the first complete local workflow:

```text
React + TypeScript -> FastAPI -> DynamoDB Local
```

The milestone had to work without an AWS account, real AWS credentials, infrastructure deployment, or billable services.

### Starting point

The repository contained a short vision README and eight UML/DFD PDFs. It did not yet contain application code. The diagrams were reviewed as design input and preserved unchanged.

Important conflicts were resolved in favor of the current architecture requirements:

- Cognito will own passwords and sessions; HireFlux never stores password hashes.
- UUIDs and Cognito `sub` replace integer user/application identifiers.
- The logical DFD data stores become item types in one DynamoDB table.
- `company_name` remains on the application instead of introducing a relational Company table.
- Reversible `ARCHIVED` behavior replaces permanent deletion.

### Architecture and documentation

Added living documentation for:

- local and target AWS architecture;
- authoritative domain fields and enums;
- access-pattern-first DynamoDB keys and indexes;
- application status-transition policy;
- milestone roadmap and acceptance criteria;
- architecture decisions for DynamoDB, local auth/Cognito, archiving, and optimistic concurrency;
- exact Windows setup, run, test, and shutdown commands.

The backend dependency direction is:

```text
routes -> application services -> repository protocols -> DynamoDB adapter
```

### Backend implementation

Implemented a FastAPI service with:

- `GET /health` and `GET /api/v1/me`;
- application create, list, get, edit, archive, restore, and status-transition operations;
- cursor-based list pagination and status filtering;
- an activity endpoint for creation and status history;
- local identity injection with fail-closed configuration checks;
- request IDs, explicit CORS, OpenAPI, and a stable error envelope;
- owner-qualified DynamoDB keys so another user's UUID cannot address a resource;
- HMAC-signed cursors bound to the current owner and filter;
- optimistic integer versions for stale-write protection;
- DynamoDB transactions for application/activity atomicity;
- Moto-backed tests that do not require Docker.

The status policy is centralized. Notable rules include:

- `REJECTED -> INTERVIEW` is forbidden;
- `INTERVIEW -> OFFER` is allowed;
- archive stores the prior status;
- restore is allowed only to that exact prior status;
- repeated same-status requests are idempotent no-ops;
- post-draft active statuses require `applied_date`.

### Frontend implementation

Implemented a responsive React application with:

- application list and status filtering;
- cursor pagination with cross-page ID deduplication;
- create and edit forms using React Hook Form and Zod;
- detail view and activity timeline;
- server-provided allowed status transitions;
- archive and exact-prior-status restore controls;
- loading, empty, validation, conflict, API-error, success, and not-found states;
- semantic HTML, keyboard focus styles, labeled inputs, and error summaries;
- centralized native-fetch API access with Zod response validation;
- Vitest, Testing Library, and MSW coverage for critical flows.

The visual direction uses an off-white workspace, white bordered surfaces, slate typography, one restrained blue accent, and status labels that communicate through text as well as color.

### DynamoDB Local

Added Docker Compose for the official DynamoDB Local image with:

- a host binding limited to `127.0.0.1:8001`;
- a named persistent Docker volume;
- an explicit, idempotent initialization script;
- schema validation for the table and both GSIs;
- startup retries so initialization can follow `docker compose up -d` safely;
- refusal to initialize a non-loopback or non-local target.

Normal FastAPI startup never creates a table.

### Problems found and resolved

- No system Python 3.13 was installed. The package was configured to require Python 3.13, while validation used the available bundled Python 3.12.13 runtime. Exact Python 3.13 validation remains an environment follow-up.
- Docker Desktop was installed but its engine was initially stopped. It was started for local validation.
- A new named Docker volume was not writable by the image's default user on Windows. The loopback-only local container now runs as root so SQLite can initialize that volume.
- Underscores in the original fake access key were rejected by DynamoDB Local 3.3.0. The example now uses alphanumeric, visibly local-only fake values.
- TypeScript 6 conflicted with the installed `typescript-eslint` peer range. TypeScript was pinned to compatible `5.9.3` rather than bypassing dependency checks.
- `react-router-dom` 7.18.0 was covered by a high-severity advisory. It was upgraded to the fixed 7.18.2 release and the dependency tree was audited again.
- Opening the site as `127.0.0.1` did not match the configured CORS origin. Local instructions now consistently use `http://localhost:5173`.

### Validation results

Backend validation:

- Ruff lint passed.
- Ruff formatting check passed.
- Strict mypy passed across 28 source files.
- Pytest passed: 59 tests.
- One upstream FastAPI/Starlette TestClient deprecation warning remained non-blocking.

Frontend validation:

- Clean `npm ci` succeeded from the lockfile.
- ESLint passed with zero warnings.
- TypeScript checking passed.
- Vitest passed: 10 tests across 5 files.
- The Vite production build passed.
- npm audit reported zero vulnerabilities for production and full dependency trees.

Local integration validation:

- Docker Compose started DynamoDB Local successfully.
- The table initializer succeeded repeatedly and confirmed schema compatibility.
- Health, profile, empty-list, CORS preflight, create, edit, transition, archive, restore, filtering, activity, and direct-route refresh behavior worked against the real local services.
- The browser console contained no warnings or errors during the smoke flow.
- Five synthetic smoke-test items were removed from their exact application partition afterward; the local application list was returned to empty.
- The HireFlux container was stopped with its persistent volume preserved.

### Security and scope confirmation

- No AWS resources were created.
- No real AWS credentials were used or committed.
- No application was deployed or published.
- No passwords or password hashes are stored.
- No DynamoDB `Scan` exists in a normal request path.
- No generated build output, virtual environment, `node_modules`, real `.env`, or coverage output is pending in Git.
- No Git commit was created.

## 2026-08-11 - Local developer handoff

Clarified the local run workflow for Windows Command Prompt users. The application intentionally uses Docker only for DynamoDB Local; FastAPI and Vite run directly on Windows for reload speed.

The reproducible commands remain in the repository [README](../README.md). The local site is `http://localhost:5173`, API documentation is `http://localhost:8000/docs`, and DynamoDB Local is visible in Docker Desktop under the HireFlux Compose project.

## 2026-08-11 - Isolated recruiter demo workspace

Implemented the recruiter-facing demo plan discussed during the frontend review:

- replaced the root redirect with a public, responsive landing page and one-click demo launch;
- added HMAC-signed 24-hour temporary sessions with a random owner UUID per launch;
- seeded five fictional applications across Draft, Applied, Interview, Offer, and Rejected through the ordinary domain services, including transition activity;
- protected application routes and attached the bearer token centrally to API requests;
- added explicit missing/expired-session screens, cache clearing on identity changes, an expiry warning, and reset/exit controls;
- added an unsaved-form navigation warning;
- marked every temporary profile, quota, application, and activity item with DynamoDB `expires_at` TTL metadata and enabled TTL in the explicit initializer;
- enforced an atomic lifetime application limit per workspace to bound database writes;
- documented separate local, staging, and production environments plus the Amplify SPA rewrite and promotion checks;
- added a HireFlux social-preview image and matching metadata.

Security remains server-enforced: request bodies do not accept owners, guessed IDs in another workspace return the same `404` as missing records, token tampering returns `401`, reset changes identity immediately, and cleanup does not depend on asynchronous TTL deletion.

Completion validation passed: Ruff lint/format, strict mypy, and 67 backend tests; frontend lint, TypeScript, 15 tests, and production build; plus a live DynamoDB Local smoke check proving five seeded records and cross-workspace `404` isolation.

## Next recommended work

Before Milestone 2, install/use Python 3.13 and rerun the documented backend validation with a fresh virtual environment.

Milestone 2 then adds:

- owner-scoped notes and interviews;
- dashboard status-count projections and an idempotent backfill;
- upcoming follow-ups and interviews;
- richer activity history;
- bounded search, sorting, and filtering;
- profile/settings UI.

AWS provisioning, Cognito, private attachments, reminders, and CI/CD remain deliberately deferred to their roadmap milestones.
