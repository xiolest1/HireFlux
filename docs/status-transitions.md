# Application status transitions

## Policy

Status is never null. Creation starts in `DRAFT` or `APPLIED`; other initial states would skip required workflow history. Status can change only through the dedicated backend transition service. Editing application details cannot change status.

`applied_date` is required whenever an application has left `DRAFT`. A draft may omit it, and an archived former draft may also omit it.

## Transition matrix

`Allowed` means the transition is implemented. `Forbidden` includes both product decisions and the binding `REJECTED -> INTERVIEW` rule.

| From / To | DRAFT | APPLIED | SCREENING | INTERVIEW | OFFER | ACCEPTED | REJECTED | WITHDRAWN | ARCHIVED |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DRAFT | No-op | Allowed | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Allowed |
| APPLIED | Forbidden | No-op | Allowed | Allowed | Allowed | Forbidden | Allowed | Allowed | Allowed |
| SCREENING | Forbidden | Forbidden | No-op | Allowed | Allowed | Forbidden | Allowed | Allowed | Allowed |
| INTERVIEW | Forbidden | Forbidden | Forbidden | No-op | Allowed | Forbidden | Allowed | Allowed | Allowed |
| OFFER | Forbidden | Forbidden | Forbidden | Forbidden | No-op | Allowed | Allowed | Allowed | Allowed |
| ACCEPTED | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | No-op | Forbidden | Forbidden | Allowed |
| REJECTED | Forbidden | Forbidden | Forbidden | **Forbidden** | Allowed | Forbidden | No-op | Forbidden | Allowed |
| WITHDRAWN | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | No-op | Allowed |
| ARCHIVED | Conditional restore | Conditional restore | Conditional restore | Conditional restore | Conditional restore | Conditional restore | Conditional restore | Conditional restore | No-op |

## Implementation decisions

- Archiving is reversible and replaces permanent deletion. When entering `ARCHIVED`, the application stores `archived_from_status`. Restore is allowed only to that exact prior status; this prevents archive/restore from bypassing the workflow.
- Repeating the current status is an idempotent no-op: it creates no activity and does not increment the version.
- Forward skips are intentional. Some hiring processes omit a named screening or interview stage, so `APPLIED` and `SCREENING` may advance directly to a later observed milestone.
- `WITHDRAWN` records a candidate ending the process. `REJECTED` remains an employer outcome, and `ACCEPTED` remains a successful terminal outcome.
- `OFFER -> REJECTED` represents a rescinded offer; a candidate declining or leaving the process uses `WITHDRAWN`.
- `REJECTED -> OFFER` is an explicit correction path for an application that was marked rejected by mistake or later resulted in an offer. It does not permit `REJECTED -> INTERVIEW`.
- Backward movement such as `INTERVIEW -> APPLIED` is forbidden. A correction can use a future explicit administrative repair workflow rather than weakening ordinary transitions.
- Moving a draft to `APPLIED` requires an `applied_date` in the transition request if the record does not already have one. The server does not silently invent the date.
- Each successful change, including archive and restore, appends a human-readable activity item. The service produces its meaning; the repository handles atomic persistence.
- The backend records the first time an application reaches submitted, response, screening, interview, offer, and acceptance milestones. These server-owned timestamps support historical funnel rates even after the current status changes.

These choices are centralized and easy to revise. Tests enumerate the matrix so a policy change is intentional and visible.
