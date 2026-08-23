# HireFlux development log

This log records the engineering work, decisions, problems, and validation completed for HireFlux. It is written so the project can be discussed clearly in portfolio reviews and technical interviews.

## 2026-08-23 - Analytics timezone and filter hardening

Stage-aging analytics and its application-list drill-down now use the saved workspace IANA time zone for calendar boundaries. New browser workspaces automatically detect and persist the browser's time zone, while a manual Settings choice prevents later automatic replacement. Invalid `stage_age` combinations in shared application URLs are normalized in the frontend instead of reaching an API error state. The reconciliation fixture now includes the current interview workspace fields, keeping the full backend suite aligned with the domain model.

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

- The initial target assumed Cognito would own passwords and sessions; the later public-demo decision replaced that requirement with temporary signed workspaces while preserving the rule that HireFlux never stores password hashes.
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

## 2026-08-11 - Isolated demo workspace

### Objective

Turn the fixed-user local application into a candidate-focused experience that still feels like a one-click public demo while giving every visitor a private, temporary owner identity. Two visitors entering at the same time must never see or modify one another's records.

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

The seed path deliberately uses ordinary application creation and transition services instead of bypassing domain rules. The examples therefore produce the same transactionally written activity history, versions, allowed transitions, and ownership behavior as candidate-created records.

Application creation now transactionally increments a workspace quota item. The configured lifetime limit defaults to 100 applications, and the same DynamoDB transaction rolls the increment back if the application/activity write fails. This bounds database growth within one temporary identity without using `Scan` or trusting a browser-side count.

### Temporary-data lifecycle

Temporary profile, quota, application, and activity items carry the numeric DynamoDB `expires_at` attribute. The explicit table initializer enables TTL on that attribute and remains idempotent.

DynamoDB TTL deletion is asynchronous, so it is not treated as authorization. Access ends when the signed token expires. Reset creates a different owner identity and replaces the browser token immediately; old records become unreachable from that browser before DynamoDB physically removes them.

Archived applications were also removed from the active GSI projection. They remain queryable through the `ARCHIVED` status index, which keeps default active pages full without a filter expression.

### Frontend experience

Replaced the root redirect with a public, responsive candidate-focused landing page. **Explore the Demo** requests a workspace, stores the validated token in tab-scoped session storage, clears identity-specific TanStack Query data, and redirects to `/applications`.

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
a publicly accessible candidate demo, the next milestone is a cost-bounded staging stack,
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

## Milestone 2 local workspace home and richer workflow - August 12, 2026

### Objective and route flow

Completed the local product milestone before beginning any AWS architecture or
deployment work. The public `/` route remains a candidate-focused landing page,
while a newly created or reset 24-hour demo workspace now enters the protected
`/dashboard` Home. Valid direct links to applications, interviews, analytics,
and settings remain intact instead of being forced through Home.

Home is organized around the four questions established during product
planning:

1. How many jobs am I pursuing?
2. What needs my attention today?
3. How successful has my search been?
4. What should I do next?

The resulting dashboard presents whole-workspace and active-pursuit counts, a
prioritized action center, outcome rates with visible denominators, an
eight-week submission trend, current-status context, upcoming interviews, and
recent application movement. Follow-ups can be completed or rescheduled from
the action itself, with version checks and activity history preserved.

### Application workflow and server-owned list views

Expanded the workflow to all nine current statuses: `DRAFT`, `APPLIED`,
`SCREENING`, `INTERVIEW`, `OFFER`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, and
`ARCHIVED`. The centralized transition policy remains authoritative, including
the required `INTERVIEW -> OFFER` path, the forbidden `REJECTED -> INTERVIEW`
path, exact-prior-status archive restoration, and the explicit
`REJECTED -> OFFER` correction path.

The application page now supports server-owned search, source and work-mode
filters, current-status filtering, ascending or descending update order, and
three explicit views:

