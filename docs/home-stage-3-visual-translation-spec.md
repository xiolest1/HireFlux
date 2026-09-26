# Home Stage 3 — visual translation specification

**Status:** proposed visual design contract for review, 2026-09-23. This specifies how the accepted Home information model should be perceived and navigated; it does not implement UI, change product policy, or assert measured candidate outcomes. The authoritative inputs are the accepted [Stage 2 information architecture](home-stage-2-cognitive-information-architecture.md) and its [Stage 1 evidence boundary](home-stage-1-cognition-information-audit.md). This document, not a mockup or canvas, is the Stage 3 source of truth.

## 1. Visual design thesis

Home should feel like a **calm re-entry desk with one decision spine**, not a wall of equally persuasive dashboard modules. At a glance, a candidate should identify the recorded workspace, whether a known commitment exists, whether a move is theirs, and why a possible action has surfaced. The page should then relax into history, strategy, and optional exploration. Calm does not mean hiding work: a recorded consequential commitment must remain discoverable in the initial decision path.

The recommended structural expression is **compact orientation → full-width decision context → quieter context and strategy → optional exploration**. This is a visual recommendation grounded in Stage 2's cognitive dependencies, not a claim that this exact scan order has been user-tested. No second Home-wide “next action” headline is permitted downstream.

## 2. Existing visual system: preserve, adapt, break from

Source review covered [`AppLayout.tsx`](../frontend/src/components/AppLayout.tsx), [`DashboardPage.tsx`](../frontend/src/pages/DashboardPage.tsx), [`WorkspaceComposition.tsx`](../frontend/src/components/ui/WorkspaceComposition.tsx), the UI primitives, and [`styles.css`](../frontend/src/styles.css). The existing authenticated Home was also inspected in the local demo at a narrow browser width; the accepted Stage 1 audit supplies its prior 1280×900 observation. This is implementation grounding, **not** usability testing or a rendered prototype of this proposal.

- **Preserve:** the authenticated shell's sidebar/mobile navigation, skip link, route focus, temporary-demo identity/expiry, `WorkspaceFrame` width discipline, Inter/Space Grotesk type roles, semantic ink/surface/accent tokens, native buttons and links, visible focus, 44px-class targets, status text accompanying color, skeleton/error/retry states, and `CollapsibleRegion`'s inert closed content. `Button`, `StatusBadge`, `Surface`, `PageHeader`, and the existing feedback primitives are candidates for reuse where their semantics fit.
- **Adapt:** the current raised/tonal surfaces, counts, action list, interview summary, and progress disclosure. Use a restrained surface for the **one** decision context, but let orientation and secondary context rely more on typography, spacing, and subtle rules. Do not give every responsibility a raised card. Action rows should be more legible than the present nested three-column card groups; a status badge can describe an application but must not replace ownership, date, or evidence language. Existing loading and error treatment should match the affected information source, not imply the whole search is empty.
- **Break from:** the oversized welcome/gradient panel as primary attention owner; a range selector beside current-workspace counts; the tour before operational work; “What should I do next?” followed by a separate Action Center and a separate “What deserves attention” Progress focus; equal-weight cards for interview, generic links, and operational work; and a collapsed task queue that requires opening before a consequential recorded commitment is identifiable. These are current Home conventions, not accepted architectural requirements.

The current local narrow view shows welcome, a large counts surface, and tour before the detailed decision queue. It confirms the need to change emphasis, not the effect size of that change. The shell and product token system provide sufficient visual language; Stage 3 does not require a new palette or font.

## 3. Visual hierarchy model

