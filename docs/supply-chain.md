# Supply-chain and dependency inventory

HireFlux uses two lockfile-backed dependency workflows:

- Python uses `backend/uv.lock`, generated from `backend/pyproject.toml` for
  Python 3.13 and 3.14. It records the complete runtime and `dev` extra graph,
  registry sources, and SHA-256 hashes for available source and wheel artifacts.
- The frontend uses npm's committed `frontend/package-lock.json`. `npm ci`
  installs the lockfile graph and validates the package integrity metadata.

## Reproducible Python setup

Install or update the lock only when an intentional dependency change is being
reviewed:

```bat
uv lock --project backend --python 3.13
uv lock --check --project backend --python 3.13
```

The normal setup and validation path must use the committed graph:

```bat
uv sync --project backend --extra dev --locked
```

`--locked` fails if `pyproject.toml` and `backend/uv.lock` disagree, which makes
dependency drift visible before tests or packaging run. Do not hand-edit
`backend/uv.lock`; regenerate it with uv and review the complete dependency
diff, including transitive upgrades and changed artifact hashes.

## SBOM generation

The backend generator reads the lockfile directly and emits a CycloneDX 1.5
JSON inventory with package URLs, dependency edges, the lockfile digest, and
all locked artifact SHA-256 hashes:

```bat
if not exist sbom mkdir sbom
backend\.venv\Scripts\python.exe backend\scripts\generate_sbom.py --output sbom\hireflux-backend.cdx.json
npm --prefix frontend sbom --package-lock-only --sbom-format cyclonedx --sbom-type application > sbom\hireflux-frontend.cdx.json
```

The output files are ignored generated artifacts. CI or a release workflow
should upload them as build artifacts and attach the exact SBOMs to the build
that produced them. The source of truth remains the lockfile committed with
the source revision.

The backend CI job also generates `artifacts/hireflux-openapi.json` from the
FastAPI application contract. This preserves an inspectable API specification
without requiring public staging or production documentation routes.

## Release checks

Before a staging or production build:

1. Run `uv lock --check --project backend --python 3.13`.
2. Install with `uv sync --project backend --extra dev --locked`.
3. Export the locked runtime graph with
   `uv export --project backend --locked --no-dev --no-emit-project --format requirements.txt --output-file backend/.audit-requirements.txt`.
4. Audit that hash-pinned graph with
   `uvx --from pip-audit==2.10.1 pip-audit --require-hashes --disable-pip --requirement backend/.audit-requirements.txt`.
5. Run `npm --prefix frontend ci` and `npm --prefix frontend audit --audit-level=high`.
6. Generate both CycloneDX SBOM artifacts.

`.github/workflows/quality.yml` enforces these checks on Python 3.13 and Node 22,
including Ruff, formatting, Mypy, pytest, frontend checks, vulnerability audits,
and uploaded SBOM artifacts. It performs validation only; AWS deployment and the
separately tracked public-demo throttling, concurrency, and cost controls remain
outside this workflow.
