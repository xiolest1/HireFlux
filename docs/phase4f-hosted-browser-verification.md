# Phase 4F — hosted browser end-to-end verification

**October 19, 2026: PASS WITH EXPLICIT QUALIFICATIONS for supervised staging.**
The real hosted frontend completed the bounded fictional-demo workflows through
the deployed backend. One low-priority Settings preference defect remains;
live UI conflict display and exhaustive browser network inspection are not
qualified. These limitations are not silently promoted to PASS. No source or AWS
repair was implemented, and Phase 4G has not started.

The owner accepted the [Phase 4E result and its limits](phase4e-live-backend-verification.md),
explicitly authorized Phase 4F, and refreshed Bills/Credits/personal-lab acceptance
and supervision before public verification/browser traffic. At most one new demo
workspace was authorized; exactly one was activated. No Phase 4E token was reused,
recovered or inspected.

## Actual source, artifact and unchanged deployment

- Website: <https://main.d31vp0nq9fzl6q.amplifyapp.com>.
- API: <https://0z0fpmukik.execute-api.us-east-1.amazonaws.com>.
- Target: non-root `hireflux-operator`, account ending **9465**, **us-east-1**.
  Exact STS identity matched the accepted identity at baseline and final reads.
- Lambda/backend remains qualified revision
  **`6396f89e8a5eccc7f21b5f699833dd85a1e48409`**.
- Actual latest successful hosted build remains **Amplify job 2**, revision
  **`d3a8fb1a9b959d4dddbc6d1c32e3eac459b0f945`**, matching remote main.
- Local HEAD is now **`2146fc3870f027c3d6d8f06720c46bb0b29b51a2`**. Its additional
  eight-file documentation/guidance change is unpushed. Backend, frontend and
  infra Git trees match the qualified revision across all three commits.
  No unexplained application-code difference was found.

Fresh initial/final metadata reads found the same CREATE_COMPLETE stack identity
and update time, and the same qualified Lambda code hash, runtime, execution role
and successful state. Final job metadata still showed job 2 successful with no
newer job. The checks did not recreate or redeploy anything or restart prior audits.

The existing job 2 artifact contained **39 files**, archive SHA-256
**`4867b5bf5fab0badc3c61730a0b3d6675ff02a1922fc6b1bda3ef5c4d43c0e71`**,
compressed size **1,600,373 bytes**. The existing complete-artifact verifier passed:
expected public URLs, demo mode, no source maps, no detected credential/signing
configuration patterns and no development/local endpoints. Existing build-log
evidence showed managed Node **22.23.3**, `npm ci` and `npm run build`; no new build
was requested. Signed artifact/log URLs existed only in memory and were not saved.

Actual hosted bytes matched that artifact for all four entry files:
`index.html`, `/theme-bootstrap.js`, `/assets/index-t82Qxnuz.js` and
`/assets/index-CDIFv_E7.css`. The complete archive was verified locally; this does
not claim a separate download/hash comparison of all 39 served files. Successful
browser workflows exercised their lazy-loaded page chunks.

HTTPS certificate validation, exact configured security headers/CSP,
`/applications` SPA fallback and missing-static-asset **404** passed. The allowed
staging origin received valid **200** CORS preflight permission with required
method/headers. An untrusted origin received **400**, the safe rejection body and
no Access-Control-Allow-Origin. Branch configuration exactly matched the public
API URL, public site URL and `VITE_WORKSPACE_MODE=demo`.

## Browser environment and observed workflows

Testing used the existing **Codex in-app browser through cua_repl**, sequentially,
from **17:13:48 to 17:27:51 UTC** on October 19. The supported read-only scope did
not expose engine/user-agent or a Performance/HAR network timeline. No browser
engine version, cross-engine result or real mobile hardware test is claimed.
Viewports were **1280×900**, **768×1024** and **390×844**, using the browser's
detected **America/New_York** time zone. The temporary viewport override was reset.
No HAR, persistent browser trace, token copy or dependency installation was used.

The repository's default local browser configuration was not run against AWS:
it targets localhost, uses multiple workers, starts a local build/preview and can
retain failure traces. Hosted evidence here comes from actual UI interactions,
not mocked tests or that local suite.

The observation receipt contains **28 requirement observations**: **25 PASS**,
one instrumentation qualification, one unverified conflict path and one confirmed
nonblocking application defect. These are coverage observations, not a count of
individual DOM assertions or proof of complete accessibility conformance.

