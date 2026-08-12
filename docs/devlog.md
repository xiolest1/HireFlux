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

- The initial target assumed Cognito would own passwords and sessions; the later recruiter-demo decision replaced that requirement with temporary signed workspaces while preserving the rule that HireFlux never stores password hashes.
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

### Objective

Turn the fixed-user local application into a recruiter-facing experience that still feels like a one-click shared demo while giving every visitor a private, temporary owner identity. Two recruiters entering at the same time must never see or modify one another's records.

### Backend session implementation

Added `POST /api/v1/demo-sessions` as the only public workspace-creation endpoint. A successful launch:

1. generates a random workspace UUID;
2. creates the temporary user profile;
3. seeds five fictional applications through the existing application service;
4. creates realistic transition activity for Interview, Offer, and Rejected examples;
5. returns an HMAC-SHA256-signed bearer token and its expiration time.

The token contains a version, token kind, workspace subject, issued time, and expiry. Verification uses constant-time signature comparison and rejects malformed, oversized, tampered, unsupported, or expired tokens. API errors distinguish `DEMO_SESSION_REQUIRED` from `DEMO_SESSION_EXPIRED` without exposing signing or persistence details.

`AUTH_MODE=demo` is separate from fixed `local` auth and future `cognito` auth. Demo signing keys must contain at least 32 bytes, and deployed environments reject the visibly local-only example key. Existing safeguards still reject local auth in staging, production, or a Lambda runtime.

### Seeded workspace and cost bounds

Every new workspace starts with fictional applications across:

- Draft;
- Applied;
- Interview;
- Offer;
- Rejected.

The seed path deliberately uses ordinary application creation and transition services instead of bypassing domain rules. The examples therefore produce the same transactionally written activity history, versions, allowed transitions, and ownership behavior as recruiter-created records.

Application creation now transactionally increments a workspace quota item. The configured lifetime limit defaults to 100 applications, and the same DynamoDB transaction rolls the increment back if the application/activity write fails. This bounds database growth within one temporary identity without using `Scan` or trusting a browser-side count.

### Temporary-data lifecycle

Temporary profile, quota, application, and activity items carry the numeric DynamoDB `expires_at` attribute. The explicit table initializer enables TTL on that attribute and remains idempotent.

DynamoDB TTL deletion is asynchronous, so it is not treated as authorization. Access ends when the signed token expires. Reset creates a different owner identity and replaces the browser token immediately; old records become unreachable from that browser before DynamoDB physically removes them.

Archived applications were also removed from the active GSI projection. They remain queryable through the `ARCHIVED` status index, which keeps default active pages full without a filter expression.

### Frontend experience

Replaced the root redirect with a public, responsive recruiter landing page. **Explore the Demo** requests a workspace, stores the validated token in tab-scoped session storage, clears identity-specific TanStack Query data, and redirects to `/applications`.

Application list, create, detail, and edit routes now require an active demo session. Opening one directly without a token returns to the landing page with an explanation. The centralized API client attaches `Authorization: Bearer ...` and clears the token/cache when the API reports a missing or expired session.

The application header now provides:

- remaining workspace lifetime;
- a visible warning near expiration;
- a confirmed **Reset demo** flow;
- an **Exit demo** action;
- a success notice after reset.

Create and edit forms now block client-side navigation when fields are dirty and register a browser unload warning. Successful submissions bypass that guard so normal post-save navigation is not interrupted.

The interface retains semantic headings, labels, keyboard-visible focus, explicit loading/error states, reduced-motion support, and responsive layouts. A branded Open Graph image and matching social metadata were added for link previews.

### Security and ownership checks

- Request bodies still cannot set `owner_user_id`, IDs, timestamps, roles, or status through the general edit route.
- Every protected request derives its owner from the verified token.
- A valid token from a second workspace receives the same `404` for another workspace's application as it would for a missing record.
- Token tampering and invalid bearer formats return `401`.
- Reset and expiration clear user-specific query data so one identity's cached records cannot appear in another workspace.
- No passwords, password hashes, real AWS credentials, or session tokens are written to Git or logs.

