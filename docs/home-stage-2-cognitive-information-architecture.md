# Home Stage 2 — cognitive and information architecture

**Status:** proposed Stage 2 architecture for review, 2026-09-23. This defines candidate-facing meaning and sequence, not visual design, components, an API, a scoring algorithm, or implementation work. The accepted [Stage 1 audit](home-stage-1-cognition-information-audit.md) is the evidence foundation; its unobserved candidate behaviors remain hypotheses.

## Architectural decision

Home should operate as an **evidence-led re-entry path**:

> Establish the scope of the recorded search → identify known consequential commitments and exceptions → distinguish whose move it is → support a defensible action or an honest waiting state → explain the evidence and uncertainty → offer broader history, progress, and exploration by choice.

This is a **default cognitive dependency order**, not a command that every item must appear in a fixed visual position or that every visit has one prescribed action. The candidate should not have to compare independent “next,” “attention,” and “focus” claims to discover which system has authority. A single candidate-facing interpretation of *now* can draw from several domain systems without merging their calculations into one global score.

The Stage 1 core job remains unchanged: **Home should restore situational awareness of the recorded search and help the candidate choose a defensible next step, while making the limits of that judgment clear.** Home cannot know the whole real-world search or the candidate's objectively most important opportunity.

## The sequence and its dependency logic

1. **Scope and orientation.** Answer “Which workspace and recorded search am I seeing?” and provide enough current context to interpret the rest. Do not equate total tracked records with active workload. State freshness or partial availability when material. This is a short re-entry function, not a full retrospective.
2. **Consequential signals.** Answer “Is a recorded commitment approaching or past, or is an exception worth checking?” Separate an explicit follow-up date, a scheduled interview, and a stage-age heuristic. A candidate needs this distinction before interpreting a suggested next step. The architecture does not assert that overdue always outranks an imminent interview.
3. **Ownership and possible action.** Answer “Is the move mine, the employer's, or unknown—and what can I actually do?” Candidate-owned work, employer waiting, and missing next-step information are different states. Offer a path into the relevant work surface where action is possible. Where multiple recorded commitments coexist, present them as defensible alternatives rather than inventing a universal winner.
4. **Reason and confidence.** Answer “Why is this being surfaced, and how certain is HireFlux?” The evidence supporting a suggestion should be available at the point of decision, not require comparison with an unrelated Analytics panel. Explicit dates are facts; stage-age and performance signals are inferences. This is a logical dependency of step 3, not necessarily a separate section.
5. **Context and reorientation.** Answer “What in the recorded search helps me understand the current situation?” Recently edited records, milestone history, and selected-period changes may help, but they answer different questions. There is **no reliable since-last-visit material-change feed** today; no such claim belongs in the architecture without a new data contract.
6. **Strategic understanding and exploration.** Answer “How is the search progressing, and what else can I inspect?” Aggregate progress is useful for periodic reflection, not an automatic competitor to a due commitment. Deep comparisons, full records, interview preparation, pipeline movement, Settings, and demo onboarding have dedicated purposes. Their entry points should remain available without masquerading as today's highest-priority work.

This order follows consequence and decision dependencies, not a proven universal scanning pattern. Stage 1 establishes the questions more strongly than their precise sequence. A future test may change the relative emphasis or adjacency of steps 1, 2, 5, and 6 while preserving their distinct roles.

## One candidate-facing model, several legitimate producers

**The candidate-facing decision context owns the question “What can I work on now?”** It is a semantic responsibility, not necessarily a new service. It must be able to state what is known, why an item qualifies, whether action is candidate-owned, and where the candidate can continue. It may show more than one relevant choice. Its output must not pretend to rank personal importance that HireFlux has not observed.

Other systems retain their proper questions:

- **Application and follow-up facts** supply recorded status, responsibility, date, stage history, and available record actions. They do not independently issue a second Home-wide prescription.
- **Interview workflow** supplies schedule, preparation state, and interview-specific next action. Home may elevate a recorded commitment and send the candidate to Interviews; it does not reproduce preparation detail or override that workflow.
- **Analytics/progress interpretation** supplies patterns, sample quality, and strategic reflection. A concrete candidate-owned process concern discovered there may contribute to the decision context; otherwise “recommended focus” must remain clearly strategic rather than a rival answer to today's task question.
- **Recent movement/activity** supplies edit or event history with its actual time scope. “Recently touched” is not “materially changed since you were here.” It does not rank urgency solely by recency.
- **Search tour and generic navigation** support learning and exploration. They are not commitments, exceptions, or personal recommendations.