1. **Decision context: highest operational prominence.** Give the question of known commitments and candidate action the clearest heading, strongest content measure, and most deliberate surrounding whitespace. It owns the principal Home action area, whether its result is one action, several, waiting, none known, or insufficient evidence.
2. **Orientation: immediately legible, visually compact.** Workspace/demo identity and recorded scope should precede interpretation but not consume more attention than the decision itself. Counts are supporting evidence with their scope stated, not a row of rival hero metrics.
3. **Action evidence: adjacent to each action, not visually subordinate to a separate panel.** Literal dates and ownership are easy to scan; the minimum reason and uncertainty are readable at the same stop. A recorded due date may receive stronger contrast than a heuristic review cue, without equating time sensitivity to personal importance.
4. **Secondary recorded context: quieter and proximal to its question.** Recent updates and active-search overview help reorientation after the immediate decision. They should be accessible without looking like new recommendations.
5. **Strategic interpretation and optional exploration: lowest immediate authority.** Analytics may have substantive content and a clear route, but its headline, surface strength, and action treatment must not compete with an operational commitment. Tour/navigation is contextual, never a substitute task.

Use hierarchy through scale, grouping, measure, spacing, and restraint before using saturated color. A strong visual accent means “this is an affordance or salient recorded condition,” not “the system knows this opportunity matters most.”

## 4. First meaningful view

The opening composition should establish a compact **Home / recorded search** heading and scope statement, followed directly by the beginning of the decision context. Within a few seconds, the candidate should perceive: “I am in this temporary recorded workspace; there is or is not a known consequential condition; HireFlux has a bounded basis for the next step.” This is not a mandate to fit every item above a pixel fold. It is a requirement that the initial scan encounters the right *authority* before tour, recency, or Analytics.

The time-range control belongs with range-dependent strategic reporting, not alongside current-workspace operational counts. If a global shell already communicates demo identity and expiry, Home may repeat only the scope information needed to interpret its content; do not add a second promotional welcome.

## 5. Information grouping and structural composition

The **decision spine** is one visually coherent region containing: a truthful outcome summary; known commitment/exception groups when present; identifiable referents and time meaning; candidate/employer/unknown ownership; available action or destination; and minimum reason/limitation. This is one candidate-facing authority, not necessarily one card or algorithm. It can have internal rows and subgroups without fragmenting into separately titled “next” systems.

**Selected desktop composition:** use a full-width decision band within the established `WorkspaceFrame` measure. Orientation is an open, compact introduction above it. Give the decision band one neutral raised surface with a clear heading/outcome, then separate its internal peer rows with subtle rules rather than nested equal-weight cards, decorative gradients, or a second hero treatment. Keep the minimum reason and limitation inside the same row as its action. Below the band, use a quieter two-column context area at spacious desktop widths: recorded history/scope first in source order, strategic reflection second. Neither column receives the decision band's surface strength or an operational “next” heading. At laptop/tablet widths this lower area becomes one column; mobile preserves the same semantic order. Never put operational work behind a visually secondary rail while strategic content occupies the main reading path.

## 6. Decision-context presentation

The recommended row grammar is: **referent and condition → actual time/owner → possible action or destination → concise reason and epistemic limit**. Visual proximity matters more than decorative badges. A candidate should not need to remember a count from the top while searching a different panel for the item and then Analytics for its explanation.

- A **recorded deadline** uses literal date language and a named opportunity. “Due today” or “overdue” is reserved for a real saved date interpreted in the workspace time zone; it is not a general warning color.
- An **upcoming interview** shows its scheduled time and interview-specific continuation. It can coexist visibly with an overdue follow-up; the interface does not crown either the objectively most important opportunity.
- An **undated candidate step** remains actionable but says it has no recorded date. A **stage-aged opportunity** is a review suggestion with its age/heuristic disclosed, never a missed obligation.
- **Employer waiting** names the recorded ownership and any candidate check-back separately. **Unknown ownership** stays visibly unknown rather than forced into a candidate/employer binary.
- A **recommendation** is phrased and styled as a suggestion supported by cited recorded conditions. Avoid numerical confidence scores, “AI certainty” meters, or a single oversized prescribed action unsupported by the data.

