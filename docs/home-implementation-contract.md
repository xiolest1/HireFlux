# Home implementation contract (2026-09-23)

The accepted Stage 1–3 documents remain unchanged. The production Home implementation uses one candidate-facing decision band. Dashboard actions are server-generated recorded commitments or review cues; a small Home-specific presentation model distinguishes available work, waiting, incomplete evidence, no known candidate action, and no recorded opportunities. Analytics remains reporting-period interpretation, not another operational next-action owner.

## Semantic corrections and scope

- An undated candidate-owned next step is `CANDIDATE_ACTION_UNDATED` with no due date. It cannot be presented as due today.
- A 14-day APPLIED/SCREENING stage-age cue is `STALE_APPLICATION`, without a due date. It is a Home review suggestion, not an overdue commitment.
- Search Health's 21/14/9-day stage-specific patterns remain separate strategic heuristics. Their purpose differs from Home's earlier APPLIED/SCREENING review cue, so the thresholds were not unified. Neither is a recorded deadline.
- The Dashboard action response now carries optional next-step `responsibility`, allowing Home to distinguish candidate-owned, employer-owned, and unknown ownership without guessing. It also surfaces upcoming scheduled interviews beyond the previous 24-hour `INTERVIEW_SOON` window as `INTERVIEW_UPCOMING`, subject to the existing five-item interview query cap. Existing kinds remain supported by the frontend validator.
- The endpoint shape is additive, but the new action kinds and removal of invented dates are not compatible with an older frontend validator. If frontend and backend are released separately, deploy the updated frontend first; the existing `INTERVIEW_SOON` and dated follow-up kinds remain valid during that transition.
- Home may show up to 100 due follow-ups and five upcoming interviews from its server source. Its row disclosure shows all actions returned by that source; it must not imply those caps are an exhaustive search. Applications and Interviews remain the full-record destinations, but their classifications are not identical to Dashboard actions.

## Evidence boundary

Home can only judge recorded information. It cannot know unrecorded obligations, opportunity preference, external conversations, employer intent, or what changed since a previous visit. A failed operational refresh with a cached snapshot is partial evidence, not an all-clear. The Applications workspace is consulted only when Dashboard surfaces no action; a failed ownership check is also partial. Analytics can fail independently and does not replace the operational answer. Date-based status can age while a long-lived page stays open; there is no midnight refresh timer in this implementation.

The Stage 1–3 documents describe the design decision and evidence ceiling; this note records the bounded contract and intentional cross-surface distinctions of its implementation.