### Environment and deployment preparation

Updated the default local configuration to use demo auth and documented separate local, staging, and production values. Staging and production must use different APIs, DynamoDB tables, signing keys, CORS origins, logs, alarms, and throttles.

The deployment guide now records the required Amplify single-page application rewrite, direct-route refresh tests, missing-asset `404` check, staging-to-production promotion sequence, and release gates for API throttling, Lambda concurrency, monitoring, log retention, and budget alerts. No AWS resources were provisioned during this work.

### Tests and validation

Added coverage for:

- token round-trip, malformed input, tampering, and expiration;
- deployed demo-key configuration failures;
- unauthenticated protected requests;
- five-record seed contents and activity history;
- separate-workspace ownership isolation;
- TTL metadata and initializer behavior;
- atomic workspace application limits;
- archive removal from the active index and archived-status discovery;
- protected frontend route redirects;
- bearer attachment, reset, expiry cleanup, and unsaved-form warnings.

Completion results:

- Ruff lint and formatting passed across 40 backend files.
- Strict mypy passed across 31 backend source files.
- Pytest passed: 67 tests. One upstream FastAPI/Starlette TestClient deprecation warning remains non-blocking.
- Frontend ESLint and TypeScript checks passed.
- Vitest passed: 15 tests across 6 files.
- The Vite production build passed.
- Live DynamoDB Local smoke testing returned five seeded statuses and a cross-workspace `404`.
- The local root page, direct application-route fallback, and social image returned `200`.

## Post-implementation QA and Python 3.14 support - August 12, 2026

Completed responsive browser QA at 1440 x 900 desktop, 768 x 1024 tablet, and
390 x 844 mobile viewports. The landing page, application list, detail page,
create form, reset dialog, and direct-route refresh behavior rendered without
horizontal overflow or browser console errors.

Keyboard QA identified two modal focus gaps: the unsaved-changes dialog did not
move focus inside when opened, and the reset dialog did not restore focus to its
trigger when closed. Both dialogs now share focus management that:

- moves focus to a safe initial action;
- traps Tab and Shift+Tab within the open dialog;
- supports Escape-to-close;
- restores focus to the invoking control when the dialog closes.

Python support now covers 3.13 and 3.14 through the declared range
`>=3.13,<3.15`, with both versions listed in package metadata. A fresh isolated
Python 3.14.7 environment successfully installed every pinned runtime and
development dependency.

Validation results:

- Ruff lint and format checks passed across 40 backend files on Python 3.14.7.
- Strict mypy passed across 31 backend source files on Python 3.14.7.
- Pytest passed: 67 tests on Python 3.14.7; the existing upstream
  FastAPI/Starlette TestClient deprecation warning remains non-blocking.
- Frontend ESLint and TypeScript checks passed.
- Vitest passed: 19 tests across 7 files, including modal focus containment,
  Escape handling, and focus restoration regressions.
- The Vite production build passed.

## Release-readiness audit and staging decision - August 12, 2026

Completed a broader release-readiness audit after adding Python 3.14 support.
The local application baseline is healthy and ready for the staging
infrastructure milestone; no AWS resources were created during this audit.

### Full validation

- Python 3.14.7 passed Ruff lint and formatting, strict mypy, all 67 backend
  tests, and `pip check`. A separate dependency audit reported no known
  vulnerabilities in the published packages; the local HireFlux package was
  skipped because it is not published on PyPI.
- Frontend ESLint, TypeScript, all 19 Vitest tests across 7 files, and the Vite
  production build passed. `npm audit` reported zero vulnerabilities.
- DynamoDB Local was validated against `amazon/dynamodb-local:3.3.0`. Running
  the initializer twice returned `already_valid`; the table remained active
  with on-demand billing, the expected primary key and two GSIs, and enabled
  TTL on `expires_at`.
- A 23-check live API flow passed, covering demo-session creation,
  authentication, pagination, cursor ownership, application creation and
  editing, stale-version conflicts, status transitions, activity history,
  archive and exact restore behavior, ownership isolation, request validation,
  CORS, and request IDs.
