# Phase 5B — Backend Cognito authentication and durable accounts

**October 20, 2026 — PASS WITH EXPLICIT QUALIFICATIONS, locally implemented.**
The backend foundation in the accepted [5A contract](phase5a-cognito-implementation-contract.md)
is implemented and tested. All **603 backend tests pass**. Real Cognito behavior
has not been exercised. The production dependency audit is clean; an existing
dev-only Werkzeug advisory remains. The isolated candidate ZIP passes native
Python 3.14 tests but exceeds the project's soft compressed-size warning by
about 0.2 MiB. These qualifications are detailed below.

This completes **5B only**. Frontend OAuth (5C), account safety/CDK/offline release
qualification (5D), and controlled AWS release/live verification (5E) remain
separately authorized phases. The original 5A–5E and Phase 6–7 sequence is preserved.

## Authorization, baseline and preserved evidence

Implementation, dependency installation, test traffic and candidate packaging were
local. Public official documentation/package vulnerability databases were consulted;
there were **no AWS or GitHub account API calls, real provider sign-ins, hosted
requests, cloud changes, pushes, remote CI or Amplify builds**. No commit was made.

HEAD remains `2146fc3870f027c3d6d8f06720c46bb0b29b51a2`. All changes are uncommitted.
The pre-existing documentation/guidance work and untracked Phase 4/5A handoffs
remain. This phase adds backend code/tests, configuration examples and current
documentation. Frontend, infra, workflows and hosting-header files are unchanged.

Offline preservation checks verified all **88 indexed 4H evidence entries**, all
**10 consumed ledgers**, and **59 prior evidence entries**, including earlier
financial/recovery receipts. The 4H handoff/index, original 5A contract, AGENTS,
provider-recovery outcome, historical bound template and deployed Lambda assets
are unchanged. The readiness audit is itself indexed evidence and remains frozen;
current implementation status belongs here and in the current architecture/devlog.

The historical canonical Lambda ZIP remains SHA-256
`4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`.
The accepted demo deployment, testing pause, owner-approved cash-funded baseline
and USD 0 assumed usable promotional credit remain in force. These are preserved
dated observations, not fresh cloud availability or Billing verification.

## Actual implementation and files

Paths below are repository-relative and include new and modified files.

- **Authentication:** new `backend/src/hireflux_backend/auth/cognito.py`,
  `jwks.py`, `provider.py`, `principal.py`; updated `auth/local.py`.
  Small typed provider/authentication ports support injected clocks/transports.
- **Configuration/composition:** `backend/src/hireflux_backend/config.py`,
  `lambda_settings.py`, `app_factory.py`, root `.env.example`.
- **API/errors:** `backend/src/hireflux_backend/api/dependencies.py`,
  `api/error_handlers.py`, new `api/routes/auth.py`, updated `api/routes/me.py`,
  `api/routes/demo_sessions.py`, and `application/errors.py`.
- **Persistence:** `backend/src/hireflux_backend/application/workspace_bootstrap.py`
  and `infrastructure/dynamodb/workspace_bootstrap_repository.py`. Reused existing
  bootstrap, product services, protocols, lifecycle/manifest and transaction guards.
  No new table, index, mapping database or erasure engine.
- **Dependencies/runtime:** `backend/pyproject.toml`, `backend/uv.lock`,
  `backend/scripts/lambda_artifact_probe.py`, `backend/README.md`.
- **New tests:** `backend/tests/cognito_fixtures.py`,
  `unit/test_auth_capabilities.py`, `unit/test_cognito.py`,
  `unit/test_provider_transport.py`, `integration/test_cognito_accounts.py`.
  Updated `conftest.py`, `unit/test_config.py`, `unit/test_lambda_runtime.py`,
  `integration/test_api_flow.py`, `integration/test_workspace_bootstrap.py` for
  the new valid configuration/public endpoint contracts.
