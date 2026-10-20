# Phase 5A — Cognito architecture and implementation contract

**October 20, 2026 — PASS: implementation-ready planning contract, pending owner
review and separate authorization for 5B.** Everything described as proposed below
is future work. This review changed no authentication, application, infrastructure,
dependency, AWS or GitHub configuration. It created this one uncommitted document.
The existing testing pause and cash-funded staging boundary remain in force.

Exactly five subphases: **5A design → 5B backend → 5C frontend → 5D account safety,
infra and offline qualification → 5E separately authorized staging release/live
verification**. Phases 6–7 still own production hardening/deployment. A planning
PASS establishes neither Cognito implementation nor live account readiness.

## 1. Baseline and source reconciliation

### Accepted deployment and current checkout

Use the [4H acceptance](phase4h-staging-acceptance.md) and
[frozen evidence index](phase4h-evidence-index.json), not earlier undeployed/HTTPS
STOP summaries. Account ending **9465**, **us-east-1**, `hireflux-staging`:
22 expected resources previously CREATE_COMPLETE; 40 configuration checks and
bounded HTTPS/backend/browser/operations checks passed with explicit qualifications.

- Qualified backend revision: `6396f89e8a5eccc7f21b5f699833dd85a1e48409`.
- Lambda ZIP SHA-256:
  `4fb0923cd4fb0e817c0a6b9ceb724218c6cbb4cfab0462fd6ccceec1ce8b75d3`.
- Corrected bound template SHA-256:
  `106222638171615bfdedaa1e99f612381c6dfcc4c105ac22aec05a1f359aa21d`.
- Last verified hosting: Amplify `d31vp0nq9fzl6q`, `main`, job 2 SUCCEED,
  revision `d3a8fb1a9b959d4dddbc6d1c32e3eac459b0f945`; archive SHA-256
  `4867b5bf5fab0badc3c61730a0b3d6675ff02a1922fc6b1bda3ef5c4d43c0e71`.
- Local HEAD remains `2146fc3870f027c3d6d8f06720c46bb0b29b51a2`. Backend,
  frontend and infra trees still match all three revisions; `.github` has no
  working changes. October 20 offline checks reconfirmed unchanged 4H handoff/index
  hashes. No fresh cloud inventory or availability claim is made.
- Accepted origins: `https://main.d31vp0nq9fzl6q.amplifyapp.com` and
  `https://0z0fpmukik.execute-api.us-east-1.amazonaws.com`.

Pre-existing uncommitted work is documentation/guidance: AGENTS, ARCHITECTURE,
README, docs/architecture, devlog, provider-recovery outcome and roadmap changes;
4E/4F/4G/4H handoffs and the 4H index are untracked. Preserve these changes.
The canonical ZIP is a baseline, not the artifact for a future changed backend.

The October 20 credential review under
`.tools/credential-lifecycle-20261020/` verified **TOKEN**, HireFlux-only regional
GitHub App installation, no deploy keys and one Amplify push webhook. Its receipt
predates retirement. **The owner now reports both provisioning PATs deleted**;
this supersedes their former presence/expiry metadata, without claiming a new
GitHub check. No replacement PAT or connection migration is planned. Local ignored
receipts are not automatically available in another checkout.

### Authority and corrections to older descriptions

Reuse [ADR 0005](adr/0005-durable-local-workspace-bootstrap.md),
[0006](adr/0006-frontend-workspace-session-boundary.md),
[0007](adr/0007-durable-workspace-manifest-and-erasure.md),
[domain model](domain-model.md), [readiness record](production-account-readiness.md)
and [roadmap](roadmap.md). Their earlier phase descriptions are dated checkpoints.
The owner has now authorized 5A, superseding the roadmap's still-deferred Phase 5
status for **planning only**. The domain model's future group/custom-role sentence
does not apply to Phase 5: admit only `STANDARD_USER`; ignore groups/custom roles.
Update that sentence during authorized 5B documentation work, not during this audit.

The historical HTTPS STOP was a verifier path assumption; the ordinary-edit
activity STOP was a test assertion defect. Neither is an unresolved application
bug. The Settings time-zone marker defect is real and remains in 5C's change set.
4H's unverified expiry/TTL/fault/delivery/scaling paths and production findings
F03/F04/F07/F08/F10/F11 remain limitations; they are not reopened or silently closed.

## 2. Existing-versus-missing matrix

| Boundary | Implemented evidence / exact reuse | Phase 5 gap and owner |
| --- | --- | --- |
| Principal/data lifetime | `domain/models.py: CurrentIdentity`, `IdentityKind`, `TrustedProfileAttributes`; durable kind forbids data expiry | Cognito verifier/admission context, 5B; keep principal separate from token lifetime/profile |
| Auth selection | `config.py: Settings.validate_security_boundaries`; `api/dependencies.py: get_current_identity`; local guards and signed two-segment demo codec | Exclusive LOCAL/DEMO/COGNITO switch; COGNITO currently returns 503; additive capabilities, 5B |
| Runtime composition | `lambda_settings.py: get_lambda_settings`, `app_factory.py: create_app`; scoped IAM/two cold-start signing secrets | Exact staging/demo versus production/cognito pairing, no Cognito provider; extend 5B, inject cloud IDs in 5D |
| Empty durable bootstrap | `application/workspace_bootstrap.py: bootstrap`, `_validate`, `require_ready`; `infrastructure/dynamodb/workspace_bootstrap_repository.py: commit` | `api/routes/me.py: bootstrap_workspace` still calls local-only profile helper; replace trusted-source selection in 5B |
| Durable product data | `workspace_guard.py: guarded_transact`, manifest refs, existing shared application/resource services | Reuse owner isolation, limits, optimistic writes, transitions and activity semantics; no new table/index |
| Export/erasure | `workspace_export.py`, `workspace_safety.py`, `workspace_safety_repository.py`; strong inventory, bounded export, one-way deletion | Existing routes have no provider-backed recent-auth/finalization; gate PERSISTENT destruction in 5B, complete 5D |
| Browser session boundary | `WorkspaceSessionProvider`, `workspaceSessionController.ts: next/ready/initialize`, generation-scoped query clients and async fences | One fixed adapter per controller, immutable bearer string; extend registry/credential lease and add OAuth adapter, 5C |
| Durable UI | `workspaceCapabilities.ts`, `api/workspaceBootstrap.ts`, Settings; local durable bootstrap/preferences/export | Real sign-in/out, provider errors, persistent identity presentation, UUID restriction and Settings patch, 5C |
| Browser security | `securityHeaders.ts`, Vite headers, root customHttp files, hosting renderer/tests, safe router return paths | One exact Cognito connect origin, callback/sign-out routes and strict callback privacy, 5C; qualify 5D |
| Cloud topology | `environment.ts`, `hireflux-stack.ts`, `backend-api.ts`, `frontend-hosting.ts`; existing 22 resources | No pool/client/domain/branding; define four additive resources offline in 5D, create only in 5E |
| Operations/storage | Finite logs, reserved concurrency five, native metrics, manual costs; staging Delete/PITR-off data | Persistent semantics do not create recoverability; fictional records only in initial 5E |

Paths above are under `backend/src/hireflux_backend/`, `frontend/src/` or
`infra/lib/` as appropriate. Existing tests include backend `test_config`,
`test_identity_lifetime`, `test_demo_session_codec`, `test_workspace_bootstrap`,
`test_workspace_safety`, `test_workspace_export`, `test_lambda_runtime`, and frontend
`WorkspaceSession.test.tsx`, `api/client.test.ts`, `securityHeaders.test.ts`.

Direct source entry points:

- [Settings/security guards](../backend/src/hireflux_backend/config.py),
  [FastAPI identity dependencies](../backend/src/hireflux_backend/api/dependencies.py),
  [Lambda configuration](../backend/src/hireflux_backend/lambda_settings.py),
  [application composition](../backend/src/hireflux_backend/app_factory.py).
