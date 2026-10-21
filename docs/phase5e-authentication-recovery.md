# Gate 0 — operator authentication restored

October 21, 2026, **03:19:09 EDT / 07:19:09 UTC**.
**PASS for authentication recovery only. STOP after identity verification.**
This supersedes the expired-session blocker in the
[single-probe handoff](phase5e-authentication-probe.md); that evidence is preserved.

- CLI login completed: **YES**.
- Authentication succeeded: **YES**.
- Exact expected account match: **YES**.
- Exact expected non-root principal match: **YES**.
- Sanitized error: **none**.
- Login CLI invocations: **1**.
- STS CLI invocations: **1**; successful STS responses observed: **1**.
- Local `--version` invocations: **1**; no account request.
- Underlying login/Sign-In/STS wire-request totals: **not directly observed**.

The owner personally completed the browser authentication. The existing
Amazon-signed CLI 2.36.47 ran `aws login --profile hireflux-operator --region
us-east-1` once. The wrapper waited for successful CLI termination, a stat-only
confirmation that the expected native login store was updated, and an unchanged
approved non-root identity binding before running the single STS command.
Browser opening or owner confirmation alone was not treated as CLI success.

Login stdout/stderr went directly to the null device; no authorization URL,
code, full identity message, password, MFA information or browser data was
captured. STS output was compared privately in memory and discarded, retaining
only the allowed match/success fields and counts. No cache contents were
manually opened. Only the normal AWS CLI login managed its native credentials.

The established child-process controls retained TLS verification and excluded
static/shared, container, web-identity and instance-metadata credential fallback.
`AWS_MAX_ATTEMPTS=1`, no pagination/pager/auto-prompt/debug and no shell expansion
were retained. There was no explicit retry or alternative identity. The login
had a 10-minute process limit; STS retained its 45-second process limit and
5/15-second socket deadlines. Normal login protocol operations were not counted
through debug logging or instrumentation. The
[supported CLI login behavior](https://docs.aws.amazon.com/cli/latest/reference/login/)
uses the personal browser flow and native credential storage.

**Nine focused synthetic recovery checks passed**, including rejection of failed
or cancelled login, success without updating the expected store, timeout/halt
handling, output suppression and replay prevention. The previously qualified
19-case STS sanitizer/command controls were reused unchanged.

The new append-only receipt contains six events and ends in
`PASS_AUTHENTICATION_RESTORED`:
`.tools/phase5e-readiness/operator-auth-recovery-20261021.jsonl`.
SHA-256: `17a255008d520f96ddfbf07381bd721259c6ca150777f2b62752043ea09cc907`.
Local preservation verification is recorded in
`.tools/phase5e-readiness/operator-auth-recovery-verification-20261021.json`.
Both original stopped inspection ledgers, the failed CLI probe, the immutable
22-read manifest, qualified source and artifacts remain unchanged.

**The authentication prerequisite for a separately authorized Gate 0 continuation
is satisfied.** Fresh explicit R01–R22 authorization, current local preflights,
still-valid credentials and a new continuation receipt remain required. The
original request manifest and no-refresh policy were not changed by this recovery.
R01 must still verify identity first. This is not an overall Gate 0 READY finding:
R02–R22 resource/configuration/permission checks and owner Billing requirements
remain outstanding. Neither the custom SDK path nor additional AWS reads were
retested. No IAM changes, application/release edits, builds, deployments, Billing,
GitHub or application operations occurred. Testing remains paused and Phase 5E
deployment remains unauthorized.