For one defensible action, an identifiable lead item and one clear continuation are appropriate. For several defensible actions, use peer rows within the same decision context, with distinct date/ownership labels and no fake universal rank. A recorded commitment may coexist with a useful undated or strategic action; the latter is presented as optional work within the same decision context, not as a rival priority or as another dated obligation. For high volume, give immediate awareness of every consequential **class** of known work, show identifiable representative commitments and a direct path to inspect the remaining *available recorded* items. The initial band itself is never collapsed. Additional rows or evidence may expand within it, but the closed summary retains each known condition class, a useful referent, time/ownership meaning, and the path to more. A generic Applications link must not be labeled as an exhaustive action queue unless that destination actually preserves the relevant set; the current Applications workspace has a different needs-action classification. Counts must state when a query is capped; a preview is not “all work.” Exact row limits and cross-domain ordering require a later data/behavior contract, not a client-side visual guess.

The minimum explanation should be plain language, not a debug trace. Additional evidence can open locally or route to the record/Analytics as appropriate. The action, reason, and uncertainty remain perceptually grouped even if supporting detail expands. A failed or stale source can leave facts from a successful source visible, but cannot produce an unqualified all-clear.

## 7. Progressive disclosure

**Immediate awareness:** workspace/scope, known consequential conditions, bounded no-action or unknown outcome, and a path to relevant work. **Decision support:** ownership, literal time status, minimum rationale, provenance/limit. **Secondary context:** recent updates, active-search summary, milestone/progress summary, optional onboarding. **Deep investigation:** full opportunity activity, interview preparation, pipeline, period comparisons, and Settings in their dedicated routes.

Disclosure is for **depth**, not for the existence of a known commitment. An expandable queue may reveal additional rows or fuller evidence, but its closed state must already communicate the categories, scope/count caveat, at least a useful referent, and direct access to all relevant recorded work. Avoid a row of similarly prominent collapsed panels; that merely hides the present reconciliation task. Empty secondary regions may be absent; empty or uncertain **decision** outcomes must be explicitly communicated.

## 8. Operational and strategic visual treatment

Operational content has the primary action grammar: named record, time/owner, continuation, and reason. Strategic content has a reflective grammar: clearly labeled reporting period, sample/denominator or insufficiency, interpretation, and an Analytics destination. It may be a quiet summary with details on request; it is not another “what to do next” command. If a concrete, evidence-backed candidate-owned process concern is promoted into the decision context, it adopts that context's explanation and uncertainty contract rather than retaining a separate Analytics priority banner.

The distinction should survive without color: headings, wording, source/time labels, and physical grouping carry meaning. Do not present a large colored trend headline immediately above a recorded due obligation.

## 9. Quiet, waiting, empty, and unknown states

Retain the same orientation and decision-context location in every ordinary state. Change the outcome and supporting context, not Home's underlying map.

- **Nothing urgent:** state that no *known time-critical recorded* work is due; optional candidate work or strategy may still be available. Do not use a success check that means “all work complete.”
- **Waiting on employers:** identify the known employer-owned opportunities and separate any saved candidate check-back. Make waiting feel like a legitimate state, not stalled performance.
- **No known candidate action:** say the conclusion is based on available recorded information; keep active pursuits and optional exploration accessible without inventing a task.
- **Insufficient information:** an unavailable source, incomplete coverage, or too little evidence prevents a confident *overall* conclusion. Preserve known facts, show what is unavailable, and offer retry or the relevant record path. Unknown ownership qualifies its particular item; it does not by itself erase other known commitments or force the whole page into an insufficient-information state. This must not look like an empty success state.
- **No recorded opportunities:** establish the empty recorded scope and offer a first recording path. Tour may support learning, but cannot be presented as urgent work.
- **Several choices, none dominant:** show peer possibilities with their own reasons and ask the candidate to choose; do not enlarge one merely to fill a hero slot.