This resolves the present cross-panel reconciliation problem by assigning each claim a role. It does **not** require one backend priority algorithm, one card, one recommendation, or the disappearance of Analytics from Home. Those implementation and presentation choices remain open.

## Decision-context information contract

Before Home can responsibly ask a candidate to act on a surfaced item, its candidate-facing meaning should be answerable in these terms:

- **Referent:** which opportunity, interview, or cross-workspace condition is involved?
- **Provenance:** recorded fact, reliable derivation, heuristic inference, or recommendation?
- **Time:** an actual saved calendar date/instant, an elapsed-time threshold, or no date at all? In which workspace time zone is a date interpreted?
- **Ownership:** candidate action, employer wait/check-back, or unknown? A saved follow-up on an employer-owned next step can still create a candidate check-back; the two responsibilities must not be conflated.
- **Reason:** what recorded evidence makes it relevant *now*? If only a heuristic is available, what is the limit of that inference?
- **Continuation:** what action or destination exists? A signal with no immediate action may still justify awareness, but should not be phrased as an executable task.
- **Coverage/freshness:** is the answer based on current data, a bounded subset, or a partially unavailable source?

This is an **information contract**, not a proposed response schema or new API. Domain services remain the authority for business policy and facts; React must not invent transitions, metrics, ownership, or deadline semantics. A later implementation design can decide how the meaning is produced and rendered.

## Consequence without an unsupported universal rank

The candidate-facing model should distinguish **recorded time sensitivity**, **candidate actionability**, **heuristic review value**, and **personal importance**. HireFlux can often compare the first two within known data; it can sometimes suggest the third; it cannot calculate the fourth reliably. Thus:

- An explicit overdue follow-up is a known date condition, not proof it is the candidate's most important opportunity.
- An upcoming interview is a known commitment; preparation relevance grows as it approaches, but an arbitrary cross-domain winner is not established by Stage 1.
- An undated candidate next step may be actionable without being due today.
- A stage-aged opportunity may merit review without being overdue or evidence of employer intent.
- An employer-owned wait can be important context without requiring candidate action now.

When evidence does not support a unique order, Home should preserve a small set of meaningful choices and their reasons, rather than hide uncertainty behind one apparently authoritative instruction. The exact number and presentation are **not** frozen by Stage 2.

## State continuity and adaptive emphasis

The same conceptual questions should persist across candidate states. Content and emphasis may adapt to available evidence, but the meaning of “commitment,” “waiting,” “progress,” and “exploration” should not switch roles.

- **New / low-data:** distinguish an empty recorded search from a failed load; support the first recording step; limit progress claims when the sample is insufficient. Onboarding is relevant but not an urgent task.
- **Active, no urgency:** affirm that no *known recorded* work needs immediate action; retain visibility of active pursuits and optional maintenance without inventing an emergency.
- **Interview-stage:** make the schedule and candidate-owned preparation/follow-up legible, with evidence and destination. Do not let a generic “interview chapter” statement displace a separate recorded due commitment.
- **Overdue work:** present the dated fact and actionable path; do not imply that every age-based review item missed a deadline.
- **High-volume:** preserve complete meaning while bounding initial decision demand; counts and previews must not obscure the fact that more recorded work exists or imply that a capped query is exhaustive.
- **Quiet / waiting:** say what HireFlux knows is awaiting an employer, what lacks a next-step owner, and that no *known* candidate action is due. “Nothing to do” must not mean “nothing is happening.”
- **Returning:** support reorientation using current facts and honestly labeled recent records. Do not claim a material change since the last visit until a usable visit boundary/history capability exists.

These are architectural behavior expectations inferred from the accepted Stage 1 evidence. Low-data and quiet/waiting experiences were not coherently observed at runtime; candidate preference for this adaptation remains to be tested.

## Exceptions, uncertainty, and degraded information

- **No known action:** a legitimate resolved state. The candidate-facing decision context should not fill it with generic Add/Pipeline/Analytics links framed as urgency. Exploration may remain available under its own meaning.
- **Unknown owner or missing date:** preserve “unknown” or “undated.” Do not convert missing data into a temporal fact merely to complete a queue.
- **Partial failure:** if operational data is unavailable, Home cannot assert “caught up.” Factual information from a successful source may remain useful, while an Analytics failure must not invalidate known commitments. Distinguish unavailable interpretation from absent activity.
- **Separate snapshots:** current Dashboard and Analytics responses can arrive at different times. Candidate-facing claims should disclose or avoid contradictory scope/freshness rather than treat equal reporting range as proof of one snapshot. The frequency of real conflicts is unverified.
- **Time passage:** saved dates and interview times can cross thresholds without an edit. A response should be understood as an “as of” interpretation, not continuously live truth; Stage 2 does not prescribe a refresh mechanism.
- **Bounded collections:** five upcoming interviews and a capped due-follow-up query should not silently become a claim about *all* recorded commitments when coverage may be incomplete.
- **Completed/archived/terminal records:** preserve historical context without representing it as current actionable work; allow for eventual projection lag after a mutation.

