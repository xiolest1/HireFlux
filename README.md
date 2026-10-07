# HireFlux

## A clearer way to manage a job search

HireFlux is a candidate-focused job application tracker for turning a scattered search into a structured, actionable workflow.

Instead of keeping application details across spreadsheets, browser tabs, inboxes, and calendar reminders, HireFlux gives each opportunity a place to live and keeps the next step visible. Candidates can track where an application stands, prepare for interviews, follow up at the right time, and learn from the overall search without losing the history behind each decision.

HireFlux is intentionally a personal job-search workspace. It is not a job board, recruiting marketplace, or applicant-tracking system for employers.

## Explore the experience

The public landing page opens an isolated demo workspace with fictional data. No account or sign-up is required.

Each demo workspace is:

- pre-populated with fictional applications across drafts, active stages, and outcomes;
- isolated from every other visitor's workspace;
- available for 24 hours so the workflow can be explored safely;
- resettable at any time without affecting anyone else;
- safe to edit because the data is synthetic and temporary.

The demo is designed to show how HireFlux feels in a realistic candidate workflow, not to represent a connected production account.

## What candidates can do

### See the whole search at a glance

The Home dashboard answers the questions that matter most during an active search:

- How many opportunities am I pursuing?
- What needs my attention today?
- How successful has my search been?
- What should I do next?

The Action Center brings together overdue and upcoming follow-ups, interview preparation, and applications that may be losing momentum. Large groups use compact previews so the dashboard stays readable while every action remains available.

### Manage every application in one place

Applications can be created, edited, searched, filtered, and viewed as cards or a compact list. Each record keeps the details that are easy to lose elsewhere:

- company, role, location, work mode, source, salary context, and job link;
- current stage and server-approved status transitions;
- follow-up date and next-step context;
- notes and append-only activity history;
- archive and restore behavior for completed or closed opportunities.

The application detail view brings the opportunity, history, notes, and interviews together so the candidate can act without reconstructing context from multiple tools.

### Prepare for interviews, not just track them

Scheduled interviews include the time, format, meeting details, preparation prompts, checklists, candidate questions, and post-interview debrief fields. Interview status and preparation progress remain connected to the application they belong to.

### Understand search momentum with honest analytics

Analytics turns the application history into descriptive signals rather than unsupported predictions. It includes:

- submission and outcome trends;
- response, interview, offer, and acceptance rates with visible denominators;
- current pipeline and stage distribution;
- time spent in the current stage with exact application drill-downs;
- source and work-mode comparisons;
- follow-up coverage and period-over-period comparisons;
- Search Health insights that distinguish action needed, worth watching, and useful context.

The analytics language is deliberately cautious: small samples are labeled, aging is a review signal rather than a forecast, and historical milestones remain true even when an application's current status changes.

### Keep control of the workspace

Workspace settings include time zone, follow-up defaults, dashboard range, application-list defaults, theme, and other personal preferences. The demo also shows how candidate-facing account controls could work, including notification preferences, session visibility, recovery guidance, and MFA readiness, without pretending those simulated controls are live authentication services.

Candidates can export their fictional application data as CSV for inspection. Persistent account portability and larger production exports are reserved for the future product path.

## Product principles

HireFlux is built around a few practical principles:

- **Next-step clarity:** every active opportunity should make the next action easy to find.
- **History matters:** activity and milestone history should explain how an application reached its current state.
- **Descriptive over predictive:** analytics should help a candidate review their process, not make promises about outcomes.
- **Candidate ownership:** the workspace is for the person running the search, with controls and language designed around their decisions.
- **Safe experimentation:** the demo should be realistic enough to explore and isolated enough to change freely.
- **Accessible by default:** responsive layouts, semantic structure, visible focus, keyboard support, and clear loading, empty, and error states are part of the product experience.

## Project snapshot

HireFlux is a portfolio-grade full-stack application currently designed for a local demo:

```text
React + TypeScript + Vite -> FastAPI -> DynamoDB Local
```

- **Frontend:** React, TypeScript, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, Vitest, and Testing Library.
- **Backend:** FastAPI with explicit route, application-service, repository-protocol, and DynamoDB-adapter boundaries.
- **Data model:** owner-scoped applications, notes, interviews, activities, settings, analytics counters, and schedule projections.
- **Security model:** signed temporary demo identities, server-owned authorization and metrics, explicit CORS, optimistic concurrency, and no stored passwords.
- **Current runtime:** local development with DynamoDB Local. Planned AWS staging is documented separately and is not provisioned by this repository.