- **PASS — landing, missing session and issuance.** The landing rendered its
  temporary/demo boundary and entry controls. A protected `/applications` deep
  link redirected to landing without issuance. One entry click showed disabled
  preparation controls and then returned to that intended Applications view with
  seeded data. No second activation, retry issuance or workspace reset occurred.
- **PASS — Home and supported navigation.** Home showed the seeded 22 active /
  30 tracked baseline, attention cards, recent updates, search activity and tour.
  Later it reflected the newly tracked application as 23 active / 31 tracked and
  the new interview in its action context. Primary navigation, application
  sections, mobile bottom navigation and overflow navigation were discoverable
  and usable. No Home redesign was performed.
- **PASS — list/filter/sort/pagination/search.** Offer filtering returned three
  offers, with an active filter chip and focus restored to the filter trigger.
  All view expanded from **20 to 30 unique** links through Load more. Selecting
  least-recently-updated visibly changed the first results from the newly updated
  application to older seed records. A no-match search showed a clear empty state
  and clearing action. A later positive `Phase4F` search recovered the new record.
- **PASS — application creation, feedback and validation.** Empty submission
  produced a required-company message and invalid-field semantics. A single
  fictional company/role was then saved, with success feedback and View
  application navigation. No invalid form submission created an extra record.
- **PASS — status and editing.** Mark as applied required a valid applied date;
  after native date entry the application became APPLIED and its journey/activity
  updated. The role was edited and an October 20 follow-up date saved with
  success feedback. Manage next step saved No separate action right now and
  cleared the check-back display. These were live UI-to-API outcomes.
- **PASS — notes and interviews.** One fictional note was saved and reopened in
  the note manager. One Technical screen was scheduled for October 20 at 2 PM
  New York, 30 minutes, with fictional location/preparation text. Editing changed
  its duration to 45 minutes. The global interview queue showed six entries and
  selecting the test record displayed its saved details. Explicit cancellation
  preserved that interview as CANCELED.
- **PASS — analytics/Search Health.** Overview, Pipeline and Sources rendered.
  Search Health's overdue-follow-up explanation expanded with supporting counts;
  small-sample and non-predictive interpretation warnings were visible. Keyboard
  tab focus and selected tab behavior were exercised. This verifies presentation
  and integration, not every denominator scenario already covered by contracts.
- **PASS with the defect below — Settings.** Changing default follow-up days
  from 7 to 8 saved successfully and remained 8 after reload. The temporary
  workspace, read-only email, profile-preview simulation and unavailable full
  account export were explicitly distinguished from real accounts. No CSV or
  full export was downloaded, and account simulations were not submitted.
- **PASS — refresh/history/session boundary.** Reloading an edit deep link and
  Settings preserved the same workspace and saved records. Browser back restored
  the edit route. A normal Ctrl-click edit tab opened anonymously, consistent
  with tab-scoped session storage; it was closed without issuance. Exit returned
  to landing, and direct navigation to the old application remained anonymous
  with no old fictional company visible.
- **PASS — safe error/recovery and retirement.** One intentionally nonexistent
  UUID rendered Application not found with a safe request reference and recovery
  link. Navigation/search recovered the real test record. Reset confirmation was
  inspected and canceled with Escape; its reseeding action was not executed.
  The new application was explicitly archived, retaining its history and exact
  Restore to applied option. Restore itself was not executed in this browser run.

## Responsive layout and accessibility observations

Desktop Home, tablet Interviews/Analytics and mobile Home, Settings and interview
editing were inspected through rendered screenshots and accessible structure.
The checked views had no page-wide horizontal overflow. Long fictional labels
wrapped, or were truncated in the compact queue selector while the full selected
record remained readable. Vertical scrolling and the mobile dialog's scrollable
body/sticky action footer kept its fields and controls accessible. A sampled
tablet set contained no visible main controls below 40 pixels high; this is not a
complete target-size audit.

The status dialog's Shift+Tab/Tab wrapping kept focus inside and returned to its
close control. Forms had visible labels/required errors; navigation changed page
titles and focused headings; filter completion restored trigger focus. Keyboard
date and time entry worked. Reset cancellation and mobile navigation were
exercised. No screen reader, automated full axe audit, every-breakpoint test or
full contrast certification was performed. No functional layout blocker was found.

Local screenshots are under `.tools/phase4f/screenshots/`: `home-desktop.png`,
`home-mobile.png`, `interview-mobile.png`, `interviews-tablet.png` and
`application-archived-desktop.png`. The archived-state image was recaptured after
the closing confirmation/viewport paint settled, so it shows the actual archived
record rather than an intermediate animation frame. Screenshots contain only
fictional UI data, never token values.