Tone and surface treatment remain calm in all six. Use explicit wording and a stable heading rather than changing the page into a wholly different onboarding or exception dashboard.

**Evidence-availability variants of the same decision band:** while the operational answer is loading, retain orientation and a neutral loading placeholder where the decision outcome will appear; do not temporarily display the no-action state. With partial evidence, render the known commitment rows and an adjacent coverage limitation that prevents an exhaustive all-clear. If a required operational source fails, keep any independently verified facts but show an unavailable/retry outcome for the missing portion; do not promote a successful Analytics response into a replacement operational answer. If Dashboard and Analytics snapshots conflict or differ in scope, do not combine them into one apparently current claim: keep the operational answer bounded to its own source and label/withhold the strategic interpretation as appropriate. Where freshness is detectable, state the as-of/refresh limitation near the affected claim. A genuinely no-known-action outcome appears only when available operational evidence supports it. These distinctions are presentation rules, not a new backend reliability model.

## 10. State-aware behavior across the required scenarios

**A. Interview tomorrow plus recorded overdue obligation:** both conditions appear in the initial decision path with literal dates, separate routes, and no unsupported absolute winner. The interview's preparation belongs to Interviews; the overdue follow-up belongs to its Application.

**B. Several active applications, nothing urgent:** orientation remains; the decision context explicitly reports no known time-critical action and may identify optional undated or maintenance work as such. Active count is context, not a demand.

**C. High-volume with several possible actions:** compact group summaries show what categories exist and whether a list is bounded; identifiable rows and an obvious all-work path remain. More items change quantity, not authority or semantics.

**D. Everything waiting on employers:** decision context reports known waits and distinguishes any candidate check-back. No generic Add/Analytics link is promoted to a fake task.

**E. New/low-data:** recorded scope and first recording path are primary; strategic rates are qualified or absent. Onboarding is a contextual aid, not a rival decision center.

**F. Insufficient evidence:** successful factual sources remain visible; the decision outcome communicates that a confident recommendation or all-clear is unavailable, with retry/record path. Missing data is not “caught up.”

**G. No recorded opportunities:** the same Home heading and decision location explain the empty scope and first useful recording action. No fictional pipeline trend appears.

**H. Several commitments with no dominant action:** peer items expose date, owner, and reason; no visual ranking implies personal importance. The candidate retains judgment.

These are conceptual design tests, not claims that all eight states were observed in a live workspace. Stage 1 saw a high-volume demo and a constructed inconsistent empty response; other state behavior needs validation.

## 11. Responsive translation

- **Large desktop:** use the shell's existing navigation and a bounded reading measure. Orientation is compact; the full-width decision band contains one reading path of outcome and peer rows. Internal columns, if any, hold supplementary evidence only, never parallel priority authorities. Secondary recorded context and strategic analysis use the quieter two-column area after the decision band.
- **Normal laptop:** preserve the same order and hierarchy with less lateral spread. Decision rows should wrap their referent, date, reason, and action within one readable block; do not squeeze them into equal miniature cards.
- **Tablet:** account for the icon sidebar and narrower content area. Favor a single decision column, with context/strategy following. An expanded menu or disclosure cannot obscure the current decision outcome.
- **Portrait phone:** use the existing mobile header and bottom navigation. Stack orientation, outcome, and commitment rows in semantic source order; put action, reason, and limit within each row. Keep touch targets at least the project's practical 44px size and sufficient bottom clearance. Secondary material follows the decision, not vice versa.

Across widths, a long company or role name wraps; a date/status does not become an unlabeled icon; the decision region remains discoverable before optional tour/Analytics. Responsive changes alter layout, not what counts as a recorded obligation or who owns the move.

## 12. Content-robustness contract