- `ACTIVE`: Applied, Screening, Interview, and Offer;
- `ALL`: every status, including Archived;
- `ARCHIVED`: archived records only.

The API queries only authenticated-owner index partitions. Multi-status views
fan out across the required GSI2 status partitions, merge within the bounded
workspace quota, and paginate with a signed logical cursor bound to owner,
view, explicit status, search, filters, and sort. This prevents the former
client-side active filtering problem, where a page could appear empty while a
matching record existed later. The React query cache includes the same filter
scope and still deduplicates IDs across best-effort cursor pages.

### Notes, interviews, and action history

Added owner-scoped application notes with create, edit, and delete operations,
and owner-scoped interviews with schedule, edit, complete, and cancel flows.
Child resource IDs, ownership, versions, and timestamps remain server-owned.
Application ownership is checked before child access, so another workspace sees
the same `404` as it would for a missing parent.

Scheduled interviews project into both the owner interview list and GSI3
schedule. Completing or canceling one removes it from the scheduled projection
transactionally. Follow-up completion, follow-up rescheduling, note mutations,
and interview mutations append ordinary activity items instead of rewriting
history. Upcoming interviews and due follow-ups are therefore actionable views
over canonical owned records rather than browser-invented state.

### Dashboard and analytics semantics

Added server-owned historical milestones for submission, first response,
screening, interview, offer, acceptance, and current-stage entry. Current status
does not erase a previously reached milestone. Response, interview, offer, and
acceptance rates use submitted applications as the denominator, expose both
counts and rates, and return zero rather than dividing by an empty population.

Analytics supports `30d`, `90d`, and `all` ranges plus current status, normalized
source, and work-mode filters. Rates, trends, funnels, source performance, and
work-mode comparisons use the submitted population inside the selected range.
For finite ranges, summary, current-status distribution, and stage aging use
in-range submitted records plus current drafts; all-time includes every current
record. Source comparisons are visibly marked as small samples until at least
three submitted applications are present. The page also reports average time to
first response and submitted applications still awaiting a response, with an
explicit statement that demo analytics are descriptive rather than predictive.

### Saved workspace preferences and calendar behavior

Added versioned, owner-scoped settings for a validated IANA time zone, default
follow-up interval, default application view, default dashboard range, and
theme. Settings carry the demo TTL and survive navigation within the isolated
workspace. Header theme changes and the Settings page persist through the same
authenticated API instead of relying only on browser-local state.

Follow-ups are stored as ISO date-only calendar values. “Overdue” and “today”
are evaluated against the current calendar date in the saved workspace time
zone; rendering does not convert the date through UTC or shift it to an adjacent
day. New-application defaults add the saved follow-up interval to the current
date in that same zone. Interviews remain timezone-aware instants stored in UTC
and are displayed in the selected workspace zone.

### DynamoDB projections and local operations

The table now has three sparse indexes. GSI1 carries non-archived applications
and a separate owner-interview partition, GSI2 partitions applications by
status, and GSI3 carries outstanding follow-ups plus scheduled interviews.
Application/status transactions maintain nine status counters and one
historical funnel counter alongside canonical metadata and activity. Dashboard
counter reads use a strongly consistent owner-partition `Query` over the
`COUNTER#` sort-key prefix; request paths still contain no `Scan`.

Added a guarded, idempotent local reconciliation command. It refuses non-local
targets and requires an exact table-name confirmation before its controlled
maintenance scans. Rewriting applications and interviews through current
serializers repairs their sparse index attributes, restores missing scheduled
interview projections, removes stale schedule keys from completed/canceled
interviews, and rebuilds status and funnel counters. A separate guarded local
reset command supports intentional clean-room testing without making table
creation or destructive maintenance an application-startup behavior.

### Candidate dataset, TTL, and security boundaries

Expanded each new demo from five examples to 16 deterministic fictional
applications covering every status, varied sources and work modes,
overdue/today/upcoming follow-ups, notes, scheduled/completed/canceled
interviews, historical milestones, and enough activity to demonstrate the
dashboard and analytics honestly. Seeding continues through ordinary services
and transactions instead of bypassing domain rules.