- **Documentation:** this handoff, `docs/devlog.md`, `docs/domain-model.md`,
  `docs/roadmap.md`, `docs/architecture.md`, root `ARCHITECTURE.md`/`README.md`.
  Earlier dirty content in shared documents was preserved.

## Configuration contract

`AUTH_MODE` remains required and accepts `local`, `demo`, `cognito`.
Absent `AUTH_CAPABILITIES` preserves the legacy singleton. Explicit CSV accepts
exactly `local`, `demo`, `cognito`, or the set `demo,cognito`; input order is
irrelevant, surrounding entry spaces are trimmed, and public output is canonical
demo-before-Cognito. Empty entries/sets, duplicates, unknown/case-mismatched names,
LOCAL mixtures and an anchor outside the enabled set fail validation.

- LOCAL only: local/test, existing loopback/fake-credential requirements intact,
  rejected under Lambda runtime markers. No provider fallback.
- Local/test: demo, Cognito or both, using synthetic providers for qualification.
- Staging: demo, Cognito or both. A later hybrid release retains `AUTH_MODE=demo`
  plus `AUTH_CAPABILITIES=demo,cognito` for the accepted update ordering.
- Production: Cognito only. The old unimplemented Cognito placeholder is now a
  real fail-closed configuration boundary: missing provider settings fail startup,
  rather than initializing a production app with a 503 placeholder. This does
  not modify deployed code or CDK. 5D must provide production trust configuration
  before any future production release.

When Cognito is enabled, require:

```dotenv
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_FAKEEXAMPLE
COGNITO_APP_CLIENT_ID=FAKEPUBLICCLIENTID
COGNITO_DOMAIN=https://hireflux-fake-example.auth.us-east-1.amazoncognito.com
PERSISTENT_ACCOUNT_MANAGEMENT_ENABLED=false
```

These are fake public identifiers, not live resources. The pool region must match;
client IDs are bounded alphanumeric; domain is an exact HTTPS regional Cognito
prefix origin, with no userinfo, port, path, query, fragment or alternate host.
Issuer/JWKS derive from the configured pool/region. No arbitrary issuer input.
In 5B, setting account management true fails startup; its orchestration cannot be
advertised before 5D. Signing-secret references, role-based DynamoDB access,
CORS, quotas, secret resolution and existing Lambda guards remain intact.

## Authentication, JWT and provider security

One FastAPI dependency selects exactly one enabled verifier. Non-LOCAL requests
require exactly one Authorization header and one case-insensitive Bearer scheme
with exactly one ASCII space; duplicate headers, extra whitespace, controls,
multiple credentials and other formats fail. Total header is bounded to 8 KiB;
demo tokens retain their 2,048-character bound, and JWT credentials have a separate
8,192-byte verifier bound. Two segments route only to demo HMAC; three only to
Cognito. Shape never proves authenticity. No failure falls back to another path.

Cognito enforces RS256 with trusted RSA keys of 2,048–8,192 bits, exact issuer and
`client_id`, `token_use=access`, required `openid email profile` scopes, and no
unexpected `aud` pending a separately defined resource-audience policy. ID tokens,
untrusted key-URL/header metadata, unsupported algorithms, invalid signatures,
duplicate JSON members, JSON deeper than 16 levels and malformed claims fail.
Required positive integer `exp`, `iat`, `auth_time` exclude booleans/floats/strings;
optional `nbf` is checked. Chronology enforces auth_time <= iat < exp, maximum
3,600-second lifetime, 60-second clock skew, future/not-before limits and expiry.
Only STANDARD_USER is assigned; groups/custom claims never grant authority.

The exact verified `sub` becomes the owner: nonempty, <=128 characters, no Unicode
controls/whitespace/`#`; no UUID normalization, lowercasing, email linking or new
owner mapping. Signed provider username and credential times stay in
`VerifiedPrincipal`, outside `CurrentIdentity` and durable data lifetime.

