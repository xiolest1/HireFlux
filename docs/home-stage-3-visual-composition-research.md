# Home Stage 3 — visual composition research

**Status:** research recommendation for review, 2026-09-24. Stage 1 and Stage 2 remain accepted. The [first Stage 3 visual specification](home-stage-3-visual-translation-spec.md) and current Home are evidence from the first implementation, not the governing composition for this research. This document changes no product policy or production UI. Its low-fidelity proofs and burden estimates are design comparisons, not candidate-test results.

## 1. Current rendered Home: where the burden sits

Inspection used the current frontend at 1280 × 900, 768 × 1024, and 390 × 844 with the repository's deterministic browser API fixture. The fixture supplies a fictional demo session and responses without writing to the backend. Dark-mode full-page captures were kept outside the repository; the existing light 1280px visual reference was also inspected. The example has 8 active/16 total recorded opportunities, one overdue saved check-back, and one scheduled interview. These measurements describe that example, not every Home state or a human eye-tracking result.

- At **1280px**, orientation ends around document y=210. The decision surface begins at y=254, is approximately **960 × 719px**, and finishes at y=973. Recorded context starts at y=1050—below the 900px first viewport. The full page is about 1679px tall. No horizontal overflow was observed.
- At **768px**, the decision surface begins at y=270 and grows to about **648 × 811px**. Recorded context begins at y=1158 and strategy at y=1460. The context and strategy columns correctly collapse, but the decision still reads as a long sequence of full rows.
- At **390px**, the decision surface begins at y=282 and grows to about **358 × 1075px**; recorded context begins at y=1426 and strategy at y=1820. The page is about 2553px tall. In the first 844px viewport, the first action's explanation reaches the fixed bottom navigation; the second commitment requires scrolling. There is no horizontal overflow, but correct wrapping is not the same as easy orientation.
- In both themes, the eye is **likely** drawn first to the Home heading, then the large decision heading and outcome. That is a structured visual judgment, not measured fixation. Before reading body copy, the candidate can recognize “Home” and “recorded next steps,” but not readily distinguish the two actual conditions. The condition/count line and full rows must be read to learn that both a saved follow-up and an interview exist.
- The band contains one outcome heading, one general caveat, a four-part count sentence, two repeated full action anatomies, a cap/coverage sentence, and a navigation footer. The two rows each carry condition, ownership, time, role/company, reason, possibly a limitation, and continuation; the follow-up also exposes Complete and Reschedule immediately. Eight visible links/buttons exist in the full band for this two-action example, including two ways to open the first record. The important objects are semantically coherent but nearly all request inspection at once.
- The broad desktop band uses width for long text lines, not for reducing simultaneous reading. The calmer recorded/strategic context below is visually well subordinated, yet it cannot assist first-glance orientation because it is below the fold. On light mode the same large raised surface and repeated rows appear especially document-like; dark mode's contrast does not remove the reading burden.

**Diagnosis:** Stage 2's competing-authority defect is substantially addressed. The new defect is *within* the single authority: one large container still behaves like a work queue of individually demanding objects. The repeated “why” and limitation paragraphs, duplicate record continuation, zero-valued categories in the count sentence, and full controls on every row are visible because Home can render them, not because all must be simultaneously parsed. A saved commitment's identity, time, ownership, minimum reason, and route must remain initially discoverable; the full operation and repeated generic caveats need not all lead.

## 2. Focused research synthesis

The following is applied evidence, not proof that one of this document's wireframes will improve candidate performance.

