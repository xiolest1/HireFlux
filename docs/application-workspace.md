# Application opportunity workspace

The application detail route is one lifecycle-aware opportunity workspace. It
does not split notes, interviews, details, or history into route-local tabs.
The default reading order is identity and current state, What’s next, Journey,
Interview process, Notes, Opportunity details, and Full activity.

## Lifecycle presentation

The frontend workspace selector ranks candidate-facing actions from the
application status, server-provided `allowed_transitions`, milestone
timestamps, next-step responsibility, check-back date, interview rounds, recent activity, and the current
calendar date in the workspace time zone. It is a presentation selector only:
it cannot make a transition available unless the backend returned it.

Daily workflow actions are promoted while correction, archive, and other
exceptional transitions remain in More actions. Archive requires a confirmation
dialog. Drafts emphasize applying; active pursuits emphasize follow-up or the
next interview; Offer emphasizes recording a decision; closed outcomes favor
reflection; Archived records are read-oriented and expose only the exact
server-provided restore target.

Operational intent belongs to the Application. `next_step_responsibility`
answers who owns the next move (`CANDIDATE`, `EMPLOYER`, or explicit `NONE`),
while `next_step_note` explains it and `follow_up_date` is only the check-back
date when the opportunity should return to attention. A scheduled later round
is derived from Interview records rather than copied into these fields.

The canonical `POST /api/v1/applications/{application_id}/next-step` command
validates these fields together, accepts only active opportunities, uses
optimistic concurrency, and atomically records `NEXT_STEP_UPDATED`. Candidate
actions require a note; `NONE` requires an empty note and date. The general edit
route cannot change the two semantic fields. Existing date-only records remain
valid legacy check-backs until the candidate reviews them.

Completing a candidate action clears its note/date and records `NONE`.
Completing an employer check-back clears only the date and preserves the fact
that the candidate is waiting. All transition, next-step, and check-back
mutations send the application version already shown. A conflict keeps entered
intent visible, refreshes the current version, and allows a deliberate retry.

## Navigation and progressive loading

Canonical deep links use
`?section=journey|interviews|notes|details|history`. Existing
`?tab=notes|interviews|activity` links are translated to the matching section.
An `interview=<uuid>` link focuses and highlights that interview round.
Preparation and reflection links open the global Interviews workspace at
`/interviews?interview=<uuid>`.

The application core loads first. Recent activity and application interviews
load after the core succeeds. The two-note preview loads as Notes approaches
the viewport. Full notes and older activity load only after disclosure. A
secondary-resource failure is contained within its section and does not replace
the opportunity workspace.

Journey uses server-owned application milestones plus candidate-relevant
interview events. Full activity remains a separate newest-first audit view;
technical resource edits do not receive Journey-level prominence.