Every temporary item type now carries the workspace's numeric `expires_at`,
including settings, notes, interviews, counters, quota, applications,
activities, and profile. Signed-token expiry remains the immediate authorization
boundary because DynamoDB TTL cleanup is eventual. Ownership always comes from
the verified identity; request bodies cannot choose owners, roles, IDs,
timestamps, milestone fields, or general-edit status. CORS remains an explicit
allowlist, deployed clients omit local endpoints and explicit credentials, and
no passwords, uploads, real credentials, or private user data were introduced.

### Frontend quality and validation handoff

Implemented the protected Home, Analytics, Interviews, and Settings routes with
centralized API calls and Zod validation. New and changed views include labeled
controls, semantic sections and tables, visible keyboard focus, loading/empty/
error states, retry paths, responsive layouts, screen-reader equivalents for
visual trends, and text labels in addition to color. Mutations invalidate the
relevant application, activity, schedule, dashboard, and analytics queries.

At this documentation handoff, the suite collects 129 isolated backend tests
and contains 31 frontend tests across eight files. Ruff lint/format, strict
mypy, backend API/integration tests, frontend ESLint/TypeScript/Vitest, and the
production build were exercised throughout the milestone, including ownership,
TTL, cursor scope, view completeness, analytics denominators, projection
reconciliation, optimistic conflicts, route flow, settings persistence, and
accessible interactions. The final real-browser pass covered saved-time-zone
timestamp rendering, date-only follow-ups, session-boundary cache isolation,
responsive layouts, direct-route refreshes, and keyboard focus behavior. No
AWS resources were created during Milestone 2.

## Final Milestone 2 browser QA and session-isolation hardening - August 12, 2026

Completed the final local release gate against the running Vite, FastAPI, and
DynamoDB Local services. The browser pass covered 1440 x 900 desktop,
768 x 1024 tablet, 390 x 844 mobile, and a 320-pixel narrow fallback. The
dashboard, application list, application detail, analytics, interviews, and
settings views remained contained without page-level horizontal overflow.
Mobile navigation now uses five compact, accessible columns at supported phone
widths and wraps below 360 pixels, so every primary destination remains visible
without a horizontally scrolling menu. The compact `Apps` label retains the
accessible name `Applications`, and tablet and desktop labels remain unchanged.

The browser workflow exercised demo launch, all-status and archived views,
direct protected-route refresh, unauthenticated deep-link redirection, notes,
follow-up completion, status transitions, settings and theme persistence,
analytics filters, application creation, and reset. Modal QA confirmed an
`alertdialog` with an explicit label and description, safe initial focus, and
focus restoration to the reset trigger. Automated keyboard tests additionally
cover Tab and Shift+Tab containment, Escape dismissal, unsaved-change dialogs,
and focus restoration. The final dashboard refresh produced no browser console
warnings or errors.

The pass found and resolved three release-significant issues:

- Timestamp formatting outside Home had used the browser time zone instead of
  the saved workspace time zone. Global interviews, application cards, detail
  headers, activity, notes, nested interviews, and workspace expiry now all
  require and use the selected zone. Date-only follow-ups remain calendar-safe.
- The mobile primary navigation exposed a horizontal scrollbar and initially
  left `Settings` off-canvas. Its responsive grid now fits all destinations at
  390 pixels and wraps cleanly at 320 pixels while preserving 44-pixel targets.
- Replacing a demo identity could briefly render TanStack Query data from the
  prior workspace. Launch, reset, and exit now synchronously clear the query
  cache at the identity boundary. Protected routes unmount behind a neutral
  preparation state while a replacement session is issued, and only remount
  after the new token is active. A live 17-record-to-reset reproduction proved
  that the old total disappears during the transition and the new isolated
  workspace returns with exactly 16 applications and two drafts.

