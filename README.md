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

The canonical architecture and current-versus-target boundary are documented in [ARCHITECTURE.md](ARCHITECTURE.md).

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

</details>

## Documentation

- [Architecture](ARCHITECTURE.md) — how the frontend, API, auth, domain services, DynamoDB, and future AWS boundary fit together.
- [Dashboard and analytics](docs/dashboard-and-analytics.md) — product metrics, Action Center behavior, Search Health, stage aging, and filter contracts.
- [Domain model](docs/domain-model.md) — applications, milestones, notes, interviews, activities, and workspace rules.
- [Status transitions](docs/status-transitions.md) — the server-owned application workflow.
- [Data export](docs/data-export.md) — current CSV export and future portability boundaries.
- [Roadmap](docs/roadmap.md) — planned product and infrastructure work.
- [Development log](docs/devlog.md) — implementation history, decisions, and validation notes.
- [Supply-chain guide](docs/supply-chain.md) — lockfiles, SBOMs, and dependency review.

## Current status

The local candidate demo is the active product slice. AWS staging, persistent accounts, external identity, private attachments, reminders, email delivery, and large asynchronous exports remain future milestones rather than hidden dependencies of the current app.
