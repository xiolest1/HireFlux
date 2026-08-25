# Application opportunity workspace

The application detail route is one lifecycle-aware opportunity workspace. It
does not split notes, interviews, details, or history into route-local tabs.
The default reading order is identity and current state, What’s next, Journey,
Interview process, Notes, Opportunity details, and Full activity.

## Lifecycle presentation

The frontend workspace selector ranks candidate-facing actions from the
application status, server-provided `allowed_transitions`, milestone
timestamps, follow-up date, interview rounds, recent activity, and the current
calendar date in the workspace time zone. It is a presentation selector only:
it cannot make a transition available unless the backend returned it.

Daily workflow actions are promoted while correction, archive, and other
exceptional transitions remain in More actions. Archive requires a confirmation
dialog. Drafts emphasize applying; active pursuits emphasize follow-up or the
next interview; Offer emphasizes recording a decision; closed outcomes favor
reflection; Archived records are read-oriented and expose only the exact
server-provided restore target.

All transition and follow-up mutations send the application version already
shown to the user. A conflict keeps the attempted workflow visible and requires
the user to reload the opportunity before retrying.

## Navigation and progressive loading

Canonical deep links use
`?section=journey|interviews|notes|details|history`. Existing
`?tab=notes|interviews|activity` links are translated to the matching section.
An `interview=<uuid>` link focuses and highlights that interview round.
Preparation and debrief links open the global Interviews workspace at
`/interviews?interview=<uuid>`.

The application core loads first. Recent activity and application interviews
load after the core succeeds. The two-note preview loads as Notes approaches
the viewport. Full notes and older activity load only after disclosure. A
secondary-resource failure is contained within its section and does not replace
the opportunity workspace.

Journey uses server-owned application milestones plus candidate-relevant
interview events. Full activity remains a separate newest-first audit view;
technical resource edits do not receive Journey-level prominence.