Final validation used Python 3.14.7. Ruff lint and format checks passed across
59 backend files, strict mypy passed across 43 source files, and Pytest passed
129 tests. Frontend ESLint and TypeScript checks passed, Vitest passed 31 tests
across eight files, and the production Vite build passed with route-level code
splitting. `pip check` and `git diff --check` passed. The Python dependency
audit reported no known vulnerabilities, and the npm production audit reported
zero vulnerabilities. The only remaining warning is the existing upstream
FastAPI/Starlette TestClient deprecation notice. DynamoDB Local, the backend,
and the frontend remained healthy, and the handoff browser was left on a clean
16-record dashboard at `http://localhost:5173/dashboard`.

## Full frontend visual redesign - August 13, 2026

### Purpose

Redesign the local demo workspace from a functional CRUD workspace into a
polished portfolio product experience. The goal was to make HireFlux feel like
a focused job-search command center: dark-first, easier to scan, more
comfortable for repeated use, stronger on mobile, and clearer about what a
candidate or visitor should try during a short demo session.

The redesign deliberately stayed inside the frontend boundary. Backend routes,
payloads, authentication/session behavior, ownership rules, application status
transition rules, and DynamoDB access patterns were not changed.

### Changes delivered

Completed the dark-first HireFlux workspace redesign without changing backend
routes, payloads, ownership rules, or status-transition policy. The visual
foundation now uses semantic canvas, surface, border, text, accent, success,
warning, and danger tokens; self-hosted variable Inter and Space Grotesk fonts;
and one Lucide outline-icon system. Dark remains the first-run default, while
explicit Light, Dark, and System preferences persist consistently. Shared
surface, page-header, field, tab, drawer, dialog, menu, icon-button, skeleton,
toast, and feedback primitives now provide consistent motion, focus, Escape,
and focus-restoration behavior.

The authenticated shell now provides a persistent collapsible desktop sidebar,
contextual utility bar, mobile top bar, safe-area-aware bottom navigation, and a
focused More sheet. Route changes restore scroll, announce the destination,
focus the new page heading, and update the document title. Reset and exit retain
their confirmation/session protections and also clear the session-only
search tour. The landing experience keeps the direct demo entry while
adding a stronger product-proof narrative and an explicitly decorative,
screen-reader-described workspace preview.

Applications now use URL-backed Active, All, and Archived views plus a
medium-screen card/list preference. Search remains submit-driven; status,
source, work mode, and sort changes are staged in a responsive filter drawer
until Apply, with result counts and removable filter chips after submission.
Cards and the semantic desktop table expose location, work mode, urgency,
timestamps, and a visible Manage route to the application overview. Narrow
screens intentionally fall back to cards rather than squeezing the table.

Application detail now exposes URL-backed Overview, Notes, Interviews, and
Activity tabs, lazily requesting each resource only when selected and retaining
React Query cache when revisited. The server-provided status policy remains the
only source of allowed transitions; it is presented in a sticky desktop rail
and a focused mobile/tablet sheet. Notes reveal their composer deliberately,
interview editing uses a drawer/sheet with explicit cancellation confirmation,
and create/edit forms keep essential fields open while optional fields collapse
until requested, pre-populated, or invalid. Required fields are semantic,
validation summaries link to invalid controls, and form actions remain visible
in a sticky footer.

Home now leads with a dismissible three-action search tour, a linked metric
strip, and a dominant action center grouped into Overdue, Today, and Upcoming.
Successful status, note, and interview actions alone advance session-only guide
progress. Analytics is divided into URL-backed Overview, Pipeline, and Sources
sections with staged secondary filters, accessible week labels, responsive
source cards, and a labeled desktop table. Interviews is organized around the
saved workspace calendar, and Settings presents profile, workspace lifecycle,
preferences, and account controls together while replacing unavailable
production controls with explanatory capability content.
Dashboard, analytics, and application filters retain previous data during
refetches and reserve layout-matched skeletons for initial loading.

### Validation and acceptance

