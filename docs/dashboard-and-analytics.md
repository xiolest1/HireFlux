# Dashboard and analytics contract

The protected `/dashboard` route is the workspace Home. It is the default destination after starting or resetting a demo, while `/` remains the public candidate-focused landing page. Direct protected deep links remain intact when a valid session already exists.

## Workspace Home

The Home page answers four questions in priority order:

1. **How many jobs am I pursuing?** Total tracked includes every current status, including archived. Active pursuits include only `APPLIED`, `SCREENING`, `INTERVIEW`, and `OFFER`.
2. **What needs my attention today?** The Action Center includes overdue/today follow-ups, interviews in the next 24 hours, and applications sitting in `APPLIED` or `SCREENING` for at least 14 days. “Today” is the calendar date in the workspace's saved time zone. Follow-ups can be completed or rescheduled from Home. Each priority group shows a compact three-item preview when it contains more actions, with an inline control to reveal the remaining actions.
3. **How successful has my search been?** Response, interview, offer, and acceptance rates use server-owned historical milestones and always include their submitted-application denominator.
4. **What should I do next?** Priority actions, the next scheduled interviews, and recent application movement lead to the relevant owned record.

The dashboard also shows an eight-week submission trend and a compact current-status breakdown. Dense comparisons belong on `/analytics`, not on the Home page.

## Metric definitions

- **Submitted population:** applications with a server-owned `submitted_at` milestone and canonical `applied_date` inside the selected date range. Drafts are excluded. Later current outcomes do not remove an application from this denominator.
- **Response:** first reached screening, interview, offer, acceptance, or rejection. Withdrawal by itself is not treated as an employer response.
- **Interview, offer, and acceptance:** first reached the corresponding milestone at any time, regardless of current status.
- **Rate:** milestone count divided by submitted count. A zero submitted population produces a zero rate and an explicit zero denominator.
- **Current analytics population:** for `30d` and `90d`, applications submitted inside the range plus records whose current status is `DRAFT`; for `all`, every current record. An archived record without a submitted milestone therefore appears only in `all`. Summary, current status distribution, and stage aging all use this same population.
- **Current status distribution:** current records in the current analytics population; it is not a historical funnel.
- **Stage aging:** calendar days since the server-owned current `stage_entered_at` milestone for active applications in `APPLIED`, `SCREENING`, `INTERVIEW`, or `OFFER`. The clock resets whenever an application moves to a new stage. Inclusive buckets are `0-7`, `8-14`, and `15-30` days, followed by `31+` days. These buckets are descriptive review signals, not predictions.
- **Average first response:** mean elapsed days from `submitted_at` to `first_response_at` for submitted applications that received a response.
- **No response:** submitted applications without `first_response_at`.
- **Source performance:** table rows are labeled as a small sample until the source contains at least three submitted applications. Search Health uses the stricter five-application threshold documented below before drawing a source conclusion.
- **Adjacent-period comparison:** `30d` and `90d` compare the selected inclusive window with the equally sized window immediately before it. Rate deltas are percentage-point differences. `all` has no comparison because it has no finite adjacent window.
- **Follow-up coverage:** active pursuits with a non-null `follow_up_date` divided by active pursuits in the current analytics population. Missing, overdue, and due-today counts use the workspace calendar.
- **Search-health insights:** a deterministic, server-owned rules engine organizes candidates around momentum, responsiveness, pipeline movement, follow-up hygiene, and source effectiveness. It composes at most four cards by actionability, urgency, evidence quality, magnitude, and tone, then suppresses simpler cards when a combined signal already explains the same data. Every card includes a compact evidence summary, optional sample qualifier, expandable detail, and only supported application-list or creation actions. These rules are descriptive guidance, not scoring, candidate evaluation, or hiring prediction.

Search Health uses conservative product heuristics rather than universal job-market benchmarks. Seven-day momentum warnings require at least five submissions in the prior week, a decline of at least three submissions, and current volume no greater than 75% of the prior week. Thirty-day response trends require at least five recent and five earlier submissions plus a 15-percentage-point difference. Source conclusions require at least five submissions from that source, a response rate at least 15 percentage points above the workspace baseline, and at least a 40% source response rate. Evidence lines expose the relevant counts, denominators, periods, or stage thresholds; small samples receive an intentional “still building your picture” state instead of a rate conclusion.

Search Health classifications deliberately separate urgency from direction. `Action needed` is reserved for overdue or due-today work. `Worth watching` describes meaningful but non-urgent stage-aging and negative trend signals. `Worth knowing` provides useful context without implying a problem, and `Positive signal` is used only for supported improvements or strengths. Limited rate samples remain eligible only after the minimum threshold and receive an `Early signal` qualifier; they never become `Action needed` solely because a rate declined.

Pipeline review thresholds vary by current stage: `APPLIED` is reviewed at 21 days, `SCREENING` at 14 days, and `INTERVIEW` at 9 days. Offers are excluded from generic stage-aging warnings because HireFlux does not currently track an offer deadline; draft, terminal, and archived records are also excluded. Follow-up reasoning combines overdue, due-today, due-soon, and missing plans into one card while the headline reflects only the most urgent subset. Combined rules recognize lower volume with higher interview conversion, higher volume with lower response conversion, and stable volume with improving response and interview conversion.

