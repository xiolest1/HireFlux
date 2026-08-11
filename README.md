# HireFlux

HireFlux is a portfolio-grade job application tracker built as a deliberately small serverless system. Milestone 1 runs entirely on a development machine:

```text
React + TypeScript -> FastAPI -> DynamoDB Local
```

No AWS account, cloud resource, or real AWS credential is needed for the local slice.

## Current milestone

Milestone 1 implements the authenticated-user application workflow: initialize/read the local user profile, create and page through applications, view and edit details, apply server-owned status transitions, archive instead of permanently deleting, and record creation/status activity.

Deferred work is tracked in [docs/roadmap.md](docs/roadmap.md). Notes, interviews, dashboard projections, Cognito, attachments, AWS infrastructure, reminders, and CI/CD are intentionally not part of this milestone.

## Architecture at a glance

- `frontend/` - React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, Vitest, and Testing Library.
- `backend/` - FastAPI with route, application-service, repository-interface, and DynamoDB-adapter boundaries.
- `docs/` - architecture, data access patterns, status policy, roadmap, and decision records.
- `Diagrams/` - the original UML and data-flow design input. The current docs resolve differences between these diagrams and the implemented architecture.

The target AWS architecture is Amplify Hosting, Cognito, API Gateway HTTP API, one Lambda running FastAPI through Mangum, DynamoDB on-demand, private S3, EventBridge Scheduler, SES, and CloudWatch. Nothing under that target is provisioned in Milestone 1.

## Prerequisites

- Node.js 22 LTS and npm 10 or newer.
- Python 3.13.
- Docker Desktop with Linux containers enabled.
- Git.

On Windows PowerShell, use `npm.cmd` in case local execution policy blocks the `npm.ps1` shim.

## First-time setup on Windows PowerShell

Run these commands from the repository root:

```powershell
Copy-Item .env.example .env

py -3.13 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"

npm.cmd --prefix frontend ci

docker compose up -d dynamodb-local
backend\.venv\Scripts\python.exe backend\scripts\init_local_table.py
```

The values in `.env.example` are fake credential-shaped strings required by the AWS SDK when talking to DynamoDB Local. Never replace them with real credentials for local development, and never commit `.env`.

## Run the app

Keep each long-running command in its own PowerShell window, from the repository root.

Backend:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn hireflux_backend.main:app --app-dir backend\src --reload --port 8000
```

Frontend:

```powershell
npm.cmd --prefix frontend run dev
```

Open `http://localhost:5173`. API documentation is at `http://localhost:8000/docs`, and health is at `http://localhost:8000/health`.

Stop the local database without deleting its named volume:

```powershell
docker compose stop dynamodb-local
```

## Validation commands

Backend:

```powershell
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m ruff format --check backend
backend\.venv\Scripts\python.exe -m mypy backend\src
backend\.venv\Scripts\python.exe -m pytest backend
```

Frontend:

```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run test
npm.cmd --prefix frontend run build
```

Backend tests use an isolated Moto table and do not need Docker. Frontend tests use a mocked HTTP boundary and do not need the backend.

## Configuration

The root `.env.example` documents every local setting. Important invariants:

- `AUTH_MODE=local` is accepted only for local/test, requires an explicit loopback database in local mode, and is rejected when Lambda runtime markers exist.
- `DYNAMODB_ENDPOINT_URL` is explicit locally and omitted in AWS.
- Local SDK credentials are visibly fake. Deployed code will use its Lambda execution role.
- CORS uses an explicit origin allowlist; wildcard origins are rejected.
- Normal application startup never creates a DynamoDB table. Run the initializer explicitly.

## Further reading

- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [DynamoDB access patterns](docs/dynamodb-access-patterns.md)
- [Status transitions](docs/status-transitions.md)
- [Roadmap](docs/roadmap.md)
- [Architecture decision records](docs/adr/)