JWKS cache: **300 seconds, 16 keys, 64 KiB**, single-flight retrieval, no separate
indefinite signing-key LRU. Unknown-key refresh is globally limited per process
to once per 30 seconds, with 128-entry/30-second negative caching. Failed key
retrieval is also cooled down; required expired keys are never served stale.
Successful trusted retrieval without the key produces 401; unavailable/malformed
trusted key material produces 503. Rotation inside cooldown can temporarily deny
a new key; retries remain explicit and bounded.

After signature/claim verification, pinned server-side `/oauth2/userInfo` must
match subject and supply a valid email with **JSON true or exact string `"true"`**.
Optional missing name becomes `HireFlux user`; invalid attribute types/response
shape fail. Subject mismatch or provider 401 yields 401; unverified email yields
403; timeout/redirect/429/5xx/malformed provider response yields safe 503.

Successful admission is cached by issuer/client/SHA-256 of the complete token:
**60 seconds, 128-entry LRU, never beyond token expiry**, with monotonic freshness.
Raw tokens are not cache keys or retained in principals. Fresh admission bypass
is available through the typed port for 5D. Ordinary revocation/disablement can
take up to 60 seconds to become visible; local JWT validation alone does not prove
revocation. Failed refresh of required admission never reuses stale attributes.

HTTPS uses normal certificate/hostname verification, fixed URLs, no redirects,
proxies/discovery/retries or custom TLS bypass. Each call has a two-second work
budget, connect/read timeouts capped at one second, bounded streamed reads and
one attempt. Combined auth work is bounded to four seconds, reduced to leave one
second of remaining Lambda time. These are cooperative bounds, not OS/DNS
preemption guarantees; final timing remains a 5D/5E qualification.

Provider construction is network-free. Demos never contact Cognito. Error envelopes
retain request IDs and safe messages; account 401 responses use `WWW-Authenticate:
Bearer`. Existing selected-demo `DEMO_SESSION_REQUIRED`/`DEMO_SESSION_EXPIRED`
remain, with hybrid/account `AUTHENTICATION_REQUIRED`, `SESSION_EXPIRED`,
`ACCOUNT_NOT_VERIFIED` and `AUTHENTICATION_UNAVAILABLE` categories.

## Persistent bootstrap and preserved product behavior

The empty `/me/bootstrap` request remains absent or `{}`; browser owner/profile/
role fields are rejected. LOCAL takes its guarded settings attributes; PERSISTENT
takes admitted provider attributes; DEMO is forbidden. First persistent bootstrap
atomically creates only PROFILE, SETTINGS and ACTIVE WORKSPACE with complete
manifest version. Concurrent/repeated initialization converges; no demo seed.

Only LOCAL adopts unmarked legacy owner data. Identity kind, TTL or provenance
conflicts fail closed. DELETING/DELETED cannot resurrect. Missing ACTIVE profile
can recover from trusted attributes; missing customized settings conflicts.
Changed trusted name/email synchronize only on explicit bootstrap, conditionally
against the prior profile and ACTIVE/no-TTL workspace in one transaction. Existing
creation times, deprecated login field and preferences survive; ordinary `/me`
overlays fresh admitted attributes without a write. Unchanged bootstrap avoids
the transaction entirely.

Moto tests inspect serialized profile, settings, workspace, application, note,
interview, resource/workspace quotas, status/funnel counters, activity and manifest
records: persistent items have no `expires_at`. Token expiry denies access without
deleting data; a fresh token for the same subject restores access. Equal or changed
emails do not change owners. Independent persistent/demo owners remain isolated;
foreign/missing resources both return 404. Existing versions, transitions,
transactions, cursor scope, limits, exports and ACTIVE guards remain in force.

Persistent `DELETE /api/v1/me` and `POST /api/v1/me/deletion/retry` always return
**403 ACCOUNT_MANAGEMENT_UNAVAILABLE** in 5B. No Cognito deletion, revocation/admin
API, IAM permission, finalization field or worker was added. LOCAL development
erasure/export and all prior demo lifecycle/domain regressions still pass.