Test long organization and role names (including “Senior Infrastructure Reliability Engineer, Developer Productivity & Internal Platforms”), several simultaneous date-specific commitments, long rationale, missing dates, unknown owner, large counts, multiple interviews, and an unusually long strategic interpretation. Permit natural wrapping and flexible row height. Do not truncate the referent, date meaning, action label, minimum reason, or uncertainty merely to maintain symmetry. A supporting summary may be concise, but its destination must expose complete meaning.

At sparse extremes, do not retain empty decorative cards for absent interview, trend, or tour concepts. At dense extremes, avoid displaying every item at identical emphasis; retain complete category awareness, honest bounded-preview language, and direct access to the full relevant list. Validate at 200% text and narrow phone width; the design may grow vertically but must not overflow horizontally or detach controls from their explanation.

## 13. Typography, density, and spacing

Use the established Space Grotesk display role for a concise Home heading and decision-region heading; Inter remains the workhorse for dates, ownership, rationale, controls, and longer text. The decision outcome has one clear typographic lead; individual commitment referents are prominent enough to scan but do not all become display headlines. Metadata must remain readable body/supporting text, not a collection of tiny uppercase labels.

Keep orientation relatively tight; allow more space **between** the decision context and reflective content than **within** an action/reason/limit group. Use subtle dividers for multiple peer rows. A quiet state can have generous breathing room without becoming a giant empty card. Exact token values are implementation details to calibrate in rendered prototypes against the current theme and zoom behavior.

## 14. Color and emphasis semantics

Use existing `ink`, `ink-muted`, `surface`, `surface-raised`, `line`, `accent`, `warning`, `danger`, `info`, and focus tokens in both themes. Reserve stronger warning/danger treatment for a literal recorded time condition or actual failure, not stage age or generic recommendation. Heuristic suggestions use neutral treatment plus explicit language; waiting and no-action use calm neutral tones, not disabled or failure styling. Accent marks links and operable controls consistently, not “the best career move.”

Do not rely on color alone: text states the date/ownership/evidence category. Recheck contrast for muted explanations and focus indicators in light and dark mode. Existing status badges may describe application stage but must not be repurposed as recommendation confidence.

## 15. Interaction and motion

Primary interactions are ordinary links into Applications/Interviews and existing canonical follow-up operations where available. The decision band and its meaningful closed-state summary remain present by default; only additional rows/evidence may expand. Disclosure uses `aria-expanded`, a labeled control, stable focus, and closed content removed from keyboard navigation. Hover, focus, pressed, disabled, and pending controls may reuse the established button treatments, but no state may conceal the minimum action/reason/limit or make a temporarily disabled control appear to be a new recommendation. On a completed/rescheduled follow-up, acknowledge the result locally, preserve focus or a sensible nearby target, and tolerate projection lag without silently reasserting a resolved action. Do not place an essential commitment behind hover or motion. Loading, mutation success/failure, retry, and eventual projection lag remain explicit local states.

Recommend **no new ambient or entrance motion** for Home. Existing lightweight route/feedback transitions can remain if they do not delay information or alter meaning. A bounded disclosure transition may support continuity, but the final state must be available immediately under reduced motion and when animation fails. The priority relationship is semantic and spatial, not animated.

## 16. Accessibility constraints

Preserve one H1, meaningful section headings, DOM/source order matching the cognitive path, the existing skip link and route-focus behavior, native links/buttons, visible focus, keyboard-operable disclosure, 44px practical targets, and screen-reader text for date/ownership distinctions. Do not duplicate a visual decision summary in accessible content. Status cannot depend only on icon/color. When content updates after a mutation, announce the result without narrating every data refresh; focus must not be lost because a row disappears. Errors and partial-source caveats must be discoverable in reading order. Zoom, text enlargement, high-contrast needs, and reduced motion must retain the same candidate-facing meaning.

## 17. Alternative explorations and convergence

**Recommended: editorial decision spine over an equal-card dashboard.** One prominent outcome region, subordinate context, and later strategy express Stage 2's single candidate-facing authority. The tradeoff is fewer simultaneous summary metrics; those remain accessible as scope or Analytics. An equal-card grid was rejected because it would again make tour, recency, and Progress look equally urgent.