## Confirmed application defect and minimum proposed repair

**LOW, nonblocking here: saving an unrelated preference marks an unchanged
automatic time zone as manual.** Before saving only follow-up days 7→8, the option
was America/New York (automatic). After saving and reloading it was America/New
York without the automatic marker. The zone value and rendered dates stayed
correct; no security, ownership or current time-conversion failure was observed.

Confidence is high: `frontend/src/pages/SettingsPage.tsx:193` sends the entire
draft, including unchanged `time_zone`, while
`frontend/src/features/resources/queries.ts:61` marks any temporary-workspace
update containing `time_zone` as manual. This suppresses automatic detection for
the rest of that tab session after a save that did not choose a different zone.
It contradicts the stated distinction between automatic detection and an explicit
different-zone selection. Exit clears the tab's marker through normal cleanup.

The smallest proposed repair is a frontend partial update containing only changed
preferences plus `expected_version`, omitting unchanged `time_zone`. Existing
frontend and backend request types already permit this. Preserve genuine manual
zone changes, server version checks and refreshed-draft behavior. No API, Lambda
or CDK change is proposed.

**No repair was implemented or published.** A repair requires separate source/
publication authorization, focused tests for unrelated saves retaining automatic
detection, explicit zone changes remaining manual, conflicts and refreshed drafts;
the relevant frontend lint/typecheck/tests/build; then an authorized Amplify build,
artifact/served-byte checks and a bounded hosted Settings/reload regression.
The owner can instead accept this minor limitation for the existing fixed-zone,
supervised testing scope before starting Phase 4G.

## Tool defects, security evidence and unverified paths

Reader/tool problems were kept separate from application behavior:

- The reused AWS reader expected a dictionary to inspect pagination, but the
  initial ListJobs projection returned an array. A local projection correction
  preserved pagination screening. No AWS mutation or public request occurred in
  that failed metadata attempt.
- An arbitrary prefetch ceiling rejected the archive's number of JavaScript
  chunks after complete artifact validation. The correction selected only the
  entry point's explicit assets and retained all 39 artifact hashes. Lazy page
  chunks were exercised through normal browser navigation.
- Preflight expectations initially assumed 204, and then a success status for an
  untrusted origin. The accepted/live contract is allowed-origin 200 and safe
  rejected-origin 400 without permission. The instrumented receipt records exact
  statuses; the earlier generic STOP lacked exact failed-request instrumentation,
  so its historical location is not invented. Existing completed static evidence
  was reused and only one rejected-origin request was repeated for final proof.
- The browser tool's `.fill()` did not retain a native date value. The form
  correctly rejected the empty date without a backend transition; segmented
  native keystrokes produced the verified value and the transition succeeded.
  The actual Settings heading is Settings & profile; one wait for Settings timed
  out before inspection corrected the locator. Neither was a service failure.

The existing artifact was downloaded three times during those reader corrections,
about **4.8 MB compressed in total**, with no new build. No uncontrolled retry loop
or repeated workspace issuance occurred. Historical stops and the one-activation
receipt remain preserved.

The available console reader returned **zero warning/error entries** at the
inspected point; no observed CSP/mixed-content/credential error was reported.
This is sampled provider-visible console evidence, not an exhaustive browser
trace. Public artifact/configuration inspection and real persisted UI outcomes
demonstrated the expected AWS API integration; no localhost use was observed.

One bounded API log read, limited to 200 events and the browser's time window,
returned **191 events**: **184 × 200, 4 × 201, 3 × 404**;
methods **92 OPTIONS, 83 GET, 8 POST, 8 PATCH**. It found **zero 5xx**, token/
credential patterns or private test-content markers. The three GET 404s are
consistent with the intentional missing application and the detail page's three
parallel application/interview/activity queries; the UI showed the expected safe
error. No unrelated visitor attribution is inferred from a public time window.
Only allowlisted operational fields were saved, not raw messages or request
payloads. Pagination was advertised, so the sample is not asserted exhaustive.
No Insights, broad log scan or paid monitoring feature was introduced.

API Gateway response latency in that mixed sample was **13 ms minimum, 31 ms
median, 3421 ms maximum**, including preflights. These are gateway observations,
not client page-load measurements, p95/SLOs or load/scaling guarantees.

