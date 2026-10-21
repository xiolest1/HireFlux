# Phase 5D.1 — CDK security remediation addendum

Date: 2026-10-20 (America/New_York). Local maintenance addendum to
[Phase 5D](phase5d-account-lifecycle-handoff.md); its accepted record is unchanged.

## 1. Disposition

**PASS — CDK security remediation and offline requalification.** No application
functionality or CloudFormation resource behavior changed. This removes only
the inherited CDK dependency qualification. Other 5D qualifications, the testing
pause, cash-funded baseline and separate 5E authorization requirement remain.

## 2. Original advisory and actual findings

The installed path was `aws-cdk-lib@2.272.0 → minimatch@10.2.5 →
brace-expansion@5.0.9`, physically bundled under aws-cdk-lib/node_modules.
The request's CVE-2026-69152 / GHSA-rgw5-rvv9-x895 affects the 4/5.x line below
5.0.9; the baseline already contained that fix. [Maintainer advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-rgw5-rvv9-x895).
The [AWS issue](https://github.com/aws/aws-cdk/issues/38496) discusses the older
2.263.0/5.0.8 graph; it is useful context, not the current installed version.

The fresh baseline audit instead confirmed three subsequent advisories against
5.0.9, reported as one high-severity vulnerable dependency:

- GHSA-q2hr-2g5m-vwhr: moderate, quadratic parsing; 4/5.x fixed in 5.0.12.
  [Maintainer advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr).
- GHSA-qhr7-859c-m2p7: high, nested recursion; fixed in 5.0.11.
  [Maintainer advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7).
- GHSA-6j4f-fj2g-mc7p: high, comma parsing recursion; fixed in 5.0.10.
  [Maintainer advisory](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p).

## 3. Minimum remediation

Pinned aws-cdk-lib **2.272.0 → 2.273.0**, the first next official release whose
[release notes](https://github.com/aws/aws-cdk/releases/tag/v2.273.0) identify
bundled brace-expansion 5.0.12. Verified the actual npm tarball before installing;
its SHA-512 SRI matches registry metadata and the new lock. No need for 2.274.0.
CLI remains **2.1144.0**, constructs 10.8.1 and TypeScript 5.9.3 unchanged.
The package's Node >=20 and constructs ^10.5.0 constraints are satisfied.
Only root dependency selection, the library record and bundled brace version
changed in the lock; no overrides, patches, audit suppression or unrelated upgrade.

## 4. Installed bundled dependency

Clean `npm ci --ignore-scripts --no-audit --no-fund` installed the locked graph.
The sole installed brace-expansion package copy in infra/node_modules is now
**5.0.12**, still reached through minimatch 10.2.5. All 13 shipped brace package
files match the inspected official tarball byte-for-byte. Full `npm ls --all`
passes without invalid/unmet constraints. Install-script suppression is a standard
npm safety option; security was checked separately with the full audit.

## 5. Audit

`npm --prefix infra audit --json`: **zero total vulnerabilities**, including
zero high/critical. The three actual baseline findings are absent and the older
CVE fix remains included. No residual known infra advisory is reported by this
audit. Raw before/after audit JSON, full trees, package integrity, lock delta and
an infra CycloneDX SBOM are in `.tools/phase5d-remediation/`.

## 6. Executed checks

All passed, without changing tests or guards:

- Targeted lock update: `npm --prefix infra install --package-lock-only --save-exact
  aws-cdk-lib@2.273.0 --ignore-scripts --no-audit --no-fund`, then clean install.
- `npm --prefix infra ls --all --json` and full `audit --json`.
- Infra directory: `node node_modules/typescript/bin/tsc` and
  `node scripts/test-unit.mjs`: **127 tests**.
- With `HIREFLUX_QUALIFIED_BACKEND_ARTIFACT=.tools/phase5d/hireflux-backend-candidate.zip`:
  `node --test build/test/cli.integration.js`: **four tests**, including repeatable
  staging/production synth, exact inventory, CLI compatibility, account isolation
  and rejection of profiles/mutation commands with network attempts blocked.
- Same candidate: `node --require ./build/test/block-network.js
  scripts/check-schema-parity.mjs --schema ../.tools/phase5d/dynamodb-schema.json`:
  both environments pass keys/GSIs/projections/TTL/billing parity.
- `.tools/phase5d-remediation/requalify.cjs`: fresh account-bound staging/production
  synth, full structural comparison, original deployed-template update guard and
  exact original inert UPDATE regeneration in memory. Zero network attempts.
- Final source/artifact/evidence hashes, lock consistency, documentation links and
  `git diff --check` pass. Backend/frontend tests and builds were not rerun:
  their inputs and artifact bytes are directly verified unchanged.

## 7. Template comparison

Both templates are **byte-for-byte identical** to 5D, beyond canonical equality.
Resource types/IDs/properties/dependencies, policies, metadata, parameters/defaults,
conditions and outputs all match. Asset manifests also match exactly.

One non-CloudFormation assembly-report addition is recorded in both environments:
`@aws-cdk/aws-cloudfront:defaultViewerProtocolPolicyRedirectToHttps`, recommended
true. It is a library feature-flag recommendation, not a changed context setting.
HireFlux defines no AWS::CloudFront resource; Amplify definitions are identical.
This changes neither deployment templates nor assets, and no guard was relaxed.
The only other changed assembly file is `tree.json`: its constructInfo version
labels change from 2.272.0 to 2.273.0. Every tree difference is checked to be
exactly that label update. These are construct inspection records, not resource
properties. A complete assembly file comparison found no added/removed files;
all files except manifest.json and tree.json are byte-identical in both environments.

## 8. Resource and credential preservation

29 declarations / 26 blank-email-selected resources remain. Against the frozen
deployed baseline, exactly the same four Cognito additions and two nonreplacing
Lambda code/environment + pool-scoped AdminDeleteUser policy modifications pass.
No other resource, table/schema/TTL, secret, API/CORS/header trust, Cognito policy,
monitoring, budget, cost capacity or staging/production binding changed.
Amplify App/Branch properties remain identical; both PATs remain deleted.
NoEcho `AmplifyGitHubAccessToken` still uses UsePreviousValue=true without a
ParameterValue. All prior parameters, execution role and rollback policy match.

## 9. Application and artifact preservation

All baseline backend/frontend tracked and untracked inputs match their captured
hashes, including both locks and the complete 5D packaged-source inventory.
No backend/frontend artifact was rebuilt. Direct byte checks confirm:

- Backend ZIP: `0934a7850fb2ec8c2946afc5828c76e830638a3965736434ef31025504f58f6d`.
- Frontend 45-file inventory: `98d69b6b210af34b342b96c2dccd540d2b0005075784161921878cb1c438097c`.

Recent auth, ownership, erasure/finalization, reconciliation, frontend fences,
demo lifetime and closed registration are unchanged source and configuration.

## 10. Current release identities

- Infra lock **before**: `314e1dfc107e72c933b401b301a3367dcb710685b9a174c8ebad2987136a3bfb`.
- Infra lock **now**: `39d79a5b494e92b2ea3cf9813bf8dff3d4ef5e5ec3ba8e3f0e0259ade2661c39`.
- Fresh staging template: `65431c46065237d875cc3015cdc1c9bb81136fe331898d2906773bcd50b9526b`.
- Fresh production template: `8d60e4a2bc15ac309e6e2c5d5662172a5c4586e3f40a3f5eb8d910d39e979d64`.
- Sorted-key canonical staging: `c539a58545e3089ce2d0931256fa3e2df1c2569be4b8fb941c2b71eb995b3968`.
- Sorted-key canonical production: `177bd22bffab61d222a5f5c9dd7a3114b5e25424d77bfee3410253725c4b86ac`.
- Existing inert UPDATE: `c407196d6b3a80a8dc49219571ce198594474187af43c00a127db5e323cb9b13`.

Canonical hashing recursively sorts object keys and preserves array order; both
old/new values match under this definition. Raw template hashes are separately
checked. The unchanged UPDATE fixture needs no duplicate file or new credential.
New `release-metadata.json` binds these identities to the updated dependency lock;
`verification.json` binds current source and checks. Both are in the new directory.

## 11. Remaining uncertainties

No live AWS state, domain availability, CloudFormation acceptance, email/quota,
Billing, real token/provider behavior or hosted revision was reverified. Those
remain 5E gates. Staging remains disposable, tests paused and cash-funded with
$0 assumed usable credits and unchanged manual spending thresholds.

## 12. Phase 5E amendment

The original resource plan, rollout order, security conditions, rollback/retained-
pool treatment and bounded traffic/build budget remain valid unchanged. Replace
only its old CDK security qualification with this verified upgrade and current
infra lock/release metadata. Fresh owner authorization and live state/change-set
review are still required before any publication, deployment, signup or testing.
No top-level phase or new roadmap is introduced. **STOP at 5D.1.**

## 13. Working tree and historical evidence

HEAD remains `138309d759e43ba4eda131e9f047a5bcf919f446`, main, uncommitted.
The pre-existing 5C/5D work is retained. This addendum changes only:

- `infra/package.json` and `infra/package-lock.json`.
- Current `infra/README.md`, `docs/architecture.md`, `docs/devlog.md`, `docs/roadmap.md`.
- New `docs/phase5d1-cdk-security-remediation.md`.

Separate ignored evidence: `.tools/phase5d-remediation/`. All 184 old local 5D
evidence files and the accepted 5D handoff remain byte-identical. Frozen 4H entries,
consumed ledgers and prior receipts/artifacts are independently checked again.
Current-document updates are identified by the new receipt rather than rewriting
5D's historical source/document hashes. No AWS/account API call, hosted traffic,
GitHub account operation, commit/push, remote CI, Amplify build, credential change,
asset publication, deployment or consumed-ledger reset occurred.