**Recommended: peer commitments rather than one universal hero recommendation.** When evidence cannot establish a winner, visible peer rows with reasons preserve candidate judgment. A single large recommendation was rejected because it would visually assert a rank HireFlux cannot justify. When only one actionable item exists, the same row grammar can naturally lead without changing architecture.

**Recommended: an initially legible decision summary with depth on request.** A fully collapsed Action Center was rejected because it hides consequential work; showing every high-volume row by default was rejected because it buries the decision in volume. The closed state must still identify recorded condition classes, representative referents, coverage, and the complete-work destination.

**Recommended: restrained, conditional strategic summary after operational meaning.** Analytics remains discoverable with a period/sample label and clear route; an equally dominant Progress recommendation was rejected as a rival authority. Whether a particular candidate state warrants more or less strategic material on Home remains a **validation hypothesis**, not a fixed display quota.

**Legitimately unresolved:** the optimal number of visible peer items, precise cross-domain ordering when several dates compete, and the best amount of onboarding in a real low-data journey. Compare alternatives with identical scenarios and candidate tasks; do not bake a visual choice into a new recommendation algorithm. These uncertainties do not prevent a first prototype of the recommended hierarchy.

The reasoning classes here are explicit: single-authority semantics and truthful dates are **architectural requirements**; readable grouping, keyboard access, and non-color status are **usability/accessibility requirements**; decision-spine composition and restrained strategy are **design inferences** to test; exact visual taste is not evidence of improved task performance.

## 18. Structural mockup (abstract, not final copy)

```text
Authenticated shell: existing sidebar/header or mobile header/bottom navigation

Home · recorded demo search
  Scope / as-of or partial-coverage note where material

FULL-WIDTH DECISION BAND — the one Home-wide answer to current work
  Outcome: known work | waiting | no known action | insufficient evidence | empty scope
  Loading/partial/failure: same location, with source-specific availability meaning
  If known commitments:
    Condition class and honest count/coverage
    Opportunity / interview · literal date or “undated” · whose move
    Available continuation
    Minimum recorded reason + inference/uncertainty, kept with that continuation
    Peer commitment(s), if applicable; direct path to complete relevant work
  If quiet/unknown/empty:
    Specific meaning + bounded evidence + appropriate route/retry/exploration

QUIETER CONTEXT AREA — two columns only on spacious desktop; one source-order column elsewhere
  SECONDARY RECORDED CONTEXT
    Active scope and recently updated records, only when useful
    Record/history destinations; no “since your last visit” implication
  STRATEGIC REFLECTION, CONDITIONAL
    Reporting period + sample/coverage + bounded interpretation
    Analytics destination; no second operational “next” command

OPTIONAL EXPLORATION
  Tour or generic route links only when contextually useful
```

This expresses responsibilities and relationships, not a fixed component tree or prescribed wording. On mobile it remains exactly this source order, with natural vertical stacking.

## 19. Visual validation plan

Prototype the recommended design and a restrained alternate where a genuinely unresolved choice matters, using **identical data** for the eight states in §10. Assess large desktop, normal laptop, tablet, and portrait phone; light and dark themes; 200% text; long names; capped collections; separate Dashboard/Analytics failures; keyboard and screen-reader reading order. Do not use the seeded high-volume demo as the only success case.

Use first-impression comprehension and short task tests: identify the recorded workspace; locate an overdue *recorded* follow-up alongside tomorrow's interview; explain whose move it is; identify why an undated suggestion is not due; distinguish a waiting state from a failed load; find remaining available work from a preview; find deeper Analytics without mistaking it for today's command. Ask candidates to teach back what is fact, inference, and recommendation. Observe first-click destination, whether they inspect unrelated regions, whether they miss a consequential commitment, and whether they infer a false last-visit change. Record errors, confidence, and route bouncing; do not claim improvement before comparison. Implementation QA must separately cover loading versus genuine no-action, partial operational evidence, source failure/retry, detectable stale data, and contradictory Dashboard/Analytics snapshots; none may imply an exhaustive all-clear. Accessibility review should include non-color status, focus after mutation/disclosure, overflow, contrast, zoom, and reduced motion.