Ranges are `30d`, `90d`, and `all`; date windows and submission trends use the user-entered `applied_date`, while `submitted_at` remains the exact server instant used for elapsed-time metrics. This keeps direct `APPLIED` creation and `DRAFT` → `APPLIED` transitions in the same reporting window when they share an applied date. Analytics filters support current status, normalized source, and work mode. Results describe the temporary workspace and are not predictions about a user's career or future outcomes.

Application lists accept an explicit server-owned view. `ACTIVE` contains `APPLIED`, `SCREENING`, `INTERVIEW`, and `OFFER`; `ALL` contains every status, including `ARCHIVED`; and `ARCHIVED` contains only archived records. An explicit status filter selects that status regardless of view. The web client keeps both selectors coherent: active status filters use `ACTIVE`, archived uses `ARCHIVED`, and draft or completed-outcome filters use `ALL`. The signed cursor is bound to the effective view, status, search filters, and sort order. Omitting `view` preserves the legacy non-archived list used by older API clients; the web client always sends its selected or configured view.
The application list also accepts `stage_age` with one of `0-7`, `8-14`, `15-30`, or `31+`. It requires the `ACTIVE` view, is evaluated by the server against current `stage_entered_at`, and is included in the signed cursor scope. The web client exposes this as a filter chip and uses it for exact links from the aging buckets.
The list also accepts `follow_up=NEEDS_ATTENTION` with the `ACTIVE` view. It returns active records whose follow-up date is due today, overdue, or missing in the workspace calendar, and it binds that filter and date to signed cursor scope. Search Health uses this deep link for its follow-up CTA.

## Workspace calendar and time zone

The saved `time_zone` is a validated IANA name and defines the workspace calendar. A browser workspace automatically detects the browser's IANA time zone and keeps it synchronized through the existing settings endpoint; the server's `UTC` value is only a fallback when detection is unavailable or the browser itself reports UTC. Choosing a different time zone in Settings creates a manual override for the rest of that browser workspace. Dashboard follow-up classification converts the current instant into the saved zone and compares its local date with `follow_up_date`. A date before the local date is overdue; an equal date is due today. Changing the saved zone can therefore change which date is currently “today,” but it never rewrites an existing follow-up date.

`follow_up_date` is an ISO `YYYY-MM-DD` calendar value, not a timestamp or midnight UTC instant. The API and DynamoDB preserve that date exactly, and the UI renders it without applying a time-zone shift. When a new application form uses the default follow-up interval, the browser starts from the current calendar date in the saved workspace zone and adds `default_follow_up_days`; the user can still replace or clear that proposed date.

`applied_date` is a user-entered calendar date and cannot be later than the current date in the saved workspace time zone. It is never converted into a timestamp. It is the canonical calendar date for submission ranges and trends. `submitted_at` is a separate server-owned UTC instant captured when an application is created as `APPLIED` or first leaves `DRAFT`; `first_response_at` and the other historical milestones are also UTC instants. Analytics durations use these ordered instants, so a date-only value cannot create a negative response time. Legacy records with out-of-order response milestones are excluded from the average rather than producing an invalid value.

Interviews and historical milestones are different from date-only fields: they are timezone-aware instants stored and exchanged in UTC. The UI displays interview timestamps in the saved workspace zone, while elapsed-time analytics compare the server-owned UTC milestone timestamps. This separation prevents a date-only follow-up from moving to an adjacent day while still presenting scheduled times in the user's chosen zone.

## Demo behavior

Each new 24-hour workspace receives 30 synthetic applications covering all statuses, multiple sources and work modes, overdue/today/upcoming follow-ups, scheduled/completed/canceled interviews, notes, and enough historical activity to exercise the metrics. The dataset contains no real candidate, employer, or contact information.

Settings persist only for that isolated workspace: time zone, follow-up interval, default application view, dashboard range, and theme. The Personal account preview also offers clearly labeled, workspace-scoped simulations for notification preferences, identity recovery, MFA, and active-session controls. These interactions never change authentication or send messages; the demo has no password, MFA enrollment, external login, uploads, email delivery, account conversion, or permanent account deletion. The account-continuity view describes what a future migration could preserve without claiming that a migration service exists.

Analytics and authorization are server-owned. React validates the API response and presents it; it does not fetch every page to invent totals or decide ownership, workflow legality, or funnel membership.
Outcome cards link to the supporting application workspace rather than claiming that a historical milestone is the same as current status. Insight action parameters are validated and reduced to the application list's supported `view`, `status`, `source`, and `follow_up` filters before navigation.

Search Health is computed on demand and does not persist insight snapshots. It therefore does not claim that an insight is new, resolved, or improved relative to a prior generated card. Historical insight lifecycle, more advanced confidence treatment, and asynchronous analytics snapshots remain possible future work rather than current behavior.
