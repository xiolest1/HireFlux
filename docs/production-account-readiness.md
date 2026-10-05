# Production account readiness — Phase 1

Date: 2026-10-05. Status: architecture proposal for review, not an accepted implementation ADR.
Repository baseline: `533cee182dc1a20ef7edb45db5d2c0ee21635dfd`.

**Phase 2A implementation update (2026-10-05):** the historical findings and
proposals below describe the Phase 1 baseline. Durable local principal/data-lifetime
separation, empty atomic bootstrap, and central durable readiness are now implemented;
see [ADR 0005](adr/0005-durable-local-workspace-bootstrap.md) and section 37.
No Cognito, persistent frontend session, or AWS deployment is implemented.
The accepted follow-on scope/order supersedes the earlier grouped Phase 2 proposal:
Phase 2B frontend sessions; Phase 2C account deletion state, strong application
manifest, write guards, and expanded export safety; Phase 3 CDK synth only;
Phase 4 AWS staging demo; Phase 5 Cognito accounts in staging; Phase 6 hardening;
Phase 7 production deployment. Direct verified Cognito sub ownership remains
approved for the future verifier.

This audit covers the implemented local React/Vite → FastAPI → DynamoDB Local
system. AWS, Cognito integration, and CDK deployment remain future work. Phase 1
creates this document only; it does not change authentication, persistence, UI,
infrastructure, or existing product policy. File references below are relative
to the repository root. Proposed module names and contracts are explicitly future work.

## 1. Executive finding

**HireFlux is structurally ready to evolve, but is not ready to accept persistent
personal accounts today.** Its backend authentication seam is real: routes take
`CurrentIdentity`, services derive ownership from its `user_id`, and adapters use
owner-qualified keys. Persistent data is already representable by omitting TTL.
This does not require a database replacement, new general-purpose indexes,
microservices, or a separate implementation of the candidate workflow.

The smallest defensible evolution is:

- Preserve signed, fictional, disposable demos and their separate provisioning service.
- Accept verified Cognito **access tokens** alongside demo credentials at one backend boundary.
- Use the verified Cognito `sub` directly as owner ID within one pinned pool per environment.
- Separate credential expiration from workspace-data expiration explicitly.
- Bootstrap an empty durable workspace idempotently from authenticated requests.
- Replace frontend demo-only orchestration with a general workspace session boundary,
  retaining the demo adapter and clearing all identity-scoped state on replacement.
- Start with Cognito managed login, authorization code with PKCE, and no BFF.
- Keep FastAPI responsible for verification on shared demo/account API routes.
- Add account lifecycle and erasure access paths before public personal-data release.

The principal blockers are exclusive auth modes, no Cognito verifier/configuration,
ambiguous lifetime semantics, stale profile authority, frontend credential/session
coupling, returning-user preference handling, and missing persistent account
disable/delete/recovery operational contracts. Domain ownership and status policy
are assets to preserve, not redesign.

### Evidence and scope

Reviewed `AGENTS.md`, `ARCHITECTURE.md`, `README.md`, `.env.example`,
`docs/roadmap.md`, `docs/deployment-environments.md`,
`docs/dynamodb-access-patterns.md`, `docs/domain-model.md`, `docs/data-export.md`,
`docs/status-transitions.md`, and all four current ADRs. Inspected backend auth,
dependencies, composition/configuration, domain models, service/port boundaries,
routes/schemas, serializers, quota/counter/projection writes, demo cleanup,
cursors, and export behavior; frontend auth/storage, API/download helpers,
router/layout, settings, landing, forms, query hooks, and test fixtures.
Repository-wide searches covered the identity/lifetime/session/role/export terms
in the request and additional logging, browser-storage, and projection coupling.

Existing tests were inspected for owner isolation, foreign-resource 404s, request
validation, optimistic conflicts, quotas, cursors, seed failures, settings,
exports, configuration guards, route protection, cache clearing, and expiry.
The validation record at the end distinguishes tests run from code inspection.
This is a readiness assessment, not proof of a deployed AWS system or a complete
penetration test.

## 2. Current identity and data flow

```mermaid
flowchart TD
  Visitor[Visitor at public landing] --> Start[DemoSessionProvider.start]
  Start --> Post[POST /api/v1/demo-sessions plus Idempotency-Key]
  Post --> Reserve[DemoSessionService reserves generated workspace UUID]
  Reserve --> Seed[Profile and fictional resources through ordinary services]
  Seed --> Ready[Lifecycle READY]
  Ready --> Sign[DemoSessionCodec: two-part HMAC credential]
  Sign --> Store[Tab sessionStorage: token and expires_at]
  Store --> API[apiRequest / apiDownload: Bearer header]
  API --> Dependency[get_current_identity verifies signature and expiry]
  Dependency --> Identity[CurrentIdentity: UUID, STANDARD_USER, is_demo, data expiry]
  Identity --> Services[Owner-scoped application and resource services]
  Services --> Ports[Repository protocols]
  Ports --> Keys[USER#owner and USER#owner#APPLICATION#id]
  Keys --> Items[Domain items, quotas, counters, sparse indexes, TTL]
```

`application/demo_sessions.py` reserves `WORKSPACE` plus an optional hashed
idempotency record, creates 30 fictional applications and related resources,
then issues a token only after `READY`. Failures get best-effort cleanup and a
short-lived `FAILED` marker. The HMAC payload in `auth/demo.py` contains `sub`,
`iat`, `exp`, `kind=demo_session`, and version; it is **not a three-part JWT**.
`auth/demo.identity_from_claims` normalizes it to `CurrentIdentity` with a
synthetic email. `api/dependencies.py` verifies before services see an owner.

The owner UUID doubles as the demo workspace ID. No separate tenant/membership
model exists. `auth/local.py` supplies a fixed, non-demo identity with no expiry;
this already exercises many durable backend semantics in tests.

## 3. Demo-coupling inventory

Classification applies to the current implementation, not just its naming.

- **Already identity-agnostic:** `application/services.py`, `resource_services.py`,
  `insights.py`, `pipeline.py`, and `opportunity_workspace.py` consume normalized
  identity or owner strings. `application/ports.py` and `resource_ports.py` expose
  no boto3 keys. Application/child primary keys, all current GSI partitions, and
  `CursorCodec` scopes are owner-derived. HTTP writes exclude ownership fields.
- **Already identity-agnostic with a bounded-scale condition:** application lists,
  duplicate advice, dashboard/analytics, notes/interviews and CSV export. They
  remain viable only while the configured lifetime/child limits bound fan-out.
- **Thin adaptation required:** `domain/models.CurrentIdentity` has mandatory
  name/email and optional `expires_at`, but no explicit provider/kind invariant.
  Keep owner-neutral identity; distinguish profile attributes and token lifetime.
  `UserService` and `DynamoUserRepository` need an explicit persistent profile
  projection contract; `WorkspaceResourceService.get_settings` can be reused.
- **Production-account blocker:** `config.AuthMode`, `api/dependencies.py`, and
  `api/routes/demo_sessions.py` select exactly one mode. `COGNITO` exists but
  always returns authentication-unavailable; it does not support coexistence.
- **Production-account blocker:** `frontend/src/main.tsx`,
  `auth/DemoSessionProvider.tsx`, `demoSessionContext.ts`, `DemoSessionGuard.tsx`,
  `sessionStore.ts`, `api/client.ts`, and `app/router.tsx` assume authenticated
  access means a demo. Storage restoration and API 401 handling are demo-specific.
- **Thin adaptation required:** `components/AppLayout.tsx`, `pages/SettingsPage.tsx`,
  and `pages/LandingPage.tsx` select identity wording/actions from demo context;
  query keys throughout `features/*/queries.ts` omit owner identity.
- **Thin adaptation required:** `auth/timeZonePreference.ts` and
  `features/resources/queries.useAutoDetectTimeZone` treat a tab marker as evidence
  of a manual preference. Returning accounts need server-persisted initialization
  semantics. Search-tour state and Settings preview state need centralized cleanup.
- **Demo-specific by design:** codec, demo-session endpoint, fictional seed,
  lifecycle/idempotency records, failed-seed cleanup, countdown, demo reset/exit,
  demo trust copy, and account-control simulations. Keep these separate adapters
  and surfaces; do not run them when provisioning real users.
- **Demo-specific policy by design:** full JSON export rejects `identity.is_demo`;
  CSV remains available. The future UI should consume one small capabilities
  object rather than infer this from the presence of a stored demo token.

## 4. Existing production-ready seams

`CurrentIdentity` is provider-neutral enough for ownership. No Cognito SDK or
demo token object enters ordinary application/domain methods. The domain and
resource dataclasses all allow `expires_at=None`; `mapping.serialize_item`
omits `None` values, and readers accept missing TTL. Quotas and counters append
TTL assignments only when a data expiration exists. Optimistic concurrency and
transactional activity/projection updates are independent of the provider.

`get_or_create_profile` and `create_settings` use conditional creation and
strongly consistent reads after a lost race. Empty counters are read as zero;
empty application/child queries are valid. No fixture seed is required for the
backend dashboard. Local auth is rejected outside local/test and under the two
AWS runtime markers checked in `config.py`. CORS is explicit; errors are safely
normalized; table operations remain operator commands.

These seams are implemented. Registration, JWKS handling, returning browser
sessions, account erasure, and deployed operations are not.

## 5. Production-account blockers and priority

1. **Before any account integration:** separate data lifetime from token `exp`;
   enforce valid identity kinds; establish additive auth capability configuration;
   define profile/verification authority and idempotent empty bootstrap.
2. **Before browser account flows:** general credential access and route guards;
   initialization state; session generation fencing; identity replacement cleanup;
   demo-specific capability presentation; persistent time-zone initialization.
3. **Before AWS staging:** real signature/claims verifier, safe JWKS cache,
   public-client OAuth configuration, callback handling, deployment isolation,
   packaging and observability. Missing Cognito configuration must fail startup.
4. **Before accepting public personal data:** tested logout/recovery/revocation
   semantics, account access-denial and recoverable erasure, export limits in
   bytes/time as well as records, abuse limits, backups/restore and privacy hygiene.

The current 2,048-character demo token bound cannot be blindly reused for Cognito
tokens carrying scopes/groups/revocation metadata. Use a bounded, tested JWT
limit appropriate to the selected configuration and infrastructure header limits.

## 6. Recommended target identity model

```mermaid
flowchart LR
  Demo[Verified demo HMAC credential] --> Normalize[Backend identity normalization]
  Cognito[Cognito access token verified against pinned issuer/client] --> Normalize
  Local[Guarded local identity / test fixture] --> Normalize
  Normalize --> Principal[CurrentIdentity: owner UUID, kind, standard role, data lifetime]
  Principal --> Account[Persistent account access gate and bootstrap]
  Principal --> Core[Shared application/domain services]
  Account --> Core
  Core --> Dynamo[Existing owner-scoped DynamoDB model]
```

One identity owns one personal workspace. No tenant selection, team memberships,
identity broker, or browser-selected owner is needed. Define kinds such as demo,
persistent, and guarded local; local exercises durable semantics. Verification
outputs credential expiry separately. In a durable identity, domain expiry must
be absent, regardless of how frequently the browser refreshes its tokens.

Allow one fixed Cognito issuer/client configuration per deployment initially.
Do not accept arbitrary pools based on unverified `iss`. Existing owner key
strings stay intact. Reject a bootstrap that encounters a profile with a
conflicting recorded identity kind/provider binding instead of adopting or
stripping TTL from another workspace.

## 7. Cognito sub versus internal HireFlux ID

