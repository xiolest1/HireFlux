# Gate 0 authentication-path diagnosis

October 21, 2026. Local-only addendum to the preserved
[Gate 0 report](phase5e-readiness-gate0.md). **Inspection remains BLOCKED;
Phase 5E deployment remains unauthorized.** No AWS requests were made.

## Finding and confidence

**Confirmed immediate cause:** the custom reader rejects the cached signing
snapshot when it has fewer than 25 seconds remaining and deliberately prevents
normal SDK renewal. This does not establish that the owner's broader login
session expired or that the reported login failed.

**Probable stale input; renewal discrepancy unresolved:** stat-only inspection
found the expected login file last modified at **2026-10-20 06:32:54 UTC**, about
**23 hours 1 minute** before the resumed stop at **2026-10-21 05:34:10 UTC**.
The selected store therefore showed no modification corresponding to the reported
renewal. Modification time is not credential-expiry evidence. No cache contents
were opened to determine either signing expiry or refresh-grant validity.
The historical terminal's command, process-local overrides and completed callback
cannot be reconstructed from current configuration alone. No claim is made that
the owner selected a wrong identity, used WSL, or failed authentication.

## Actual provider and runtime

- CLI: **2.36.47**, bundled Python **3.14.6**, Windows AMD64.
- Inspection runtime: backend virtual-environment Python **3.13.15**;
  boto3 **1.43.53**, botocore **1.43.78**, python-dateutil **2.9.0.post0**,
  urllib3 **2.8.0**. CLI and Python SDK use separate runtimes.
- `CachedLoginOnly` in the preserved
  [reader](../.tools/phase5e-readiness/execute-approved-reads.py) calls botocore's
  internal `LoginCredentialFetcher.load_cached_credentials()` through
  `LoginTokenLoader`/`JSONFileCache`. It replaces ordinary resolution with this
  sole provider, fixes `hireflux-operator` / `us-east-1`, and disables refresh
  and alternate credential sources. It does not invoke `LoginProvider.load()`.
- `NoRefreshCredentials._refresh()` evaluates
  `not refresh_needed(refresh_in=25)` using timezone-aware expiry and the SDK
  clock. Expired credentials and 24.999 seconds remaining fail; exactly 25
  seconds passes. It runs during client creation, before R01 is signed/sent.
  Both prior receipts record this exact local stop with zero SDK operation
  attempts and zero transmitted requests.
- A newly constructed provider rereads its selected snapshot. An already loaded
  credential object does not reread an updated cache when its snapshot expires.
  Thus this is not permanent reuse of one in-memory snapshot across both runs.

