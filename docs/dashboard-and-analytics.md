# Dashboard and analytics contract

The protected `/dashboard` route is the workspace Home. It is the default destination after starting or resetting a demo, while `/` remains the public recruiter landing page. Direct protected deep links remain intact when a valid session already exists.

## Workspace Home

The Home page answers four questions in priority order:

1. **How many jobs am I pursuing?** Total tracked includes every current status, including archived. Active pursuits include only `APPLIED`, `SCREENING`, `INTERVIEW`, and `OFFER`.
2. **What needs my attention today?** The Action Center includes overdue/today follow-ups, interviews in the next 24 hours, and applications sitting in `APPLIED` or `SCREENING` for at least 14 days. “Today” is the calendar date in the workspace's saved time zone. Follow-ups can be completed or rescheduled from Home.
3. **How successful has my search been?** Response, interview, offer, and acceptance rates use server-owned historical milestones and always include their submitted-application denominator.
4. **What should I do next?** Priority actions, the next scheduled interviews, and recent application movement lead to the relevant owned record.

The dashboard also shows an eight-week submission trend and a compact current-status breakdown. Dense comparisons belong on `/analytics`, not on the Home page.

## Metric definitions

- **Submitted population:** applications with a server-owned `submitted_at` milestone inside the selected date range. Drafts are excluded. Later current outcomes do not remove an application from this denominator.
- **Response:** first reached screening, interview, offer, acceptance, or rejection. Withdrawal by itself is not treated as an employer response.
- **Interview, offer, and acceptance:** first reached the corresponding milestone at any time, regardless of current status.
- **Rate:** milestone count divided by submitted count. A zero submitted population produces a zero rate and an explicit zero denominator.
- **Current analytics population:** for `30d` and `90d`, applications submitted inside the range plus records whose current status is `DRAFT`; for `all`, every current record. An archived record without a submitted milestone therefore appears only in `all`. Summary, current status distribution, and stage aging all use this same population.
- **Current status distribution:** current records in the current analytics population; it is not a historical funnel.
- **Stage aging:** elapsed time since the server-owned current `stage_entered_at` milestone for active pursuits in the current analytics population.
- **Average first response:** mean elapsed days from `submitted_at` to `first_response_at` for submitted applications that received a response.
- **No response:** submitted applications without `first_response_at`.
- **Source performance:** rate comparisons are labeled as a small sample until the source contains at least three submitted applications.

Ranges are `30d`, `90d`, and `all`; date windows use `submitted_at`. Analytics filters support current status, normalized source, and work mode. Results describe the temporary workspace and are not predictions about a user's career or future outcomes.

Application lists accept an explicit server-owned view. `ACTIVE` contains `APPLIED`, `SCREENING`, `INTERVIEW`, and `OFFER`; `ALL` contains every status, including `ARCHIVED`; and `ARCHIVED` contains only archived records. An explicit status filter selects that status regardless of view. The web client keeps both selectors coherent: active status filters use `ACTIVE`, archived uses `ARCHIVED`, and draft or completed-outcome filters use `ALL`. The signed cursor is bound to the effective view, status, search filters, and sort order. Omitting `view` preserves the legacy non-archived list used by older API clients; the web client always sends its selected or configured view.

## Workspace calendar and time zone

The saved `time_zone` is a validated IANA name and defines the workspace calendar. Dashboard follow-up classification converts the current instant into that zone and compares its local date with `follow_up_date`. A date before the local date is overdue; an equal date is due today. Changing the saved zone can therefore change which date is currently “today,” but it never rewrites an existing follow-up date.

`follow_up_date` is an ISO `YYYY-MM-DD` calendar value, not a timestamp or midnight UTC instant. The API and DynamoDB preserve that date exactly, and the UI renders it without applying a time-zone shift. When a new application form uses the default follow-up interval, the browser starts from the current calendar date in the saved workspace zone and adds `default_follow_up_days`; the user can still replace or clear that proposed date.

Interviews and historical milestones are different: they are timezone-aware instants stored and exchanged in UTC. The UI displays interview timestamps in the saved workspace zone, while rolling analytics ranges compare the server-owned UTC milestone timestamps. This separation prevents a date-only follow-up from moving to an adjacent day while still presenting scheduled times in the user's chosen zone.

## Demo behavior

Each new 24-hour workspace receives 16 synthetic applications covering all statuses, multiple sources and work modes, overdue/today/upcoming follow-ups, scheduled/completed/canceled interviews, notes, and enough historical activity to exercise the metrics. The dataset contains no real applicant or recruiter information.

Settings persist only for that isolated workspace: time zone, follow-up interval, default application view, dashboard range, and theme. Identity and production security controls are read-only previews; the demo has no password, MFA, external login, uploads, email delivery, or permanent account deletion.

Analytics and authorization are server-owned. React validates the API response and presents it; it does not fetch every page to invent totals or decide ownership, workflow legality, or funnel membership.