## Information governance

**Needed for the initial decision:** recorded scope, known consequential signals, action ownership, an honest no-action/unknown state, and the reason for a suggested action. **Contextual or requested:** recently updated records, milestone progress, comparison evidence, tour steps, and full opportunity/interview detail. **Other routes:** record editing, interview preparation, pipeline operations, deep Analytics and Settings. The distinction is cognitive, not a specified viewport, accordion, card, or visual hierarchy.

The first encounter should answer whether the candidate faces a known consequential commitment and how to reach a defensible choice. It need not contain every record or metric. Conversely, merely hiding information does not solve the problem if competing priority claims remain.

### Presence and disclosure boundary for Stage 3

These are **information-availability rules**, not controls or placement instructions. An initial answer must be understandable without opening another region; supporting detail may be requested. Conditional material disappears when irrelevant, but its absence must not be mistaken for a successful load or for proof that no unrecorded work exists.

- **Orientation and coverage:** persistent Home responsibility. Immediately establish the recorded workspace/scope and material freshness or partial-coverage limits; deeper record counts and range definitions may be contextual. If the scope cannot load, show an unavailable/retry state rather than an empty or caught-up search. Applications remains the destination for the full inventory.
- **Commitments and exceptions:** conditional on known evidence, but a consequential recorded date or scheduled commitment must be discoverable in the initial decision path—not only inside a collapsed secondary queue. Summarize its referent, literal time meaning, and coverage; route to the relevant Application or Interview for full work. With none known, communicate that bounded result; with a failed or capped source, do not claim exhaustive absence.
- **Decision and explanation:** persistent Home responsibility even when its output is no action or several choices. Expose actionable versus waiting/unknown ownership, the immediate reason, and fact-versus-heuristic status together. More evidence may be progressively disclosed, and execution may route to Applications/Interviews, but the minimum reason and uncertainty cannot be hidden behind that drill-down. A strategic recommendation cannot silently replace a recorded commitment as the operational answer.
- **Secondary work:** conditional when multiple known items exist. Home must signal that more recorded work exists and provide a path to inspect it; an initial summary is acceptable, but disclosure cannot make a consequential commitment undiscoverable or imply a bounded preview is exhaustive. The exact visible count and expansion mechanism remain open.
- **Waiting and quiet states:** conditional, explicit Home outcomes when supported. State known employer-owned waits or no known candidate action without portraying waiting as failure; retain access to the underlying opportunity. If ownership or data is insufficient, represent uncertainty instead of a clean all-clear. Generic navigation can remain available as exploration, never as a substitute task.
- **History and strategic context:** contextual Home summaries when they answer a distinct reorientation or strategic question, with fuller record history in Applications and deeper comparisons in Analytics. Recent records mean recently recorded/updated, not changed since a visit; stage age means time elapsed, not an event. A comparison between stated reporting periods is change across those periods, not change since the candidate's last visit or evidence that the change is materially actionable. Strategic insight may inform the decision context only through a concrete, evidence-backed candidate-owned concern; otherwise it remains reflection, not a rival urgent instruction. If sample or source quality is inadequate, qualify or omit the interpretation rather than manufacture one.
- **Onboarding and exploration:** contextual for a new or learning candidate, otherwise optional; destinations remain their dedicated routes. It may be absent when no longer useful and must not conceal a known commitment. Loading, mutation, failure, and stale-data states are temporary disclosures whose authority is limited to the affected source.

**Quiet-state meanings are not interchangeable.** “Nothing urgent” means no *known time-critical recorded* work, not no useful work. “No known candidate action” is a bounded conclusion from available records, not a claim about life outside HireFlux. “Waiting” identifies recorded employer ownership and may coexist with a candidate check-back. “Insufficient information” means the system cannot justify an all-clear or confident suggestion. “No recorded opportunities” is an empty recorded scope and calls for a first recording path. Several defensible actions with no supported winner are a valid decision outcome; the system need not invent a ranking. Across these states the orientation, consequence/decision, and explanation responsibilities remain recognizable while their content changes.