The acceptance layer now includes JSX accessibility linting, twelve route and
open-overlay axe component checks, and deterministic Playwright coverage against
a production preview. Browser checks run at 320 x 720, 390 x 844, 768 x 1024,
and 1280 x 900 with reduced motion. They exercise computed dark and light
contrast, persisted theme choice, keyboard tabs, staged filters, drawer and
status-sheet focus restoration, card/list fallback, lazy query caching,
progressive form validation, route containment, and a desktop 200-percent zoom
equivalent. Ten stable desktop visual baselines cover the landing page, Home
shell, Applications, every application-detail tab, Interviews, Analytics, and
Settings.

Final validation passed ESLint, TypeScript, 58 Vitest tests across 11 files
(including all twelve axe scenarios), the production Vite build, and 47
Playwright checks with nine expected non-desktop skips for the desktop-only
theme, tab-snapshot, and zoom duplicates. Every principal browser route had
zero detected WCAG A/AA axe violations and no unintended page-level horizontal
overflow at the four tested widths. Dedicated browser scenarios also verified
layout-matched loading, explicit empty and failed-request/retry feedback, and
containment of extreme long application content. A final live pass launched a
fresh 16-record isolated workspace and verified the redesigned Home and
Applications flows against the running local API. `git diff --check` and the
npm production dependency audit also passed.

## Light-mode visual refinement - August 22, 2026

### Purpose

Refined the explicit light theme so it feels calmer and more legible across
different displays without changing the existing dark-first product identity.
The work stayed within presentation: no API contracts, routes, theme
persistence behavior, authentication, or backend architecture changed.

### Changes delivered

The light palette now uses a cool blue-gray canvas, near-white raised
surfaces, stronger semantic borders, darker readable muted text, and softer
cyan/violet lighting. Primary actions remain cyan/teal with white text, while
amber is reserved for warning and expiry states using a contained cream panel
and narrow warning rule rather than a bright yellow outline.

The landing page now uses semantic canvas and surface tokens, a quieter hero
gradient, clearer workspace-preview boundaries, gray-blue preview layers, and
consistent feature/proof-card separation. Status badges and remaining
legacy-palette feature screens use the same semantic light-mode compatibility
mapping, while the dark token values and layout remain unchanged.

### Validation

Added deterministic light-mode screenshots for the landing page at 320, 390,
768, and 1280 pixels, plus desktop light baselines for Dashboard,
Applications, Application Detail, Interviews, Analytics, and Settings. Light
routes are checked for WCAG A/AA axe violations, horizontal overflow, and
stable layout after the theme transition.

Final validation passed frontend ESLint, TypeScript, 68 Vitest tests across 12
files, the production Vite build, and 60 Playwright checks (51 passed with
nine expected desktop-only skips). Existing dark-route coverage also passed;
the Settings desktop baseline was refreshed to match the current Settings
page structure already present in the working tree. `git diff --check` passed.

## Analytics, resource bounds, and workflow-integrity hardening - August 22, 2026

### Purpose

Completed a correctness and resilience pass based on candidate-workflow review.
The work focused on preventing date-only values from becoming invalid
timestamps, keeping analytics consistent across equivalent workflows, making
bounded resources complete and affordable to read, and preserving recoverable
UI state when a demo reset fails.

### Analytics and date semantics

Established the separation between the user-entered `applied_date` calendar
value and server-owned UTC milestones. `applied_date` is validated against the
workspace's current calendar date and is never converted through UTC. The
analytics reporting window and submission trend use that canonical business
date, while elapsed-time metrics use ordered server timestamps such as
`submitted_at` and `first_response_at`.

Direct `APPLIED` creation and `DRAFT` to `APPLIED` transitions now resolve to
the same applied-date reporting window. Invalid legacy milestone ordering is
excluded from duration averages rather than producing negative response times.
The API, service, schema, and frontend form changes keep these rules
server-owned and display validation errors at the user input boundary.

### Archived workflow integrity