- [Principal/lifetime models](../backend/src/hireflux_backend/domain/models.py),
  [bootstrap service](../backend/src/hireflux_backend/application/workspace_bootstrap.py),
  [profile/bootstrap/erasure routes](../backend/src/hireflux_backend/api/routes/me.py),
  [transaction guards](../backend/src/hireflux_backend/infrastructure/dynamodb/workspace_guard.py),
  [erasure service](../backend/src/hireflux_backend/application/workspace_safety.py).
- [Session controller](../frontend/src/auth/workspaceSessionController.ts),
  [adapters](../frontend/src/auth/sessionAdapters.ts),
  [credential/generation scope](../frontend/src/auth/sessionGeneration.ts),
  [API client](../frontend/src/api/client.ts),
  [bootstrap response validation](../frontend/src/api/workspaceBootstrap.ts),
  [Settings](../frontend/src/pages/SettingsPage.tsx).
- [CSP source](../frontend/src/securityHeaders.ts),
  [hosted policy renderer](../frontend/scripts/render-hosting-headers.mjs),
  [environment definitions](../infra/lib/config/environment.ts),
  [stack/NoEcho parameter](../infra/lib/hireflux-stack.ts),
  [Lambda/API/IAM](../infra/lib/backend/backend-api.ts),
  [Amplify App/Branch](../infra/lib/hosting/frontend-hosting.ts).

## 3. Final authentication architecture

### Capabilities, compatibility and environment matrix

Add **`AUTH_CAPABILITIES`**, a validated comma-separated set from `local`, `demo`,
`cognito`; reject duplicates, unknown/empty entries and mixing `local` with anything.
No new overloaded `hybrid` auth mode. Effective capabilities are explicit when
present; otherwise translate legacy `AUTH_MODE` to its single capability.
If both exist, legacy mode must be a member of the effective set and satisfy all
local guards. Keep `AUTH_MODE` required during Phase 5 for compatibility; it selects
the sole path only when capabilities are absent. Keep **`AUTH_MODE=demo`** as a
compatibility anchor in staging Lambda
while enabling `AUTH_CAPABILITIES=demo,cognito`: the old bundle can still cold-start
during the ordered code/config update. It must not select a fallback identity.

| Environment/state | Effective capabilities | Behavior |
| --- | --- | --- |
| Current accepted staging | legacy `AUTH_MODE=demo`, no new keys | Exact existing demo behavior; unchanged during 5A–5D |
| Local durable development | `local` only | Fixed local identity; development frontend only; loopback DB/fake credentials; reject runtime markers |
| Local demo | `demo` | Existing issuance/expiry/seeding; no Cognito network requirement |
| Local integration / tests | `demo,cognito`, or either alone | Inject deterministic providers/keys/clocks; no real Cognito needed; fake trust is test injection, never a deployed environment override |
| Proposed 5E staging | `demo,cognito` | Both independently verified; user explicitly chooses demo or account |
| Other separately reviewed staging configuration | Either supported subset alone | Selected legacy anchor must belong to the set; disabled provider is denied, never used as fallback |
| Future production definition | `cognito` | Demo issuance/verification disabled; separate pool/client/trust; no production deployment in Phase 5 |

`local` remains forbidden outside LOCAL/TEST, with `AWS_LAMBDA_FUNCTION_NAME` or
`AWS_EXECUTION_ENV`, and without the current loopback/fake-credential prerequisites.
Never infer local auth from missing headers. Preserve signing-key, local-endpoint,
explicit-IAM-role and secret-reference protections. Existing cursor/demo secrets
and logical IDs remain unchanged; this is not a signing-key rotation project.

### Single verification boundary and no fallback

Keep FastAPI `get_current_identity`/`get_workspace_identity`. No new Gateway JWT
authorizer on shared routes: it would reject the existing non-JWT demo token.
Parse exactly one Authorization header; reject duplicates, CR/LF, embedded
whitespace, multiple credentials and non-Bearer schemes. Bound header/token bytes:
8 KiB total credential limit, retaining demo's 2,048-character limit.

For non-local requests, segment count is only a **routing hint**: two segments
select the enabled demo HMAC verifier; three select the enabled Cognito verifier;
all other shapes fail. Never authorize from the hint or unverified `iss`/`sub`.
Perform exactly one selected verification path. Signature, key, issuer, expiry,
provider or parsing failure is terminal; never try demo/local afterward. A truncated
JWT cannot authenticate as a demo without a valid demo MAC and claims. Disabled
paths return a safe 401, not another identity.

Demo missing/invalid/expired behavior remains `DEMO_SESSION_REQUIRED` /
`DEMO_SESSION_EXPIRED` for legacy demo-only configuration and the selected demo
verifier. Hybrid missing credentials use `AUTHENTICATION_REQUIRED`. The existing
issuance route checks the **demo capability**, retains its idempotency/state/seed
and failure cleanup behavior, and returns 503 when disabled. Public health/auth
configuration never initiates a workspace or contacts Cognito.

### Cognito JWT verifier contract — 5B

Propose `auth/cognito.py`, `auth/principal.py` and small provider/cache adapters
behind typed protocols. `VerifiedPrincipal` carries `CurrentIdentity` plus verified
credential metadata (`issuer`, `client_id`, `auth_time`, expiry and trusted provider
username) and trusted profile attributes. Do not add credential expiry, email or
tokens to `CurrentIdentity`, repository keys or domain mutation commands.

