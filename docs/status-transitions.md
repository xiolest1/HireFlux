# Application status transitions

## Policy

Status is never null. Creation starts in `DRAFT` or `APPLIED`; other initial states would skip required workflow history. Status can change only through the dedicated backend transition service. Editing application details cannot change status.

`applied_date` is required whenever an active application is `APPLIED`, `INTERVIEW`, `OFFER`, or `REJECTED`. A draft may omit it. An archived draft may also omit it.

## Transition matrix

`Allowed` means the transition is implemented. `Forbidden` includes both product decisions and the binding `REJECTED -> INTERVIEW` rule.

| From / To | DRAFT | APPLIED | INTERVIEW | OFFER | REJECTED | ARCHIVED |
| --- | --- | --- | --- | --- | --- | --- |
| DRAFT | No-op | Allowed | Forbidden | Forbidden | Forbidden | Allowed |
| APPLIED | Forbidden | No-op | Allowed | Forbidden | Allowed | Allowed |
| INTERVIEW | Forbidden | Forbidden | No-op | Allowed | Allowed | Allowed |
| OFFER | Forbidden | Forbidden | Forbidden | No-op | Allowed | Allowed |
| REJECTED | Forbidden | Forbidden | **Forbidden** | Forbidden | No-op | Allowed |
| ARCHIVED | Conditional restore | Conditional restore | Conditional restore | Conditional restore | Conditional restore | No-op |

## Implementation decisions

- Archiving is reversible and replaces permanent deletion. When entering `ARCHIVED`, the application stores `archived_from_status`. Restore is allowed only to that exact prior status; this prevents archive/restore from bypassing the workflow.
- Repeating the current status is an idempotent no-op: it creates no activity and does not increment the version.
- `OFFER -> REJECTED` is allowed for a rescinded or declined offer because the current vocabulary has no separate declined state.
- Backward movement such as `INTERVIEW -> APPLIED` is forbidden. A correction can use a future explicit administrative repair workflow rather than weakening ordinary transitions.
- Moving a draft to `APPLIED` requires an `applied_date` in the transition request if the record does not already have one. The server does not silently invent the date.
- Each successful change, including archive and restore, appends a human-readable activity item. The service produces its meaning; the repository handles atomic persistence.

These choices are centralized and easy to revise. Tests enumerate the matrix so a policy change is intentional and visible.