Archived applications continue to satisfy the required fields of their
remembered prior status. In particular, an archived later-stage application
cannot clear the `applied_date` that would be required when restored. Restore
requests can repair a legacy archived record that is missing this field before
the status transition is applied; the exact `archived_from_status` rule remains
authoritative.

### Resource quotas and bounded reads

Added per-application server-owned quotas with transactional counters: 100
notes, 25 interviews, and 500 append-only activity entries by default. Quota
updates happen atomically with child-resource creation or activity writes, and
deleting a note releases its slot. The local demo's existing 100-application
lifetime quota remains in place.

Notes, interviews, activity, and global upcoming-interview reads now return
bounded pages with signed, scope-bound cursors and continuation metadata. The
cursor contract hides DynamoDB keys and rejects tampering, cross-owner reuse,
and application/filter mismatches. Frontend panels accumulate pages safely,
deduplicate items, and expose load-more behavior so records beyond the first
page remain discoverable.

### Reset failure recovery

Demo reset no longer clears the active workspace or unmounts the protected
layout while the replacement session is being created. The current workspace
and reset dialog remain available until reset succeeds. If creation fails, the
dialog stays open with the explicit message that the existing workspace is
still available, a `Try again` action, and an assertive alert that receives
focus for screen readers and keyboard users. Query data is cleared only after
the replacement session exists, preserving the old identity on failure while
still enforcing cache isolation at the successful identity boundary.

### Validation

Added regression coverage for date validation, milestone consistency, archived
workflow repair, quota limits and rollback, signed cursor scope, complete
interview pagination, and failed-reset focus/retry behavior. The current
frontend validation passes 62 Vitest tests, ESLint, TypeScript checking, and
the production Vite build. Backend Ruff lint/format, strict mypy, and the full
backend suite also pass at 138 tests. `git diff --check` passes; existing
Git line-ending normalization warnings are non-blocking.

The durable contracts were updated in the dashboard/analytics, domain-model,
DynamoDB access-pattern, and isolated-demo-session ADR documents. No AWS
resources were created during this work.

## Browser security headers - August 22, 2026

### Hosted policy

Added the repository-root `customHttp.yml` monorepo configuration for Amplify
Hosting. Hosted responses now receive a deployable Content Security Policy,
HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, and cross-origin isolation headers. The policy permits
same-origin scripts only, blocks object/plugin content and inline event-handler
scripts, prevents framing, disables unused browser capabilities, and scopes API
connections to the planned us-east-1 API Gateway origin. Deployments using a
custom API domain or another AWS region must update `connect-src` before release.

The pre-React theme setup moved from an inline script in `frontend/index.html`
to `frontend/public/theme-bootstrap.js`, keeping first-paint theme selection
while allowing `script-src 'self'`. Vite development and preview servers now
send the same header family with an explicit local API allowlist and without
HSTS on HTTP. The development-only Vite React-refresh bootstrap is the sole
reason the local server allows inline scripts; the production preview and
hosted policy keep them blocked. The security-header helper has focused tests
covering inline script blocking, framing protection, local HTTP behavior, and
MIME sniffing protection.

This is defense in depth for the current temporary demo token in
`sessionStorage`; it does not make a bearer token unreadable to already-running
same-origin JavaScript. Production identity/session hardening remains a separate
deployment milestone.

## Python dependency lock and SBOM baseline - August 22, 2026

### Reproducible dependency graph

Generated and committed `backend/uv.lock` from the existing pinned
`backend/pyproject.toml`. The lock covers the runtime and development extra
across the supported Python 3.13 and 3.14 range, records transitive versions,
registry sources, and SHA-256 hashes for source and wheel artifacts. The
recommended environment setup is now `uv sync --project backend --extra dev
--locked`, and `uv lock --check` is the drift gate before validation.

The frontend already has a committed npm lockfile; the documented setup keeps
using `npm ci` so its package integrity metadata remains authoritative.

### Software inventory

