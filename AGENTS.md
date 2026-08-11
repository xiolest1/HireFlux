# HireFlux repository guidance

## Layout

- `frontend/`: React/Vite web client.
- `backend/src/hireflux_backend/`: FastAPI application.
- `backend/tests/`: isolated unit and API integration tests.
- `backend/scripts/`: explicit operator commands, including local table initialization.
- `docs/`: living architecture and product decisions.
- `Diagrams/`: source design artifacts; preserve them.

## Boundaries and conventions

- Backend dependency direction is `routes -> application services -> repository protocols -> adapters`.
- Domain rules live in services/domain modules, never in React or raw DynamoDB calls.
- JSON, query parameters, and Python names use `snake_case`.
- Use UUID strings, UTC timezone-aware timestamps, and ISO 8601 dates/times.
- Derive ownership from the authenticated identity. Never accept `owner_user_id` from a request body.
- Use DynamoDB `Query`/`GetItem`; do not add `Scan` to normal request paths.
- Keep status transitions in one policy module and expose allowed transitions from the API.
- Preserve the binding rules `REJECTED -> INTERVIEW` is forbidden and `INTERVIEW -> OFFER` is allowed.
- Archive applications rather than permanently deleting them.
- Treat activity items as append-only in ordinary application behavior.
- Keep frontend API calls centralized and validate untrusted responses with Zod.
- Use semantic HTML, visible focus, labeled inputs, and explicit loading/empty/error states.

## Security invariants

- Never store passwords or password hashes.
- Never commit tokens, real AWS credentials, `.env`, uploads, or private user data.
- Never accept client changes to ownership, roles, generated IDs/timestamps, or application status through the general edit route.
- Never log tokens, credentials, sensitive attachment contents, or raw internal exceptions.
- `AUTH_MODE=local` must fail configuration validation outside local/test environments.
- A deployed DynamoDB client must omit local endpoint and explicit credentials and use its IAM role.
- CORS must be an explicit allowlist, never `*`.
- Do not expose DynamoDB keys, AWS errors, stack traces, or internal exceptions to clients.
- Do not weaken tests, types, lint rules, authorization, or business rules to make validation pass.

## Commands

From the repository root on Windows PowerShell:

```powershell
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m ruff format --check backend
backend\.venv\Scripts\python.exe -m mypy backend\src
backend\.venv\Scripts\python.exe -m pytest backend

npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run test
npm.cmd --prefix frontend run build
```

Run DynamoDB Local and its explicit initializer:

```powershell
docker compose up -d dynamodb-local
backend\.venv\Scripts\python.exe backend\scripts\init_local_table.py
```

Run the development services in separate PowerShell windows:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn hireflux_backend.main:app --app-dir backend\src --reload --port 8000
npm.cmd --prefix frontend run dev
```

## Definition of done

A change is done when ownership and validation remain server-enforced, targeted tests cover changed behavior, lint/type checks/tests/build pass, docs and `.env.example` match configuration, no generated artifacts or secrets are added, and the diff contains no unrelated changes.