Use **PyJWT[crypto]**, reviewed current candidate **2.15.1**, rather than custom RSA
or an application authorization framework. Pin its exact version and compatible
`cryptography`/native wheels in 5B locks; include Python 3.13/3.14 and Linux artifact
qualification. Nothing is installed in 5A. The project's
[changelog](https://pyjwt.readthedocs.io/en/stable/changelog.html) and
[API reference](https://pyjwt.readthedocs.io/en/stable/api.html) support explicit
algorithm/key/claim validation; a library is not the whole Cognito policy.

Required checks after signature verification:

- Exactly **RS256**, RSA signing key of at least 2,048 bits; bounded string `kid`,
  trusted JWKS only; reject `none`, HMAC/EC/key confusion, unsupported `crit`, JWE,
  missing keys and invalid signatures. Never follow token `jku`, `x5u` or key URLs.
- Exact configured issuer and **`client_id`**, `token_use == "access"`; reject ID
  tokens. Do not substitute an ID token's `aud` rule for access-token client binding.
  Phase 5 does not request resource binding; unexpected `aud` is rejected pending
  an explicit resource-audience contract, rather than accepted as a client ID.
- Nonempty string subject; exact preservation, `STANDARD_USER`, `PERSISTENT`,
  `data_expires_at=None`. No group/custom-claim/profile role grants privileges.
- Required bounded nonempty provider `username` string from the signed access
  claims, retained only in the authentication context for provider finalization.
  This is not display name, request input or an email-based owner lookup.
- Strict integer NumericDates (not booleans/strings/floats), required `exp`, `iat`,
  `auth_time`; optional `nbf`. Require positive/order-consistent times, `exp > iat`,
  lifetime at most 3,600 seconds, no future issue/auth time or not-before beyond
  **60 seconds clock skew**, and reject expiration beyond that skew. Use injected
  UTC clock; if library time checks are delegated for testability, equivalent strict
  application checks are mandatory before creating a principal.
- `scope` is a bounded space-delimited string containing `openid email profile`.
  Reject missing required scopes, malformed types and M2M-like/non-user identities.
  Extra scopes never grant application roles. No resource server/M2M grant is added.

AWS documents the signature/issuer/client/token-use checks in
[JWT verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html).

**Necessary compatibility correction:** Cognito warns that `sub` is not guaranteed
to conform to an RFC UUID version/variant. Backend owner fields already use strings;
`frontend/src/api/workspaceBootstrap.ts:7` adds `z.string().uuid()` and can reject a
valid provider subject. Preserve direct `sub`, with no `UUID()` rewriting/lowercasing
or internal-owner mapping. Validate a bounded nonempty subject (maximum 128
characters, no controls, whitespace or `#` key delimiter), not an RFC version.
Unexpected unsafe provider subjects fail closed. Retain UUID validation for
generated application/resource/demo IDs and the fixed LOCAL identity. In 5C make
bootstrap validation conditional: LOCAL UUID, PERSISTENT safe opaque subject plus
exact authenticated-subject consistency. Update the owner-vocabulary documentation
in the implementing phases. This is a narrow compatibility exception, not a key
migration. [AWS access-token claims](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-access-token.html)

### JWKS and provider admission

Derive the original regional issuer and JWKS from the configured pool ID:
`https://cognito-idp.us-east-1.amazonaws.com/<pool-id>` and
`<issuer>/.well-known/jwks.json`. No token-selected issuer discovery, alternate
region, redirect following, custom CA or disabled TLS. Updated/multi-region issuers
are outside this single-region contract. Provider construction is lazy/network-free
so a Cognito outage does not break demo initialization.

One per-process bounded JWKS cache: **300-second freshness, at most 16 keys / 64 KiB
response**; validate key shape/use/algorithm and reject ambiguous duplicate kids.
Do not add an indefinite signing-key LRU above this freshness boundary.
Single-flight fetch; unknown `kid` permits one forced refresh per issuer per 30
seconds, with bounded negative caching. Successful refresh without that key → 401;
transport/service failure → 503. Do not serve expired cached keys after failed
refresh. Provider HTTP calls have finite connect/read timeouts, a two-second work
budget each, size limits and **one attempt**, not default SDK retry chains. Bound
combined auth work and check remaining Lambda time before remote work; transport
timeouts are not proof that every OS/DNS call can be preempted. Qualify worst-case
failure handling within the existing 15-second Lambda budget in 5D.

**Admission is distinct from valid JWT syntax/signature.** After cryptographic
verification, call the configured domain's **server-side `/oauth2/userInfo`** to
establish current subject/verified email and reject provider-disabled/revoked/deleted
sessions. Match its `sub` exactly to the verified JWT. Cache success by issuer,
client and SHA-256 of the full token, not email/sub alone: **60 seconds maximum,
128-entry LRU, never beyond JWT expiry**. Do not log/cache raw tokens or use stale
admission after freshness expires. Store only necessary normalized attributes and
verification times. Provider 401 clears admission and returns 401; timeout/429/5xx
returns 503. No offline profile fallback. Use a fresh uncached check for destructive
operations. This admits a documented **up-to-60-second revocation/disablement lag**
for ordinary requests; it does not promise instant global logout.

AWS explicitly notes that local JWT validation alone cannot detect revoked tokens
in [revocation behavior](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html).
The [userInfo contract](https://docs.aws.amazon.com/cognito/latest/developerguide/userinfo-endpoint.html)
documents subject/attribute retrieval and invalid-token failures, and currently
returns `email_verified` as a **string**. Accept only literal JSON `true` or exact
string `"true"`; reject false/missing/other truthy values. Validate email syntax;
missing optional name becomes `HireFlux user`, not an untrusted claim or generated
identity. No `aws.cognito.signin.user.admin` scope is needed for userInfo.

Principal admission requires verified email; optional display-name enrichment does
not. Cache prevents repeated provider reads on every hot request. Bootstrap uses
`TrustedProfileAttributes` from this boundary; LOCAL alone uses
`profile_attributes_from_settings`. Preserve creation/preferences and deprecated
`last_login_at=null`. On explicit bootstrap, conditionally synchronize changed
trusted name/email once under the ACTIVE/no-TTL guard; ordinary `/me` can present
fresh trusted attributes over the stored projection without a write. Name/email
never change owner, grant rights or link accounts. An email change or identical
emails in different pools/subjects cannot transfer data.

## 4. Frontend session architecture — 5C

### Dependency and integration decision

Select **`oidc-client-ts` 3.5.0**, subject to lock/audit/TypeScript/browser regression
qualification at implementation. The project's [release list](https://github.com/authts/oidc-client-ts/releases)
shows active maintenance; its [package](https://github.com/authts/oidc-client-ts/blob/v3.5.0/package.json)
has one runtime dependency, `jwt-decode`. Use the typed client directly, without
Amplify JS, another React auth provider, AWS browser SDK or new global session
store. [Maintainer Cognito guidance](https://authts.github.io/oidc-client-ts/)
specifies refresh-token-only revocation and disabling automatic silent renewal.
The inspected [response validator](https://github.com/authts/oidc-client-ts/blob/v3.5.0/src/ResponseValidator.ts)
is not an RS256 API verifier: enforce issuer/client/time checks in the wrapper,
nonce/state binding and backend admission; never call browser-decoded claims
trusted API identity. Tokens come only from the fixed TLS token endpoint after
the code/PKCE exchange. No arbitrary token import or persisted-user object can
activate a workspace without server bootstrap.

Configure public client/code/S256, scopes `openid email profile`,
`automaticSilentRenew=false`, `monitorSession=false`, `loadUserInfo=false`,
`revokeTokenTypes=["refresh_token"]`, one-use state age **300 seconds**, finite
10-second browser network timeouts, no logger, popup or hidden-iframe fallback.
Pin explicit metadata (issuer/authorize/token/revoke endpoints) from validated
public backend configuration. No browser discovery, userInfo or JWKS fetch is
needed; the backend performs the security-relevant provider reads.

Extend `WorkspaceSessionController`, not its ownership boundary:

- `sessionAdapters.ts`: registry of enabled demo/Cognito adapters and separate
  guarded LOCAL path; add `cognitoSessionAdapter.ts`, `cognitoClient.ts` and a
  generation/epoch-fenced `cognitoSessionStore.ts`.
- `workspaceSessionController.ts`: explicit `activateDemo`, `beginSignIn`,
  `beginSignUp`, `completeCallback`, `signOut`, restore and provider-error handling.
  Keep a single selected active workspace; reset is demo-only.
- `sessionGeneration.ts` / `api/client.ts`: replace fixed authorization usage for
  PERSISTENT with an asynchronous **credential lease** bound to the immutable
  identity generation. Lease records credential revision and expiry; check scope
  before/after refresh, headers, JSON/blob parsing and side effects. Demo/LOCAL
  preserve existing behavior.
- Keep `WorkspaceSessionProvider`, identity-scoped QueryClients, scoped hooks,
  unsaved-form registration, `downloadInSession`, navigation/toast fences and
  layout remounts. OAuth SDK events never independently make the UI authenticated.
- `workspaceCapabilities.ts`: derive real sign-out/account-management from identity
  kind and server capability, not every durable lifetime. LOCAL remains a
  development tool; demos keep reset/expiry/simulations; PERSISTENT gets honest
  profile/export/account controls.

### State and credential contract

| Event | Required transition / side effects |
| --- | --- |
| Initial load | Public landing renders without waiting for personal hydration; validate public auth config asynchronously, restore only the selected adapter |
| Try Demo | Fence/clear prior identity first; explicit issuance only; never a Cognito-error fallback |
| Create Account / Sign In | Confirm voluntary abandonment of dirty forms; new generation → authenticating → managed login; account creation uses its built-in Create account path within the same code/PKCE transaction |
| OAuth callback | Process only the dedicated public route; one transaction, strip URL promptly, validate state/nonce/config; admitted credential → bootstrapping → ready |
| Returning account | Validate stored transaction/session context and logout epoch, refresh if needed, then idempotent server bootstrap; no personal UI before success |
| Same-subject refresh | Remain ready while valid; replace credential revision atomically without clearing same-identity forms/query data; refresh cannot change issuer/client/sub |
| Expired/revoked token | Fence and clear private state; expired/sign-in-required UI, no write replay or automatic demo |
| Provider unavailable | Stable retryable provider-error UI; bounded explicit retry, no auth loops; old unexpired token only within its normal validity, never extended locally |
| Account DELETING/DELETED | Clear product caches; restricted account-recovery/status shell, never retry bootstrap as a new workspace |
| Sign-out/switch | Invalidate generation before async work, clear identity caches/storage/toasts/drafts/download continuations; remote logout cannot reactivate an old scope |

Keep tokens in **tab-scoped sessionStorage** via the library store, never localStorage,
URLs, personal-data query persistence or telemetry. Keep active access credentials
in memory too; the store enables reload/rotating refresh. Closing the tab ends that
local persistence; returning later can sign in again and recover the same server
data. This is browser-readable storage and remains exposed to same-origin script
compromise; preserve CSP and dependency review. No fictional promise of HttpOnly
SPA tokens, indefinite login or an unapproved BFF.

Refresh is single-flight per active session, normally 60 seconds before expiry or
before a request needing a fresh lease. Call the client's refresh-token path only
when a refresh token exists; absence means sign-in, never iframe authentication.
Persist each rotated token before releasing waiters. One network attempt; at most
one explicit retry inside the provider's ten-second rotation grace period, otherwise
require sign-in. No automatic retry of a lost-response mutation. An old-revision
401 must not invalidate a newer lease; a current-revision 401 invalidates the
session. Every delayed completion still checks the originating identity generation.

Fence the **SDK storage writes themselves**, not only the promise after callback
completion: UserManager stores a user before returning it. Wrap its user store
with the originating operation scope and saved logout epoch; check them immediately
before every credential write, without an asynchronous gap. A stale callback or
refresh must fail before storage or user-loaded event exposure. OAuth transactions
also retain the logout epoch across full-page navigation. Do not reuse a newly
unfenced global store for an older operation. Keep this protocol state inside the
existing controller/adapter integration, not a second application auth manager.

Prevent cloned-tab refresh races: retain an opaque session-instance ID alongside
the tab store and acquire a Web Lock for that instance. A duplicate tab that cannot
acquire ownership drops its copied credentials **without revoking the other tab's
family** and offers explicit sign-in. Unsupported locking/storage uses an in-memory
session with explicit sign-in after reload. Independent logins use separate token
families. Do not broadcast rotated tokens between tabs.

Use BroadcastChannel plus storage-event fallback for **credential-free logout
events** and an opaque logout epoch in localStorage. No tokens, subject, email or
product data in messages. Other account tabs invalidate immediately; restored
sessions compare their saved epoch before bootstrap. A demo tab remains a demo,
but clears any inactive Cognito restore state. Sign-out first fences locally, then
attempts bounded refresh-family revocation and top-level Cognito logout; failures
do not restore local access and must be reported honestly. Cognito logout uses
`/logout?client_id=...&logout_uri=<exact-allowlisted-URL>`, with no ID token in the
URL; do not assume generic OIDC RP-logout parameters work.
[AWS logout](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html),
[refresh rotation](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html).

Settings sends only changed fields plus `expected_version`; mark manual zone only
for an actual successful zone change in a temporary workspace. Durable zones are
server-owned, initially UTC, and never overwritten by returning-user browser
detection. Read-only provider profile presentation replaces the local-backend
copy and simulated account forms for PERSISTENT. Password recovery is managed by
Cognito; HireFlux never accepts passwords. Account erasure controls stay unavailable
until 5D, rather than pretending sign-out deletes data.

## 5. Configuration and API contract

### Backend and deployment inputs

| Input | Proposed contract |
| --- | --- |
| `AUTH_CAPABILITIES` | Explicit effective set above; absent preserves legacy mode |
| `AUTH_MODE` | Existing single-mode compatibility anchor only when capabilities are explicit |
| `COGNITO_USER_POOL_ID` | Required when Cognito enabled; same configured region; exact original issuer derived, no arbitrary URL input |
| `COGNITO_APP_CLIENT_ID` | Required nonempty provider client ID; one configured public client per environment |
| `COGNITO_DOMAIN` | Required exact HTTPS Cognito prefix-domain origin; no paths/query/fragment/userinfo, redirects or arbitrary host |
| `PERSISTENT_ACCOUNT_MANAGEMENT_ENABLED` | Default false; invalid without Cognito; only 5D enables qualified destructive orchestration |
| Existing settings | Preserve `ENVIRONMENT`, `AWS_REGION`, API CORS, table/signing references, workspace quotas/export/erasure bounds |

Pool ID/client ID/domain are public identifiers, not secrets. Settings rejects
enabled-but-missing/malformed/mismatched Cognito configuration at startup; don't
convert an error into demo-only service. Valid configuration constructs lazy
providers; availability failure is per Cognito request, leaving demo independent.
Cache/size/time limits above are validated constants initially, not a set of
operator-tunable bypasses. No static AWS credentials, app-client secret or user
token goes into Lambda environment, CloudFormation output or frontend variables.

### Public configuration avoids touching Amplify

Add **GET `/api/v1/auth/config`** with `Cache-Control: no-store`, no credentials,
no provider/network/DB work. Versioned schema:

```json
{
  "version": 1,
  "environment": "staging",
  "capabilities": ["demo", "cognito"],
  "account_data_policy": "disposable_staging",
  "account_management_enabled": false,
  "cognito": {
    "issuer": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE",
    "client_id": "EXAMPLE_PUBLIC_CLIENT_ID",
    "domain": "https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

The example identifiers are **not deployed Cognito IDs**. When disabled, omit
`cognito` and advertise only actually enabled public capabilities; never expose
LOCAL user configuration. Backend verification remains authoritative regardless
of frontend feature presentation. Derive the account-management/data-policy values
from validated runtime settings, not request input.

The new frontend loads this fixed relative path from the existing compiled API
origin, validates it with Zod and checks environment, trusted domain, issuer shape,
public client and supported scopes. The existing `VITE_API_BASE_URL`,
`VITE_PUBLIC_SITE_URL` and `VITE_WORKSPACE_MODE` values need **no Branch change**.
`local` remains a DEV-only opt-in. For the updated demo-capable build, public server
capabilities replace `demo` as an exclusive adapter selector; a missing endpoint
on an old demo backend permits **legacy demo only**, not speculative Cognito.
Malformed/mismatched config is an error; network errors disable account entry
with retry and never issue a demo automatically. Existing deployed frontend code
doesn't consume this route and remains unchanged until the explicit 5E build.

### Existing and added HTTP behavior

- `POST /api/v1/me/bootstrap`: body stays empty; provider-admitted persistent
  identity supplies attributes; same 200 initialization/replay schema, with
  PERSISTENT identity. No seeds/import/ownership fields. Same incompatible/deleting/
  deleted conflicts; do not turn all conflicts into bootstrap retries.
- Ordinary product routes: same repository protocols, versions, quotas, safe 404,
  transition matrix, append-only ordinary activity and error envelope.
- `/me`: trusted profile presentation over existing stored projection; no side
  effects on ordinary reads. Export remains current bounded JSON/CSV, no-store,
  not a transactional snapshot or complete historical backup archive.
- Persistent `DELETE /me` and `POST /me/deletion/retry`: **403
  `ACCOUNT_MANAGEMENT_UNAVAILABLE` in 5B**; preserve existing LOCAL tests/semantics.
  5D adds recent-auth and explicit `{"confirmation":"DELETE_MY_ACCOUNT"}` schema
  for persistent requests. It owns provider finalization described below.
- Add safe Cognito 401 `AUTHENTICATION_REQUIRED` / `SESSION_EXPIRED`, 403
  `ACCOUNT_NOT_VERIFIED`, 503 `AUTHENTICATION_UNAVAILABLE`; use existing envelope
  and generic `WWW-Authenticate: Bearer`. Provider errors, subjects, token strings,
  JWT internals and email-existence hints are never response/log details.
- 5D adds 403 `RECENT_AUTHENTICATION_REQUIRED`; deletion status/retry remains
  authenticated but deliberately **does not require ACTIVE workspace readiness**.
  Add narrowly typed optional finalization status fields to deletion responses;
  preserve existing LOCAL response compatibility and status codes.

## 6. Identity/data lifecycle guarantees and 5D safety

Reuse existing empty atomic bootstrap, complete manifest, strong reads, optimistic
transactions and ACTIVE guard. Persistent items have **no `expires_at`**, including
profile, settings, applications, children, quota/counter items and manifest refs.
Demo items retain their signed expiry/TTL, and no demo import/adoption is offered.
Only LOCAL may use the existing unmarked legacy-adoption path. A new PERSISTENT
owner with pre-existing owner data but no compatible PERSISTENT workspace marker
must get a bootstrap conflict, not silent adoption. New persistent bootstrap is
empty/atomic; existing ACTIVE trusted-profile recovery preserves preferences.
Only one issuer/client per environment can admit PERSISTENT subjects; pool changes
are identity migrations, never an email-based relink. Test synthetic same-subject
kind/provenance conflicts; marker collision must fail, never convert demo data.

Keep seven operations distinct:

1. **Sign-out:** clear browser identity/revoke the appropriate refresh family and
   clear managed-login cookie. Does not delete workspace data or other accounts.
2. **Provider disablement:** prevents future provider admission after its bounded
   cache window; does not delete table data. No application admin bypass is added.
3. **Recovery:** Cognito-managed verification/password recovery; same subject
   returns to the existing workspace. Re-registering an email yields no right to
   an old subject's data.
4. **Export:** existing ACTIVE/manifest/owner/record-byte-work bounds; no-store;
   5D requires recent provider authentication for full account export. No partial
   archive on 413, no private download after generation change.
5. **Live-table erasure:** existing conditional ACTIVE→DELETING freeze and bounded
   strong deletion; no ordinary mutation succeeds after freeze. In-progress work
   remains recoverable without client inventory/cursors.
6. **Cognito identity deletion:** separate provider finalization **after** verified
   HireFlux DELETED, never a substitute for erasure or the first step.
7. **Historical retention:** live erasure does not erase backups, CI/build assets,
   logs or retained identity infrastructure; production retention/restore/privacy
   policy and tombstone lifetime remain Phase 6.

### Minimal destructive-account orchestration in 5D

Introduce `application/account_lifecycle.py` above existing erasure services and a
typed provider-deletion port; no new table, index, queue, job or erasure engine.
For a PERSISTENT destructive request: verify JWT + **fresh userInfo**, require
`now-auth_time <= 300 seconds` using the signed claim (not refreshed `iat`), compare
the confirmation literal, then use verified owner and existing lifecycle checks.
Recent login uses managed login **`prompt=login`** with a new PKCE/state/nonce
transaction; a token refresh or remembered one-hour login cookie is not sufficient.
[AWS prompt behavior](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)

Bound each call using the existing erasure limits. Return 202 while DELETING; allow
authenticated status and explicitly confirmed retries in the restricted account
shell. If freshness expires, reauthenticate and resume that same subject; do not
create a new workspace. The UI fences product queries immediately when erasure
starts and explains irreversible loss of fictional staging records.

After strong verification yields DELETED, call **AdminDeleteUser** for the configured
pool and the **verified provider `username`**, never body/email/foreign username.
Give Lambda only `cognito-idp:AdminDeleteUser` on that pool ARN in 5D. No wildcard
pool, user-admin role, group management or generic administrative endpoint.
[Provider deletion API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminDeleteUser.html)

Extend the existing non-TTL WORKSPACE tombstone only with minimal provider
finalization state (`PENDING`, `COMPLETE`, `REVIEW_REQUIRED`) and a completion
timestamp; no tokens, email, profile or application data. Conditional updates
require the same owner/PERSISTENT/DELETED provenance. Local erasure keeps its
existing data-only semantics. Persist PENDING before the provider call; one bounded
attempt per explicitly requested retry. UserNotFound from this trusted operation
is idempotent completion. Network/permission failures never restore ACTIVE.

If the provider succeeded but response/status persistence was lost, subsequent
userInfo can deny the now-deleted user: show sign-in-required/deletion outcome
uncertain, never resurrect. An owner-approved **non-root operational** provider
metadata check can reconcile finalization; no public unauthenticated status lookup
or background retry is added. Retain the live-table tombstone even after identity
deletion. A fresh signup with the same email has a different owner. Direct external
provider deletion/disablement can leave table data orphaned; do not claim the user
cannot act independently at Cognito or that provider deletion erased those records.
Such recovery is an operator/privacy procedure; initial staging accepts only
controlled accounts and fictional application records.

## 7. Browser and security-header contract

Proposed, **not yet reserved**, staging prefix domain:

`https://hireflux-staging-9465-use1-20261020.auth.us-east-1.amazoncognito.com`

Use `/oauth2/authorize` (top-level GET, `response_type=code`, S256 challenge),
`/oauth2/token` and `/oauth2/revoke` for browser POSTs. Create Account has a distinct
HireFlux entry point and enrollment guidance, then uses managed login's built-in
Create account/confirmation path; Sign In uses its sign-in path. Do not invent an
undocumented `screen_hint` contract or rewrite an SDK URL to a guessed signup
endpoint. Password recovery stays on managed login.
[Managed login](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html)
Provider userInfo/JWKS are server calls. No browser discovery request is made.
Domain collision/unavailability at 5E is a STOP for a reviewed prefix/config/CSP
change, not an automatic alternative host. Pool IDs/client IDs remain generated
values to be bound in 5D/5E; no invented live issuer is recorded.

Register **exactly**:

- Callback: `https://main.d31vp0nq9fzl6q.amplifyapp.com/auth/callback`.
- Logout: `https://main.d31vp0nq9fzl6q.amplifyapp.com/auth/signed-out`.

Add these public SPA routes outside `WorkspaceSessionGuard`; no wildcard paths,
redirect parameters or query-specific registrations. Return destinations come
from the stored OAuth transaction and `safeWorkspaceReturnPath`, default dashboard.
No trust in a callback's arbitrary `returnTo`. Use callback query response mode,
not implicit tokens/fragments. Capture callback URL once in memory and immediately
`history.replaceState` to its clean path before awaiting exchange/rendering errors;
pass the captured string to the client. State is opaque random, one-use and
tab-bound with nonce/verifier, exact config/redirect and five-minute age checks.
Duplicate callback/StrictMode processing shares one promise and cannot exchange
the code twice. Stale logout/login completions cannot re-store credentials.

Anticipated changes:

- `frontend/src/securityHeaders.ts`, `vite.config.ts`, root
  `customHttp.template.yml` / `customHttp.yml`, hosting renderer and tests:
  add only the exact staging Cognito domain to **connect-src**. Keep current API
  policy unchanged, no `*.amazoncognito.com`, arbitrary HTTPS or browser
  `cognito-idp` origin. Make Referrer-Policy **no-referrer** to reduce callback-query
  disclosure; do not log URLs. Code still necessarily reaches the hosting callback
  request; promptly remove it and avoid inspecting/exporting raw callback logs.
- Keep `form-action 'self'`: auth/logout are top-level navigation and token/revoke
  use fetch, not HireFlux form submissions. Keep COOP/CORP same-origin, frames
  denied, scripts self-only, and all other protections. No popup/iframe workaround.
- Existing SPA rewrite already admits `/auth/callback` and `/auth/signed-out`;
  add regression tests retaining real static-file 404 behavior. No rewrite change
  or App resource property change is expected.
- The checked-in hosted policy is the **staging main-branch artifact**. Add no
  production Cognito domain to it speculatively. The renderer must validate a
  trusted per-environment origin map, and offline tests must render a separate
  production policy; actual production publication is a separate Phase 6–7 gate.
  Do not claim one staging file automatically isolates/publishes both policies.

API CORS still permits only the exact frontend origin with bearer headers and no
credentialed cookies. Do **not** add the Cognito domain to API CORS: Cognito is not
the browser origin. Cognito token/revoke endpoint CORS is provider-owned; a live
failure requires diagnosis, never API CORS `*` or weakened CSP. AWS documents
[browser token exchange](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html).

Local tests use fake providers/HTTP mocks, without adding loopback URLs to the
deployed staging client. A later explicitly authorized real local integration
would use a **separate public development client**, callback
`http://localhost:5173/auth/callback`, logout
`http://localhost:5173/auth/signed-out`, and browser origin localhost consistently.
Do not assume HTTP 127.0.0.1 or arbitrary Vite preview ports are registered. Such
an extra client is not part of the minimum four-resource staging proposal.

## 8. Cognito infrastructure and incremental release contract

### Minimum offline CDK definition in 5D

Add `infra/lib/auth/cognito-auth.ts` using the installed CDK Cognito L1s where
needed. The current 2.272.0 declarations already contain `userPoolTier`,
`managedLoginVersion`, refresh rotation and `CfnManagedLoginBranding`; no tooling
upgrade is required merely to express this design.

Propose **four new resources**, no replacements:

1. Environment-specific UserPool, **ESSENTIALS**, email username/auto-verification,
   case-insensitive sign-in, self-registration, email-only account recovery,
   verified-before-email-update semantics, password minimum 12 with mixed character
   classes. MFA/phone/SMS/passwordless/remembered devices/triggers/threat-protection
   add-ons off. Initial STANDARD_USER is an application policy, not a group.
2. Public UserPoolClient, **no secret**, COGNITO provider, authorization code only,
   scopes `openid email profile`, read email/email_verified/name, minimum write
   attributes email/name. Explicit password sign-in flow only as needed for managed
   login; no custom/admin/REFRESH_TOKEN_AUTH flows. No broad default flow set.
   Access/ID tokens **60 minutes**, refresh **one day**, rotation enabled with
   **ten-second grace**, token revocation enabled, existence-error suppression.
   Direct SDK user-admin tokens, if independently obtained, are not admitted to
   HireFlux without the required OAuth scopes/userInfo checks.
3. Prefix UserPoolDomain, **ManagedLoginVersion=2**, exact chosen environment prefix.
4. ManagedLoginBranding for that client with **UseCognitoProvidedValues=true**, no
   custom assets. API-created clients do not automatically get the console's
   branding setup; do not omit this and discover an unusable login page in 5E.

Provider schemas: [pool](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpool.html),
[client](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpoolclient.html),
[domain](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpooldomain.html),
[branding](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-managedloginbranding.html).
Rotation uses the OAuth token endpoint, not REFRESH_TOKEN_AUTH; original refresh
expiry is not extended by rotation. [Rotation contract](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html)

Use COGNITO_DEFAULT email with its default sender; no owned SES identity, SMS IAM,
Identity Pool, custom domain/certificate, social provider or new signing secret.
Backend JWKS/userInfo require no AWS IAM permission. Only account finalization adds
scoped AdminDeleteUser; preserve current DynamoDB, secrets and logging permissions.

New **Cognito pool** deletion protection ACTIVE and RemovalPolicy/UpdateReplacePolicy
RETAIN in both environments are deliberate identity safeguards, distinct from the
existing disposable staging table. Client/domain/branding can be removed on stack
deletion, leaving retained users/attributes needing an owner disposal decision.
Retaining an inactive pool has no modeled flat directory-storage charge, but
ongoing identity operations can count MAUs and retention remains a privacy duty.
No production pool is created; synth must show separate IDs, region/account binding
and domain with no staging client/redirects trusted in production.

Keep construct paths/logical IDs for every existing resource. Expected incremental
changes: four Cognito Adds, Lambda Code/Environment update and existing runtime
policy's one pool-scoped action. **Existing Amplify App and Branch properties,
DynamoDB table, signing secrets, budgets, alarms, log retention and throttles remain
unchanged.** Dependency graph: existing App origin → pool/client redirect allowlist;
pool/client → Lambda trust/config; existing backend endpoint → existing Branch.
App has no pool/API reference, preventing a cycle. Exact count/diff comes from 5D
synth and the later change set, not this anticipated inventory.

### Mandatory staging-storage decision

**Keep the existing staging table policy for initial 5E**, with no automatic PITR,
backup or retention activation. Durable application semantics mean records do not
expire on logout/token expiry; they do **not** promise recovery after operator
error, CloudFormation deletion/replacement or table loss. PITR and deletion
protection remain off, removal/replacement destructive.

Limit initial 5E to owner-controlled tester identities and **fictional application
records**, with an unmistakable disposable-staging notice before account workspace
use and in Settings/export/delete flows. Do not invite users to store irreplaceable
job-search data. Retained Cognito identity is not a backup of DynamoDB. Loss of the
table also loses deletion tombstones: the no-resurrection guarantee applies within
the retained workspace lineage. Table replacement is a hard STOP; re-creation with
accounts still enabled is not an automatic recovery procedure.

If the intended audience needs dependable personal-data storage, STOP that rollout
for separately approved protection/recovery/retention and cost decisions. Production
Table RETAIN/PITR/protection is already defined but does not settle restore-erasure
reconciliation (finding F07). No Phase 5 planning decision certifies that policy.

### Deleted PAT / NoEcho update handling

`hireflux-stack.ts:66` retains the existing `AmplifyGitHubAccessToken` parameter and
`frontend-hosting.ts:36` keeps the **identical AccessToken Ref**. Do not remove it,
replace it with an empty/fake value, extract the old token, or supply a new PAT.
For an **UPDATE** of the existing stack, use structured
`{"ParameterKey":"AmplifyGitHubAccessToken","UsePreviousValue":true}` with no
ParameterValue. Keep blank email and the other accepted parameters as explicitly
reviewed. [CloudFormation semantics](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_Parameter.html)

CDK documents `--previous-parameters=true` as its default, and the installed CLI
exposes that option. However, HireFlux's `infra/scripts/cdk-local.mjs` intentionally
permits only offline synth/list/version and strips credentials. **It is not the
deployment executor.** Prior 4D CREATE/token-entry helpers and consumed ledgers
cannot be reused as an UPDATE workflow. 5D must locally qualify the exact 5E
structured UPDATE preparation/review path and previous-value handling without
CloudFormation calls. [CDK option](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html)

Previous-value handling preserves CloudFormation state; it does **not** validate a
revoked token. It is acceptable here only when the reviewed change set contains
**no Amplify App modification/replacement** and App properties remain identical.
If CloudFormation/provider requires App.Update or repository reauthorization,
STOP: its still-present AccessToken property might submit an unusable prior value.
A new credential is justified only for a separately reviewed creation/replacement
or actual reauthorization need, never expiry housekeeping. No promise is made that
every unrelated future App update will avoid authentication.

5E change-set hard stops: App or Branch change not in scope, any replacement/
conditional replacement of App/table/signing secrets, pool replacement, changed
repo/branch/CORS/trust, unexpected IAM broadening/resource/build, revoked credential
use, source/artifact mismatch, or unexplained cost/inventory differences. Review
property-level changes and full inventory; no automatic retries/reconnection.

### One ordered 5E rollout, not new subphases

1. Obtain separate owner authorization, fresh Billing/lab/supervision baseline,
   temporary non-root identity and exact update/publication/test budget. Compare
   current source, stack, assets, connection and latest build with the accepted
   baseline. None of these live reads is performed in 5A.
2. Qualify final source/new Linux ZIP and account-bound offline template. Prepare
   one reviewed **UPDATE change set** adding Cognito/backend support while leaving
   all App/Branch properties unchanged; inspect previous parameters and normal
   rollback. Publish assets/execute only under the new concrete authorization.
3. Verify pool/client/domain/branding, backend trust, current demo compatibility and
   public auth-config metadata before publishing account frontend. A source push
   to main earlier would trigger Amplify, so 5B–5D stay local/offline.
4. Under the separately reviewed publication/build scope, publish the qualified
   frontend/header source **once** to main; its existing auto-build makes the one
   expected build. Verify revision/artifact/headers before live account activity.
   No Branch environment/App connection update or gratuitous build is needed.
5. Run only the accepted minimal account/demo verification budget and report
   qualified results/limits/costs. Stop on unexpected failures; preserve evidence.

If frontend release fails, the old demo frontend can continue with the additive
backend; no account UI precedes backend readiness. A reviewed rollback may disable
Cognito admission and restore known-good code/headers, preserving existing durable
items and pool identities. CloudFormation rollback cannot recover deleted data,
users, revoked sessions or lost refresh tokens; retained new resources need owner
review. Any rollback/build/cleanup still requires its approved action scope.

## 9. Incremental monthly cost model — October 20 official-price review

Choose **Essentials** for managed login and refresh rotation; Lite's classic UI
does not satisfy that combination, and Plus/add-ons are unnecessary here.
[Feature plans](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-sign-in-feature-plans.html)

AWS lists **10,000 native/social MAUs per account or organization** shared across
eligible Lite/Essentials usage, indefinitely rather than an introductory credit
term; Essentials native MAUs above allowance are **$0.015 each**. This is not
10,000 per app/pool, nor a renewed promotional balance. Same-pool repeated sign-ins
do not become separate MAUs; distinct test identities/pools can consume allowance.
No Plus, federation or M2M grant is proposed. Using an OIDC client with native
Cognito users is not external OIDC-provider federation. No fixed minimum fee is listed.
Model available allowance **and zero remaining allowance**; actual shared usage
has not been queried. [Cognito pricing](https://aws.amazon.com/cognito/pricing/)

Default Cognito email uses AWS-managed sending resources; choose the default sender,
not a new SES setup. The documented default quota is **50 emails per AWS account
daily**, shared with other pools and reset at 09:00 UTC. Verification, resends and
recovery compete for it. Do not request an increase or silently switch sender.
Higher volume/custom sending requires separately approved SES identity/configuration
and sandbox/delivery work. [Quota](https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html),
[email configuration](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)

Email pricing is separate; conservatively reserve **$0.10/1,000 outbound messages**
as an email cost allowance, without asserting that AWS-managed default delivery
will produce that exact bill. No usable promotional offset is assumed.
[SES reference rate](https://aws.amazon.com/ses/pricing/)
SMS/phone/email OTP MFA, Plus threat protection, paid higher RPS, multi-region,
custom sender and triggers remain disabled/deferred. Native user authentication
is MAU-priced; do not apply M2M per-token pricing to normal code/refresh grants.

Own scenario calculations, before tax/labs/unmodeled traffic:

| Scenario / assumptions | Incremental Cognito MAU cost | Modeled auth overhead reserve | Interpretation |
| --- | --- | --- | --- |
| Retained but inactive pool, no identity activity | $0 | Approximately $0 | Existing secrets/monitoring/hosting/storage still cost money |
| 10 supervised accounts, 500 additional API/admission-work equivalents, 0.25 s average extra Lambda work at 1 GiB, ≤50 emails/month | $0 if shared allowance available; $0.15 if exhausted | Up to $0.05/month planning reserve | About $0.05 incremental with allowance, $0.20 without; not a cap |
| 100 future accounts, 5,000 equivalents at 0.5 s, ≤500 emails/month spread within daily limit | $0 if allowance available; $1.50 if exhausted | Up to $0.25/month planning reserve | About $0.25 or $1.75 auth increment; extra product usage is separate |

Compute arithmetic uses **$0.0000166667/GB-second**, **$0.20/million Lambda
requests** and **$1/million HTTP API requests**, conservatively ignoring shared
compute/request freebies: 500×0.25 s costs $0.002083 compute; 5,000×0.5 s costs
$0.041667. Reserves include small API/DB/log/storage/email margins, not an enforced
budget. [Lambda](https://aws.amazon.com/lambda/pricing/),
[HTTP API](https://aws.amazon.com/api-gateway/pricing/)
Existing on-demand DynamoDB billing includes additional readiness reads and small
conditional bootstrap/profile writes; account admission does not seed 30 apps.
Transactional writes/index amplification and later personal records must still
be counted. [DynamoDB](https://aws.amazon.com/dynamodb/pricing/)

Carry forward gross HireFlux **$1.30–$2.30 idle plus small storage**, **$1.60–$2.60
with maintenance**, **$3.20–$4.20 under the prior limited-testing workload**. Thus
that same limited workload plus ten-account auth overhead is approximately
$3.25–$4.25 with available MAUs, or $3.40–$4.40 if exhausted. The hundred-account
row is **not** a claim that all their product traffic fits the old workload.
An authorized release build adds actual build minutes; avoid repeat builds.

These are assumptions, not measured account eligibility, delivery costs, forecasts,
caps or invoices. Retained pool activity, persistent data growth, provider outages
increasing Lambda duration, abusive registrations/verification email, recovery
attempts and existing anonymous demo seeding can exceed them. API throttles/
concurrency do not constrain Cognito's public signup endpoints or cap spending.
Supervised registration is an operating boundary, not an implemented invite gate.
Before broader availability, revisit abuse controls and data protection under
the original production gates; do not add WAF/triggers/services during this plan.

Keep **$0 usable promotional coverage**, inactive cost-tag attribution caveat and
manual $2 gross review / $5 first-week stop / unexplained ~$1/day investigation /
>$10 ongoing monthly review. No new alarms/recipients/paid logs are assumed. Actual
shared MAUs, email headroom, API quotas, billing lag and total resource spending
are 5E metadata/Billing checks under separate authorization; no fresh Billing or
paid monitoring query was made here.

## 10. Bounded 5B–5E implementation and validation plan

### 5B — backend Cognito admission and durable integration

**Outcome:** local/offline backend supports explicit demo+Cognito capability
selection, exact JWT trust, bounded provider admission, empty PERSISTENT bootstrap
and preserved owner/data guards. No Cognito resources or hosted frontend work.

Expected files: `config.py`, `auth/local.py` compatibility guard,
`auth/cognito.py`, `auth/principal.py`, provider/cache adapters,
`api/dependencies.py`, new `api/routes/auth.py` and public config schemas,
`api/routes/me.py`, safe errors/handlers, `app_factory.py`, `lambda_settings.py`,
trusted profile service/repository update where needed, backend dependency/lock
and fake `.env.example`. Document standard-role and subject compatibility rules.
Don't implement 5D deletion finalization/IAM here; gate persistent destructive
routes. No broad product-service rewrite or new owner key shape.

Entry: owner accepts this contract and separately authorizes 5B; current source
matches reviewed baseline. Acceptance: meaningful unit/API/Moto tests plus full
backend Ruff/format/mypy/pytest; network-fenced provider tests. Preserve existing
Lambda startup/demo packaging tests, updating fixtures for additive configuration.
STOP on principal fallback, arbitrary provider URLs, issuer mixing, owner mismatch,
durable TTL, partial bootstrap, resurrected lifecycle or leaked credentials.
Handoff: exact diff/config/API contract, locked dependencies, test results, remaining
5C/5D integration needs. Stop before 5C; no deployment, push or remote CI run.

### 5C — OAuth adapter and persistent browser experience

**Outcome:** one controller supports explicit demo and account entry/restore/sign-out,
managed OAuth callback, bounded rotating refresh and empty durable workspace UX
against fake/locally qualified 5B APIs. Add no pool or cloud change.

Expected files: session adapter/controller/generation/provider/context/capabilities,
new Cognito client/adapter/transaction/logout coordination helpers,
`api/client.ts`, auth-config and bootstrap schemas, `app/router.tsx`, dedicated
callback/signed-out/account-status pages, Landing entry controls, AppLayout sign-out,
Settings changed-field patch/provider copy, header sources/renderer/tests and
frontend dependency/lock. No second auth provider or dashboard redesign.

Entry: accepted 5B handoff and separate 5C authorization. Acceptance: frontend
lint/typecheck/unit/hosting-header/hosting-build/security tests, local build and
local browser QA with fake provider; all existing demo/session fencing tests pass.
No real hosted/Cognito traffic. STOP on uncontrolled SDK logging/renewal, code/token
URL persistence, cross-identity data/side effects, arbitrary redirect/CSP origin,
profile overwrite or simulated persistent-account claims. Handoff: OAuth config,
dependency footprint/audit, browser state/storage contract, focused local evidence.
Stop before 5D; no main-branch push or Amplify job.

### 5D — account safety, Cognito CDK and offline release qualification

**Outcome:** recent-auth, bounded erase→provider-finalize/account-recovery contract
implemented and tested; four-resource Cognito definition, least-privilege IAM,
unchanged existing App/Branch/table/secrets, qualified backend/frontend artifacts
and safe UPDATE preparation. **No Cognito resource is created.**

Expected files: account lifecycle service/provider port and Cognito deletion adapter,
`workspace_safety.py`/repository/mapping minimal tombstone extension, deletion schemas/
routes and account Settings/status UI, `infra/lib/auth/cognito-auth.ts`, environment,
stack and backend environment/policy wiring, infra config/backend/hosting/auth tests,
offline deployment-review tooling/fixtures and release docs. Preserve old ledgers.

Entry: separately authorized 5D after accepted 5B/5C. Acceptance: full affected
backend/frontend checks, complete locked Linux Lambda build/runtime/privacy/SBOM
gates, infra typecheck/unit/both environment synth/schema parity/real-artifact
offline CLI checks, network attempts blocked. Assert four Adds in expected staging
definition, stable old logical IDs/properties and scoped IAM; compare old/new
templates offline. Test UPDATE UsePreviousValue request construction without AWS.
No dependency installation beyond separately authorized implementation scope.
STOP on source/package mismatch, extra resources, production trust overlap, App/
Branch mutation/replacement, unbounded deletion, lost progress/resurrection,
credential retrieval or unjustified recurring features. Handoff exact revisions,
new hashes/inventory, full checks and one concrete proposed 5E action/traffic/cost
budget. Stop; no cloud mutation, push or build under 5D.

### 5E — separately authorized staging update and minimal live verification

Entry requires fresh explicit update/publication/verification authorization, current
owner-approved cash/lab baseline, approved temporary non-root identity, independent
change-set/resource/security review and available stop owner. No prior phase's
authorization, unspent request allowance or consumed ledger carries forward.

Use section 8's ordered update then frontend release. Proposed initial budget for
owner review: **at most two controlled real Cognito test identities, one fictional
demo issuance, six verification/recovery emails, eight interactive auth/recovery/
recent-auth flows, two refresh exchanges and 60 sequential HireFlux API requests**,
including bootstrap, ownership negatives, two bounded JSON exports and at most
five erasure/finalization requests for one test account. Include the one intended
frontend build and a few bounded static/header reads. Counts are proposed ceilings,
not authorization or load/capacity testing; stop rather than silently exceed them.

Verify actual new resource/configuration and correct source/artifacts; signup,
confirmation, sign-in, recovery, reload/sign-out, two-subject isolation, durable
no-TTL items/preferences, safe deletion and independent demo behavior. Use real
provider passwords/codes only personally in managed login, never chat/logs. Inspect
minimal safe operational metadata and cost deltas; no gratuitous fault injection,
alarm/load tests or paid monitoring. Failed provider/deployment behavior stops
automatic progression/retry. Report observed versus unverified paths honestly.
5E completion does not authorize real irreplaceable data, unattended access,
production, additional testers or Phase 6 automatically.

### Shared deterministic regression contract

- **JWT/provider:** valid RSA fixture, altered signature/alg/key, duplicate/malformed
  claims/headers, wrong issuer/client/token type/scope, bounded subject edge cases,
  bool NumericDates, expiry/skew/future issue/not-before, unsupported key URLs,
  unknown/missing kid, rotation/cooldown, JWKS timeouts/oversize/redirects, userInfo
  mismatch/unverified-email string cases/401/429/outage. No verifier fallback;
  demo remains usable with valid Cognito config during provider failure.
- **Owners/data:** two PERSISTENT subjects plus demo cannot access each other's
  records; identical/changed email grants no access; provider group/admin claims
  ignored; kind/provenance collision fails. Empty bootstrap/replay/concurrent
  first login preserve timestamps/settings and create no seed or TTL. Foreign
  and missing return the same 404. Existing optimistic/transaction rollback,
  signed cursor scoping and limits continue to pass.
- **Lifecycle:** credential expiry/logout never delete data; ACTIVE guards deny
  delayed writes after freeze; DELETING/DELETED bootstrap/read/export denial;
  record/byte/work export and erasure limits; explicit confirmation/recent auth,
  provider disablement/deletion failure, lost-response/finalization persistence,
  authenticated retry/reconciliation without resurrection. Test permission errors
  without real AWS calls. No claim of backup erasure or disaster recovery.
- **Browser:** wrong/malicious/expired state, nonce/client/issuer/redirect mismatch,
  duplicate callback/StrictMode, unsafe return paths, URL cleanup, no password/token
  telemetry; refresh rotation/invalid_grant/outage/no-token fallback, simultaneous
  requests/duplicate tabs/logout epoch, session switching and old query/mutation/
  toast/download/navigation completions. Durable restore never re-detects zone;
  Settings unrelated save preserves demo automatic detection, true zone edit
  marks it manual, 409 preserves unsaved edits. Demo reset/exit/expiry and keyboard
  navigation remain valid; provider errors never issue a demo.
- **Infra/hosting:** no secret-bearing client/IDs in wrong environment; exact
  callbacks/logout/domains/scopes/TTL policies/rotation/branding/protection; staging
  four-Add diff and unchanged old resources, structured previous parameters;
  forbidden origins/implicit grant/unsafe CSP fail, callback refresh/asset 404
  preserved. Public config/bundles/Lambda settings contain no credential material.

Use test-generated keys, injectable clocks/transports and Moto; no Docker or
AWS resources are required. Test representative boundary classes, not every
unrelated product permutation. Live provider/hosting behavior stays a 5E gate.

## 11. Material design decisions

- **Chosen:** direct verified `sub`; single pool/client trust per environment;
  explicit additive capabilities; shared FastAPI boundary; bounded server userInfo
  admission; existing durable services/manifest; one frontend session controller;
  Essentials/code+PKCE/public client; tab-scoped rotating refresh; recent-auth
  erasure then provider deletion; controlled disposable staging.
- **Chosen to protect accepted hosting:** public, no-I/O auth-config endpoint
  instead of adding Cognito environment variables/build settings to existing
  Amplify resources. Preserve NoEcho Ref with previous parameters only when App
  has no change. One backend update precedes one explicitly authorized frontend
  publication/build. No PAT recreation or migration by default.
- **Necessary corrections:** provider subjects are not strict RFC UUIDs; userInfo's
  exact `"true"` is not generic truthiness; no groups/admin grants despite older
  future-role prose; repair the known changed-field Settings defect; code-created
  managed-login clients need branding; ordinary JWT validation is not revocation.
- **Rejected without need:** identity broker/internal owner mapping, BFF/second
  auth manager, Gateway-only authorizer, client secret/implicit grant, shared
  demo-to-account import, email-owned records, new indexes/database/microservices,
  static credentials, automatic PAT renewal, production data in disposable staging.
- **Deferred:** broad public/production abuse protection, protected production
  recovery and backup-erasure reconciliation, generalized roles/admin bypass,
  real local-cloud OAuth client, social/Identity Pools/SMS/SES/custom domains,
  Plus/paid quotas/triggers, global immediate session revocation and unrelated
  F03/F07/F08/F10/F11 hardening. None is a hidden prerequisite of the local demo.

## 12. Remaining owner questions

**No material design question blocks beginning 5B.** The contract makes explicit
proposals for storage warning/audience, Essentials, subject compatibility, session
storage, admission caching, deletion ordering and the no-App-update rollout.
They are reviewable choices, not claims that the owner has authorized deployment.

Before **5E**, the owner must approve its exact cloud/publication/test budget and
accept fictional-only disposable staging, cash spending, retained pool ownership
and destructive test-account deletion. Actual domain availability, generated IDs,
shared free allowance/email headroom and provider/update behavior are deliberately
external qualification gates, not reasons to create resources or tokens in 5A.
An intention to host irreplaceable personal data changes that audience decision
and requires storage/recovery/cost review before such deployment.

## 13. Phase 5A verdict and exact 5B entry conditions

**PASS — Phase 5A architecture/gap analysis/implementation contract complete.**
Reusable foundations, auth coexistence, JWT/provider trust, profile/owner derivation,
browser/session/CSP design, data loss/lifecycle, Cognito resources, costs and deleted
PAT update handling are specified. Proposed components are not implemented.

5B may begin only after the owner reviews this document and **separately authorizes
5B**, with the source baseline reconciled and this backend-first scope retained.
If a newly demonstrated provider/library/source incompatibility changes a material
decision, stop for the smallest amendment rather than implementing a workaround
or moving the decision downstream silently.

5A validation: read actual source/tests and relevant accepted handoffs; consult
official AWS/library documentation as of October 20; verify unchanged qualified
source and frozen 4H hashes; check this document's local references and diff.
No application tests/builds, dependency installations, browser/backend traffic,
AWS/GitHub API operations, authentication renewal, resource/user creation, token
operations, Billing changes, commit/push or new CI/Amplify job occurred. Only this
planning document is added; the accepted evidence and existing dirty work remain.

**Stop here. No 5B–5E execution is authorized by this handoff.**
