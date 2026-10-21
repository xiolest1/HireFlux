# Gate 0 — single CLI authentication probe

October 21, 2026, **02:57:56 EDT / 06:57:56 UTC**.
**STOP — personal authentication required. Gate 0 remains BLOCKED.**
This records the separately authorized probe following the
[local authentication diagnosis](phase5e-auth-path-diagnosis.md).

## Result

- Authentication succeeded: **NO**.
- Account match: **NO — not confirmed; no identity returned**.
- Principal match: **NO — not confirmed; no identity returned**.
- Sanitized error: **`LOGIN_REFRESH_TOKEN_EXPIRED`**.
- Authentication CLI invocations: **exactly 1**. One earlier `--version`
  invocation was local metadata only.
- Successful STS responses observed: **0**. Sign-In and STS wire-request totals
  were not directly observed. No additional account operation was initiated.

The supported CLI reported expiry of its login refresh token. In the pinned
CLI source, Sign-In `TOKEN_EXPIRED` during `CreateOAuth2Token` maps to
`LoginRefreshTokenExpired`. That supports an expired broader login grant for
this invocation, rather than only the earlier custom 25-second guard. It is
source-backed inference that the refresh path reached Sign-In and stopped before
STS signing; it is not packet-level request counting. Exact cached signing
expiry and refresh timing were not inspected.
[Pinned provider](https://github.com/aws/aws-cli/blob/2.36.47/awscli/botocore/credentials.py)
and [exception mapping](https://github.com/aws/aws-cli/blob/2.36.47/awscli/botocore/exceptions.py).

## Qualified controls

The existing Amazon-signed Windows CLI **2.36.47**, bundled Python **3.14.6**,
passed executable-hash/version checks. The expected Windows user, default cache
configuration and non-root `hireflux-operator` profile binding matched.
All **19** final synthetic command/sanitization tests passed.

The command selected `sts get-caller-identity`, the exact profile and `us-east-1`.
It disabled pagination, pager, auto-prompt and debug; retained normal TLS;
used closed stdin, no shell expansion, 5/15-second socket deadlines and a
45-second process timeout. The child environment set `AWS_MAX_ATTEMPTS=1` and
standard retry mode. Shared/legacy credential-file inputs were directed to the
Windows null device for this child only; static environment, container,
web-identity and instance-metadata fallbacks were excluded. The actual profile,
config file and native login cache were retained. No persistent setting changed.

`AWS_MAX_ATTEMPTS=1` includes the initial attempt for each API operation. It does
**not** independently impose a global Sign-In request count across credential
refresh callbacks. No wire instrumentation or debug logging was enabled, so no
exact Sign-In total is claimed. There was no wrapper retry, explicit refresh
command, fallback identity or browser login.
[AWS retry semantics](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-retries.html).

Before live execution, local qualification corrected an incorrect wrapper
assumption about machine-wide installation and a PowerShell separator-quoting
error. Those preparation stops made no authentication request. Their evidence
and initial qualification receipt were retained; the existing inspection helpers
and earlier ledgers were not edited or replayed.

## Evidence and next action

The new append-only receipt is
`.tools/phase5e-readiness/auth-cli-probe-20261021.jsonl`, SHA-256
`afd3db6f6348deadbf1d50928f85bf2a9d63a646f4ecfad2cec02f7c4e47f5ab`.
It records authorization, the sole invocation, sanitized result and final STOP.
Raw CLI stdout/stderr stayed in process memory and were discarded. No raw STS
output, principal ARN, token, key, private cache path or verbose CLI error was
persisted or displayed. No credential-cache content was manually opened.
**Output-handling qualification:** an initial preparatory file read inadvertently
included an existing infrastructure resource ARN from the approved manifest.
That was not live STS output or credential material; subsequent reads used
sanitized projections. The original tool output cannot be removed by this task.

Both earlier stopped ledgers, the 22-operation manifest, qualified release and
existing configuration were preserved. Local verification is recorded separately
in `.tools/phase5e-readiness/auth-cli-probe-verification-20261021.json`.

**R01–R22 cannot resume yet.** Personal browser authentication for the existing
profile is required; none was initiated. After personal renewal, a fresh explicit
authorization and newly bound receipt are required for the unchanged inspection.
This probe's normal-refresh exception does not extend to R01–R22. No operator
permissions, live resources or Billing baseline were verified by this failure.
No further probe, troubleshooting, login, AWS/GitHub read, build or deployment was
performed. Phase 5E deployment remains unauthorized; testing remains paused.