Added `backend/scripts/generate_sbom.py`, a standard-library CycloneDX 1.5
generator that reads the Python lockfile and emits package URLs, dependency
edges, artifact hashes, and the lockfile digest. The supply-chain guide also
documents npm's CycloneDX SBOM command for the frontend. Generated SBOM files
are ignored local/CI artifacts rather than source files, so a future staging
workflow can upload the exact inventories alongside each build.

## Demo provisioning reliability - August 22, 2026

### Lifecycle state and failure cleanup

Demo creation now reserves a workspace lifecycle item as `PROVISIONING` before
writing the profile and seeded applications, activities, notes, interviews,
settings, quotas, and counters. The item becomes `READY` only after the full
seed completes. If any step fails, the service returns a safe persistence error,
marks the lifecycle `FAILED` with a 15-minute default TTL, and removes partial
owner/application records best-effort through bounded owner-scoped queries and
batch deletes. The failed marker and its optional idempotency record remain
briefly so an incomplete seed is distinguishable from a successful workspace;
they do not grant authorization.

### Retry safety

`POST /api/v1/demo-sessions` accepts an optional `Idempotency-Key`. The backend
stores only a SHA-256 hash of that key with the generated workspace reference.
Once provisioning is `READY`, replaying the same key returns the same
deterministic signed token and workspace expiry rather than creating a second
seed. Requests that collide with `PROVISIONING` or `FAILED` receive a conflict,
so callers can retry an incomplete operation with a new key after the failure
has been surfaced. The frontend generates a UUID key for each launch/reset
attempt, making transport-level replay safe without exposing internal
DynamoDB keys.

### Validation

Added Moto-backed integration coverage for the `READY` lifecycle marker,
idempotent replay, partial-seed cleanup, short failure TTL, and failed-key
conflict behavior. Added frontend coverage proving demo launch sends the
idempotency header. The local architecture and access-pattern documents now
describe the lifecycle and bounded cleanup path. No AWS resources were created.

## Settings draft refresh safety - August 22, 2026

Settings preferences now track dirty fields independently from the server
snapshot. When another control, such as the header theme toggle, refreshes the
shared settings query, untouched fields accept the latest server values while
locally edited fields remain in the draft. Saving replaces the draft with the
server-confirmed response and clears the dirty-field set.

Added a frontend regression test covering an unsaved dashboard-range change
surviving a header theme refresh while the refreshed theme is accepted.

## P1 audit remediation - August 22, 2026

### Browser Notes contract

The Playwright Notes-tab regression was caused by stale browser fixtures that
omitted `next_cursor` from paginated notes and activity responses. The real API
and frontend Zod schemas require the cursor field, so the fixture now matches
the production contract without weakening validation or suppressing parser
errors.

### Demo reset isolation

Demo reset now cancels active queries, clears React Query data, and removes the
stored demo token as soon as identity replacement begins. The protected app
stays mounted only to show a reset/provisioning state and the existing reset
dialog; old workspace records are not rendered behind it. If provisioning
fails, the previous valid session is restored explicitly, caches remain cleared,
and the dialog focuses the existing accessible error with retry/recovery
actions.

### Bounded synchronous export

`GET /api/v1/me/export` now sets `Cache-Control: no-store` and `Pragma:
no-cache` on successful responses. Synchronous export is capped by
`MAX_SYNC_EXPORT_RECORDS`, defaulting to 5,000 exported application, activity,
note, and interview records. Larger workspaces receive
`WORKSPACE_EXPORT_TOO_LARGE` instead of a partial download. The current default
resource quotas allow up to 100 applications, 10,000 notes, 2,500 interviews,
and 50,000 activity records, so a maximum workspace must move to a future async
S3 export path before AWS staging relies on production-scale data export.

## Unified Settings & profile controls - August 22, 2026