## Public auth configuration and Phase 5C contract

`GET /api/v1/auth/config` requires no credential and returns `Cache-Control: no-store`.
It performs no provider/database request or workspace creation. Example for a
future configured staging backend (all provider values below are fake):

```json
{
  "version": 1,
  "environment": "staging",
  "capabilities": ["demo", "cognito"],
  "account_data_policy": "disposable_staging",
  "account_management_enabled": false,
  "cognito": {
    "issuer": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_FAKEEXAMPLE",
    "client_id": "FAKEPUBLICCLIENTID",
    "domain": "https://hireflux-fake-example.auth.us-east-1.amazoncognito.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

Omit `cognito` entirely when disabled. Public capabilities exclude LOCAL; guarded
DEV local mode remains explicit frontend configuration, without publishing local
user metadata. Data policy is `local_development` in local/test,
`disposable_staging` in staging and `production` in production. The latter is an
environment label, not a production-safety certification. Account management is
always false in 5B. No tokens, secrets, profiles or IAM/account details are returned.

5C must use its single existing session controller, validate this versioned response,
provide actual access tokens, and bootstrap before private queries. PERSISTENT
bootstrap subjects are safe opaque strings, while LOCAL/resource/demo UUID checks
remain. Required scopes, error codes and lifecycle conflicts above are binding.
Fence credentials/caches/late callbacks across identity changes, implement the
accepted PKCE/refresh/logout protocol and Settings changed-field fix, and preserve
the explicit disposable-staging warning. Missing endpoint on the old deployed
backend permits only the accepted legacy demo behavior. No frontend work occurred.

## Dependencies, local validation and qualifications

Added exactly **PyJWT[crypto] 2.15.1**. Updated existing dev-transitive cryptography
50.0.0 to **50.0.2**, now a production transitive dependency, for current bundled
OpenSSL fixes. cffi 2.1.1 and pycparser 3.0 retain their locked versions and join
the production graph. No unrelated package upgrade. `uv.lock` is deterministic;
uv 0.12.5 sync/lock checks pass on local Python **3.13.15**.

Executed from repository root:

```text
backend/.venv/Scripts/python.exe -m ruff check backend
backend/.venv/Scripts/python.exe -m ruff format --check backend
backend/.venv/Scripts/python.exe -m mypy backend/src
backend/.venv/Scripts/python.exe -m pytest backend -q
.tools/phase3b-tooling/bin/uv.exe lock --project backend --check
git diff --check
```

Final results: lint/format PASS (**121 Python files**), mypy PASS (**76 source
files**), **603 tests PASS in 118.60 seconds**, lock PASS. The existing Starlette
TestClient/httpx deprecation warning remains; no warning suppression or unrelated
dependency change. Tests generate RSA fixtures, inject provider/time, block
external DNS/connections and use Moto. Windows loopback socket pairs are allowed
only for the in-process test runner.

Initial failures resolved without loosening policy: new config fixtures now supply
valid public trust settings or assert startup failure; public auth-config is exempt
from readiness; the new test initially tried to schedule an interview on a DRAFT
and was corrected to APPLIED; JSON depth is explicitly bounded independently of
runner recursion limits; runtime probe's historical 31-package assertion now
verifies the new 35-package graph. Persistent atomic failure and freeze-race tests
pass. Existing owner, transition, optimistic conflict, rollback, cursor, demo,
export and erasure tests are retained.

pip-audit ran on pinned exported runtime and dev graphs, without dependency
resolution upgrades: **production 35 packages, zero known vulnerabilities**.
The broader backend/dev export reports one existing finding:
**Werkzeug 3.1.8, PYSEC-2026-4312 / CVE-2026-102598 / GHSA-g6x2-hccm-hh4m**, fixed
in 3.1.9. It concerns Windows NTFS device paths in `send_from_directory`.
Werkzeug is Moto/Flask dev tooling, absent from the ZIP; HireFlux is FastAPI and
these tests run Moto in-process, without that file-serving path. It is recorded
as an unremediated dev-only qualification, not called a clean all-dependency audit.

Candidate build command used the bundled standard CPython 3.14 interpreter:

```text
.tools/phase3b-python/cpython-3.14-windows-x86_64-none/python.exe backend/scripts/build_lambda_artifact.py --uv .tools/phase3b-tooling/bin/uv.exe --output .tools/phase5b/hireflux-backend-candidate.zip --verify-reproducible
.tools/phase3b-python/cpython-3.14-windows-x86_64-none/python.exe backend/scripts/validate_lambda_artifact.py --artifact .tools/phase5b/hireflux-backend-candidate.zip
```

Both clean Linux-target wheel-only installs/builds matched: **35 distributions,
3,952 files, 31,670,754 compressed / 73,630,398 expanded bytes**, candidate SHA-256
`d762631e67ece97815c17bb6ff50ec81acceee84a32946d018eed1e90dc33400`.
Compressed size is about **30.20 MiB**, above the 30-MiB warning, below the 40-MiB
hard limit; expanded size is below the 150-MiB warning/200-MiB hard limit. No source
wheel compilation, Windows native binary or runtime dependency fallback.

The pinned official AL2023 Lambda image, **Python 3.14.8 / x86_64 / glibc 2.34**,
loaded eight native modules from the extracted read-only ZIP with `--network none`,
`-I -S -B`, no checkout/runtime site-packages fallback. Real RSA signing/verifying
plus synthetic Cognito admission passed, along with cold/warm HTTP API, CORS,
safe errors/logging, invalid config, secret reuse and large proxy response checks.
**Zero network attempts**. This is stronger than ordinary unit tests but remains
a 5B candidate, not the final 5D source/release artifact or a live Cognito test.

Local logs/receipts are ignored under `.tools/phase5b*`: full/focused test logs,
package/runtime logs, dev/runtime audits, candidate ZIP/manifest and
`phase5b/preservation.json`. They do not automatically travel to another checkout.
All current runtime source bytes and lock/project hashes match the candidate.

Official references consulted: [AWS JWT verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html),
[userInfo](https://docs.aws.amazon.com/cognito/latest/developerguide/userinfo-endpoint.html),
[PyJWT changelog/advisory fix](https://pyjwt.readthedocs.io/en/stable/changelog.html),
[PyJWT recursion advisory](https://github.com/jpadilla/pyjwt/security/advisories/GHSA-42vr-xj54-vc7v),
[cryptography changelog](https://cryptography.io/en/stable/changelog/), and
[Werkzeug advisory](https://github.com/pallets/werkzeug/security/advisories/GHSA-g6x2-hccm-hh4m).
Local behavior claims above come from executed tests, not solely those documents.

## Deferred work and exact stop boundary

5D still owns recent authentication, fresh uncached admission for destructive
operations, explicit confirmation, erase-then-provider finalization, retry/recovery
and scoped AdminDeleteUser IAM. The typed fresh-auth interface exists; none of that
orchestration is exposed now. It also owns Cognito CDK, final Linux ZIP/release
qualification, safe UPDATE preparation and unchanged Amplify previous-parameter
handling. No old ledger, PAT or CREATE executor is reused here.

5E must separately verify real token/claim/userInfo shapes, actual key rotation,
revocation/disablement and email behavior, hosted browser OAuth, runtime latency,
real configured pool/client/domain, scoped permissions, costs and final source/
artifact consistency under explicit release/test authorization. Mock-provider
success does not close those gates. Persistent data lacks demo TTL but the accepted
staging table remains disposable, with no new backup/recovery guarantee.

**Stop at completed local 5B. Wait for owner review and separate 5C authorization.**