AWS documents 15-minute signing credentials with automatic renewal during a
broader session of up to 12 hours. The current no-refresh policy can therefore
reject a session that ordinary resolution could renew. Python login support
requires CRT. [AWS login-provider documentation](https://docs.aws.amazon.com/sdkref/latest/guide/feature-login-credentials.html)
and [CLI sign-in behavior](https://docs.aws.amazon.com/en_en/cli/latest/userguide/cli-configure-sign-in.html).

**CRT is absent** from this Python environment. The installed native
`LoginProvider.load()` raises `MissingDependencyException` before loading a cache
without it. The custom path bypasses that entry point; synthetic tests reproduce
the expiry stop without CRT. Missing CRT is consequently a separate obstacle to
switching to normal Python resolution, not the cause of this recorded stop.
No dependency was installed or changed.

The [version-pinned SDK implementation](https://github.com/boto/botocore/blob/1.43.78/botocore/credentials.py)
and [CLI implementation](https://github.com/aws/aws-cli/blob/2.36.47/awscli/botocore/credentials.py)
were compared with local source. Cached loading intentionally omits expiry
checking; normal refresh can call Sign-In `CreateOAuth2Token` and update the
login cache. No documented public metadata-only, guaranteed nonrefreshing API
was identified. The internal loader returns authentication material, not just
expiry metadata; it was exercised only with synthetic fixtures in this task.

## Configuration and clock comparison

CLI local configuration lookup and the reader select the same `login_session`,
matching the approved principal binding. No secret value or full identity was
reported. The selected profile has no static credentials or alternate provider
settings; its unset region is supplied explicitly by the reader.

`AWS_CONFIG_FILE`, `AWS_SHARED_CREDENTIALS_FILE`, `AWS_LOGIN_CACHE_DIRECTORY`,
`AWS_PROFILE` and `AWS_DEFAULT_PROFILE` are absent from current process, persisted
user and machine scopes. `HOME` is also absent; Python home, PowerShell home and
`USERPROFILE` agree. Default config/cache selection and the CLI/SDK cache-key
algorithms agree. The shared credentials file exists but was not opened.

The current shell, Codex and desktop process ancestry have the same Windows
owner as the interactive user. The actual reader is a direct Windows Python
process, not a WSL/Node credential wrapper. These checks establish current
context consistency, not the owner's historical terminal environment.

Python/SDK and PowerShell UTC readings agree within their measurement intervals.
Windows is on Eastern daylight offset **UTC−04:00**. No internal clock, timezone,
profile or cache-location mismatch was demonstrated. Absolute UTC was not
validated against an external time source.

## Local validation and preservation

**17 synthetic cases passed** against the actual preserved helper and installed
SDK: fresh/expired credentials, the exact 25-second boundary, different stores,
wrong references/profile selection, modeled valid refresh with expired signing
credentials, unsupported provider, absent CRT, timezone/clock/parser edges,
new-loader versus in-memory snapshot behavior, and wrong account/principal
rejection. A mocked Sign-In refresh verified the expected operation and an
in-memory-only cache update. It did not validate any real refresh grant.

The Python diagnostic/tests blocked real cache opens and network operations;
tests also blocked SDK API calls. There were **zero real cache-content opens,
network attempts or AWS requests**. CLI commands were limited to `--version`
and a captured, equality-only `configure get login_session`; neither resolves
credentials. PowerShell collected only environment presence/equality, clocks
and process-owner relationships. No cache filename, private credential path,
token, key, command history or terminal contents were collected or displayed.

**No authentication-helper bug was demonstrated; no existing helper changed.**
Only this report and ignored local diagnostic scripts/receipts were added.
The qualified release, original readiness report, both stopped ledgers and
approved manifest remain unchanged. Manifest SHA-256:
`b173d7b5a2dd8e11e80809e71eecf1393ea555232163be453c126f280cb3850b`.
No login/logout, refresh, profile/cache change, dependency change, commit,
GitHub operation, application request, build or deployment occurred.

Private evidence in `.tools/phase5e-readiness/`:
`auth-path-local-observations-20261021.json`,
`auth-path-environment-20261021.json`,
`auth-path-synthetic-tests-20261021.json`, and
`auth-path-diagnosis-verification-20261021.json`.

## Smallest next decision

Do not repeat login on the assumption that it failed. Under the present
no-cache-content/no-refresh/no-service-request policy, real signing and
refresh-grant validity cannot be established further.

If the owner wants a live answer, the proposed next authorization is **one
authentication-only probe** using the existing CLI's supported login provider,
same profile/region/principal, allowing **at most one Sign-In CreateOAuth2Token
refresh and its normal cache update if needed, followed by exactly one STS
GetCallerIdentity request**. Qualify enforcement and sanitization locally first;
retain TLS verification, no fallback identity, no retry, no credential export
and no automatic browser login. Retain only exact identity-match booleans and
sanitized failure codes. Stop if renewal is rejected or identity differs.
This is a proposed policy exception, not an action taken or authorized here.
It avoids adding CRT to the qualified application environment.

Any later R01–R22 resumption needs fresh explicit authorization and a new receipt;
neither stopped ledger can be replayed or reset. All existing resource allowlists,
limits, release qualifications, Billing requirements and the testing pause remain
in force. This diagnosis ends here.