**Still unverified:** live UI display/recovery from a 409 conflict. A separate tab
was anonymous and browser history restored fresh data, so no stale authenticated
document was safely obtained without copying tokens or issuing another workspace.
Phase 4E's actual backend 409 checks remain valid, but they are not browser proof.
No 5xx/offline fault was deliberately injected to qualify every retry screen.
The browser scope did not expose a full network timeline, so exhaustive browser
request/header attribution remains unverified. No persistent HAR/trace was made.

All four Phase 4E limitations remain **UNVERIFIED**: natural rejection of a valid
expired session; eventual physical TTL deletion; live invalid/unavailable signing
secret failure; Lambda warning/error-log delivery. Browser exit/guard success does
not prove natural expiration. No AWS service, signing key or permission was
disrupted to manufacture these cases.

## Fictional data, costs and next phase

Exactly **one** additional demo workspace was created for Phase 4F, with the normal
30-application fictional seed. Settings displayed expiry **October 20, 2026 at
1:14 PM America/New_York**, to minute precision. Its signed token/owner UUID was
not extracted merely for reporting, and no expiry seconds are invented.

- Added application **`7b162163-9029-4aaf-9445-764b72107006`** is **ARCHIVED**,
  from APPLIED. Its final role is Cloud Software Engineer — Browser Verification
  (edited), at Phase4F Fictional Research & Development Cooperative.
- Added interview **`a1db8878-2469-4011-997b-e9df85376279`** is **CANCELED**,
  October 20 at 2 PM New York, 45 minutes. Its fictional history remains.
- One added note remains with the application. Its UUID was not collected;
  content was fictional and no note was hard-deleted in this phase.
- Default follow-up interval is **8 days**. The separate October 20 check-back
  was cleared through the no-separate-action choice before archiving.
- Exit completed normally. Session access and UI caches were cleared; a former
  protected application URL returned to landing. There was no second workspace,
  reset execution, large export or hard workspace deletion. Retained records use
  the demo TTL lifecycle; their physical deletion was not observed, and Phase 4F
  did not independently read every item's TTL.

Cost observations are bounded activity counts, not a bill: the 191-event API
sample includes automatic/preflight requests, while static verification recorded
nine public requests plus at most eight earlier uninstrumented requests. It is
not a total browser resource/HAR count. The complete artifact was 1.6 MB per
download; no build or deployment was triggered. Actual gross charges, remaining
credits and billing-tag effectiveness were not measured. The owner's accepted
**USD2 incremental review / USD5 first-week stop / unexplained USD1/day
investigation** controls remain manual. The existing USD10 budget has no
recipients and is not a cap. No Billing settings were changed.

Inherited production findings **F03/F04/F07/F08/F10/F11** remain open: recorded
CDK tooling advisory, anonymous issuance/cost amplification, retained-data/restore
governance, mutable CI action references, signing-key cache/rotation lifecycle,
and real production authentication/release. These were carried forward rather
than re-audited. No Cognito account, production readiness or unattended public
launch is claimed.

**Phase 4G entry requires** explicit owner authorization for the original
operations/scaling/cost scope, a current accepted supervised cost/lab baseline,
acknowledgment of the preference defect and remaining qualifications (or a
separately authorized qualified frontend repair), and resolution of any new
source/deployment/security/cost discrepancy. Any load-generating work needs its
own concrete bounded authorization; Phase 4F grants none. No new phases or
architecture redesign are proposed. **4G operations/scaling/cost and 4H final
staging evidence freeze remain unchanged and unstarted.**

## Evidence and local documentation validation

Sanitized Git-ignored evidence is in `.tools/phase4f/`, with hashes in
`final-disposition.json`: `billing-window.json`, `metadata-baseline.json`,
`artifact-verification.json`, `hosted-verification.json`,
`browser-issuance-once.json`, `browser-observations.json`, `browser-console.json`,
`test-data-inventory.json`, `settings-finding.json`, `operational-observations.json`,
reader-correction receipts, the initial instrumented STOP journal and screenshots.
The published app and prior Phase 4D/4E evidence/attempt ledgers were preserved.
Git does not transfer ignored evidence or screenshots by itself.

No application source was edited and no local build was needed. Validation was
the actual bounded hosted browser flow, existing artifact verifier, exact served
entry-byte comparison, source confirmation of the Settings finding, final AWS
metadata/log sample and documentation diff/link/evidence checks. No new test was
written to mirror unchanged implementation. Documentation remains local/unpushed;
publication could trigger Amplify and needs its own authorization.