**Option A: verified `sub` → `owner_user_id`. Recommended initially.** It fits
the UUID conventions and documented intent in `docs/domain-model.md`, eliminates
a mapping lookup/transaction on first use, and preserves all key constructors.
Security depends on pinning issuer/client before trusting `sub`. Email and
username must never be ownership keys or account-linking evidence. AWS itself
recommends `sub` instead of mutable/case-varying usernames or emails.
[AWS identifier guidance](https://docs.aws.amazon.com/en_en/cognito/latest/developerguide/user-pool-case-sensitivity.html).

The cost is a genuine pool-lifecycle dependency. Recreating/deleting the pool or
deleting/recreating a user does not restore the old workspace association.
Protect durable pools against accidental replacement/removal; document recovery
and require explicitly verified operator-assisted re-linking/migration if this
ever happens. A DynamoDB restore alone does not restore Cognito accounts.
Retaining provenance (`identity_provider`, pinned issuer, schema version) in a
profile helps diagnose mismatches but is not an internal-ID mapping.

**Option B: `(issuer, sub)` → generated internal UUID → owner.** This isolates
physical owner keys from a provider change and lets approved replacement
identities attach to existing owners. It requires a unique linkage entity,
atomic account/link creation, race handling, deletion of links, and a carefully
authorized recovery/linking workflow. It does not by itself establish who owns
an orphaned account after a disaster. Lookup by verified email alone remains
unsafe. It could use primary-key lookups without a GSI, but adds work to every
account lifecycle operation.

Both options can be secure. At portfolio scale, with one pool per environment
and no current provider migration requirement, Option B buys hypothetical
portability at disproportionate complexity. Option A is the approval-level
ownership tradeoff. A later migration would need an explicit old-owner/new-owner
plan covering all partitions/projections, not just profile replacement.

## 8. Identity source of truth and profile audit

Current `DynamoUserRepository.get_or_create` stores name, email, role,
`created_at`, `last_login_at`, and optional TTL only on creation. On subsequent
calls it returns the old profile. Its sole synchronization is a string-based
`Demo Recruiter` → `Demo Workspace` rename when the incoming name matches.
`last_login_at` therefore currently means first profile initialization, not
latest login. `/me` reads can also create a profile; authentication itself does
not ensure one exists. Profiles have no account-state/verification fields or
profile-edit endpoint. Routes authorize using identity, not the stored role.

Recommended authorities:

- **User ID:** verified Cognito issuer/sub, mapped directly as in section 7;
  generated demo UUID or configured local UUID for their respective modes.
- **Email and verification:** Cognito. Store an optional display/export projection
  with synchronization time; it is not proof for linking accounts or sending
  future email. Verification is checked from a trusted provider response.
- **Display name:** Cognito `name` initially, projected for display/export. A
  missing name uses a neutral display fallback without changing ownership.
  Future editing calls the provider and refreshes the projection; do not turn
  the existing local preview into a second authority.
- **Role:** server policy gives all initial identities `STANDARD_USER`.
  Stored role is informational; ignore arbitrary group/custom role values for
  privilege. Reserve `ADMIN` without implementing an administrative access path.
- **Authentication account state:** Cognito controls confirmation, disablement,
  credentials and recovery. Offline JWT validation has bounded stale acceptance.
- **HireFlux account state:** a durable server-owned account record controls
  workspace bootstrap version and `ACTIVE`/`DELETING`/`DELETED` denial. It cannot
  reactivate a Cognito-disabled user or authorize an invalid token.

Cognito access tokens ordinarily provide identity/scopes, not the email/name
fields this `CurrentIdentity` currently requires. Do not invent those claims or
accept a browser's ID-token payload as enrichment. Separate the verified
principal from optional profile attributes. At persistent bootstrap and renewed
session hydration, the backend fetches configured Cognito `userInfo` with the
verified access token and requested `openid email profile` scopes, checks its
`sub` against the principal, validates types, and requires verified email.
`email_verified` can be returned as a string; normalize strictly, never by
truthiness. Provider rejection denies hydration; provider outage returns safe
retryable failure. Do not create a durable account from unverified metadata.
[AWS userInfo contract](https://docs.aws.amazon.com/cognito/latest/developerguide/userinfo-endpoint.html).

Email/name changes update only their projections after a successful trusted
refresh; they never rename partitions. Configure verification-before-email-
update so the original address remains active pending verification.
[AWS attribute update settings](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UserAttributeUpdateSettingsType.html).
Admin confirmation must not implicitly bypass the verified-email gate. The
backend's session-validation snapshot may be reused only until that access
token expires; reject expired or missing snapshots for workspace access and
hydrate again. Cognito remains the authority; this short-lived snapshot is not
an indefinitely trusted DynamoDB `email_verified` flag.

Replace misleading login timestamps with explicit `last_seen_at`/attribute-sync
semantics, or update `last_login_at` only when a real authentication event can
be established. Avoid per-request profile writes. Preserve the legacy demo
rename narrowly for demo identity and make concurrent synchronization conditional
so a delayed refresh cannot overwrite newer metadata.

## 9. Backend authentication boundary

Keep credential parsing and authentication selection in `auth/` composed by
`app_factory.py` and invoked by `api/dependencies.py`. A small typed verifier
interface is justified for demo, Cognito, and deterministic test fixtures; it
needs only verify/normalize behavior, not an enterprise provider framework.
Provider-specific claim parsing, cryptography and network calls do not enter
application/domain services. Profile enrichment/account access is a separate
service using a provider port and repository protocol.

Retain `AUTH_MODE=local` as a strictly guarded developer convenience. Evolve
deployed configuration additively to specify demo availability independently
from persistent verifier availability. Preserve legacy demo/local defaults;
do not silently reinterpret `AUTH_MODE=cognito` as permission to issue demos
with an unchecked default key. Validate every enabled capability's configuration.

Central bearer parsing rejects ambiguous/multiple credentials and bounds input.
The two-part legacy demo format and three-part JWT format can select an enabled
verifier; format selection is not authentication. Each verifier must fully
verify its own format. A failed JWT must never fall back to local identity or
demo verification. Unknown formats/issuers fail closed. Local ignores credentials
today; keep that behavior only behind its explicit local/test guard.

Preserve existing demo error codes. Add general required/expired/invalid auth
categories for persistent tokens; return the existing safe envelope, 401 with
`WWW-Authenticate`, and distinguish configuration/provider outages (503).
Authorization against foreign resources remains 404; account state denial is
separate from resource existence. No user-selectable provider/owner query fields.

## 10. Frontend auth and session boundary

Replace the top-level demo-only context with a `WorkspaceSessionProvider`
(proposed name) with a discriminated authenticated session and separate demo
operations. Prefer orthogonal lifecycle (`initializing`, `anonymous`, `ready`,
`switching`, `signing_out`, `error`) and identity kind, plus an expiry reason,
over duplicating every lifecycle state for each provider. During initialization
or switching, unmount/block workspace consumers. Preserve demo reset failure
recovery intentionally; it is distinct from account logout.

The provider owns asynchronous credential retrieval/refresh, session hydration,
safe redirect state, bootstrap readiness, logout, and identity replacement.
`api/client.ts` obtains the active credential from this boundary for JSON and
downloads; it no longer directly reads demo storage. OAuth exchange requests
must never accidentally receive the demo bearer token. API and UI session
events carry a generation identifier so an old request's 401 cannot log out a
new identity. Retry refresh once under a shared in-flight promise; do not replay
non-idempotent writes on uncertain network outcomes.

Use owner/kind-scoped query keys or a QueryClient per active session, plus a
session generation fence on mutation callbacks, downloads, auto-detection,
toasts and navigation. Query cancellation alone cannot stop a mutation already
accepted by the server. Existing hooks call `setQueryData` on mutation success;
clearing the cache without fencing those callbacks is not a sufficient proof
of isolation. `keepPreviousData` must never span identities. No persisted
personal-data query cache is required.

Current coupling and required behavior:

- **Routes/deep links:** `DemoSessionGuard` currently redirects to `/` with
  `from`; account restoration must finish before deciding anonymous. OAuth
  return paths must be validated same-origin workspace paths; reject `//`,
  external URLs, auth callbacks, and foreign application redirects. The current
  landing allowlist does not preserve all query-string-only deep links.
- **Expiry:** current provider schedules one demo deadline and the API clears
  only demo 401 categories. Durable token expiry triggers refresh/re-authentication,
  never data expiry. No refresh loop or repeated expired-credential requests.
- **Refresh:** demo restores validated `sessionStorage`. Persistent hydration
  re-establishes credentials/readiness, then loads profile/settings before workspace
  content. Invalid storage must become anonymous safely, including storage errors.
- **Cross-tab:** current custom session event is window-local, with no auth
  `BroadcastChannel` or cross-tab logout coordination. Keep demos tab-scoped.
  Durable logout/account switch broadcasts a credential-free event to clear other
  account tabs; do not broadcast tokens or workspace content.
- **Preferences:** clear manual-zone marker, both tour keys, account-preview key,
  query/mutation state, drawers, forms, download references and identity toasts
  centrally. Current tour cleanup is in layout reset/exit, not provider expiry.
  Theme and sidebar collapse may remain device preferences; apply saved account
  theme once available, without leaking profile/content.
- **Time zone:** `useAutoDetectTimeZone` can PATCH the browser zone even when the
  saved zone differs; the only manual marker is tab-scoped. Initialize once on
  new durable workspace using a validated hint, or persist an initialization
  flag. Returning visits must not silently replace the saved zone.
- **Unsaved forms:** `ApplicationForm` has `useBlocker` and `beforeunload`.
  Intentional sign-in/switch/logout should confirm discard before leaving;
  forced expiry/denial clears sensitive state even if a navigation blocker is
  active. No automatic upload or carryover of drafts to the new identity.
- **Anonymous landing:** remains available without hydration-dependent marketing
  content. Provide distinct Try demo, Create account, Sign in and Continue actions.
  Do not issue a new demo merely because account restoration failed.

## 11. Initial browser session architecture

**Recommendation: managed Cognito login using authorization code + S256 PKCE,
a public client with no client secret, and a SPA bearer session.** Managed login
and PKCE are complementary choices: the former owns credential/verification/
recovery screens; the latter secures the redirect code exchange. Validate OAuth
`state`, OIDC nonce when processing ID tokens, exact callback URI and code
transaction expiry; remove code/state from browser history promptly. Use a
maintained OAuth client with explicitly configured storage, not hand-written
protocol/cryptography. Cognito supports public-client PKCE code exchange.
[AWS token endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html).

For the initial model, keep access/ID tokens in memory, and the rotating refresh
token plus short-lived PKCE transaction in tab `sessionStorage` so refresh and
return visits in that tab work. Do not use persistent `localStorage` for account
credentials. On a new tab/closed-browser return, redirect to managed login;
its provider session may allow continuation, otherwise the user signs in again.
The workspace is durable even when browser credentials are gone. Never equate
remembered identity with a valid session. This is a deliberate UX/security
tradeoff requiring approval, not an assertion that sessionStorage prevents XSS.

Recommend five-minute access tokens and a bounded seven-day refresh lifetime
initially, rotation enabled, minimal bounded grace for retry races, and one
refresh at a time per tab. Re-check exact supported limits/tier at Phase 3/4;
these are proposed settings, not current configuration. Cognito rotation returns
replacement refresh tokens; clients must save the replacement and handle a lost
response without uncontrolled retries. Rotation must be supported by the chosen
client's actual refresh method.
[AWS refresh/rotation behavior](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html).

Realistic alternatives:

- **Custom signup/login UI using Cognito APIs:** still delegates passwords to
  Cognito but puts challenge, recovery, resend, enumeration and error-flow
  complexity in HireFlux. It does not fix JavaScript token exposure. Defer until
  there is a real product need for custom authentication screens.
- **HttpOnly-cookie/BFF session inside the existing FastAPI deployment:** protects
  refresh/access tokens from direct JavaScript reading and allows shared browser
  sessions, but adds server session storage, cookie-domain/SameSite decisions,
  CSRF checks, OAuth backend callbacks, session rotation, and expiry/cleanup.
  Cookies must be Secure/HttpOnly, narrowly scoped, and mutations require origin
  checks plus CSRF protection. XSS can still act through the victim's session.
  This need not be a new microservice, but is more work than current needs justify.
- **Memory-only refresh credential:** reduces at-rest exposure but loses tab
  refresh continuity and relies on reauthorization; viable if that UX is preferred.
- **Gateway JWT authorizer:** a verification layer, not a browser-session design;
  see section 12. It does not create recovery, refresh, or logout behavior.

Bearer API calls are not automatically authenticated by cookies, so traditional
API CSRF is reduced; OAuth login/session substitution still needs state/PKCE.
All JavaScript-readable tokens remain exposed to successful XSS. Preserve strict
script CSP, safe React text rendering, dependencies/lockfile checks, HTTPS and
no credentials in URLs/logs. Public OAuth clients using refresh tokens need a
replay-defense design such as rotation.
[OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html).

Logout clears/fences local data first, revokes the refresh session using the
provider, broadcasts logout, and redirects through managed `/logout` to clear
provider browser continuity. Provider failures leave the local session signed
out with safe retry guidance, not restored personal content.
[Cognito revocation](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html),
[managed logout](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html).

Initial credibility requires PKCE/state, server verification, explicit storage,
refresh rotation, reliable cleanup, bounded tokens and truthful logout. A BFF,
long-lived remember-me, custom auth screens, MFA/session-device dashboards,
federation and immediate per-token revocation are future hardening unless the
approved threat/UX requirements make them release gates.

## 12. JWT and claim-validation contract

Before assigning owner identity, the Cognito verifier must:

- Verify an RS256 signature with the configured pool's public key; reject `none`,
  HMAC substitution, unsupported algorithms, missing/invalid `kid`, and malformed JWTs.
- Pin `iss` exactly; require `token_use=access` and the configured `client_id`.
  An ID token is not accepted for API access. If resource-bound `aud` is enabled,
  validate that exact resource as well; do not substitute `aud` for `client_id`.
- Require a nonempty valid subject compatible with the UUID ownership contract,
  numeric non-boolean `exp`/`iat`, valid optional `nbf`, and sensible chronology.
  Reject expired tokens, excessive future issue times and malformed scope types.
- Require the agreed API scope when introduced; no group/custom claim may grant
  privileges without explicit server policy. Metadata cannot establish ownership.

AWS documents the access-token client/issuer/token-use distinction and signature
checks. These are validation requirements, not a license to decode and trust.
[AWS JWT validation](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html).

HireFlux-specific operational policy: allow at most 30 seconds configured clock
skew; include that in the advertised acceptance bound. Cache JWKS with bounded
freshness in warm processes; refresh once on unknown `kid`, single-flight and
rate-limit misses, retain known keys only under a documented freshness policy.
Use HTTPS to a derived allowlisted JWKS URL, timeouts and response-size bounds;
never follow token `jku`/`x5u`/arbitrary issuer URLs. Unknown keys and outages
without usable trusted keys fail closed. Inject clock/key provider for tests.

**Initial choice: FastAPI verifies both formats.** This preserves shared
`/api/v1/applications`, settings, interviews and export routes for demo and account
identities, local/test portability and the error envelope. An API Gateway HTTP
API route's native Cognito JWT authorizer would reject the demo's non-JWT
credential before FastAPI. Do not attach it to all shared routes or claim it
supports either credential. Edge throttling still applies without a JWT authorizer.

**Gateway-only** verification would require trusted integration context handling
and guaranteed absence of direct backend bypass; it also leaves local auth
behavior different. **Both** are useful if account-only route groups are later
justified, but duplicate key/claim configuration and may require separate paths
or a custom multi-format Lambda authorizer. Defer that complexity initially.
If a native JWT authorizer is added, require route scopes to distinguish access
tokens, align issuer/audience, and test resource-bound `aud` versus fallback
`client_id`. Gateway key caching and claims behavior differ from application
verification.
[AWS HTTP API authorizer contract](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html).

Offline checks cannot establish immediate revocation/disablement/deletion.
For ordinary access accept only the proposed short token lifetime plus skew,
with provider-backed hydration no longer valid than its token and immediate
HireFlux tombstone denial. Sensitive account changes/erasure require fresh online
provider validation and recent authentication. If instant rejection of all
stolen tokens is required, add online status checks or server sessions; do not
pretend Gateway or signature verification supplies it.

## 13. Persistent account lifecycle

The initial flow is managed signup → email confirmation → code/PKCE login →
trusted attribute/verification hydration → empty HireFlux bootstrap → first
workspace visit. Returning sessions refresh/hydrate without seeding or replacing
settings. Logout removes session access, not workspace data. Recovery and
password reset belong to Cognito; HireFlux provides entry/return/error guidance
and session cleanup. Passwords/codes never enter HireFlux DynamoDB or logs.

Responsibility and edge cases:

- **Cognito:** account uniqueness, password policy, confirmation/resend/code
  expiry, authentication challenges, recovery, provider sessions/tokens, account
  disablement and identity deletion. Configure verified email as the initial
  confirmation/recovery channel; no HireFlux password endpoint or email worker.
  [AWS signup/confirmation](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html),
  [recovery policy](https://docs.aws.amazon.com/cognito/latest/developerguide/managing-users-passwords.html).
- **HireFlux:** callbacks/session UI, verified workspace admission, profile
  projection, settings, account access gate, data retention/export/erasure, safe
  error handling, and retryable bootstrap. The browser reports intent only.
- **Abandoned unverified signup:** no workspace is created. Do not scan/delete
  DynamoDB to clean a user who never reached HireFlux. A later pool-retention
  operator policy can address abandoned identity records if needed.
- **Duplicate signup/already-used email:** provide safe continuation to sign-in
  or recovery. Do not link a new subject to an existing workspace by email.
  Enable existence-error suppression where applicable but acknowledge signup
  uniqueness and alias behavior can still reveal existence; managed UI must be
  tested. Do not claim the setting prevents every enumeration path.
  [AWS existence-error behavior](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html).
- **Expired verification/recovery challenge:** return to resend/recovery with
  bounded retry guidance, never self-confirm through a browser flag.
- **Changed email:** Cognito verification-before-update, then refresh projection;
  failed confirmation preserves current ownership/settings and provider authority.
- **Disabled/deleted provider user:** subsequent hydration/refresh fails. Already
  issued offline-verifiable credentials have the bounded acceptance described
  above. Disablement is not an erasure request.

## 14. First-login provisioning

Backend dashboard needs valid identity and settings; the profile is consumed by
`/me`/layout and export. Quotas/status/funnel counters are not preconditions:
`DynamoApplicationRepository.create` creates them transactionally on first write,
and counter reads supply zeros when absent. No onboarding record, fictional
application, interview, note, notification, schedule, or attachment is required.

Choose **explicit request-driven, idempotent bootstrap with lazy counters**.
A proposed authenticated `POST /api/v1/me/bootstrap` coordinates trusted metadata,
account access state, conditional profile creation and conditional default
settings. It returns the resulting profile/settings/capabilities and a bootstrap
schema version. An ordinary workspace-access dependency rejects uninitialized
persistent accounts with a safe bootstrap-required response; bootstrap itself
does not require prior readiness. Authentication and bootstrap failures remain
distinct so Cognito success plus a DynamoDB outage can be retried without
creating another account.

Do not copy the demo `PROVISIONING`/seed-cleanup workflow. For these small durable
records, each conditional ensure operation can safely resume after partial
success. Mark an account `ACTIVE`/bootstrap version complete only after required
records exist. Creation must never overwrite existing settings or reactivate a
`DELETING`/`DELETED` account. Concurrent callers read the conditional winner and
continue; existing metadata synchronization uses its own version/observation
ordering. A READY marker is not evidence that a settings read can never fail:
if a required record is missing, repair only defaults under an active account
gate, then return the recovered result.

Profile/settings race handling already exists in their adapters; atomic account
state checks must be added to bootstrap completion and future persistent writes.
Use a small account-state transaction condition for mutating paths so deletion
cannot race a preflight-only state check. The provider response is fetched and
verified before database provisioning, not within a long DynamoDB transaction.
No Cognito trigger or event bus is necessary for initial provisioning.

For time zone, a validated initial hint is a preference, never identity proof.
Set it only when initializing a new settings record; returning accounts keep
their stored zone. UTC remains the fallback. Defer product onboarding state
until a real onboarding flow exists.

## 15. Demo and durable workspace coexistence

Both identities use the same applications, notes, interviews, dashboard,
analytics, settings, status transitions, concurrency and owner isolation.
Centralize a small server-reported capability contract alongside session
hydration: demo reset, workspace deadline, full-account export, and available
account management. Do not add an entitlement engine. Frontend capabilities
choose presentation; server endpoints still enforce identity/type/state.

Demo shows fictional/temporary copy, deadline, reset and exit; reset creates a
new owner, rather than deleting a permanent workspace. Persistent shows durable
workspace copy, sign out, account/recovery management and export; no reset-to-
fiction button or data-lifetime countdown. Delete account is a separately
authorized destructive flow, not a renamed demo exit. Notifications remain
unavailable until delivery exists. Quotas remain server-owned for both types;
initially the same bounded limits are acceptable if clearly disclosed.

## 16. Demo → account transition

**No automatic migration.** Demo data is explicitly fictional, uses historical
seed timestamps, synthetic profile details and TTL, and may have been edited
arbitrarily. Importing it would pollute a real search, retain demo TTL on
auxiliary records, and complicate ownership/erasure. Registration creates an
empty durable workspace under a different owner. This is an instruction of this
phase, not an unresolved approval question.

Sequence for a deliberate conversion action:

1. Confirm any unsaved-form discard before beginning the intentional redirect.
2. Enter switching state and advance generation; unmount personal workspace
   consumers and stop new queries/mutations.
3. Cancel queries, clear query and mutation state, and fence all late completion
   callbacks/401s/exports from the old generation.
4. Remove demo credential and demo-specific tour, zone marker, preview preferences
   and UI state. Preserve only device theme/sidebar if desired.
5. Authenticate/verify the persistent session, validate callback state, then run
   empty bootstrap and obtain its server identity/capabilities.
6. Activate a fresh scoped client/state and navigate to Home or a safe return
   route. Old demo application IDs do not become new-account resources.

The demo's server data expires normally; there is no cross-owner copy, TTL
removal, or aliasing. Cancellation/failure leaves anonymous retry guidance or an
explicit new demo option; do not silently revive a credential already cleared
for account conversion. Future selective import would require a separate
verified, transactional migration design and explicit user intent.

## 17. Complete implemented DynamoDB persistence audit

Owner scope comes from identity, not from provider-specific key encodings.
For all ordinary implemented entities below, demo TTL is the workspace epoch;
durable TTL is **omitted**. There is no independent TTL per GSI entry: indexes
project the underlying item and eventually reflect its removal/update.

- **USER_PROFILE:** `USER#owner / PROFILE`; conditional creation by
  `DynamoUserRepository`, strong read on race, legacy demo-name update. Owner
  partition; TTL optional through `profile_to_item`. No ordinary delete API.
- **WORKSPACE_SETTINGS:** `USER#owner / SETTINGS`; lazy conditional creation,
  versioned replacement; strong GetItem. TTL optional through settings mapping.
  No ordinary delete API.
- **WORKSPACE_QUOTA:** `USER#owner / WORKSPACE_QUOTA`; created/incremented by
  application transaction; optional TTL assignment; bounds lifetime creations.
  No decrement on application archive, no standalone client mutation/delete.
  The primary key supplies scope; this item need not repeat owner as an attribute.
- **APPLICATION:** `USER#owner#APPLICATION#id / METADATA`; versioned transactional
  writes; owner GetItem, GSI1 recent non-archived and GSI2 every-status lists;
  GSI3 only outstanding active follow-ups. Archive/restore keeps the item and
  GSI2 discoverability. TTL optional and preserved during edits/transitions.
- **ACTIVITY:** same application partition, `ACTIVITY#instant#id`; transactionally
  appended by services; bounded owner/parent prefix Query with signed cursor.
  TTL taken from normalized identity on new events, optional serializer. Ordinary
  behavior never deletes/edits history; account erasure is a separate service.
- **NOTE:** same partition, `NOTE#id`; parent authorization, conditional/versioned
  create/edit/delete plus activity and resource quota. Optional identity TTL on
  create, preserved on edit. Prefix query and bounded recent preview. Notes can
  be physically deleted ordinarily; that does not delete their activity record.
- **INTERVIEW:** same partition, `INTERVIEW#id`; transactional create/update/status/
  preparation/debrief writes; parent authorization. Optional identity TTL on
  create, preserved on replace. GSI1 `USER#owner#INTERVIEWS` includes history;
  GSI3 `USER#owner#SCHEDULE` includes scheduled interviews only. There is no
  separate owner-interview projection entity: index keys live on the interview.
  Completion/cancellation retains history; no ordinary physical-delete route.
- **RESOURCE_QUOTA:** same partition, `RESOURCE_QUOTA`; transaction updates
  activity/note/interview bounds. `resource_quota_update` conditionally assigns
  optional TTL. Some paths inherit application/child TTL, note deletion inherits
  activity TTL. Notes decrement their count on removal; interviews/activity retain
  lifetime bounds. No direct client access or ordinary deletion.
- **WORKSPACE_CONTEXT:** same partition, `WORKSPACE_CONTEXT`; earliest scheduled
  interview/preparation projection created/replaced/deleted in interview
  transactions; GSI1 `USER#owner#OPPORTUNITY_CONTEXT`; TTL comes from the proposed
  interview. Deleted when no scheduled interview remains. This is a separate
  physical item and must be covered by TTL and account erasure tests.
- **Status counters:** `USER#owner / COUNTER#STATUS#status`; atomic create/transition
  increments/decrements; strongly consistent base counter prefix Query. TTL
  inherited from application only if present. They are not separate GSI records.
- **Funnel counter:** `USER#owner / COUNTER#FUNNEL`; atomic historical milestone
  increments, strong owner query; optional application TTL. Historical counters
  are not reset when a current status changes.
- **Demo lifecycle:** `USER#workspace / WORKSPACE`, entity `DEMO_WORKSPACE`;
  conditional reservation and state transactions, strong lookup. Expiration is
  required; no durable use. Failed cleanup retains the marker briefly.
- **Demo idempotency:** `DEMO_IDEMPOTENCY#sha256(key) / SESSION`; separate non-owner
  primary partition containing a generated workspace reference, created with
  reservation and updated with lifecycle state. Required demo/failure TTL; queried
  by opaque operation key, not by a client-selected owner. It grants replay access
  to the same demo token: treat the raw key as sensitive until expiry. No durable
  account linkage, session record, or export record exists here.
- **Export metadata:** no stored job/artifact entity today; CSV/JSON are generated
  synchronously. Application/account responses omit physical storage keys.
- **Attachments, notifications/reminders, durable sessions and account linkage:**
  documented future concepts, not implemented persistence. Do not count roadmap
  item shapes as audited live resources.

Primary evidence: `infrastructure/dynamodb/mapping.py`, `resource_mapping.py`,
`repositories.py` (quota/status/funnel updates), `resource_quota.py`,
`resource_repositories.py` (`_opportunity_context_write`),
`demo_workspace_repository.py`, `table_schema.py`, and service constructors in
`application/services.py`/`resource_services.py`. The guarded local
`reconciliation.py` rebuilds projections/counters from canonical resources and
also supports missing TTL; it is not a production migration/erasure API.

No ordinary path inspected requires an expiry for every owner. The deliberate
exceptions are demo session/lifecycle models. **A fresh durable owner works
without TTL; reusing a demo owner does not safely convert it.** Update expressions
that omit TTL do not REMOVE a previously stored TTL. Replacements can preserve
it on canonical records, while new activity uses identity TTL. That is another
reason to forbid in-place demo conversion and verify parent/profile lifetime
consistency before introducing durable identities.

## 18. Lifetime invariants and persistence tests

- Demo identity has a verified future workspace deadline; every temporary
  domain, quota, counter, context, lifecycle and idempotency item receives its
  intended TTL. Token expiry denies access immediately, regardless of cleanup.
- Durable/local identity has no data expiration; every ordinary item written
  from it omits numeric `expires_at`, including helper updates and projections.
- JWT `exp`, refresh-token expiry, authentication failure, sign out, and browser
  closure never add TTL, archive, decrement counters, or delete durable resources.
- Child/projection lifetime matches canonical owner/application lifetime;
  transitions and reflection updates preserve it. Reject conflicting owner/kind
  admission; do not attempt to repair lifetime by clearing TTL opportunistically.
- Account erasure uses explicit, resumable owner-scoped deletion. Account access
  tombstones and deletion recovery metadata must not accidentally expire and
  allow workspace recreation. Future export/session artifacts may have their
  own cleanup deadlines, never shared with ordinary workspace domain data.

Phase 2 must inspect actual serialized items after create/edit/transition/
archive/restore/note delete/interview scheduling/preparation/status changes for
both kinds. A test merely asserting `identity.expires_at is None` is insufficient.
Include status/funnel counters, both quotas and context, not just METADATA.

## 19. Authorization and role findings

Inspected `api/routes/applications.py`, `workspace_resources.py`, `settings.py`,
`insights.py`, `pipeline.py`, `me.py`, their services/ports and adapter queries.
All current owner-sensitive routes obtain `IdentityDependency`; public exceptions
are health and demo creation. Route UUIDs identify resources, never owners.
`RequestModel` forbids extra body fields; domain services whitelist mutable
fields. `ApplicationService.get` and resource parent checks address the owner
partition; notes/interviews must first belong to an owned parent. Guessing a
foreign ID yields the same missing-resource behavior, without an admin bypass.
Dashboard/analytics/quotas and export all derive owner from identity. Cursor
signatures bind owner fingerprint, kind and query/parent scope; index partitions
are rebuilt from trusted identity. No request-path Scan was found.

No current cross-owner access gap was identified in the inspected paths.
This is evidence for retaining the design, not a guarantee about future account
endpoints. GSI results are eventually consistent; that is a correctness/erasure
enumeration concern, not permission to query another owner's partition.
Existing tests cover foreign/missing application, notes/interviews, forbidden
ownership fields, cursor scope/tamper and bounded exports.

`UserRole` defines STANDARD_USER/ADMIN, but no administrative service or role
gate grants an owner bypass. Initial accounts need ordinary candidate access
only. Assign STANDARD_USER in normalization. Do not build Cognito groups or a
HireFlux editable role field now. If administration later becomes required,
choose one authoritative role source (a narrowly mapped verified group or a
server-controlled authorization record), implement a separate guarded service,
and define change/revocation latency. The stored profile must remain a projection
and browser inputs must never grant role. This recommendation revises the
future Cognito-group assumption in `docs/domain-model.md`, not live policy.

## 20. Account erasure and export readiness

Distinguish operations precisely: sign out ends a session; disable blocks
authentication/account access; delete workspace data erases domain records;
delete account erases workspace and provider identity under a tracked lifecycle.
Ordinary application DELETE continues to archive. Account erasure is a new,
separately authorized exception to ordinary append-only history preservation.

### Erasure

Current demo cleanup is best effort, not a complete durable erasure mechanism.
Applications occupy many primary partitions. `Query PK=USER#owner` cannot find
those partitions; GSI2 can discover all statuses including archive, but is
eventually consistent. `demo_workspace_repository.cleanup` supplements GSI
enumeration with known created IDs, may leave failed batches, retains lifecycle,
and depends on TTL as fallback. Do not present it as Delete my account.

Recommend one small additive owner application manifest:
`USER#owner / APPLICATION_REF#id`, created atomically with every persistent
application and retained on archive. Strong owner-prefix Query then enumerates
application partitions without a Scan/new GSI. This resolves a real erasure
access-pattern gap, not hypothetical general search needs. Add it before real
persistent writes; demo support may carry demo TTL if the same transaction
builder is reused. Backfill only deliberately retained old durable/local test
workspaces; disposable demos need not be migrated into accounts.

At this scale choose a synchronous **bounded batch attempt with durable resume
state**, not a guarantee that one HTTP call erases up to all configured maxima.
An account can accumulate thousands of items across partitions. First validate
recent authentication online and freeze the account (`DELETING`). Persistent
mutations must transactionally check ACTIVE to prevent in-flight creation after
freeze. Deny bootstrap, normal reads and exports while deleting; keep a narrow
authenticated status/retry path.

Query manifest strongly, query each application partition, delete children,
metadata/context/quotas and then its manifest reference only after the partition
is confirmed empty. Handle unprocessed BatchWrite entries with bounded backoff;
store progress safely and return in-progress if the time/item budget runs out.
Delete owner settings/profile/counters/quota after application erasure; preserve
minimal deletion/tombstone state. Recheck residual manifest/owner records before
claiming workspace completion. Deleting canonical records removes GSI entries
eventually; indexes are not independent objects to delete.

Delete Cognito identity **last**, after workspace erasure is complete, so a
provider deletion failure can be retried while the subject still authenticates
only to deletion recovery. If provider identity disappears earlier/outside the
flow, use a separately authorized operator procedure with the stored deletion
state; never allow email-based self-reclaim. Duplicate delete requests see the
same progress; a failed attempt never reactivates or lazily reseeds the workspace.
A deleted-account tombstone rejects still-live old tokens until they cannot be
accepted; initial permanent minimal tombstone retention avoids unsafe bootstrap.

No queue/worker is required now. If browser-independent completion, measured
maximum duration or future attachments/reminders require it, add a job/worker
as a distinct later capability. Future erasure must remove private S3 objects,
export artifacts, notification records and schedules before deleting the final
account reference. Backup retention/restore must document how deletion
tombstones are reapplied; do not promise immediate erasure from historical backups.

### Export

`WorkspaceExportService.export` already rejects demos (403), queries only the
owner, collects profile/settings/all statuses/activities/notes/interviews, and
returns `export_version=1` plus counts. CSV is safe for both kinds, includes
archived applications, escapes CSV text and neutralizes formula prefixes. Routes
set `no-store`; there are no persistent export artifacts, tokens or password data
in either export. Durable profile projection becomes real PII.

Keep the synchronous endpoints at initial bounded scale, but do not equate
`max_sync_export_records=5000` with a byte/time limit: large descriptions/notes
can produce an oversized Lambda/API response, and child pages are collected
before the cumulative count is checked. Add incremental count/serialized-byte/
duration budgets and safe too-large guidance before public account release.
Neither export is a transactional point-in-time snapshot; application discovery
uses eventual GSI reads, then child reads occur over time. Describe it as a
best-effort current copy, or use the strong manifest for complete discovery and
explicit snapshot expectations. Do not claim it includes Cognito MFA/security
events or future attachments that are not represented.

Future larger jobs read bounded pages, write a private expiring S3 artifact and
authorize job/download access by owner, with short-lived links and cancellation
on account deletion. No such system is implemented in Phase 1. Export cannot
run concurrently with account erasure; do not retain artifacts after deleting
the source account. Ordinary resource export needs current auth; account deletion
and security changes additionally need recent authentication.

## 21. Focused threat findings

The transition raises the consequence of existing issues from disposable fiction
to a private job-search history. The following controls address concrete paths.

- **Token theft/replay:** demo token and future tab refresh token are readable by
  JavaScript; PKCE does not protect tokens after an XSS compromise. Strict hosted
  script CSP and text rendering reduce injection exposure; short access lifetime,
  refresh rotation and logout cleanup bound persistence. Never put credentials
  in URL query strings, telemetry or error details. Stolen tokens may still be
  used within the bounded acceptance window; immediate revocation is a distinct
  architecture requirement.
- **Forged credentials/auth bypass:** the current codec verifies HMAC and expiry;
  Cognito must verify signature and pinned claims. Current Cognito requests fail
  closed at dependency time, but there is no startup validation of pool/client.
  Add it, preserve local runtime guards, and reject verifier fallback.
- **Account enumeration/recovery:** managed authentication reduces HireFlux's
  challenge implementation surface; configure existence-error behavior and test
  actual signup/recovery response distinctions. Do not expose provider exceptions
  or implement email-based workspace linking.
- **Cross-identity browser leakage:** unscoped query keys, `keepPreviousData`,
  delayed mutation cache writes, old 401s, account preview storage and tour state
  require generation fencing and centralized cleanup. Reset currently cancels
  queries and hides content; start/exit/expiry mainly clear. Extend the invariant
  to all switch paths and writes, with explicit adversarial timing tests.
- **IDOR/cursor replay:** owner-qualified primary/GSI keys and signed scoped
  cursors are strong existing controls. Keep foreign children and parent reads
  at 404. New account/bootstrap/delete/export-job routes must use the same
  server-derived owner and their own capability/state checks.
- **Accidental persistent deletion:** populating identity TTL from token expiry,
  reuse of demo IDs, or auto-repair of stale TTL would destroy durable data.
  Encode kind/lifetime invariants and assert every serialized helper item.
- **PII leakage through responses/logs:** safe error handlers drop raw AWS errors,
  exception content and validation input values. Future gateway/access/ASGI logs
  need scrutiny: URL queries can contain company searches and cursors. Log route
  templates rather than full request URLs; never enable request/response bodies
  or Authorization logging for diagnosis.
- **Excessive payload/cost:** schemas bound individual prose/arrays and quotas
  bound growth; parsing still has no application-wide request byte limit in the
  inspected code. Define a body limit appropriate to actual forms and reject
  oversize requests early. Bounded record export alone does not bound memory,
  serialized bytes or Lambda execution time.
- **CORS/redirect/environment mistakes:** current allowlist is a good seam;
  deployed origin validation should additionally require exact HTTPS origins,
  no embedded credentials/wildcards. Separate pool/table/API/CSP/callback values
  across staging/production. CORS is not authentication, and copying `user_id`
  from browser state is never acceptable.
- **Erasure race:** preflight ACTIVE checks alone do not prevent a concurrently
  accepted write after freeze. Transactional account-state conditions, strong
  manifests and resumable batches are required for an erasure completion claim.
- **Infrastructure exposure:** API execution role must access only its own
  table/indexes and required secret configuration. No browser DynamoDB credentials,
  public data bucket, deployed local endpoint, Lambda public URL bypass, or
  broad Cognito admin role is needed for the proposed initial flow.

## 22. Privacy and PII hygiene

Applications contain employer/role/location, compensation context, private
description and job-search outcomes; notes, next-step prose, interview meeting
URLs, questions, preparation and reflections are private content. Email/name
become identity PII. Meeting links can contain reusable join secrets. Exports
contain that content and must be treated as personal downloads, not test artifacts.

`api/error_handlers.unexpected_exception_handler` currently logs only a generic
event, request ID and exception type without stack trace. Validation details
exclude raw inputs. Searches found no production browser tracking integration
or server content-logging framework; product Analytics is owner-specific domain
analysis, not third-party behavioral telemetry. Existing seed/test/browser
fixtures use synthetic identities and sample content. Preserve that boundary.

Do not capture real-account browser screenshots/traces in committed Playwright
snapshots, seed fixtures, CI artifacts or support messages. Staging uses synthetic
workspaces/test email accounts only. Developer tools and routine CloudWatch logs
must exclude tokens, email/name, form bodies, export contents, meeting URLs,
passwords/codes and provider responses. Prefer field/error categories and counts,
not rejected values. Device storage retains only permitted credentials and
non-sensitive preferences; do not add job-search drafts or query persistence
without a privacy design. No legal/compliance program is proposed here.

## 23. Observability and auditability

Request-ID middleware already validates a supplied ID against a safe 64-character
pattern and returns `X-Request-ID`. Unexpected errors use safe categories.
It does not currently provide a complete request latency/metric pipeline.

Before staging add structured events with request ID, route template, method,
status, duration, environment, identity kind, and safe auth/provisioning failure
category. A stable environment-specific pseudonymous owner identifier is useful
for correlated failures; hash/HMAC it deliberately, restrict access/retention,
and recognize that pseudonyms remain sensitive operational data. Do not use raw
owner IDs as high-cardinality metric dimensions. Prefer metrics for auth failures,
bootstrap failures, conditional conflicts, throttling, DynamoDB errors,
Lambda duration/error/concurrency, and export-too-large events. Separate normal
optimistic 409 conflicts from persistence 503 failures.

Application activity remains the owner's append-only workflow history; it is
not operational logging or an authentication audit trail. Record safe lifecycle
operation state for deletion and bootstrap recovery separately. Do not log
signup forms, full JWT claims, recovery codes, changed emails or note/reflection
content as security events. Provider audit sources, alarm routing, retention
and diagnostic access belong in the later infrastructure/release plan.

## 24. Abuse, quota and cost boundaries

**Before public staging:** protect public demo creation and API request volume
with HTTP API throttles, bounded Lambda concurrency/timeouts, table limits and
alerts; preserve demo idempotency and resource quotas. Use a restricted preview
origin/access policy when possible. Pool signup/verification/recovery limits and
safe retry handling must be tested; do not build a second HireFlux email system.
Demo creation seeds many transactional writes, so a public button has greater
cost than one request. Warm JWKS miss storms also need bounded refresh behavior.

**Before public production:** decide and disclose durable workspace lifetime
quotas, export frequency/size limits and support behavior when full. Defaults
currently permit 100 lifetime applications, 100 notes/application, 25 interviews
and 500 activity entries/application. Archive does not free application capacity;
there is no activity reset. Raising limits affects dashboard/list/export memory
and query cost, not just one validation check. Validate worst-case configured
bounds, ensure signup/recovery throttling monitoring, deletion retry budgets,
finite logs and spend alarms. Budget alarms are alerts, not spending caps.

**Safely deferred:** WAF/CAPTCHA unless observed abuse warrants it; paid tiers,
entitlements, scalable asynchronous export workers, attachment storage quotas,
reminder/email delivery limits until those features exist. Before introducing
attachments or reminders, add size/ownership/content/cleanup and per-user send
controls in that feature's release gate. Do not add Redis/queues for hypothetical
cost problems.

## 25. Configuration and secrets

Current `Settings` has local/demo/cognito modes but no pool/client/issuer/OAuth
configuration. It validates signing-key length/local prefix, configured local
endpoint, CORS, docs exposure and selected runtime guards. `app_factory.py`
constructs the demo codec/service even when auth mode is not demo; current demo
key validation runs only in DEMO mode. A combined mode must validate the demo
key whenever demo creation or verification is enabled.

Configuration classes for future work:

- **Secret, backend only:** demo signing key, cursor signing key, any future
  server session encryption/HMAC secret, and any confidential-client secret if
  a BFF is chosen. No client secret is needed for the recommended SPA client.
  Passwords, tokens, recovery codes and real AWS credentials are secrets/data,
  not checked-in environment configuration.
- **Public browser environment configuration:** API/site origin, Cognito region,
  pool ID, public app-client ID, managed-login domain, callback/logout URLs and
  scopes. Client ID identifies a public client; it is not a password. Each
  `VITE_*` value is compiled into downloadable assets. Use visibly fake examples.
- **Server-only non-secret configuration:** pinned issuer/client/region and JWKS
  derivation, table name, enabled verifier capabilities, token skew/size policy,
  allowed API scopes, quotas, CORS, logs and export/body limits. Some identifiers
  are also public, but the backend's independently configured trust settings are
  authoritative; it must never load them from browser payloads.

Preserve fail-closed startup. Invalid enabled Cognito config, missing deployed
secrets, local signing defaults or incompatible origins must prevent startup.
In deployed environments require HTTPS browser/API/provider URLs. Test
configuration isolation and reject local/test identity fixtures under AWS markers.
The current DynamoDB client omits endpoint and explicit credentials when no
local endpoint exists; deployed Settings should also explicitly reject supplied
local credential-shaped settings. Boto3's ambient credential resolution still
needs an IAM-role-only deployment environment; Lambda platform role credentials
are distinct from committed/user-provided keys.

`.env.example` remains unchanged in Phase 1, because none of these values is live.
Future additions must not make Cognito a hidden dependency of the local demo.
Update `frontend/src/securityHeaders.ts`, `customHttp.template.yml` and hosted
header rendering together: OAuth token/userInfo/revocation fetches introduce
provider connect origins beyond the existing exact API allowlist. Allow only
the exact required HTTPS origins, not a broad AWS wildcard or unsafe scripts.
Callback routes also require SPA rewriting without hiding missing static assets.

## 26. Local development strategy

Continue ordinary development with demo auth and the existing fixed local
identity. The fixed identity is already non-expiring and non-demo; extend its
bootstrap/profile semantics rather than requiring live AWS. Backend tests can
inject a verifier/principal and provider-attribute fixture through app composition
or dependency overrides, with fixtures impossible to enable in deployed config.
Frontend tests use deterministic anonymous/demo/durable session adapters and
MSW HTTP contracts. These fixtures must exercise real services/serializers and
must never be selected by a browser header in a deployed API.

Locally verify JWT cryptography against generated test RSA keys and simulated
JWKS/provider responses, including rotation and failures. Moto remains the
DynamoDB integration boundary; Docker is optional for tests. No live Cognito
signup, SES, AWS admin credentials or table creation at API startup is needed.

Staging alone validates actual managed-login callback/cookie behavior, signup
email and confirmation/recovery delivery, real OAuth refresh/rotation/revocation,
disabled/deleted accounts against provider endpoints, HTTP API/Lambda payloads,
CORS/security headers, real GSI lag/TTL cleanup, IAM and deployed resource limits.
Local mocks can validate decisions and failure handling, not those services'
real operational behavior.

## 27. Implementation test matrix

The current suites supply a baseline, not Cognito/account coverage. Extend
existing tests instead of replacing them with provider-dependent smoke tests.

- **Unit — identity:** signature/RS256 allowlist, wrong issuer/client/token_use,
  ID-token rejection, scopes, malformed subject/timestamps/claims, future time,
  skew boundaries, unknown/rotated keys, bounded JWKS outage/misses, no verifier
  fallback; normalized kind/lifetime and strict userInfo boolean/subject handling.
  Extend `backend/tests/unit/test_config.py` and add verifier tests beside
  `test_demo_session_codec.py`; keep generated keys and clocks deterministic.
- **Unit — account:** bootstrap decisions, active/deleting/deleted admission,
  trusted profile projection synchronization and last-seen semantics; no seed
  or token-expiry-to-data mapping. Existing domain matrix, milestone/time-zone
  and export-formula tests remain unchanged.
- **Moto/API — persistence:** two durable owners and two demos; missing/foreign
  equivalence across all routes; body ownership rejection; cursor owner/parent/
  filter scope; complete serialized TTL/no-TTL inventory; transaction rollback
  when quotas, account-state condition or projection fails; bootstrap races,
  partial profile/settings recovery, empty dashboard/analytics and limits.
  Extend `test_api_flow.py`, `test_workspace_resources.py`, `test_demo_sessions.py`
  and `test_insights.py`. Add strong manifest enumeration and erasure/retry tests
  when those contracts are implemented.
- **Frontend — session:** initializing/anonymous/demo/durable/error/expired;
  refresh and storage failures; deep links/callback state; logout; failed reset;
  generation fencing for delayed query, mutation, download and old 401; cache/
  tour/preview/manual-zone clearing; device preference preservation; no prior
  identity placeholder; returning settings not overwritten; unsaved discard and
  forced expiry focus/routing. Extend `DemoSessionFlow.test.tsx`, `client.test.ts`,
  `AppLayout.test.tsx` and `WorkspaceFeatures.test.tsx` with durable fixtures.
- **E2E local:** real demo remains intact; deterministic durable identity exercises
  empty-first-visit → create → interview/note → refresh → logout → return. Include
  account A → B and demo → account with deferred responses and multi-tab cleanup.
  Current Playwright `e2e/fixtures.ts` injects a demo-shaped stored session and
  mocks API calls, so it does not validate real authentication/DynamoDB wiring.
  Add a distinct full local API path and retain useful mocked layout coverage.
- **AWS staging:** actual signup/resend/expired code/verification/duplicate email,
  login/recovery failure/reset, token/refresh rotation and lost response,
  logout/provider continuity, disabled/deleted user and stale-token bound,
  bootstrap outage recovery, environment issuer/table separation, direct route
  refresh/missing assets/CSP/CORS, Lambda packaging/JWKS cold start and quotas.
  If a Gateway authorizer is later selected, test both its rejection cases and
  intentional demo route compatibility; otherwise verify FastAPI shared-route auth.

All account behavior changes must run the full affected checks from `AGENTS.md`.
Do not claim a mock proves delivery, managed browser cookies, IAM, JWT-authorizer
payload mapping, DynamoDB eventual deletion, or maximum deployed response size.

## 28. First-login failure and recovery matrix

Each case states durable recovery; no manual database repair is the normal path.

- **Cognito account exists, profile absent:** verified hydration plus bootstrap
  conditionally creates an empty profile/settings/account record; no seed.
- **Profile exists, settings absent:** active bootstrap creates defaults only,
  preserves profile creation time, and returns authoritative resulting settings.
- **Settings exist, profile absent:** ensure missing profile from trusted metadata;
  preserve user's settings and validate lifetime/provider compatibility.
- **Duplicate/retried bootstrap:** conditional ensures return the same owner and
  winner records; do not update settings/version as a side effect of retry.
- **Two tabs bootstrap concurrently:** unique owner partition and conditional
  creation select one record; losing requests strongly read/retry completion.
  Conflicting preference hints cannot overwrite the winner.
- **Provider login succeeds, bootstrap database call fails:** browser holds an
  authenticated but not workspace-ready state; show safe retry and request ID.
  Retry same owner; do not sign up again or create a demo fallback.
- **Network fails after server success:** repeating bootstrap reads completed
  state; never repeat seed or replace resource ownership.
- **Account marker incomplete after profile/settings success:** validate existing
  records and conditionally finish schema version/ACTIVE transition. No cleanup
  deleting a durable partial account.
- **Account marked ready, required record missing:** under active state, repair
  the missing default/metadata projection; surface unavailable errors honestly.
  Do not guess user's previously customized missing settings.
- **Browser thinks onboarding incomplete but workspace exists:** server bootstrap
  readiness wins; frontend dismissal/tour state does not cause reprovisioning.
- **Metadata refresh delayed/out of order:** newer server observation/version wins;
  stale tab cannot roll name/email/verification projection backward.
- **Provider unavailable/attributes invalid:** deny hydration with retryable
  provider failure or safe invalid-auth category; no fabricated verified profile.
  Ordinary cached validation is usable only within its previously verified token
  lifetime, never renewed by an outage.
- **Deleting/deleted account receives bootstrap:** deny ordinary recreation and
  expose only the authorized deletion-status/retry path. Missing profile is not
  proof of a new user if a tombstone exists.

For the proposed server attribute-validation snapshot, use a bounded in-memory
cache keyed by token digest and principal, never raw tokens in logs/persistence.
Expire it no later than the access token; a Lambda cold start/cache miss performs
the online check again. This makes a cached verified-email result usable without
adding token-expiry TTL to durable domain records or trusting client metadata.

## 29. AWS target architecture and orphan behavior

Retain Amplify static hosting → API Gateway HTTP API → one Lambda with
FastAPI/Mangum → one on-demand DynamoDB table per environment, plus Cognito User
Pool and CloudWatch. The repository includes Mangum as a dependency but inspected
`main.py` currently exports the ASGI `app`, not a `Mangum` Lambda handler. Packaging/
handler wiring is future work, not an already-deployed integration. Keep Python
3.13/3.14 support and choose the deployed runtime after verifying its current AWS
support; Python 3.14 is listed by AWS at this audit date.
[Lambda runtime reference](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html).

No VPC/private-subnet compute/NAT is required for the API to use DynamoDB/Cognito.
No EC2/ECS/RDS/Redis/OpenSearch, worker, queue, or event bus is justified by initial
identity/provisioning. Amplify hosting does not require using Amplify to provision
an independent second authentication backend. API execution uses its role;
browser authentication requires no Cognito Identity Pool or direct AWS credentials.

Realistic divergences and initial response:

- **Provider deleted externally, workspace remains:** inaccessible orphan after
  the bounded token window; durable data does not acquire TTL. Use an explicit
  audited operator cleanup/recovery process tied to proven subject provenance.
  Never reconnect by matching email. Avoid routine console deletion by access
  controls and documented procedures.
- **Provider disabled:** auth renewal/hydration rejects; keep workspace for possible
  re-enable. Operators needing immediate HireFlux denial also set its account
  access gate. No content deletion is implied.
- **Profile without provider:** fixed local/test is legitimate; otherwise preserve
  orphan state for operator resolution. Do not create provider users from a
  stale DynamoDB email automatically.
- **Partial deletion:** DELETING state plus retained progress permits bounded
  retries; provider deletion occurs after data completion. Failure is observable
  without logging personal content.
- **Profile/email/name mismatch:** synchronize from trusted provider observation;
  account-role/access decisions do not consult old display projections.
- **Pool disaster/recreation:** retained table does not establish replacement
  identity ownership; controlled migration is required. Protect and separately
  document recovery of pool and table. Direct sub mapping makes this dependency
  explicit rather than claiming portable identities.

Do not add an orphan-cleanup Scan to ordinary request paths or require event-driven
identity synchronization. Later operational reconciliation can be a separate
guarded access path if measured need warrants it.

## 30. CDK readiness and environment boundaries

TypeScript CDK remains appropriate: the frontend already uses TypeScript, target
AWS resources are small, and deterministic synth/assertion tests can precede
deployment. No CDK source/stack is added now.

Start with a reusable construct set and **one environment stack for each staging
and production**. Constructs group user pool/public client/domain, DynamoDB,
API/Lambda, secrets references and monitoring; hosting integration/environment
outputs may be configuration or a small construct. Do not create one stack per
resource. Split retained state from replaceable execution later only if a clear
deployment lifecycle makes it safer; protect stateful resources from accidental
replacement regardless of stack count.

Each deployed environment has distinct pool/client/domain, table, API/Lambda,
demo/cursor secret values, log groups, alarms, callback/logout allowlists and
hosting environment. Local is a separate Compose/runtime configuration, not a
CDK-managed AWS pool. Separate AWS accounts are desirable when available, but
unique resource identities and scoped roles are still required. No mutable data
or signing secrets are shared between staging and production.

**Configuration:** environment name/region, origins, quotas, token lifetimes,
retention/concurrency budgets. **Outputs:** API origin, region, pool/public-client
ID, managed-login domain and frontend public settings. **Secrets:** signing keys
through secret references/secure deployment configuration; no secret-valued
CloudFormation output or Vite setting. **Shared constructs:** implementation,
not shared tables/pools/secrets.

Ordering: settle stable frontend callback/logout origins → create retained
pool/client/table and secret references → package/deploy API with exact trust/
table/origin settings → publish frontend with matching public outputs and
rendered CSP/rewrite policy → staging smoke tests → protected production promotion.
If hosting origin is not known until creation, provision hosting identity first
and configure the pool/client before releasing auth UI. No table initialization
from app startup and no local reset script used as a deployment migration.

CDK assertions should check separate names/outputs, no client secret for SPA,
verification and rotation configuration, least-privilege IAM, TTL attribute,
deletion protection/removal/backup policies, explicit origins, docs exposure,
concurrency/throttles, finite log retention and no accidental NAT/VPC resources.
Review Cognito immutable settings/replacement diffs before any deploy.

## 31. Schema evolution and backwards compatibility

**Persistence alone requires no table/index migration:** optional TTL and current
owner keys already support durable local identities. Cognito access integration
needs additive application contracts, not table replacement.

Recommended additive evolution for complete account readiness:

- profile provenance/schema version and explicit synchronization/last-seen fields,
  with legacy name/email/role/time defaults readable;
- an owner account-state/bootstrap record with no domain TTL;
- a small `APPLICATION_REF#id` manifest entity for strong erasure discovery,
  atomically written with future persistent applications;
- optional persistent settings initialization metadata if needed to fix returning
  time-zone behavior; no extra onboarding system by default.

No account linkage record is required under direct sub mapping. No new GSI is
required for these owner-prefix access patterns. New attribute readers must
handle existing demo/local items; only the verified demo adapter may classify
legacy demo identities. Do not infer authority solely from a browser-stored
session, profile name/email, or missing TTL. Existing signed demo token format
can remain valid for its issued lifetime. If reconfigured signing keys rotate,
declare demo-session invalidation behavior explicitly.

Backwards gates: one-click demo without signup; complete fictional seed;
signature/tamper/expiry handling; TTL on all temporary items; reset to a new
isolated owner with recoverable failure; exit/cache clearing; protected routes;
foreign-resource 404; full-export demo rejection and sample CSV; unchanged
status matrix, archive/restore, milestones and server-owned metrics. Do not reset
the local table merely to add attributes/entities. Manifest backfill for retained
durable fixtures must be explicit and owner-scoped, with current schema version
checked before erasure claims.

## 32. Product surface implications

`SettingsPage.tsx` currently contains three distinct classes of control:

- **Real:** API-backed time zone, follow-up days, application view, dashboard range
  and theme; CSV download; profile read; JSON-export API is real for non-demo
  identities even though the normal browser session is demo-only.
- **Demo simulations:** profile-name override is component-local; notification
  toggles use `hireflux-account-preview.v1` in sessionStorage with a token-derived
  marker; recovery/MFA/session controls only manipulate preview state. They do
  not create recovery challenges, MFA enrollment, revoke provider tokens or
  deliver notifications. They are correctly labeled as previews today.
- **Future-facing copy/placeholders:** persistent login, connected providers,
  account conversion, permanent deletion, real notification delivery, security
  events and session management. None should become operational merely because
  the guard accepts a durable identity.

Persistent settings must remove/hide demo simulation controls or replace them
with real provider-backed actions. Display trusted projected name/email and
truthful verification state; recovery/verification can link to the selected
managed flow. Add Create account/Sign in entry and auth callback/error routes,
sign out, verified bootstrap feedback, durable empty workspace guidance, and
deletion/export status. Defer detailed signup-page design when managed login is
selected. No production MFA/device list is promised initially.

Settings' future “What would carry over?” copy currently suggests possible
account conversion; replace that future promise with an explicit empty-account
initial flow when implementing coexistence. `AppLayout` must not label all
sessions temporary or show reset/expiry for accounts. Preserve focus management,
44-pixel controls, loading/error/retry/empty states and accessible unsaved forms.

## 33. Documentation impacts

No broad rewrite is needed in Phase 1. On implementation, update these exact
contracts and clearly separate current from planned behavior:

- `ARCHITECTURE.md`: combined verifier/credential flow, data versus token lifetime,
  bootstrap/account-state/manifest access, chosen browser storage and actual AWS
  resources only after deployment. Preserve modular-monolith target.
- `README.md`: keep frictionless demo; introduce real account availability only
  when ready; remove simulation implications from the durable path and explain
  no seed migration. Do not claim AWS deployed from a synth-only phase.
- `docs/roadmap.md`: persistent accounts are now an intentional milestone;
  use this bounded sequence and remove unneeded initial role-claim requirement.
  Existing `.github/workflows/quality.yml` already supplies tests/build/supply-
  chain gates; future AWS OIDC deployment automation is additional work.
- `docs/deployment-environments.md`: separate pools/callbacks/public settings,
  shared-route FastAPI verification, cookie/BFF deferral, CSP provider origins,
  retention/backups/deletion and measured export budgets. Its future HttpOnly
  language currently suggests an architecture not chosen here.
- `docs/domain-model.md`: identity kind/data lifetime, source-of-truth projections,
  standard-only initial role policy, correct last-login semantics and account
  lifecycle. Cognito role claims are currently future text, not implemented auth.
- `docs/dynamodb-access-patterns.md`: account record/manifest queries and erasure;
  mark attachments/notifications clearly unimplemented; retain GSI1/2/3, no scans.
- `docs/data-export.md`: durable PII coverage, synchronization metadata, byte/time
  limits and non-snapshot behavior; async system remains deferred.
- `docs/adr/0002-local-auth-and-cognito.md` and `0004-isolated-recruiter-demo-sessions.md`:
  retain historical decisions; add a new accepted coexistence/session ADR after
  review rather than rewrite history. Explicitly preserve local guards and demos.
- `.env.example` and `AGENTS.md`: new capability/config validation, local fixtures,
  schema commands and account gates only when real; examples stay fake.
- `docs/status-transitions.md`: no policy change is needed for identity work.
  `Diagrams/` are historical design artifacts; preserve them and link to the
  canonical current overview rather than silently redraw/remove them.

## 34. Bounded implementation roadmap

### Phase 1 — this audit

**Objective:** verify seams, lifecycle/security gaps and smallest target.
**Prerequisites:** current repository inspected. **Files:** this document only.
**Validation:** evidence references, targeted baseline tests where runnable,
document/diff checks. **Non-goals:** behavior changes, Cognito, CDK or AWS.
**Acceptance gate:** user reviews architectural tradeoffs in section 35; no
later-phase work starts in this request.

### Phase 2 — identity-neutral local durable semantics

**Objective:** establish kind/lifetime, profile/attribute and account bootstrap
contracts, general frontend session boundary and local durable fixtures.
**Prerequisite:** approved ownership/session direction. **Likely modules:**
`domain/models.py`, `auth/`, `api/dependencies.py`, `app_factory.py`,
`config.py`, `application/services.py`/new bootstrap/account service and ports,
`infrastructure/dynamodb/*`, `api/routes/me.py`, schemas;
`frontend/src/auth/*`, `api/client.ts`, `app/router.tsx`, `main.tsx`, layout,
settings and query hooks. Add account/manifest contracts after the first narrow
slice; enforce state conditions before durable public writes.
**Tests:** local durable/demo TTL inventory, empty bootstrap/races/failure,
ownership/concurrency/transaction rollback, session generation fencing, durable
refresh fixtures, time-zone preservation and demo regression; full cross-stack
checks plus meaningful browser QA.
**Non-goals:** live provider signup, AWS dependencies/deployment, CDK, migration
of seed data, admin/MFA/email/attachments.
**Gate:** synthetic durable workspace survives credential expiry/refresh/logout;
demo remains unchanged; account-state/strong enumeration contracts are testable;
both paths share core workflow and no cross-identity data flash occurs.

### Phase 3 — CDK definitions and integration contracts, synth only

**Objective:** codify separate environments, resource protection and outputs;
define provider trust/client contract before deployment.
**Prerequisite:** Phase 2 normalized session/data/config contracts.
**Likely files:** proposed `infra/` TypeScript CDK package/tests, configuration
examples, environment/architecture docs; Lambda handler/packaging definition and
hosting-header/callback contract. Choose verification library after current
primary-doc/dependency review; no live AWS-dependent tests.
**Tests:** synth/assertions, IAM/resource/retention isolation, packaging import
smoke, env validation and secret-output checks.
**Non-goals:** deploy, resource creation, real-account signup, queues/workers.
**Gate:** reviewed synth produces only intended resources, separate state and
public outputs, no secret/client-local bypass; durable resources protected.

### Phase 4 — AWS staging and real Cognito integration

**Objective:** implement real verifier/provider adapter and managed OAuth session
against isolated staging, reusing Phase 2 contracts.
**Prerequisites:** approved synth/deployment and trust/session choices, stable
callback origins, secrets/roles, staging test identities. Deployment requires
separate authorization; this audit authorizes none.
**Likely modules:** Cognito verifier/JWKS and attribute adapter, auth composition,
frontend OAuth adapter/callbacks/account capability surfaces, Lambda/Mangum
handler, CDK configuration and staging smoke tests/docs.
**Tests:** section 27 local cryptographic/fixture suites plus real staging signup,
verification/resend/recovery/refresh/logout/disable/delete, bootstrap failure,
mixed demo/account routes, IAM/CORS/CSP/deep links and deployed bounds.
**Non-goals:** public-production personal data, seed migration, full custom login
UI, attachments/notifications, administrator features.
**Gate:** actual provider flows and both identities work in staging, measured
short-token/revocation behavior matches copy, no local bypass/secrets/PII logging.

### Phase 5 — public-account readiness and delivery

**Objective:** release durable personal data with operationally credible controls.
**Prerequisites:** staging acceptance; validated release limits/recovery/deletion.
**Likely modules:** account lifecycle/erasure service and UI, export budgets,
safe structured logs/metrics, alarms/backups/restore runbook, throttles and scoped
GitHub Actions OIDC deployment/promotion alongside existing quality workflow.
**Tests:** erasure/races/resume/provider partial failure, worst-case exports and
request limits, cross-tab logout and no-flash timings, restore/tombstone handling,
production isolation and accessibility/browser regression.
**Non-goals:** unlimited workspaces, enterprise IAM, BFF unless selected, paid
plans, attachments/reminder delivery and distributed services.
**Gate:** no simulation misrepresented as live; public signup/recovery/export/
deletion and abuse controls verified, finite diagnostics, protected durable
resources and documented rollback/recovery. Separate deployment approval.

## 35. Decision log and approvals

### Already decided; preserve

Modular monolith, single DynamoDB table/access-pattern model, owner-qualified
resources, centralized policy/metrics, conditional transactions, no passwords,
ordinary archive/append-only activity, explicit local schema commands, isolated
signed fictional demos, local development without live AWS. The user has also
decided initial demo data is not migrated into accounts. Do not reopen these.

### Recommended Phase 1 decisions

Normalized identity with explicit data lifetime; server-owned verification and
metadata authority; idempotent request bootstrap with lazy counters; server
standard-user role only; central small capabilities; session generation fencing;
saved time-zone preservation; additive account-state/strong manifest records;
FastAPI verification on shared routes; same minimal AWS target and TypeScript
CDK; no new GSI/BFF/worker by default. These are routine design recommendations
within the proposed architecture, not a list of separate approval questions.

### Architectural choices requiring review before implementation

1. **Ownership portability:** accept direct Cognito `sub` ownership with a retained
   single pool per environment, rather than an internal identity mapping.
   Recommended: direct sub. Tradeoff: replacement pools/users require controlled
   migration/recovery instead of transparent relinking.
2. **Browser session/UX boundary:** accept managed login + PKCE with memory access
   tokens and tab-scoped rotating refresh storage, rather than an HttpOnly server
   session. Recommended: SPA initially. Tradeoff: XSS token exposure and re-login/
   reauthorization after a tab/browser closes; no persistent remember-me promise.
3. **Revocation/disablement guarantee:** accept a five-minute access-token window
   plus at most 30-second skew for already-issued ordinary API credentials, with
   provider-backed hydration and immediate HireFlux deletion/access gates.
   Recommended: bounded acceptance initially. If immediate provider revocation
   is mandatory, choose online validation/server sessions before implementing
   persistent auth, not after release.

Approval of this document does not authorize AWS deployment or later destructive
account operations. These three choices determine meaningful architecture/UX;
ordinary names, file organization, test utilities and additive implementation
details do not need individual approvals.

### Deferred decisions

Social identity linking/provider migration, custom signup/login screens, MFA and
device-session UI, remember-me/BFF hardening, admin roles, larger quota/pricing
policy, asynchronous export/erasure workers, attachments/reminders/email delivery,
multi-region recovery and WAF. Production retention/backup policies and exact
release budgets must be selected before Phase 5, not invented as live promises.

## 36. Exact first Phase 2 slice

Start with **backend-only, local durable identity and empty bootstrap contracts**:

1. Make normalized identity kind and workspace data lifetime explicit. Keep the
   existing local fixed UUID as the durable developer path and demo as the
   temporary path; no Cognito verifier or live AWS config is added in this slice.
2. Define an idempotent bootstrap service/port and authenticated route for local
   durable profile + settings, with versioned readiness/account access semantics
   and no seeding. Preserve ordinary demo provision/codec behavior.
3. Separate profile read/projection semantics from ambiguous `last_login_at` and
   narrowly gate the legacy demo rename. Leave provider synchronization behind
   an explicit future port; local metadata remains deterministic.
4. Add Moto tests proving empty dashboard, concurrent/retried/partial bootstrap,
   settings preservation, foreign isolation, expired credentials leaving durable
   data intact in fixtures, and **no TTL across canonical items, children, both
   quotas, counters and opportunity context after product mutations**.
5. Update only the affected contracts/config examples and run the full affected
   backend checks plus diff checks; keep frontend behavior unchanged initially.

Expected initial files: `domain/models.py`, `auth/local.py`,
`application/services.py`/proposed `workspace_bootstrap.py` and port,
`api/dependencies.py`, `api/routes/me.py`, schemas, `app_factory.py`, profile/
account DynamoDB adapter and focused backend tests. Follow with the frontend
session/generation boundary and the manifest/state write conditions in later
bounded Phase 2 slices before real durable accounts become writable publicly.

This slice proves the data/ownership/lifecycle contract without mixing OAuth
delivery, frontend signup design, infrastructure and persistent semantics in one
change. **This was the Phase 1 recommendation. Phase 2A implementation is recorded below; later slices remain deferred.**

## Phase 1 validation record

- Started from a clean working tree at the baseline above. Created only
  `docs/production-account-readiness.md`; no production behavior was changed.
- Ran backend unit suites `test_config.py`, `test_demo_session_codec.py`,
  `test_cursor.py` and `test_workspace_export.py`: **20 passed**, one existing
  FastAPI/Starlette TestClient deprecation warning.
- Attempted those units plus `test_demo_sessions.py`, `test_api_flow.py` and
  `test_workspace_resources.py`. The run emitted the 20 unit successes then
  stopped producing progress in this environment; interrupted it. Integration
  tests were inspected, but this audit does **not** claim an integration pass.
- Attempted four focused frontend suites (demo session flow, client, layout and
  workspace features). The documented npm invocation failed on the Windows
  ampersand-containing workspace path. Direct Node invocation reached Vitest,
  then all suites failed before test execution with a sandbox temporary-cache
  rename EPERM. An outside-sandbox retry was not executed because automatic
  approval review was unavailable at model capacity; this was a review-system
  failure, not a judgment that the test command was unsafe. No frontend test
  success is claimed. Application/dependency configuration was not weakened.
- No deployment, resource mutation, browser account implementation, live AWS
  signup, full cross-stack build or live layout QA was performed. This is a
  documentation-only audit; future code changes must meet `AGENTS.md` gates.
- Document structure/references and `git diff --check` are checked before handoff.
  External AWS/IETF citations were consulted on 2026-10-05; target choices and
  lifetimes are HireFlux recommendations, not evidence of current deployment.

## 37. Phase 2A implementation and handoff

Phase 2A implements the durable backend foundation locally. This update does not
turn the Phase 1 proposals into a claim of Cognito integration, personal-account
production readiness, or deployed AWS infrastructure. ADR 0005 records the accepted
bounded decision and the revised roadmap.

### Capabilities and contract

- `CurrentIdentity` is now a principal containing owner UUID, role, `IdentityKind`,
  and explicit `data_expires_at`. DEMO requires a positive integer data expiry;
  LOCAL and the future provider-neutral PERSISTENT kind forbid it. `is_demo` is a
  derived property. Token expiration remains in verified demo claims rather than
  a generic principal expiry usable as durable TTL. Authentication modes and
  local/test/deployment-runtime guards remain unchanged.
- `TrustedProfileAttributes` separates display name/email from principal claims.
  Local bootstrap obtains them from validated server configuration. Demo seeding
  constructs fictional attributes internally. No authoritative browser fields or
  impersonation header/query were introduced.
- Authenticated non-demo `POST /api/v1/me/bootstrap` accepts no body or an empty
  object. Unknown fields are rejected. It returns HTTP 200 with state, identity
  kind, bootstrap version, timestamps, profile, and settings for both creation and
  replay. It does not authenticate, seed, create counters, or require an
  idempotency key. The response carries `Cache-Control: no-store`.
- A `DURABLE_WORKSPACE` record at `USER#owner / WORKSPACE` stores owner, provenance
  kind, schema version 1, ACTIVE state, and UTC timestamps without TTL. The same
  slot also holds the distinct demo lifecycle type, so collisions cannot be
  converted by overwriting a separate unrelated marker. The model recognizes
  PROVISIONING for incomplete-state recovery; normal new bootstrap transacts
  directly to ACTIVE with profile and settings in one atomic write.
- The central ordinary identity dependency validates complete readiness before
  owner routes call application services. GET /me, settings, dashboard, analytics,
  pipeline, application/resource operations, and export cannot provision a fresh
  durable owner accidentally. Missing/incomplete readiness returns
  `409 WORKSPACE_BOOTSTRAP_REQUIRED`; incompatible state returns
  `409 WORKSPACE_BOOTSTRAP_CONFLICT`. Persistence failures retain the safe 503
  envelope. Health/demo creation/bootstrap are exempt. Verified demo principals
  bypass durable readiness without an additional datastore read.
- GET /me reads an established profile. Legacy Demo Recruiter names are presented
  as Demo Workspace only for demos, without a write on a read. Durable names are
  preserved. `last_login_at` is deprecated and always null in responses and no
  longer written on new profiles. Legacy stored creation-only values are left
  untouched rather than relabeled as login evidence. `created_at` truthfully
  remains the initialization instant; no per-request last-seen write was added.
- Default settings remain UTC, 7 follow-up days, ACTIVE application view, 30d
  dashboard range, SYSTEM theme, version 1. Browser timezone/session handling is
  deferred to Phase 2B.

### Retry, partial recovery, and legacy compatibility

Bootstrap strongly queries the owner partition and validates owner/type/lifetime.
A transaction conditionally creates only absent required items, condition checks
all modeled fields of existing profile/settings, and conditionally finalizes the
workspace record. Existing preferences, versions, profile attributes, and creation
timestamps are not rewritten. Conditional/concurrent transaction conflicts reread
and retry up to five times; storage/capacity failures return a safe retryable 503.
A lost response after commit is naturally idempotent on the next request.

Atomic new bootstrap cannot leave only a new profile or settings behind. Existing
compatible profile-only/settings-only records and incomplete markers can be
completed without deleting durable data. An ACTIVE workspace with a missing
profile can recover from the trusted source. An ACTIVE workspace whose settings
are missing returns an explicit conflict requiring operator recovery: the API
cannot honestly reconstruct customized preferences.

Compatible local legacy application data is retained. Adoption queries all nine
existing GSI2 owner/status partitions, including ARCHIVED, and strongly checks
each discovered application partition for TTL/owner conflicts, including child
records and helpers. Owner-partition TTL, demo metadata, foreign ownership,
wrong entity/provenance, or incompatible schema cannot be repaired by removing
expiry or reseeding. No table/index migration or reset is required.

**Remaining limitation:** legacy GSI discovery is eventually consistent; it is
not a strong manifest and cannot prove absence of unindexed/orphan partitions.
This compatibility path does not claim deletion completeness or production erasure
safety. No DELETING/DELETED states, manifest, deletion/write guards, expanded
export safety, or account-erasure workflow were pulled into Phase 2A.

### Changed files

Paths below are relative to the repository root; generated build/contract output
is ignored and is not part of the deliverable.

- Principal/model/defaults: `backend/src/hireflux_backend/domain/models.py`,
  `domain/workspace.py`, `auth/local.py`, and `auth/demo.py`.
- Application layer: `application/workspace_bootstrap.py` (including the typed
  persistence protocol), `application/ports.py`, `application/errors.py`,
  `application/services.py`, `application/resource_services.py`,
  `application/demo_sessions.py`, and `application/workspace_export.py`.
- DynamoDB: `infrastructure/dynamodb/workspace_bootstrap_repository.py`,
  `infrastructure/dynamodb/repositories.py`, and `infrastructure/dynamodb/mapping.py`.
- HTTP/composition: `api/bootstrap_schemas.py`, `api/dependencies.py`,
  `api/routes/me.py`, `api/schemas.py`, `api/error_handlers.py`, and `app_factory.py`.
- Tests: `backend/tests/conftest.py`, integration `test_workspace_bootstrap.py`
  and `test_api_flow.py`; unit `test_identity_lifetime.py`,
  `test_application_service.py`, `test_dashboard_timezone.py`,
  `test_demo_session_codec.py`, `test_opportunity_workspace.py`, and `test_pipeline.py`.
- Documentation/config example: `.env.example`, `ARCHITECTURE.md`,
  `docs/domain-model.md`, `docs/dynamodb-access-patterns.md`, this readiness record,
  and `docs/adr/0005-durable-local-workspace-bootstrap.md`. Existing ADRs and
  original diagrams are preserved. Frontend implementation and dependency
  manifests/lockfiles are unchanged.

### Validation record

The final bootstrap/identity-focused run passed **45 tests**. Coverage includes
all ordinary OpenAPI operations before bootstrap with no writes, empty initialization,
repeat/restart stability, client-authority rejection, partial component recovery,
active settings-loss behavior, incompatible TTL/type/owner/schema/provenance,
transaction failure with existing components preserved, a lost response after
commit, concurrent bootstrap from the same stale snapshot, concurrent settings
edits, persistence-read failures, legacy application/archived adoption, and shared
product flows. Stored-item inspection covers complete demo seeds and idempotency
metadata, profile/settings, applications, notes, interviews/preparation, activity,
quotas, status/funnel counters, and opportunity context. Durable items omit TTL;
every inspected demo item retains the signed workspace expiry.

Commands run from the repository root with the existing backend virtual environment:

```text
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m ruff format --check backend
backend\.venv\Scripts\python.exe -m mypy backend\src
backend\.venv\Scripts\python.exe -m pytest backend -q
```

All passed: **312 backend tests**, 63 typed source files, 93 formatted backend
files. API tests were run outside the filesystem/network sandbox because its
Windows socket-pair restriction blocked TestClient's event loop. The existing
Starlette/httpx deprecation warning remains; no dependency was changed to hide it.
The repository virtual environment unexpectedly runs Python 3.12, outside the
project's declared 3.13–3.14 range. Therefore the same checks were also run in an
isolated temporary Python 3.14 environment using the existing manifest pins and
all existing `uv.lock` package versions as installation constraints. The source,
repository virtual environment, and dependency files were not modified for this.
All four checks passed again on **Python 3.14.7**, including **312 backend tests**.
The isolated validation environment was removed after verification.

Frontend checks ran from `frontend/` using the underlying Node entry points to
avoid the existing Windows npm-wrapper problem with an ampersand in the repo path:

```text
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc -b
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
```

All passed: **45 frontend test files / 322 tests**, plus lint, type checking, and
production build. No frontend tests were rewritten. No layout/navigation/theme
behavior changed, so live layout/browser QA was not needed for this backend slice.

The normal `backend/scripts/generate_openapi.py --output artifacts/hireflux-openapi.json`
command succeeded with `PYTHONPATH` set to `backend/src`, including on Python 3.14.
The generated bootstrap request has no allowed client fields, the response schema
is present, and the legacy nullable login field is marked deprecated. The output
remains ignored.

A real DynamoDB Local Docker smoke test used one uniquely named disposable
single-table test database, leaving HireFluxLocal untouched. Two fresh Python
processes proved persisted bootstrap/profile, application, note, interview,
customized settings, identical readiness timestamps on replay, and no durable TTL.
Concurrent initialization against the real local datastore converged from the
same empty owner snapshot. Both checks passed again on Python 3.14. Each disposable
table was removed in a guarded finally block. This exercised process restarts,
not a Docker restart or an AWS deployment. Moto's threaded rollback emulation was
serialized only around its atomic transaction operation in the focused race test;
request/read concurrency still raced, and the real local datastore separately
verified transaction concurrency.

`git diff --check` passed. No secret, environment file, generated artifact,
dependency change, frontend code, or diagram modification is included. No commit,
push, infrastructure deployment, or table reset was performed.

### Follow-on boundary

Phase 2A is the backend foundation for a durable owner. Phase 2B still needs a
general frontend session boundary and returning-user preference handling. Phase 2C
still needs the strong application manifest, persistent-account deletion lifecycle,
write guards, and expanded export safety. Cognito verification/profile sourcing
is Phase 5, after CDK synth and the existing demo in AWS staging. Persistent
personal-data production readiness is not claimed by this local implementation.