- The FastAPI service also launched successfully under Python 3.14.7 and passed
  health, session, profile, and seeded-application checks before shutting down
  cleanly.
- Browser QA passed at 1440 x 900 desktop, 768 x 1024 tablet, and 390 x 844
  mobile sizes. Create, edit, archive, restore, and `INTERVIEW -> OFFER` flows
  worked through the real UI without overflow or browser console errors.
- Keyboard-only modal focus, Escape handling, focus restoration, theme
  persistence, protected-route redirects, detail-page refresh, and unknown-route
  refresh all passed.
- Staging configuration correctly rejected local authentication, loopback
  DynamoDB endpoints, and wildcard CORS. The repository scan found no normal
  request-path DynamoDB scans, tracked private `.env` files, or likely committed
  secrets.

### Remaining staging prerequisites and outliers

- Commit the current application and QA baseline before beginning
  infrastructure work.
- Recreate the main `backend/.venv`, which still uses Python 3.12, with the
  installed Python 3.14 runtime. The isolated Python 3.14 validation environment
  proves compatibility but does not replace the main development environment.
- Add a reproducible Python transitive dependency lock file.
- Replace raw exception traceback logging in the API error handler with safe,
  structured logging before enabling centralized production logs.
- Add the Lambda/Mangum entry point and infrastructure code; neither exists yet.
- Configure an asset-aware Amplify SPA rewrite so application routes fall back
  to `index.html` while missing static assets remain `404`, and add deployment
  security headers.
- Add staging observability and safeguards: structured CloudWatch logs, finite
  retention, alarms, API throttling, modest Lambda reserved concurrency, a
  readiness check or synthetic canary, and budget alerts.
- The remaining FastAPI/Starlette TestClient deprecation warning is
  non-blocking. Major ESLint 10 and TypeScript 7 upgrades should be handled as
  separate compatibility work rather than folded into deployment.

### Milestone sequencing decision

The local functional baseline now satisfies the prerequisite for AWS work. For
a recruiter-accessible demo, the next milestone is a cost-bounded staging stack,
implemented as TypeScript CDK: Python 3.14 Lambda and Mangum, HTTP API, DynamoDB,
Secrets Manager, CloudWatch, and an Amplify staging branch with explicit CORS,
SPA routing, security headers, and budget controls. Staging should be deployed
and manually smoke-tested before adding automated OIDC-based CI/CD. Cognito,
private attachments, email, and reminders remain out of scope for this staging
foundation.

## Application card and status workflow UX - August 12, 2026

Improved the application-list workflow by adding a visible `Edit` action to
each application card. The action opens that application's detail page rather
than bypassing the overview and navigating directly into the details form. From
the detail page, a visitor can review the full record, use the existing status
control, or choose `Edit details`.

Expanded the centralized status policy with an explicit `REJECTED -> OFFER`
correction path for applications marked rejected by mistake or later resulting
in an offer. The API remains authoritative for allowed transitions, status
changes continue through the dedicated version-checked endpoint, and each
successful correction is recorded in the activity timeline. The binding
`REJECTED -> INTERVIEW` prohibition remains enforced.

Validation results:

- Frontend ESLint and TypeScript checks passed.
- Vitest passed: 21 tests across 7 files, including card navigation and the
  rejected-to-offer interaction.
- The Vite production build passed.
- Backend Ruff lint and formatting passed across 40 files.
- Strict mypy passed across 31 backend source files.
- Pytest passed: 68 tests, including the complete transition matrix and the
  explicit rejected-to-offer correction. The existing upstream
  FastAPI/Starlette TestClient deprecation warning remains non-blocking.

## Next recommended work

Build and manually validate the AWS staging foundation described above. After
staging is stable, add CI/CD or resume Milestone 2 product work, which includes:

- owner-scoped notes and interviews;
- dashboard status-count projections and an idempotent backfill;
- upcoming follow-ups and interviews;
- richer activity history;
- bounded search, sorting, and filtering;
- profile/settings UI.

Cognito, private attachments, email, and reminders remain deliberately deferred
to their later roadmap milestones.