- **Visual search and clutter.** Rosenholtz et al.'s [feature-congestion work](https://www.mit.edu/~yzli/clutter.pdf) treats clutter in relation to the difficulty of finding targets among competing features and organization. The authors also note that an *overly sparse* display can force extra navigation. **HireFlux applicability:** distinguish an identifiable commitment from repeated similar action rows without erasing other known work. **Implication:** vary scale and local density, and give category summaries a stable scanning role; do not maximize emptiness. **Inference:** whether this particular hybrid composition improves finding a due commitment has not been experimentally tested.
- **Grouping is not semantic reconciliation.** Palmer's [common-region experiments](https://www.sciencedirect.com/science/article/pii/001002859290014S) show that enclosure strongly affects perceived grouping. **Applicability:** the present raised band successfully makes its contents one *region*, but two full row anatomies remain two inspection targets. **Implication:** use a common decision region for authority, then visibly distinguish a compact summary layer from selected details within it. **Inference:** a single card alone does not reduce the number of cognitive objects; that conclusion is our diagnosis of the rendered Home, not Palmer's direct finding.
- **At-a-glance layout and text both matter.** The experiments in [*Web pages: What can you see in a single fixation?*](https://pmc.ncbi.nlm.nih.gov/articles/PMC5945715/) found that people can extract page category/layout information rapidly and that readable text also contributes. **Applicability:** the first Home screen should convey “known commitment / several choices / waiting / unknown” from both spatial hierarchy and short labels. **Implication:** meaningful group names and literal time labels must survive the squint test; decoration alone cannot carry the status. **Inference:** the study did not test candidate dashboards or HireFlux tasks.
- **Disclosure requires a correct split and a visible path.** [Nielsen's progressive-disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/) argues for a focused initial level while keeping needed options and the route to deeper information obvious. **Applicability:** defer extended rationale and workflow controls, not the existence of a consequential recorded commitment. **Implication:** every closed group needs a referent, time/owner meaning, honest bounded count, and explicit expansion/destination. **Inference:** the ideal number of exposed peer items is not given by this guidance.
- **Appearance influences perceived usability, but does not establish actual usability.** Tractinsky, Katz, and Ikar's [ATM-interface experiment](https://cris.bgu.ac.il/en/publications/what-is-beautiful-is-usable-2/) linked aesthetic treatment to post-use *perceptions* of usability. **Applicability:** a calmer and more deliberate Home can improve apparent clarity and trust. **Implication:** composition, type, and whitespace deserve deliberate design even after semantics are fixed. **Inference:** an attractive HireFlux prototype still needs task-based validation; visual preference is not evidence of better decisions.

The research supports comparing local density, grouping, and discoverable disclosure. It does **not** authorize a universal priority score, a fixed “magic” preview count, or a claim that fewer words always improve trust.

## 3. Mature product patterns: transfer and boundary

- [Linear's My Issues](https://linear.app/docs/my-issues) groups assigned work into focus categories, while [Inbox](https://linear.app/docs/inbox) separates attention-worthy notifications from other updates and provides an issue detail/workflow view. **Transfer:** category-level scanning and a clear route from preview to the underlying record. **Do not transfer:** Linear's organizational priority/SLA order or inbox-processing density; HireFlux lacks authority to rank a candidate's life choices or behave like a team issue queue.
- [Linear Pulse](https://linear.app/docs/pulse) distinguishes summary updates from the full update feed. **Transfer:** Home can carry a concise re-entry summary while detailed activity belongs elsewhere. **Do not transfer:** Pulse's engagement/popularity criteria or “new since you were away” implications; HireFlux has no verified last-visit delta.
- [Asana's My Tasks description](https://asana.com/features/project-management/my-tasks) documents user-organized sections such as Today, Upcoming, and Later; its [quick-start guidance](https://help.asana.com/s/article/quick-start-guide-to-asana) also gives Waiting on Others as a possible status grouping. **Transfer:** ownership and time categories help a person dismiss irrelevant work. **Do not transfer:** “Due today” for an undated step, a forced Must Do priority, or a full personal task manager on Home.
- [Todoist's view glossary](https://www.todoist.com/help/todoist/get-started/todoist-glossary-cA60laWMH) separates Today/Upcoming overviews from task and project detail. **Transfer:** a compact first view can route into fuller work. **Do not transfer:** user-set priority flags, reminder certainty, or an assumption that every HireFlux action has a date.
- [GitHub's notification inbox](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox) allows grouping/filtering with a distinct triage surface. **Transfer:** overview and processing are different modes. **Do not transfer:** marking a HireFlux recommendation “done” as though every surfaced cue were a discrete notification or obligation.

**Home versus workflow:** Home should *orient → highlight → summarize → route*. Applications and Interviews should *inspect → manage → process → complete*. The current Home's Complete/Reschedule controls are legitimate existing operations, but repeating the full operation alongside every exposed row moves the opening surface toward a second work inbox. This is a composition finding, not a proposal to remove those capabilities.

## 4. Minimum sufficient initial information

**Recognition-critical on Home:** recorded workspace scope; the decision outcome; every present consequential condition class; at least one named referent per class; literal saved date or scheduled time where relevant; who currently owns the move; an obvious path to the specific work. In a no-focal state, the existence of multiple peers is itself recognition-critical.

**Trust-critical at the same decision stop:** the shortest recorded reason that makes a surfaced item intelligible; whether it is a saved commitment, derived time state, or age-based suggestion; material uncertainty such as “no saved deadline,” incomplete source, or bounded/capped coverage. “Connected” means adjacent and understandable, not a full paragraph under every collapsed summary.

**Useful secondary detail:** expanded rationale, all currently returned peer rows, fuller evidence, historical context, and reporting-period interpretation. Secondary detail must be clearly requested or reached, not silently absent.

**Workflow detail at the destination:** complete/reschedule forms and preparation steps on the relevant record/workspace. Existing Home mutation controls can remain reachable in an expanded/action state, but need not dominate every closed preview. Interview preparation detail should not be replicated on Home.

**Redundant on the initial Home view:** a second link to the same application when the named referent already links there; zero-valued category clauses; repeated generic “date does not mean personal importance” paragraphs if the scoped limitation is stated once adjacent to the affected group; a generic navigation footer labeled like exhaustive retrieval when its grouping differs.

Minimum action grammar, without changing server meaning:

- **Recorded follow-up overdue/today:** named application; literal saved date and due/overdue label; actual candidate/employer/unknown ownership; one-line reason (“saved check-back” or the candidate's saved next-step note); exact application route. A time-specific cue may lead, but is not the objectively most important opportunity.
- **Scheduled interview:** named role/company; scheduled local time; “scheduled conversation” meaning; minimum preparation/review reason; route to the matching interview or its application. Do not assert an interview-specific deep link exists when the Home payload has no interview ID.
- **Undated candidate-owned action:** referent, candidate ownership, saved note if present, explicit *no recorded date*, exact application route. Never place it under Due today.
- **Stage-age review suggestion:** referent, elapsed stage basis, “suggested review” label, explicit absence of a missed deadline/employer update, application route. Do not give it deadline styling.
- **Waiting/quiet:** concise state and evidence scope, plus an underlying record path where there is a real referent. Do not fill an otherwise legitimate waiting state with a generic task.
- **Partial/failure:** known facts remain visible; the missing source and unavailable conclusion appear before any reassuring interpretation, with retry. A compact design must not hide the epistemic warning in a footer.

## 5. Disclosure and destination integrity

The current `homeDecisionModel` previews up to six actions, selecting one per action kind before filling remaining slots. `DashboardPage` expands hidden rows inline to the **returned** `dashboard.actions` array. The dashboard backend can return at most 100 due follow-ups and five upcoming interviews; this is not a guarantee that Home possesses every relevant real-world or recorded item. The Applications workspace uses a different classifier and groups, including interview preparation, offers, unscheduled candidate work, and waiting. The Interviews page groups all loaded interviews by workflow state. Neither generic route is the exact Home action-set view.

- **Saved follow-up group → hidden follow-ups → inline Home expansion → coverage:** expansion can expose the returned Home follow-ups; an application link opens the specific record. The generic Applications route exposes opportunities, but its Needs action group is not an exact copy of Home's due-follow-up query. If a backend cap is reached, say “shown from the available Home result,” not “all follow-ups.”
- **Interview group → hidden interviews → inline Home expansion → coverage:** expansion can expose only the up-to-five interviews included in the dashboard result. The current Home `INTERVIEW_*` action carries `application_id` but no `interview_id`, and its “Review interview” control routes to `/interviews`; that page may select a different preferred interview. The associated application is identifiable, but an exact interview selection from Home is **not guaranteed** by the current action contract. A future exact deep link would be a product/API change, not a visual promise in this research pass.
- **Undated steps and stage-age cues → hidden cues → inline Home expansion → coverage:** the returned Home set can be disclosed inline and each item can open its application. Applications may classify the same opportunity differently; the category count is Home-scoped.
- **Waiting → summarized waiting items → application/workspace → coverage:** Home loads only a small workspace preview when dashboard actions are absent. The Applications Waiting group is the appropriate deeper source for its own classification, not proof that every wait in the wider search is known. A candidate check-back may coexist separately.
- **Recent records/strategy → condensed Home context → Applications/Analytics → coverage:** Applications gives records; Analytics gives reporting-period analysis. Neither becomes a replacement for the operational decision set. Recently updated is not since-last-visit change.

**Design gate:** a category summary may say “3 in the returned Home result” with inline expansion of those three. It may not say “View all 3 in Applications” without a verified matching filtered destination. If exact cross-domain retrieval is desired later, name it as a missing dedicated capability rather than hiding the gap with wording.

## 6. Controlled scenario corpus

The same fictional information is used below for every direction. A and H deliberately test whether a composition invents a winner; E is the clean focal case. Counts are illustrative and not produced by the current demo fixture.

- **A —** Cedar interview tomorrow at 3 PM; Northstar saved follow-up overdue; Beacon and Harborline candidate-owned actions with saved dates. Both the interview and overdue check-back must be seen; neither is declared most important.
- **B —** Five active opportunities, no saved due item or near interview; a couple of optional undated/review cues. “Nothing urgent” cannot mean no useful work.
- **C —** High-volume search: multiple due follow-ups, interviews, undated steps, and stage-age suggestions; dashboard collection bounds apply. The candidate must see classes, representative referents, and where the returned remainder lives.
- **D —** All known opportunities are employer-owned waits; there is no currently saved candidate check-back due. Waiting is a legitimate state, not candidate failure.
- **E —** One saved follow-up due tomorrow for Northstar plus several stage-age suggestions. The saved date uniquely earns focal prominence; suggestions remain suggestions.
- **F —** Northstar's saved follow-up is available, but interview/ownership evidence is partial or failed. Show the known fact and say that the broader conclusion is incomplete; never show an all-clear.
- **G —** New/low-data candidate with no recorded opportunities. Offer the first recording path without invented progress or urgency.
- **H —** Three saved commitments with comparable timing and distinct referents, no defensible cross-domain winner. Show peer status, not a decorative hero.

## 7. Four low-fidelity composition proofs

These are *anatomy sketches*, not production copy or pixel specifications. A closed group always retains its condition class, referent, time/ownership meaning, coverage, and disclosure path. In each sketch `+` means inline disclosure of the returned Home subset, not an exhaustive cross-domain queue.

### A. Briefing — one short re-entry paragraph, then requested detail

```text
DESKTOP / E:  Home · recorded scope
              ┌ Saved follow-up tomorrow · Northstar ┐
              │ candidate check-back · why · Open     │
              └───────────────────────────────────────┘
              Also recorded: 3 review suggestions  [+ show returned items]
              Waiting/context and Analytics: quiet text links below

DESKTOP / H:  Home · recorded scope
              Three peer saved commitments · comparable timing
              Northstar · date/owner  Cedar · date/owner  Beacon · date/owner
              [+ reasons and returned items]   No singular focal object

PHONE / E:    Scope → named due commitment/time/owner/reason → Open
              Compact “3 review suggestions” + disclosure → quiet context
PHONE / H:    Scope → three compact named peer lines → disclosure
              No giant empty hero slot; secondary content follows
```

**Strength:** low initial reading demand and a fast re-entry. **Cost:** even with named peer lines, A/C/H can make the candidate expand before understanding the range of actionable work. It risks appearing deceptively complete when the returned collection is bounded.

### B. Triage — grouped work units are the main body

```text
DESKTOP / E:  Home · recorded scope
              SAVED COMMITMENTS (1)  Northstar · tomorrow · candidate · Open
              REVIEW SUGGESTIONS (3)  stage-age basis · [+ rows]
              WAITING (2)  employer-owned · [+ records]
              Each group is a compact queue with detail on selection.

DESKTOP / H:  SAVED COMMITMENTS (3)
              Northstar · date/owner | Cedar · date/owner | Beacon · date/owner
              [+ action detail]  Same row weight, no winner

PHONE / E:    Scope → commitments group → suggestions group → waiting group
PHONE / H:    Scope → peer commitment rows → disclosure → quiet context
```

**Strength:** excellent category scanning and dense-state resilience. **Cost:** Home remains primarily a processing queue; multiple similarly weighted group headers and controls can recreate the dense→dense→dense rhythm that the research is intended to escape.

### C. Editorial command center — asymmetric focal canvas and context rail

```text
DESKTOP / E:  Home · scope
              ┌ WIDE: Northstar · saved follow-up tomorrow ┐  │ NARROW │
              │ time/owner → one-line reason → Open         │  │ review │
              └────────────────────────────────────────────┘  │ waits  │
              Recorded context and strategy form a quieter lower baseline.

DESKTOP / H:  Wide shared summary: 3 peer commitments (no winner)
              Narrow rail: classes/coverage; peer referents below, equal weight
              No empty focal slot or fabricated first item.

PHONE / E:    Wide focal region becomes first full-width block;
              former rail follows as compact summaries, not a second command.
PHONE / H:    Shared peer summary first, then compact lines and disclosure.
```

**Strength:** uses desktop width and creates strong rhythm in E. **Cost:** the side rail can become a second authority; in A/H the focal canvas loses its defining asymmetry or pressures the design to crown a winner. Mobile must convert the rail carefully, not merely stack it.

### D. Hybrid — evidence-gated focal, compact grouped awareness, quiet release

```text
DESKTOP / E:  Home · compact recorded scope
              ┌ ONE DECISION CONTEXT ──────────────────────────────────┐
              │ Northstar · saved follow-up tomorrow · candidate      │
              │ saved reason + bounded time meaning · Open            │
              │─────────────────────────┬────────────────────────────│
              │ Review cues: 3          │ Waiting: 2                 │
              │ named cue + basis [+]    │ employer-owned [+]         │
              └─────────────────────────┴────────────────────────────┘
              Recently updated / reporting-period context: quieter below

DESKTOP / H:  Home · scope
              ┌ ONE DECISION CONTEXT ──────────────────────────────────┐
              │ Three comparable saved commitments; choose to inspect│
              │ Northstar · date/owner  Cedar · date/owner             │
              │ Beacon · date/owner   [+ brief reasons/returned set]  │
              └───────────────────────────────────────────────────────┘
              No elevated individual, yet strong collective beginning.

PHONE / E:    Scope → one named saved commitment/reason/limit/route
              → one-line grouped awareness with named referent + disclosure
              → waiting/context → strategy; bottom navigation stays clear.
PHONE / H:    Scope → shared “3 peer commitments” outcome
              → compact named/date/owner peers → disclosure
              → quiet context. No desktop rail is blindly stacked.
```

**Strength:** a clear beginning without permanent hero pressure; contrast between focal/compact/quiet regions; high-volume work is classified without becoming a full inbox. **Cost:** requires a disciplined evidence gate and verified summary-to-detail contract. If every category receives a decorative panel, the benefit disappears.

## 8. Identical-scenario comparison

- **A — two kinds of consequential work:** Briefing may overcompress one into “also”; Triage exposes both as equivalent queue rows; Editorial risks making one large and the other a rail item; **Hybrid uses a shared peer commitment presentation** because overdue and tomorrow do not establish personal importance.
- **B — active but not urgent:** Briefing is naturally calm but may sound too final; Triage's empty urgent group can look broken; Editorial's focal canvas becomes vacant; **Hybrid gives a bounded “nothing time-critical recorded” outcome**, then optional undated/review cues without a command tone.
- **C — high volume:** Briefing depends heavily on disclosure; Triage groups well but dominates the page with queue structure; Editorial rail can overflow or hide classes; **Hybrid shows each consequential class, named representative, count/cap, and inline returned-item expansion**.
- **D — employer waiting:** Briefing and Hybrid both support rest; Triage may make waiting look like unprocessed tasks; Editorial can over-emphasize a particular employer. **Hybrid keeps waiting visually quiet and explicit**, with saved candidate check-backs separate if they later appear.
- **E — one saved date plus heuristics:** Briefing and Editorial use the focal well; Triage treats it as a first queue row; **Hybrid gives the saved commitment a distinct lead and compresses heuristic reviews** with their age basis.
- **F — partial evidence:** Briefing's short form risks an overconfident conclusion; Triage can attach source warnings by group; Editorial may bury failure in the rail; **Hybrid attaches incompleteness to the decision outcome while retaining the verified Northstar fact**.
- **G — no records:** Briefing is elegant; Triage risks empty group furniture; Editorial has no legitimate focal content; **Hybrid collapses to a compact first-recording invitation in the same decision location**, not a dashboard of zeros.
- **H — peers without winner:** Briefing can list named peers but little rationale; Triage handles the list but reads like a work inbox; Editorial loses its defining focal asymmetry; **Hybrid presents a collective peer outcome with compact referents and on-demand reasons**, not a #1 recommendation.

## 9. First-glance and reading-burden comparison

**Counting rule:** an “information unit” is a separately scannable status, referent, or reason that asks the candidate to interpret it; an “action” is a visible interactive route/control. Counts below are approximate from the wireframes for E/H, *not measured use or performance*. They exclude global navigation. Every model carries the same underlying records and required trust information, though some detail is disclosed.

- **Current rendered two-action example:** one scope line, four-part category line, two full action bodies, and coverage footer: roughly 10–12 immediately exposed units, 8 controls across the full decision band, at least five explanation/limitation lines. On phone, the first commitment is not fully visible without scrolling. One surface groups them, but two row bodies still compete.
- **Briefing:** about 4–6 E units / 5–7 H units, 2–4 initial controls, 1–2 explanation lines; most peer reasons and additional actions deferred. Eye begins at the named saved commitment or collective peer sentence. Easy to dismiss lower content, but details/disclosure carry high retrieval burden.
- **Triage:** about 8–11 E units / 8–12 H units, 4–7 controls, 2–4 explanation lines; work is divided into three or more compact groups. Eye begins at the first group header, but several headers and rows request inspection. Dense states remain orderly yet Home still feels queue-first.
- **Editorial:** about 6–9 E units / 7–10 H units, 3–5 controls, 2–3 explanation lines. Eye starts at the wide canvas; E looks composed, but H's broad peer summary and side rail compete, and the mobile rail adds vertical depth.
- **Hybrid:** about 6–8 E units / 7–9 H units, 3–5 controls, 2–3 minimum explanation lines. Eye starts at the saved commitment *only when warranted*, otherwise at the collective decision outcome. Other classes remain legible as grouped awareness. Depth is available without presenting all actions and buttons at once.

These estimates are not a mandate to minimize counts. In particular, reducing a commitment's literal time, ownership, or uncertainty to meet a visual quota would be a failure. The stronger test is whether a candidate can identify a recorded condition *before* reading all body copy and then find the rest without route guessing.

**Visual rhythm:** Briefing is focal→very quiet→disclosure; Triage is compact→compact→compact; Editorial is focal→rail→quiet but only stable when a focal item exists; Hybrid is conditional focal *or* collective peer beginning→compact class summaries→quiet recorded/strategic context. The Hybrid alternation best avoids dense→dense→dense while preserving trust-critical signals.

## 10. Comparative judgment

**Hybrid leads** on the combined criteria of first-glance orientation, honest commitment recognition, action/reason connection, nonfocal resilience, mobile translation, and HireFlux fit. It supports a visually interesting focal event without requiring one, and gives high-volume classes a scanable closed state. Its risks are implementation discipline and truthful disclosure, not a contradiction of Stage 2.

**Briefing is runner-up.** It is strongest on calm and immediate low burden, including waiting and low-data states. It loses because A/C/H would require too much expansion or navigation before several consequential commitments become intelligible. If expanded to fix that, it begins to converge on Hybrid.

**Triage is rejected as the governing Home composition.** It is strong for a dedicated work surface, category scanning, and very dense searches, but its repeated groups and controls retain the feeling of a second inbox. Its grouping principle may inform Hybrid's compact summary layer; its page architecture should not be copied.

**Editorial command center is rejected as the governing composition.** It is visually compelling with a unique near-term recorded commitment and uses desktop width well. It is weaker when peers tie, evidence is incomplete, or the candidate is waiting; a large focal canvas would invite unsupported prominence or leave conspicuous vacancy. Its restrained use of width may inform Hybrid, but a standing context rail must not become another decision authority.

This is design judgment informed by source and rendered inspection, not a usability-test winner. Neither the literature nor the screenshots establish actual first-click accuracy, comprehension time, or trust for HireFlux candidates.

## 11. Recommended direction and visual identity

**Select Hybrid: an evidence-gated decision composition, not a full work queue inside one large card.** Preserve one Home-wide operational authority. Give a unique recorded near-term commitment a focal treatment only when the evidence supports it; where multiple recorded commitments plausibly compete, lead with their collective condition and compact, equally legible peer referents. Under that, expose short category summaries for other returned commitments/review cues and a clearly labeled inline path to the rest. Waiting, recent records, and reporting-period strategy step down in visual weight.

The visual change is **less simultaneous exposure**, not less product honesty. The first view removes repeated full-length row rationale, repeated generic limitations, immediate controls for every surfaced item, zero-category narration, and duplicate routes. It does not remove a known commitment, its literal timing/owner, its minimum reason/qualification, or a truthful retrieval path. A candidate should perceive **where to look → what deserves inspection → what can wait → where the rest exists** before reading a long explanation.

The composition should feel calm, capable, and pleasant through typographic contrast, bounded asymmetry, whitespace between decision and context, local proximity of action/reason/limit, and restrained semantic accents. No gradient, glow, score, illustration, or ambient motion is needed. On desktop, use width to keep a named commitment and compact class awareness in one reading relationship, not two competing columns. On tablet and phone, preserve the same semantic order while compressing the class summaries themselves; do not merely stack a complete desktop queue.

**Tradeoffs accepted:** fewer one-tap Home mutation controls in the closed state, some secondary reasoning behind disclosure, and a more demanding implementation contract around group coverage. Those are preferable to making every surfaced item equally loud. The design must prove that a candidate can still find and act on the returned work.

## 12. Exact proposed revision to the Stage 3 visual specification

Do **not** edit [the existing specification](home-stage-3-visual-translation-spec.md) in this research pass. A later accepted Stage 3 revision should replace its visual-composition decisions—not Stage 1/2 semantics—with the following contract:

1. Replace **“compact orientation → one full-width decision band of full peer rows → quieter context”** with **“compact orientation → one evidence-gated decision composition → compact class awareness and honest disclosure → quiet recorded context/strategic reflection.”** The decision composition is still one Home-wide authority, not a separate action dashboard plus side priorities.
2. Replace the assumption that representative actions are initially shown as complete repeated rows. In the closed view, each consequential class has an identifiable named referent, literal date/ownership meaning, minimum reason and material limitation, bounded count, and a route/inline expansion. Expanded rows may use the existing fuller grammar and operations.
3. Add an explicit **focal eligibility rule for visual design:** focal scale is allowed only for a uniquely defensible recorded near-term condition; it describes time-sensitive recorded attention, never personal importance. When evidence does not choose a unique lead, render equal peer commitment summaries in the same decision location. Do not reserve an empty hero slot.
4. Replace a standing full-width text slab with a controlled desktop relationship between a focal/collective decision lead and compact supporting classes. The supporting area is not another authority or Analytics rail. At narrower widths, preserve source order and compress the summaries; keep first-screen condition recognition and a clear bottom-nav-safe continuation.
5. Keep **action → minimum reason → material uncertainty** visibly adjacent. Move repeated generic caveats to the smallest scope that still qualifies the claim; do not hide a specific uncertainty behind disclosure. Preserve literal time/owner, non-color meaning, keyboard access, loading/partial/failure distinctions, and reduced-motion equivalence.
6. Require **summary → returned hidden items → inline expansion/exact record route → coverage label** to be documented for every group. Generic Applications/Interviews links are additional navigation, not exact “all Home work” destinations unless a future contract proves equivalence. A capped query never produces exhaustive language.
7. Keep recorded context, Analytics, and tour optional and visibly quieter. “Recently updated” never means “changed since your last visit”; reporting-period strategy never regains a rival “do this now” headline.

All Stage 2 presence/disclosure rules, the existing `homeDecisionModel`'s epistemic distinctions, server-owned facts, semantic corrections, and current API contracts remain the baseline. This research does not prescribe an implementation file structure, a new algorithm, or a new backend endpoint.

## 13. Remaining hypotheses and validation gates

- Test whether candidates distinguish **saved date**, **scheduled interview**, **undated candidate step**, and **stage-age suggestion** from the closed Hybrid summaries without needing to open every group.
- Test A/H first-click behavior: do people perceive multiple legitimate choices, or does visual scale still imply an unsupported winner? Do not promote a deterministic sort order into a personal-priority claim.
- Test C retrieval: given a named hidden item, can the candidate find it within the returned Home subset, and do they understand backend caps? Determine whether a dedicated cross-domain work-list capability is needed before using exhaustive language.
- Test D/F/G interpretation: waiting, partial evidence, and no recorded opportunities must not look like the same quiet empty state. Successful source facts must remain useful during another source's failure.
- Verify desktop and phone with first-glance tasks, route-finding, reason/uncertainty comprehension, keyboard and screen-reader disclosure, 200% text, and long titles. Record observed behavior rather than treating low-fi attractiveness or fewer visible objects as success.

## 14. Repository and evidence boundary

Created by this pass: **this document only**. No production, test, fixture, snapshot, dependency, or accepted-document changes are intended. The rendered measurements came from isolated fixture-backed browser inspection; temp screenshots are outside repository state. The four wireframes are proposed compositions, not rendered implementations. The existing first Stage 3 document remains available for an explicit later acceptance/revision decision.