Phase 2A also provides a durable local backend workspace: a server-configured
non-demo identity explicitly bootstraps an empty workspace whose records omit
demo TTL. Phase 2B adds a shared browser session boundary and a development-only
durable local adapter. Phase 2C adds strong inventory, atomic deletion/write
guards, resumable live-workspace erasure, and bounded export. Cognito and AWS
deployment remain later phases. See the [current roadmap](docs/roadmap.md#current-execution-order).

The canonical architecture and current-versus-target boundary are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

Phase 3A adds an independent [CDK foundation](infra/README.md) for explicit staging
and production environments. Phase 3D defines each backend request path with
one DynamoDB table, one ZIP Lambda, generated signing secrets, scoped IAM and
HTTP API. Both stacks synthesize without AWS credentials. Build and validate
the ZIP first using the [backend packaging commands](backend/README.md), then
run from the repository root:

```bat
npm --prefix infra ci
npm --prefix infra run typecheck
npm --prefix infra test
npm --prefix infra run synth:staging
npm --prefix infra run synth:production
```

Phase 3E adds independent static Amplify app/branch definitions and token-derived
frontend/API wiring. Hosting is not deployed; AWS deployment remains Phase 4.
The infra guide records the current open CDK bundled dependency advisory.

Phase 3B now supplies the [backend Lambda ZIP build and validation](backend/README.md):
Python 3.14, Linux x86_64, locked production wheels, deterministic packaging,
and isolated cold/warm HTTP API v2 tests. The handler is
`hireflux_backend.lambda_handler.handler`. Phase 3D verifies and binds the rebuilt
ZIP to the defined Lambda resource; nothing is deployed. See
[ADR 0009](docs/adr/0009-lambda-runtime-and-deterministic-packaging.md)
and [Phase 3B evidence](docs/production-account-readiness.md#41-phase-3b-implementation-and-handoff).

The DynamoDB table is defined locally with generated physical names, on-demand
capacity and the existing three indexes/TTL. Staging is replaceable; production
enables PITR/deletion protection and retains the table. [ADR 0010](docs/adr/0010-dynamodb-cloud-lifecycle.md)
and [Phase 3C evidence](docs/production-account-readiness.md#42-phase-3c-implementation-and-handoff)
record schema parity, lifecycle tests and the separate backup/privacy limitation.

## Run the local demo

The README is intentionally product-first. The following is the shortest local path for trying the current implementation on Windows Command Prompt.

<details>
<summary>Show local setup and startup commands</summary>

### Requirements

- Node.js 22.12 or newer;
- Python 3.13 or 3.14;
- uv 0.12.5 or newer;
- Docker Desktop with Linux containers;
- Git.

From the repository root:

```bat
uv sync --project backend --extra dev --locked
npm --prefix frontend ci
docker compose up -d dynamodb-local
backend\.venv\Scripts\python.exe backend\scripts\init_local_table.py
```

Use separate Command Prompt windows for the API and frontend:

```bat
backend\.venv\Scripts\python.exe -m uvicorn hireflux_backend.main:app --app-dir backend\src --reload --port 8000
```

```bat
npm --prefix frontend run dev
```

Then open [http://localhost:5173](http://localhost:5173). The local API health check is available at [http://localhost:8000/health](http://localhost:8000/health).

For table reset/reconciliation, environment configuration, and the complete validation workflow, see [AGENTS.md](AGENTS.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

### Optional durable local development workspace

For backend development, start the API in a separate local configuration with
`AUTH_MODE=local`. In its Command Prompt window, set the mode before starting:

```bat
set AUTH_MODE=local
backend\.venv\Scripts\python.exe -m uvicorn hireflux_backend.main:app --app-dir backend\src --reload --port 8000
```

For the durable browser flow, start Vite with the matching mode in its window:

```bat
set VITE_WORKSPACE_MODE=local
npm --prefix frontend run dev
```

Open a protected route such as `/applications`. The browser initializes the
configured fixed backend owner automatically before showing workspace content.
The workspace begins empty and saved applications/preferences survive refresh,
leaving, and reopening. This is development access, with no real login, logout,
passwords, or browser owner selector. A tab remembers intentional leave until
you choose **Open local durable workspace**. The public landing stays accessible.

API-only development can still initialize explicitly from another window:

```bat
curl.exe -X POST http://localhost:8000/api/v1/me/bootstrap
curl.exe http://localhost:8000/api/v1/me
```

Bootstrap is idempotent, accepts no authoritative client fields, and creates no
fictional applications. Ordinary durable endpoints return
`WORKSPACE_BOOTSTRAP_REQUIRED` until initialization completes. Compatible legacy
local data is preserved without a table reset. Demo identities cannot use this
endpoint to convert their workspace. Restart both processes after changing
modes. Return to `AUTH_MODE=demo` and `VITE_WORKSPACE_MODE=demo` for the ordinary
fictional demo. Local browser mode is unavailable in production builds. No table
reset or migration is required for Phase 2B.

Phase 2C requires a verified application manifest for full JSON export and
workspace erasure. Existing durable LOCAL data is preserved; run the explicit
backfill against the confirmed loopback table and configured local owner:

```bat
backend\.venv\Scripts\python.exe backend\scripts\backfill_local_manifest.py --confirm-table HireFluxLocal --owner 00000000-0000-4000-8000-000000000001
```

Use the actual configured owner/table if changed. The command is non-destructive,
idempotent, quota-verified, and refuses incomplete/temporary/incompatible evidence.
No table reset is needed. Erasure has no product button or recent-auth simulation;
validate it only on disposable data with the opt-in local smoke:

```bat
backend\.venv\Scripts\python.exe backend\scripts\smoke_workspace_safety_local.py --confirm-local-smoke
```

That script creates and deletes its own uniquely named local table, never the normal
table. See [ADR 0007](docs/adr/0007-durable-workspace-manifest-and-erasure.md).

</details>

## Documentation

- [Architecture](ARCHITECTURE.md) — how the frontend, API, auth, domain services, DynamoDB, and future AWS boundary fit together.
- [Dashboard and analytics](docs/dashboard-and-analytics.md) — product metrics, Action Center behavior, Search Health, stage aging, and filter contracts.
- [Domain model](docs/domain-model.md) — applications, milestones, notes, interviews, activities, and workspace rules.
- [Status transitions](docs/status-transitions.md) — the server-owned application workflow.
- [Data export](docs/data-export.md) — current CSV export and future portability boundaries.
- [Roadmap](docs/roadmap.md) — planned product and infrastructure work.
- [Development log](docs/devlog.md) — implementation history, decisions, and validation notes.
- [Production account readiness](docs/production-account-readiness.md) — Phase 1 audit and Phase 2/3A/3B/3C/3D/3E implementation handoffs.
- [Infrastructure foundation](infra/README.md) — environment contracts, local synth/testing, naming, and later resource insertion points.
- [CDK environment decision](docs/adr/0008-aws-cdk-environment-foundation.md) — accepted Phase 3A boundary.
- [Durable bootstrap decision](docs/adr/0005-durable-local-workspace-bootstrap.md) — accepted identity, readiness, recovery, and deferred safety boundaries.
- [Frontend workspace session decision](docs/adr/0006-frontend-workspace-session-boundary.md) — adapters, bootstrap, generations, isolation, and local-mode limits.
- [Durable workspace safety decision](docs/adr/0007-durable-workspace-manifest-and-erasure.md) — strong manifests, atomic freeze/write exclusion, erasure, and export limits.
- [Supply-chain guide](docs/supply-chain.md) — lockfiles, SBOMs, and dependency review.

## Current status

The local candidate demo is the active browser experience. The durable local
backend identity/bootstrap foundation and general frontend session boundary are
complete, including the Phase 2C local data-safety foundation. AWS staging, real Cognito accounts, private attachments,
reminders, email delivery, and large asynchronous exports remain future phases
rather than hidden dependencies of the current app.

## Phase 3E infrastructure status

The full browser-to-backend topology is defined locally: static Amplify WEB
hosting, branch-level public API configuration, exact App-domain-token CORS,
and the unchanged verified backend. Each environment synthesizes 13 resources.
Nothing is deployed and no frontend domain exists yet. Production auto-build
is disabled and authentication remains unavailable until Phase 5.
See [ADR 0012](docs/adr/0012-amplify-hosting-origin-wiring.md),
[frontend build guide](frontend/README.md),
[infra commands](infra/README.md) and [current handoff](docs/production-account-readiness.md#44-phase-3e-implementation-and-handoff).