Settings & profile is now a single page: profile editing, workspace lifecycle,
preferences, and account controls render together without the former
Preferences/Demo workspace/Account preview section navigation. The page keeps
a useful candidate-facing export action for demo visitors:
`GET /api/v1/me/applications/export` produces a spreadsheet-friendly CSV of
the signed-in workspace's applications. The full versioned JSON export at
`GET /api/v1/me/export` remains reserved for future persistent accounts and is
rejected for demo identities. Both paths are owner-scoped, use bounded
Query-based access rather than a DynamoDB Scan, and never accept an owner
identifier from the client.

The frontend downloads the server-produced CSV with its attachment filename.
The unified page also presents a
production-readiness checklist for identity recovery, MFA/session controls,
notifications, retention, and portability. These remain clearly labeled
production concepts: the demo does not pretend to provide passwords, MFA,
email notification delivery, role switching, persistent login, or permanent
deletion. Application CSV export is the active account-control action in this
milestone. The profile name field is an explicit local simulation; email remains
read-only because there is no profile-write or delivery service in the local
demo.

Added API coverage proving application CSV export remains owner-scoped and
properly escaped, the full JSON export remains isolated for persistent
identities, and demo identities cannot bypass the UI boundary. Frontend lint,
typecheck, tests, and production build were rerun for the account-preview
change. This is still local demo functionality; no AWS identity, storage, or
notification resources were created.

### Candidate account and workflow preview

The unified page includes candidate-focused, deliberately non-authoritative
account previews. A candidate workflow guide connects Applications,
Interviews and notes, and Analytics without implying an ATS or organization
role model. It never changes the signed-in authorization or server identity.
Email notification controls remain visibly blocked: the reminder checkboxes
are disabled and explain that no delivery system exists in the demo.

The page distinguishes the active application CSV export
from production concepts such as recovery, MFA, session controls, retention,
and permanent deletion. Added frontend coverage for the candidate workflow,
the local-only profile simulation, disabled email notifications, and the
explicit authorization/message-delivery boundary. This keeps the demo useful
for public product review while preserving the server-owned security and business
rules.

## Localhost development reliability - August 22, 2026

The Vite development and preview servers now bind explicitly to IPv4
`127.0.0.1`. This keeps the documented `http://127.0.0.1:5173/` browser URL
working on Windows systems where `localhost` may resolve first to IPv6 `::1`.
The local FastAPI process remains a separate service on port 8000, with
DynamoDB Local on port 8001.

## Candidate-first product framing - August 23, 2026

Removed the Settings role-and-access simulation for Candidate, Recruiter,
Hiring manager, and Administrator because those organization personas implied
an applicant-tracking system that HireFlux does not provide. Settings now
describes a private personal account, labels the demo's focus as a candidate
job search, and links Applications, Interviews and notes, and Analytics as one
candidate workflow.

The dashboard's three-step walkthrough is now the Search tour. Its internal
event, types, and storage use candidate-neutral names while still reading the
legacy `hireflux-recruiter-guide` session value once so an existing visitor's
dismissed or completed state is not lost. Reset and exit clear both storage
keys. The public landing and current architecture/product documentation now
describe a candidate-focused demo available to any visitor.

Recruiter and hiring-manager vocabulary remains only where it represents real
candidate-side application data, such as an application source, recruiter call,
or interview participant. Server-side role fields remain authoritative and
reserved for future separately guarded capabilities; no role switcher, ATS
workflow, backend authorization change, or data migration was introduced.

## Next recommended work

Freeze and commit the validated local Milestone 2 baseline, then build and
manually validate the cost-bounded AWS staging foundation described in the
roadmap: TypeScript CDK, Python 3.14
Lambda/Mangum, HTTP API, a separate DynamoDB table, secret-backed signing keys,
CloudWatch safeguards, and an Amplify staging branch with explicit CORS,
asset-aware SPA routing, security headers, throttling, constrained concurrency,
and budget alerts.

Automated OIDC-based CI/CD should follow only after the staging stack is stable
under manual smoke testing. Cognito accounts, private attachments, email, and
real reminder delivery remain deliberately deferred to their later milestones.