The strongest implementation acceptance question is: **Can a candidate explain a defensible next step—or a legitimate no-action/unknown state—from the initial decision path without reconciling several independent priority panels?**

## 20. Implementation handoff (not implementation)

- **Reusable existing primitives:** authenticated `AppLayout`, `WorkspaceFrame`, semantic theme tokens, `Button`/button styles, links, `StatusBadge` for application stage, `CollapsibleRegion` for optional depth, `Skeleton`, `ErrorPanel`, `LoadingState`, `PendingIndicator`, and existing mobile navigation/skip-link/focus patterns.
- **Adaptation required:** Home's welcome/counts header becomes compact orientation; current Action Center content becomes the single decision-context presentation; interview summary and follow-up actions enter that context under their own evidence; recent records and Progress become clearly secondary; the range control sits with range-dependent strategy; tour becomes contextual. Existing `Surface`/tonal treatments need differentiated hierarchy rather than repeated equal-weight cards. The current `DashboardPage` layout cannot merely be reordered wholesale.
- **New visual primitive if needed:** a feature-specific **decision row** that keeps referent, literal time, owner, action, minimum reason, and limitation together at desktop and mobile widths. This is a presentation primitive, not a new scoring engine or shared generic card system. A small **coverage label** may be needed for capped sources or as-of data; it must describe actual server knowledge.
- **Content/semantic dependencies:** distinct recorded date, derived due state, scheduled interview, undated candidate step, stage-age heuristic, waiting, unknown owner, recommendation, no-known-action, and insufficient-source states; truthful counts and bounded previews. One operational question may draw from several producers, but backend/domain policy and metrics remain authoritative. No React-invented status transitions, deadline, rank, or denominator.
- **Known capability limits:** no reliable since-last-visit material-change feed, objective personal priority, employer intent, outside commitments, or exhaustive all-clear from a capped/failed source. Separate Dashboard/Analytics snapshots can disagree; reporting-period changes are not visit changes. Do not promise a continuously live interpretation without a refresh contract.
- **Known implementation defects to resolve before faithful release:** synthetic “today” for undated candidate steps; deadline-free stale records grouped “Overdue”; differing stage-staleness thresholds. These are not design tokens or desired states. The visual prototype may show correct semantics, but production work must correct the source meaning before presenting it as fact.
- **Validation dependencies:** focused component/state tests for the outcome variants and disclosure/focus behavior; integration tests for literal date/owner/provenance and partial data; browser checks at representative widths/themes/zoom; accessibility and candidate comprehension tasks from §19. Any proposed ordering or visibility rule that requires new data must be explicitly gated rather than silently faked in the frontend.

**Implementation invariants:** one candidate-facing operational authority; consequential recorded commitments identifiable in the initial decision path; no heuristic styled as a literal due/overdue fact; no universal personal-priority claim; action, minimum reason, and material uncertainty kept together; waiting distinct from failure and candidate inaction; insufficient/partial evidence never rendered as “nothing needs you”; strategic interpretation never a second Home-wide next-action authority; recently updated never presented as since-last-visit change; responsive layout preserves the same semantic order and discoverability.

## Stage 3 boundary

This is a **recommended visual translation**, not an implemented Home or a validated performance result. Stage 1 and Stage 2 remain unchanged. Stage 4/implementation may refine tokens and execution details after review, but must not change the single decision authority, truthfulness, quiet-state distinctions, or the action–reason–uncertainty relationship for convenience. A genuine contradiction with Stage 2 must be raised explicitly rather than patched by visual styling.
