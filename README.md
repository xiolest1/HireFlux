# HireFlux

HireFlux is a portfolio-grade job application tracker built as a deliberately small serverless system. The current recruiter demo runs entirely on a development machine:

```text
React + TypeScript -> FastAPI -> DynamoDB Local
```

No AWS account, cloud resource, or real AWS credential is needed for the local slice.

## Current milestone

The public landing page launches a signed, 24-hour demo workspace with its own owner identity and five fictional applications. Each visitor can view, create, edit, transition, archive, restore, and reset data without seeing or changing another visitor's workspace. DynamoDB TTL marks temporary records for cleanup.

Deferred work is tracked in [docs/roadmap.md](docs/roadmap.md). Cognito is reserved for future persistent personal accounts; it is not required for the frictionless recruiter demo.

## Architecture at a glance

- `frontend/` - React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, Vitest, and Testing Library.
- `backend/` - FastAPI with route, application-service, repository-interface, and DynamoDB-adapter boundaries.
- `docs/` - architecture, data access patterns, status policy, roadmap, and decision records.
- `Diagrams/` - the original UML and data-flow design input. The current docs resolve differences between these diagrams and the implemented architecture.

The target recruiter-demo architecture is Amplify Hosting, API Gateway HTTP API, one Lambda running FastAPI through Mangum, DynamoDB on-demand, and CloudWatch. Cognito, private S3 attachments, EventBridge Scheduler, and SES remain optional later milestones. Nothing in AWS is provisioned by the current implementation.

## Prerequisites

- Node.js 22 LTS and npm 10 or newer.
- Python 3.13.
- Docker Desktop with Linux containers enabled.
- Git.

## First-time setup in Windows Command Prompt

Run these commands from the repository root:

```bat
copy .env.example .env

py -3.13 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"

npm --prefix frontend ci

docker compose up -d dynamodb-local
backend\.venv\Scripts\python.exe backend\scripts\init_local_table.py
```

The values in `.env.example` are fake credential-shaped strings required by the AWS SDK when talking to DynamoDB Local. Never replace them with real credentials for local development, and never commit `.env`.

## Run the app

Keep each long-running command in its own Command Prompt window, from the repository root.

Backend:

```bat
backend\.venv\Scripts\python.exe -m uvicorn hireflux_backend.main:app --app-dir backend\src --reload --port 8000
```

Frontend:

```bat
npm --prefix frontend run dev
```

Open `http://localhost:5173`. API documentation is at `http://localhost:8000/docs`, and health is at `http://localhost:8000/health`.

Stop the local database without deleting its named volume:

```bat
docker compose stop dynamodb-local
```

## Validation commands

Backend:

```bat
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m ruff format --check backend
backend\.venv\Scripts\python.exe -m mypy backend\src
backend\.venv\Scripts\python.exe -m pytest backend
```

Frontend:

```bat
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run build
```

Backend tests use an isolated Moto table and do not need Docker. Frontend tests use a mocked HTTP boundary and do not need the backend.

## Configuration

The root `.env.example` documents every local setting. Important invariants:

- `AUTH_MODE=demo` issues HMAC-signed temporary identities; its signing key must be replaced in staging and production.
- `AUTH_MODE=local` remains available for deterministic backend development only, is accepted only for local/test, and is rejected when Lambda runtime markers exist.
- `DYNAMODB_ENDPOINT_URL` is explicit locally and omitted in AWS.
- Local SDK credentials are visibly fake. Deployed code will use its Lambda execution role.
- CORS uses an explicit origin allowlist; wildcard origins are rejected.
- Normal application startup never creates a DynamoDB table. Run the initializer explicitly.
- `VITE_PUBLIC_SITE_URL` is public metadata and must match each deployed frontend origin.

## Further reading

- [Architecture](docs/architecture.md)
- [Environment and deployment plan](docs/deployment-environments.md)
- [Development log](docs/devlog.md)
- [Domain model](docs/domain-model.md)
- [DynamoDB access patterns](docs/dynamodb-access-patterns.md)
- [Status transitions](docs/status-transitions.md)
- [Roadmap](docs/roadmap.md)
- [Architecture decision records](docs/adr/)