### Disposition of current Home concepts

This reconciles the [Stage 1 current-information inventory](home-stage-1-cognition-information-audit.md#8-current-information-inventory) without requiring each existing panel to survive. No candidate need is removed merely to shorten Home.

- Workspace identity, active scope, and total tracked are **preserved/contextualized as orientation**; archived-inclusive total and time-range scope must not imply current workload. Journey-chapter copy is **contextualized** as an inference, not a priority authority. The range selector belongs with range-dependent progress evidence, not the definition of current commitments.
- The header primary action, “Keep moving,” Action Center, and any actionable Progress focus are **merged only at the candidate-facing decision-question level**: what recorded work can be considered now, with what reason and destination? Their date facts, interview schedule, candidate ownership, heuristic review signal, and strategic interpretation remain distinct producers; no universal score or single control is implied.
- Needs-attention counts, queue totals, dated follow-ups, undated candidate steps, interview-soon items, stale-stage items, and Action Center ordering are **preserved or contextualized within commitment/exception awareness** according to their actual evidence. Due/overdue requires a recorded date; stage age is review value, not a missed obligation. Follow-up Complete/Reschedule and pending feedback remain canonical action/temporary states, with full record work routed to the Application.
- Upcoming-interview count, next conversation identity/time, and the no-interview state are **preserved conditionally as schedule context**, with bounded-list coverage stated; Interview workflow retains preparation ownership. Recent touched records are **contextualized as update recency**, not last-visit change, and fuller history belongs to record routes.
- Progress headline, milestone path/rates, recommended focus, comparison evidence, and process details are **contextualized as strategic interpretation** with sample/scope limits; deeper evidence routes to Analytics. A concrete candidate-owned concern can contribute to the shared decision question, but a generic performance observation does not outrank operational work.
- Search tour and fixed Add/Pipeline/Patterns links are **demoted to optional exploration** with their existing destinations; no tour step or generic link is a recorded task. Loading, error, retry, and route notices are **preserved as temporary truth/availability states**, not competing recommendations.

## Alternatives considered and why this architecture is preferred

- **Activity-first chronology** would make updated records the re-entry authority. Stage 1 shows `updated_at` is not a material-change or since-last-visit model, so it cannot safely lead the decision.
- **Analytics-first interpretation** would give strategic comparison precedence over recorded commitments. Analytics is valuable, but its range and sample constraints make it a different question from today's candidate-owned work.
- **One universal ranked recommendation** would look decisive but exceed the model's knowledge of personal opportunity value, external obligations and constraints. Stage 1 did not establish that users want exactly one recommendation.
- **Status-quo independent modules with clearer decoration** would leave the candidate doing the same cross-panel reconciliation. The problem is semantic ownership, not merely visual weight.

The selected model is the narrowest architecture that can answer “what can I do now, and why?” while preserving distinct facts, inferences, strategic context and candidate judgment.

## Decisions and non-decisions

**Decided for Stage 2:** one coherent candidate-facing meaning for current work; recorded consequence before strategic interpretation in the default cognitive path; ownership and provenance exposed with action; no-action and unknown are valid outcomes; recency, aggregate progress, and onboarding do not independently claim operational priority; a stable conceptual model may adapt emphasis by state.

**Not decided:** number of visible candidate actions, cross-domain tie-breaking or scoring, exact sequence of every question, visual placement, amount of Analytics on Home, disclosure mechanics beyond the presence rules above, animation, component structure, API design, update/refresh strategy, wording, or whether candidate testing will favor a stronger/weaker adaptive emphasis. Existing semantic defects are not accepted as architecture and are not fixed here.

## Validation contract before visual design is frozen

Compare the current Home and a later architecture expression on identical realistic data: new/low-data, multiple conflicting commitments, upcoming interview plus overdue follow-up, high-volume, employer-waiting, and partial-failure scenarios. Measure whether candidates identify a defensible recorded action, distinguish a due date from a heuristic, explain why the action is relevant, recognize a legitimate no-action state, and avoid treating recently edited records as since-last-visit changes. Observe first-click accuracy, unnecessary region inspection, route bouncing, decision time, confidence and trust; do not declare success from shorter pages or fewer clicks alone. Stage 1 contains no user-study evidence, so this is a **validation plan**, not a predicted effect size.

## Stage boundary

Stage 2 stops at cognitive and information architecture. No Home component, visual design, CSS, backend rule, priority algorithm, semantic defect, data capability, or demo behavior is changed by this document. The next decision can refine an expression of these roles only after this architecture is reviewed.
