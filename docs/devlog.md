# HireFlux development log

## 2026-09-01 — L5 chapter-specific visual focus

Refined only the internal hierarchy of the lower Connected Workspace product
scenes so each chapter has one immediate focal object. The pre-edit audit found
that Applications was already closest to the target but its heading, statuses,
and rows remained similar in weight; Interviews let its dark next-preparation
card compete with the Technical Screen and retained context; Preparation gave
the checklist and candidate-question column nearly equal prominence; and
Action distributed attention too evenly among its section heading, company,
due state, action title, history strip, and supporting priorities.

L5 introduces no new visual language. Existing semantic surface, line, violet,
accent, warning, and ink tokens now establish a small primary / secondary /
tertiary model inside the existing markup. Private
`data-workspace-focus-primary` and `data-workspace-focus-supporting` targets
describe the intended hierarchy for tests without changing accessibility
semantics or making decorative product UI interactive.

Applications strengthens the selected Northstar row with a restrained violet
surface, inset edge, and clearer company/role hierarchy. Atlas Systems and
Harborline retain their icons, states, and next-step metadata at a quieter but
fully readable weight. The compact Recent Opportunities strip deliberately
uses a softer version of the same selection treatment so it supports rather
than competes with the active Interview.

Interviews gives the Northstar / Technical Screen header a light violet tone,
raises the active title and Conversation Context hierarchy, and separates the
retained application facts with an existing divider. The recent-opportunities
strip and next-preparation card remain legible but use muted surfaces and text,
so the active interview and inherited context read first in dark and light
themes.

Preparation keeps the L4 provenance header and NS markers intact while making
the checklist the clear working area. Its heading is stronger, its primary
column receives a very light violet surface, and the one unfinished candidate
question uses the existing warning surface. The candidate-question/context
column and compact retained Interview header remain visible at a supporting
weight. Static/reduced-motion cards use the same readiness bar and emphasize
the existing `One question remaining` phrase without adding or changing copy.

Action now resolves around `Send a thoughtful follow-up`: the featured row uses
the existing accent surface and edge, while the action title is larger than
the Northstar company label and due-today/provenance metadata. The section
heading, retained-history strip, and Atlas/Harborline priorities remain
credible but quieter. Compact Static Action cards preserve the same title-first
hierarchy. No CTA was added.

No motion was introduced. The GSAP timeline, ScrollTrigger, chapter transforms,
crossfades, semantic boundaries, Action hold, and release sequence are byte-for-
byte untouched. Forward, reverse, rapid traversal, and all three transition
freeze frames showed no stale emphasis or simultaneous full-strength focal
surfaces.

Exact responsive QA covered Full 1440×900, 1280×800, 1180×800, and 1024×768;
Adapted 1280×650, 1024×700, 960×720, 900×768, and 900×680; and Static
768×1024, 430×932, 390×844, and 320×568. Every size exposed the expected four
focus targets, kept its correct capability mode and pin count, and had zero
horizontal overflow. Dark and light visual review confirmed that border and
surface contrast—not opacity or hue alone—create hierarchy while all secondary
content remains readable. The browser console remained clear.

Sixteen intentionally affected references were reviewed and refreshed: four
dark settled/handoff chapter frames, three dark handoffs, both Adapted frames,
light Interview handoff and Action, the dark desktop landing page, and four
light Static full-page sizes. No unrelated product baseline changed.

ESLint, TypeScript, all 188 Vitest tests, the 13-test focused accessibility
suite, production build, three hosting-header tests, the exact-size responsive
audit, and the complete Playwright/Axe matrix pass (121 passed, 54 intentional
project-filtered skips). `git diff --check` is clean.

Against L4, the production main entry remains 282.91 kB raw / 84.78 kB gzip.
The lazy landing chunk moves from 160.30 / 56.29 to 162.06 / 56.62 kB
(+1.76 / +0.33), and CSS moves from 111.19 / 18.19 to 113.90 / 18.41 kB
(+2.71 / +0.22). No dependency, route, backend, or authenticated bundle
boundary changed; generated `dist` output remains uncommitted.

Regression boundary: L1's narrative geometry and progress placement, L2's 4px
handoffs and 24% / 46% / 76% ownership boundaries, L3's progress/release and
removed lower CTA, L4's NS identity/provenance system, E6 stage geometry, E7
capability thresholds, E8 lifecycle ownership, one master timeline, and one
ScrollTrigger per active choreographed mode are unchanged. L5 stops here; no
L6 Action-resolution work was introduced.

## 2026-09-01 — L4 Northstar opportunity continuity

Strengthened Northstar Labs as the visual protagonist of the lower Connected
Workspace story without changing the story's words, product geometry, or
motion. The pre-edit audit found that the company name survived all four
chapters, but its identity did not: Applications generated the ambiguous
initials `NO`, Interviews replaced the company cue with a generic calendar,
Preparation relied on small provenance text, and Action Center used the same
generic priority dot vocabulary as unrelated opportunities. Typography and
container placement also changed by product context, which is appropriate;
the avoidable continuity loss was the disappearing company marker.

One private `NorthstarMark` now provides a restrained violet `NS` monogram in
each scene's native identity area. Applications gives the Northstar row a
subtle selected surface while keeping Atlas Systems and Harborline fully
readable. Interviews places the compact mark beside the existing
`Northstar Labs · Interview` and `Technical screen` hierarchy. Preparation
uses a compact 28px mark on the retained Interview context and a 36px mark on
the active Preparation header, making provenance visible without competing
with the checklist. Action Center carries the 36px mark into the featured
Northstar `Do now` row while the existing cyan urgency surface, `Due today`,
retained-history text, and quieter supporting priorities keep their semantic
roles. Static/reduced-motion cards use the compact treatment so identity
survives narrow layouts without consuming task space. Existing visible text
remains the accessible source of meaning; the repeated monogram is decorative
and `aria-hidden`, so no duplicate announcement or false selection semantic
was introduced.

No continuity-specific animation was added. The identity cues inherit the
existing panel choreography, which avoided duplicate emphasis during handoffs
and kept the product task—not the marker—as the scene owner. Slow, fast,
forward, reverse, and freeze-frame checks confirmed that Northstar can be
recognized immediately in each settled chapter. At Preparation, the compact
retained cue and larger active cue communicate context → task rather than two
equal owners. At Action, Atlas and Harborline remain visible and usable while
Northstar resolves as the earned next action.

Responsive QA covered Full 1440×900, 1280×800, and 1024×768; Adapted
1280×650, 1024×700, 960×720, and 900×768; and Static 768×1024, 390×844, and
320×568. The compact marker survives Adapted and Static layouts, all tested
pages remain horizontally contained, Full/Adapted retain one pin spacer, and
Static/reduced motion retain none. Dark and light review found the existing
violet surface/ink tokens visible but restrained, with textual company and
role/provenance context preventing color-only recognition. Two intentional
references were refreshed: the dark desktop Preparation endpoint and the
light mobile-390 full landing page; all other references remained within the
approved visual threshold.

Focused component coverage now requires a marked Northstar identity in all
four static chapters. The existing desktop journey additionally asserts the
same cue at each choreographed endpoint, the smaller retained marker versus
the active Preparation marker, and preserved Atlas/Harborline context. ESLint,
TypeScript, all 187 Vitest tests, the 13-test focused accessibility suite,
production build, three hosting-header tests, the focused 1024/1280 journey,
and the complete Playwright/Axe matrix pass (121 passed, 54 intentional
project-filtered skips). `git diff --check` is clean.

Against L3, the production main entry remains 282.91 kB raw / 84.78 kB gzip.
The lazy landing chunk moves from 159.66 / 56.15 to 160.30 / 56.29 kB
(+0.64 / +0.14), and CSS moves from 110.64 / 18.15 to 111.19 / 18.19 kB
(+0.55 / +0.04). No dependency, route, backend, or authenticated bundle
boundary changed; generated `dist` output remains uncommitted.

Regression boundary: L1's 21.5rem narrative envelope and anchors, L2's 4px
crossfades and 24% / 46% / 76% ownership boundaries, L3's progress geometry,
Action hold, removed lower CTA, and release timing, E6 stage geometry, E7
Full/Adapted/Static thresholds and travel, E8 lifecycle behavior, one master
timeline, and one ScrollTrigger per active choreographed mode are unchanged.
L4 stops here; no L5 chapter-focus work was introduced.

## 2026-09-01 — L3 lower-story resolution and progress cleanup

Removed the duplicate lower-story conversion beat so Connected Workspace now
resolves directly from Applications → Interviews → Preparation → Action Center
and releases. The hero remains the single conversion surface: its Explore the
Demo / Continue Demo behavior, session handling, styling, and destination are
unchanged. The lower `Start Demo Workspace` / `Return to Workspace` button was
removed from both the pinned composition and the Static Action card, along with
its component props, LandingPage wiring, GSAP selector, hidden-state CSS, and
button-focused tests. No empty or focusable wrapper remains.

The retired CTA animated from raw timeline `0.80–0.88`; the final Action
priority settles at `0.825`. Removing that tween outright would have shortened
the master timeline from `0.88` to `0.825`, remapping normalized product and L2
narrative timing. L3 therefore preserves the exact `0.825–0.88` interval as a
property-free hold on the already-mounted Action surface. Live slow, fast,
reverse, and release QA showed that this 0.055 interval reads as a brief chance
to absorb the completed Action Center—not an empty pause—so the ScrollTrigger
distance, release point, semantic boundaries, and overall timeline duration
remain unchanged.

The four bars continue to represent Applications, Interviews, Preparation,
and Action. Their individual grid tracks were already equal and changed only
tone, but their shared container lived inside the narrator whose chapter CSS
changed max-width and horizontal offset. As a result, the whole indicator
quietly resized and shifted between chapters. Chapter-specific width/offset
styling now applies only to the fixed-height copy stack; the progress row keeps
one full-column origin, total width, four equal segments, gap pattern, baseline,
and L1 vertical position. The active segment uses the existing accent while the
other three use the existing muted line tone. The old color transition was
removed so progress ownership resolves immediately with React at the frozen
24%, 46%, and 76% L2 boundaries. The bars remain decorative and
non-interactive; Static/reduced-motion layouts continue to use the four visible
numbered chapters instead of a redundant indicator.

At 1280×800, live measurements across all four chapters recorded the same
332.32px container and the same four 77.07–77.08px segment tracks at identical
coordinates. Full QA covered 1440×900, 1280×800, and 1024×768; Adapted covered
1280×650, 1024×700, 960×720, and 900×768; Static covered 768×1024, 390×844,
and 320×568. Every viewport had zero horizontal overflow. Full and Adapted kept
one pin spacer; Static kept none. Dark and light modes retained identical
geometry with visible muted segments and one clear active segment. Release QA
confirmed Action is complete before the former CTA interval, remains the sole
final owner through the end, releases before the footer, and restores directly
to Action when reversed.

Eight intentional baselines were refreshed: the desktop landing page, dark
Full and Adapted Action endpoints, the light Action endpoint, and four
light-theme full-page references at 320, 390, 768, and 1280px. No unrelated
snapshot changed.

Against L2, the production main entry remains 282.91 kB raw / 84.78 kB gzip.
The lazy landing chunk decreases from 160.70 / 56.33 to 159.66 / 56.15 kB
(-1.04 / -0.18), and CSS decreases from 110.88 / 18.21 to 110.64 / 18.15 kB
(-0.24 / -0.06). ESLint, TypeScript, all 186 Vitest tests, the 13-test focused
accessibility suite, production build, three hosting-header tests, focused
forward/reverse/release browser checks, and the complete Playwright/Axe matrix
pass (121 passed, 54 intentional project-filtered skips).

Regression boundary: hero CTA and demo flow, product stage and choreography,
E6 geometry, E7 Full/Adapted/Static thresholds and travel, E8 lifecycle
ownership, L1 21.5rem envelope and anchors, L2 4px crossfades and semantic
boundaries, one master timeline, one ScrollTrigger per active choreographed
mode, reduced-motion priority, pin/release ordering, and footer behavior are
unchanged. L3 stops here; no L4 work was introduced.

## 2026-09-01 — L2 lower-story narrative handoff polish

Replaced the Connected Workspace narrator's three instant whole-message swaps
with short, shared ownership handoffs. The previous copy changed at raw GSAP
positions `0.226`, `0.432`, and `0.714`, before React's normalized semantic
boundaries at `0.24`, `0.46`, and `0.76`. That made the product workspace and
narrative briefly describe different chapters, and a stopped or reversed scrub
could read as an abrupt replacement rather than a causal handoff.

Each transition now uses the same bounded model: the outgoing message moves up
4px and fades over 1.2% of normalized timeline progress, beginning 1.2% before
the chapter boundary; the incoming message starts 4px below, begins 0.4% before
the boundary, and settles over 1.2%. Outgoing copy uses `power1.out`; incoming
copy uses `power2.out`. The complete message moves as one unit, with no internal
stagger, horizontal travel, blur, scale, or extra motion authority. At the
boundary the outgoing owner is gone and the incoming owner is already legible,
while the overlap window remains too short for two competing headlines.

GSAP child positions are expressed in raw timeline time, whereas the existing
chapter selector reads normalized `timeline.progress()`. The handoff positions
therefore derive from `timeline.duration()` after the frozen product
choreography is assembled. This aligns visual ownership with the semantic
boundaries without moving any product tween, label, CTA event, or release
timing. Forward, reverse, and rapid multi-boundary scrubbing remain
deterministic because the same timeline owns both directions and React still
updates only when a chapter boundary is crossed.

The L1 21.5rem narrative envelope, four fixed text rows, progress placement,
CTA placement, Full/Adapted/Static capability model, E6 stage geometry, E7
travel values, one-timeline/one-ScrollTrigger ownership, reduced-motion
fallback, and product workspace choreography are unchanged. The only refreshed
visual baseline is the Preparation-to-Action frame: its old image paired
Preparation copy with an already-settled Action Center surface, while the new
baseline correctly gives both product and narrative to Action Center. L3 CTA
removal remains unimplemented.

Live QA covered all three handoffs in dark and light Full mode at 1280×800,
including reverse traversal and the narrow ownership window. Automated browser
coverage checks the same boundaries in Full 1280×800 and Adapted 900×680,
reverse restoration, rapid jumps, chapter semantics, and horizontal
containment. Static and reduced-motion rendering remain unaffected and are
covered by the complete accessibility/browser matrix.

Against the L1 baseline, the production main entry remains 282.91 kB raw /
84.78 kB gzip, CSS remains 110.88 / 18.21, and the lazy landing chunk remains
160.70 kB raw with gzip moving from 56.28 to 56.33 kB (+0.05). ESLint,
TypeScript, all 186 Vitest tests, the 13-test focused accessibility suite,
production build, three hosting-header tests, and the L2-focused browser tests
pass. The complete Playwright/Axe matrix initially reported only the intentional
Preparation-to-Action baseline change (120 passed, 54 project-filtered skips);
that single baseline was visually reviewed, refreshed, and its focused test
passed. The clean complete rerun passed 121 tests with 54 intentional skips.

Regression boundary: hero composition, lower-story words and chapter order,
chapter endpoints, workspace panel transforms and timings, L1 anchors,
responsive capability thresholds, CTA behavior, pin duration, release buffer,
footer ordering, route cleanup, and authenticated landing-chunk isolation are
unchanged.

## 2026-09-01 — L1 lower-story narrative anchoring

Stabilized the Connected Workspace narrator without changing its copy,
product workspace, chapter transitions, CTA, release sequence, or responsive
capability model. The previous desktop narrator already kept all four visual
chapter wrappers mounted in one overlaid CSS-grid cell and anchored the group
at `top: 2rem`; it was not vertically centering each active chapter. The
movement came from changing the entire narrator's width for each chapter.
Those width changes rewrapped every overlaid copy, changed the shared grid
track's maximum natural height, and moved the progress indicator and CTA that
followed the copy stack in normal flow. GSAP's existing 7px outgoing offset
was limited to the handoff and was not the settled-position cause.

The desktop copy stack is now a fixed 21.5rem narrative envelope. Every visual
chapter uses the same internal four-row grid: a 1rem chapter-label row, a 4rem
question row, a 7.5rem headline row, and the remaining body-copy region.
Existing typography and words remain unchanged. The label, question,
headline, and body therefore begin at stable vertical anchors even when a
question, title, or paragraph wraps differently. Progress remains the next
normal-flow row, 28px after the fixed envelope, so it no longer follows the
active copy's natural height.

The Action CTA remains immediately after progress and retains its existing
markup, timing, destination, disabled state, and GSAP entrance. Because the
copy envelope and progress row now establish the core stage geometry before
the CTA, Action's extra content cannot move the label, question, headline,
body, or progress anchors. L3's planned CTA removal was intentionally not
implemented.

Bounding-box QA compared all four settled chapters at 1440×900, 1280×800,
1180×800, 1100×800, 1024×900, and 1024×768 in Full mode, plus 1280×650,
1180×650, 1024×700, 1000×720, 960×720, 900×768, and 900×680 in Adapted mode.
Within each viewport, chapter label, question, headline, body, and progress
tops were identical across Applications, Interviews, Preparation, and Action
Center. Body-to-progress clearance remained 16–28px and every measured page
had zero horizontal overflow. Forward, reverse, and rapid-scrub coverage
continued to expose exactly one visual copy. Static checks at 768×1024,
390×844, and 320×568 retained four naturally flowing chapters, the existing
CTA, zero pin spacers, and zero overflow; desktop-only slot styling does not
apply to the fallback.

The component now exposes private data targets for the five narrative slots.
Unit coverage verifies four persistent copies and the copy → progress → CTA
order. Browser coverage asserts that all six major vertical anchors stay
within 1.5px of the Applications baseline in both Full and Adapted modes.
Seven intentionally affected lower-story snapshots were refreshed after dark
Full/Adapted and light Action review; unchanged Preparation and other frames
remained pixel-identical.

Against the completed hero-simplification baseline, the production main entry
remains 282.91 kB raw / 84.78 kB gzip. The lazy landing chunk is 160.70 / 56.28
(+0.18 / +0.05), and CSS is 110.88 / 18.21 (+0.63 / +0.10). ESLint,
TypeScript, all 186 Vitest tests, the 13-test focused accessibility suite,
production build, three hosting-header tests, and the complete Playwright/Axe
matrix pass (120 passed, 50 intentional project-filtered skips). The initial
parallel Vitest run had one five-second landing accessibility timeout; that
file passed 13/13 in isolation and the complete serialized rerun passed
186/186.

Regression boundary: `ConnectedWorkspaceVisual`, product dimensions and
transforms, E6 stage geometry, E7 Full/Adapted/Static queries and travel,
chapter labels/boundaries, one master timeline, one ScrollTrigger per active
choreographed branch, CTA timing, pin duration, release buffer, route cleanup,
and reduced-motion priority are unchanged. L2 text-handoff polish and L3 CTA
removal remain deliberately unimplemented.

## 2026-09-01 — Hero narrative simplification

Reframed the public landing hero around one product promise: HireFlux keeps an
opportunity connected to what comes next. The previous hero asked visitors to
operate a second four-stage product demo while the Connected Workspace section
below already provided the detailed mechanism. That duplication made the first
screen cognitively dense and blurred the distinction between the promise and
its proof. The hero now communicates the outcome in one compact Northstar Labs
composition; the lower scroll story remains the unchanged Applications →
Interviews → Preparation → Action Center proof.

The resolved composition keeps the shared Northstar Labs identity, Product
Designer role, location/work-mode metadata, and captured status. A restrained
Flux connection carries a concise provenance statement—“Interview complete ·
Preparation retained”—into one featured “Do now” follow-up due today. This is
deliberately not a miniature interview, preparation, or Action Center screen.
The visible caption summarizes the relationship as “One opportunity, connected
from capture to action,” while a semantic figure description provides the same
meaning without placing automatic motion in a live region.

Removed the hero-only Capture / Progress / Prepare / Act milestone controls,
pause/play/replay behavior, six-scene controller, managed autoplay timer,
manual stage selection, resolve bridge, keyed intermediate surfaces, and their
tests. The obsolete controller files and eight scene-specific visual baselines
were deleted. The landing story model now retains only the data shared by the
hero and lower proof plus the frozen lower-story chapter model. This cleanup
removed 836 net lines from the tracked text diff, including 235 lines of
obsolete hero CSS, without adding a dependency or public interface.

Motion is now one scoped, one-shot GSAP timeline with four readable phases:
opportunity at 0, connection at 0.28, action at 0.70, and settled at 1.28. The
opportunity settles first, the line and provenance establish causality, and the
action resolves last. React owns the persistent semantic composition; GSAP
only adjusts transform, opacity, line-dash, and emphasis on mounted targets.
The scoped context and timeline are reverted on unmount and remain isolated to
the lazy landing route. Reduced motion creates no GSAP context or timeline and
renders the identical resolved endpoint immediately.

Responsive live QA covered dark and light presentation at 1440×900, 1280×800,
1024×768, 900×768, 768×1024, 430×932, 390×844, and 320×568. The composition
remained contained with zero horizontal overflow, a clear opportunity →
provenance → action hierarchy, and no retired stage controls or intermediate
surfaces. At 320px the visual uses stacked geometry and omits the redundant
captured-status pill while preserving the opportunity metadata and complete
causal story. Direct load, reload, route-away cleanup, route re-entry, explicit
light/dark themes, and reduced-motion endpoint behavior were also checked.

Component-level screenshots were added for the resolved dark desktop-1280 and
light mobile-390 hero. The five intentionally affected full-landing baselines
were refreshed after visual review; no Connected Workspace endpoint or
transition baseline changed. `ScrollProductStory.tsx`, `scrollStoryConfig.ts`,
the lower timeline, chapter copy, breakpoints, CTA, release behavior, and E5–E8
story snapshots remain untouched.

Against the E8 baseline, the production main entry is 282.91 kB raw / 84.78 kB
gzip (-0.04 / -0.02), the lazy landing chunk is 160.52 / 56.23 (-21.66 /
-4.66), and CSS is 110.25 / 18.11 (-12.53 / -1.16). ESLint, TypeScript, all
186 Vitest tests, the production build, three hosting-header tests, and the
complete Playwright/Axe matrix pass (120 passed, 50 intentional
project-filtered skips). One unrelated tablet interview fixture/navigation
miss occurred in the first matrix run; its focused rerun passed, followed by a
clean complete 120-test rerun.

Final narrative verdict: the hero now makes one legible promise and stops. The
Connected Workspace section earns the detailed explanation as the visitor
scrolls, so the page reveals new information instead of replaying the same
four-state product tour twice.

## 2026-09-01 — E8 adversarial landing-story QA and defect correction

Completed the requested defect-finding pass against the frozen E5 scene
ownership, E6 stage geometry, and E7 Full / Adapted / Static capability model.
The review deliberately exercised exact media-query edges, large scrubbed
jumps, reverse traversal, repeated Full / Adapted / Static crossings, route
re-entry, reload, reduced motion, theme changes, unusual aspect ratios, and
mobile/static fallbacks. It found three reproducible P2 defects; no P1 defect
or design regression was found.

The first defect occurred at the documented inclusive Adapted edges. Chromium
reported a nominal 1023×720 or 1024×719 layout viewport while evaluating exact
integer `max-width: 1023px` or `max-height: 719px` media features as false due
to fractional CSS-pixel precision. Those two capable windows therefore fell
through to Static. The JavaScript capability query and its matching CSS media
query now use `1023.99px` and `719.99px` maxima. Post-fix checks select Adapted
at 1023×720, 1024×719, 900×768, 1000×680, and 1280×640; Full at 1024×720; and
Static at 899×768, 1000×679, and 1280×639.

The second defect was a semantic/visual desynchronization during long jumps.
React chapter state and the progress indicator followed raw ScrollTrigger
progress while the rendered master timeline intentionally trailed it through
the existing `scrub: 0.35`. A fast jump could consequently expose an Action
label while the visible scene and narrative were still Preparation. The
timeline now samples its own rendered progress through one `onUpdate` event
callback; the existing ref guard still commits React state only when a chapter
boundary is crossed. ScrollTrigger remains the sole scroll authority and does
not trigger per-frame React renders. Automated alternating jumps to 92%, 10%,
55%, 30%, and 98%, plus live forward/reverse checks, keep the visible narrative
and `data-active-chapter` synchronized throughout the scrub.

The third defect was a responsive lifecycle race exposed by repeatedly cycling
Full → Adapted → Adapted-at-the-other-edge → Full → Adapted. A stale cleanup
could reset a newer same-mode instance to Static, and separately registered
match-media callbacks could briefly leave a matching Adapted query without the
correct branch. The two conditions now share one `gsap.matchMedia()` condition
map and one branch selector. Each created branch receives a private ownership
token, so only the current branch may clear the root mode during cleanup. The
timeline builder, persistent DOM, one active timeline, one active
ScrollTrigger, owned cleanup, and reduced-motion no-GSAP path remain unchanged.

Adversarial viewport coverage included 1920×1080, 1920×800, 1600×700,
1536×864, 1440×900, 1440×600, 1366×768, 1280×900, 1280×720, 1280×640/639,
1152×720, 1025×720, 1024×721/720/719/700, 1023×720, 1000×680/679, 960×720,
901×768, 900×768/680/640, 899×768, 844×390, 800×430, 768×1024, 667×375,
600×800, 430×932, 390×844, 360×800, and 320×568. Every endpoint retained the
expected capability mode, one pin spacer for Full or Adapted and none for
Static, zero horizontal overflow, and the complete four-chapter fallback where
pinning is disabled. Repeated mid-story width and height thrashing left no
duplicate wrapper, stale branch, or escaped content.

Visual and motion QA covered all four lower-story endpoints, both handoff
regions, partial stops, fast jumps, slow progression, reverse and rapid
reversal, CTA dwell, pin release, and light/dark theme changes. The E5 hero
also settled correctly after rapid mixed stage selections with no visible
overlap or overflow. A development-only `data-flux-settled` probe did not
consistently flip after a live manual selection, but the rendered endpoint was
correct, production lifecycle coverage passed, no semantic behavior depends on
that private probe, and no user-visible defect was reproduced; it was therefore
not changed. Reload in the local harness returned to a clean Applications
endpoint, and the browser console contained no warnings or errors. Existing
screenshots remained correct, so E8 refreshes no visual baseline.

Against E7, the production main entry remains 282.95 kB raw / 84.80 kB gzip
(0.00 / +0.01). The lazy landing chunk is 182.18 / 60.89 (+0.10 / +0.05), and
CSS is 122.78 / 19.27 (0.00 / +0.01). No dependency, animation chunk, route
payload, or authenticated-route landing download was added. ESLint,
TypeScript, all 197 Vitest tests, production build, three hosting-header tests,
`git diff --check`, and the complete Playwright/Axe matrix pass (120 passed,
50 intentional project-filtered skips).

Final verdict: ready to feature-freeze. E5/E6/E7 visual endpoints and story
timing remain intact; E8 changes only capability-edge precision, semantic
timeline synchronization, lifecycle ownership, and regression coverage. No E9
is justified unless a new reproducible P1 usability or accessibility defect is
found.

## 2026-08-31 — E7 responsive choreography preservation

Replaced the lower Connected Workspace story's former binary responsive rule
with an explicit Full / Adapted / Static capability model. Previously the one
ScrollTrigger branch required at least 1024×720, so a capable 900×768 landscape
viewport and short-but-wide 1180×650 or 1280×650 windows immediately received
the four-card linear fallback. Width and height were both present in the old
query, but only as one hard gate; there was no intermediate composition. The
upper E5 hero uses its own responsive visual geometry and already remained a
progressive, persistent Northstar Labs story at these sizes, so E7 makes no hero
timing, ownership, or layout change.

Full choreography remains exactly the E6 experience at 1024px or wider and
720px or taller: the same persistent 36rem stage envelope and 32rem shell, one
master timeline, one ScrollTrigger, 2.5 viewport heights of travel, approved
chapter timing, CTA dwell, and release order. Adapted choreography activates
for 900–1023px viewports with at least 680px height, or viewports at least
1024px wide with 640–719px height. It runs the same timeline builder and
semantic scene definitions with configuration rather than a parallel story:
travel contracts to 2 viewport heights, horizontal entrances reduce from
48px to 32px (and supporting translations proportionally), vertical scene
entrances reduce from 30/12px to 20/8px, and the stage uses a compact 34rem
envelope with a 6.5rem navigation rail and tighter but readable Interview
internals. Narrative/product spacing remains at least 16px and the E6 shell
stays fully contained inside its stage.

Static fallback remains authoritative below 900px, below the mode-specific
height floors, and whenever reduced motion is requested. This deliberately
classifies 1024×600 and 1440×600 as Static: their width is ample, but a 36rem
minimum pinned stage plus browser chrome, narrative, CTA, and release space
would be vertically cramped. Reduced motion is encoded into both choreography
queries and remains higher priority than responsive capability, so no GSAP
timeline, ScrollTrigger, or pin spacer is created in that mode.

Both choreographed branches are registered through the existing scoped
`gsap.matchMedia()` lifecycle. Crossing Full → Adapted → Static and back reverts
the active branch, kills only its owned trigger and timeline, removes its pin
spacer and inline transforms through the enclosing context, then creates at
most one replacement. Focused browser coverage crosses the exact 900/899px and
640/639px edges, toggles reduced motion while Adapted is active, and leaves and
re-enters the landing route; each transition resolves to the correct mode with
zero duplicate pin wrappers or stale story instances.

Live dark-theme QA selected Full at 1440×900, 1280×800, 1180×800, 1100×800,
1024×768, and 1024×900; Adapted at 900×768, 1180×650, and 1280×650; and Static
at 1440×600, 1024×600, 768×1024, 430×932, 390×844, and 320×568. Adapted
Applications, Interviews, Preparation, and Action Center were exercised
forward, in reverse, at partial stops, with fast jumps and repeated direction
changes. At 900×768 the pinned stage measured about 837×640px, its product
envelope about 588×544px, and its shell about 580×512px with a 24px layout gap.
At 1280×650 the envelope remained 544px high and the shell about 842×512px.
Both retained one readable dominant scene, Northstar continuity, one pin
spacer, complete envelope containment, a visible CTA before release, and zero
horizontal overflow. The complete linear fallback remained readable and
unpinned at every constrained and reduced-motion size.

Against E6, the production main entry remains 282.95 kB raw / 84.79 kB gzip
(0.00 / -0.01). The lazy landing chunk is 182.08 / 60.84 (+1.00 / +0.25), and
CSS is 122.78 / 19.26 (+2.25 / +0.31). No dependency, separately emitted GSAP
chunk, or authenticated-route payload was added. ESLint, TypeScript, all 196
Vitest tests, production build, three hosting-header tests, `git diff --check`,
and the complete Playwright/Axe matrix pass (119 passed, 46 intentional
project-filtered skips). Two reviewed Adapted-only visual baselines protect the
Interviews and settled Action/CTA compositions; existing E5/E6 wide-desktop
baselines remain byte-for-byte unchanged.

E5 scene ownership, E6 stable-stage geometry, persistent DOM, chapter
boundaries, wide-desktop choreography, CTA/release ordering, one-timeline /
one-ScrollTrigger ownership, and reduced-motion semantics remain unchanged.

## 2026-08-31 — E6 stable Connected Workspace stage geometry

Completed the lower Applications → Interviews → Preparation → Action Center
geometry pass from the clean E5 baseline. The implementation keeps the existing
story, chapter boundaries, internal scene choreography, 2.5-viewport travel,
CTA/release sequence, one timeline, and one ScrollTrigger. The upper E5 hero and
the E7 responsive fallback strategy remain unchanged.

The collision was caused by the workspace shell owning two incompatible jobs.
It was both the product grid cell's layout box and the chapter-specific motion
target. CSS Grid reserved its untransformed bounds, while GSAP moved and scaled
the rendered shell from `0.975 / +14px` through `1.035`, `1.065 / -60px`, and
back to `1.01`. At 1440×900 the protected narrative/product gap fell from about
50px to 2.5px during Applications → Interviews and became negative during
Preparation; the visually scaled shell reached approximately 1,022px while its
layout allocation did not change. Action could therefore interpolate through
the narrative column even though the untransformed grid itself still fit.

E6 introduces a dedicated product-stage envelope in the existing product grid
cell. The envelope is 36rem high, clips visual escape, and vertically centers a
32rem full-width workspace shell with a small internal inset. The shell now
retains `x: 0`, `y: 0`, `scale: 1`, and a centered transform origin throughout
the entire master timeline. Applications, Recent Opportunities, Technical
Screen, Preparation, retained history, and Action Center remain persistently
mounted and continue using their approved scene-local transforms, proportions,
clipping, and stacking inside that common coordinate system. The scene depth
still changes; the page-level product footprint no longer does.

Live rendered QA covered 1440×900, 1280×800, 1280×720, and 1024×768, including
settled states, handoff freeze frames, forward/reverse traversal, rapid
direction changes, and Action resolution. At the 1440 Applications → Interviews
midpoint the shell measured approximately 951.5×512px, retained an identity
matrix, stayed inside the envelope, and preserved about 50.2px of copy gap. At
1280 the shell remained approximately 836.7×512px and Action preserved about
41.9px of gap at both tested heights. At 1024 it remained approximately
625.7×512px and Action preserved about 46.8px. Every measured state had zero
horizontal overflow, one pin spacer, and complete envelope containment. The
new focused browser assertions protect a minimum 16px narrative gap, constant
shell origin and dimensions, identity outer transform, and all four envelope
edges at endpoints and high-risk handoffs. Nine lower-story dark/light visual
baselines were refreshed after direct review; no hero baseline changed.

Against E5, the production main entry remains 282.95 kB raw / 84.80 kB gzip,
the lazy landing chunk is 181.08 / 60.59 (-0.39 / -0.09), and CSS is 120.53 /
18.95 (+0.02 / 0.00). No dependency or additional animation chunk was added.
ESLint, TypeScript, the focused geometry tests, all 195 Vitest tests, production
build, three hosting-header tests, `git diff --check`, and the complete
Playwright/Axe matrix pass (118 passed, 42 intentional project-filtered skips).
A parallel Vitest run briefly exceeded the landing accessibility case's
existing five-second timeout by about 90ms; that file passed 13/13 directly and
the serialized full suite passed 195/195 without changing the timeout or test.

E5 scene ownership remains mechanically and visually intact. E7 breakpoint,
tablet, phone, short-height, and fallback choreography work was deliberately
left untouched.

## 2026-08-31 — E5 hero scene ownership and overlap cleanup

Completed a visual-state ownership pass only for the upper Capture → Context →
Progress → Prepare hero. The lower Connected Workspace sequence, E4 desktop
geometry, 2.5-viewport travel, CTA and release timing, breakpoints, and route
architecture remain unchanged.

The overlap was caused by three ownership ambiguities rather than one long
fade. The persistent Northstar container also carried capture-only metadata
indefinitely; the Context surface and Technical screen crossfaded while both
were readable; and the complete Technical screen remained at full prominence
while Preparation expanded beneath it. On dark surfaces, those technically
valid opacity ranges read as accumulated interface layers.

Northstar Labs identity and role now explicitly own the persistent opportunity
surface. Capture metadata, its Organized affordance, and Context are
scene-owned and yield over 0.22 seconds at Progress. The Applied status exits
over 0.14 seconds before the Interview status resolves. The Technical screen's
solid outer surface takes ownership 0.14 seconds into that handoff, while a
separate content target resolves over the normal 0.32-second state timing.
This retains continuity without allowing Context and the incoming interview to
compete at full strength.

During Progress → Prepare, the Technical screen becomes provenance instead of
remaining a second primary card. Its date detail exits over 0.18 seconds, its
content settles at 80% internal opacity, and the surface contracts to
`scaleX(0.96) scaleY(0.86)`, `y: -7px`, and 72% outer opacity. Preparation then
takes solid ownership after a 0.14-second handoff and opens through the existing
clip/scale choreography. The persistent Northstar identity and Interview
status remain the connective tissue; obsolete capture metadata, Context, and
full-strength interview chrome do not.

Live endpoint measurements confirmed Capture with capture metadata/status at
full strength and later surfaces hidden; Progress with metadata and Context at
zero while the Technical screen and its content are fully visible; and Prepare
with the Preparation surface at full strength while the interview is a 72%
supporting strip, its content is 80%, and its date detail is hidden. Repeated
Capture → Prepare → Progress reversals and rapid mixed selections settled to
the requested endpoint with no stale Context or Preparation UI and no
horizontal overflow. Dark desktop and light mobile Prepare frames were
reviewed and only their intentional visual baselines were refreshed.

Reduced-motion endpoint CSS now follows the same ownership model without
creating a GSAP lifecycle: later stages hide capture metadata and Context, and
Prepare/Resolve render the interview as subordinate provenance. Existing
Strict Mode cleanup, one persistent DOM composition, one hero timeline, and
target-tween cancellation remain intact.

Against E4, the production main entry remains 282.95 kB raw / 84.81 kB gzip.
The lazy landing chunk is 181.47 / 60.68 (+0.67 / +0.15), and CSS is 120.51 /
18.95 (+0.79 / +0.10). No dependency or extra animation chunk was added.
ESLint, TypeScript, all 195 Vitest tests, the production build,
hosting-header tests, `git diff --check`, and the complete Playwright / Axe
matrix pass (118 passed, 42 intentional project-filtered skips).

E6 lower-story geometry and E7 responsive choreography concerns were
deliberately left untouched.

## 2026-08-31 — E4 final transition integrity and viewport composition polish

Completed the landing page's final motion pass without changing the approved
story, hero, chapter boundaries, 2.5-viewport travel, CTA timing, release
buffer, or one-timeline / one-ScrollTrigger ownership. Timeline initialization
now excludes the initial Applications panel, narrative, and navigation state;
their explicit CSS endpoint remains authoritative until the later states begin.
Applications is therefore complete on first paint, before the pin, after
reverse scrolling above the trigger, and after rapid direction changes. The
desktop thesis-to-story gap is 48px, with no added entrance animation.

Applications now compresses spatially from raw timeline `0.08–0.21` while its
opacity stays strong until `0.17–0.21`. Recent opportunities begins at `0.095`,
the connector and node at `0.12` / `0.13`, and the Technical screen's solid
outer surface at `0.15`. A new private interview-content target resolves from
40% to full opacity through `0.33`, keeping the product canvas opaque while the
internal hierarchy forms. At normalized progress `0.25`, live measurements
showed shell opacity `1`, Recent opportunities `1`, Technical screen surface
opacity `1`, and interview-content opacity approximately `0.92` at 1280×900
dark, `0.92` in light mode, and `0.88` at 1024×768. Northstar remains traceable
through the selected context row and connector, without two full-strength
screens.

The Preparation → Action handoff now uses the same solid-surface principle.
Preparation contraction and retained history establish from `0.655`, the
Action surface becomes opaque at `0.67` and expands through transform and
clipping, its content resolves from 45% over `0.68–0.79`, and priorities retain
their approved `0.70` / `0.735` entrances. Live continuous-scroll inspection
initially found approximately 18% residual Preparation opacity in the open
space at the true `0.81` midpoint; tightening only the handoff reduced it to
approximately `0.02%`, while retained history measured `95%` and Action content
`87%`. Forward, reverse, and rapid-reversal passes keep one readable surface
and preserve the E3 endpoint, CTA entrance at `0.80–0.88`, and final dwell.

Only the Connected Workspace proof uses the wider composition. Its container
now caps at 90rem and the `xl` grid uses `0.48fr / 1.22fr` with a 24px gap;
1024px retains the prior grid and internal density. The initial shell measured
approximately 823px at 1280×900 and 935px at 1440×900, expanding to about
1022px at the 1440px Preparation peak without horizontal overflow. The
1024×768 shell remains approximately 618px wide. This uses the available
desktop canvas more fully while keeping the product bounded and the narrative
legible.

Live dark-theme QA covered first arrival, continuous slow/normal traversal,
partial stops, forward, reverse, and rapid reversals at 1440×900, 1280×900,
and 1024×768; light-mode QA covered the Applications → Interviews handoff at
1280×900. CTA dwell and release remain ordered: the CTA is settled while the
stage is fixed, the stage returns to relative positioning immediately after
the owned trigger end, and the footer first appears only after release. At
1024×700, 768, 390, and 320, all four chapters remain in normal flow with zero
pin spacers and no horizontal overflow. Reduced motion retains the tested
complete linear fallback. The hero was rechecked at its existing progression
points and needs no E4 adjustment.

Against E3, the production main entry remains 282.95 kB raw / 84.80 kB gzip.
The lazy landing chunk is 180.80 / 60.53 (+0.38 / +0.10), and CSS is 119.72 /
18.85 (+0.29 / +0.05). No dependency or separately emitted GSAP chunk was
added. ESLint, TypeScript, all 193 Vitest tests, the production build,
hosting-header tests, `git diff --check`, and the complete Playwright / Axe
matrix pass (118 passed, 42 intentional project-filtered skips).

The landing experience is now feature-frozen. No E5 or further landing motion
phase should be proposed unless live use reveals a genuine P1 usability or
accessibility defect.

## 2026-08-30 — E3 Action Center pullback, CTA resolution, and pin release

Completed only the Preparation → Action Center portion of the Connected
Workspace arc. E1 and E2 retain their approved geometry and timing, with
Preparation remaining the spatial peak at `scale: 1.065`, `y: -6px`, and
approximately `x: -51px` at 1024px / `x: -60px` at 1440px. E3 now relaxes the
same persistent shell to `scale: 1.01`, `y: 2px`, and
`x: -clamp(16px, 1.5vw, 22px)`, producing the intended broad → focused →
deepest-focus → broad arc without returning to the initial Applications
geometry.

Preparation now resolves causally instead of disappearing in a 45ms fade. Its
checklist and supporting modules demote first, the focused surface contracts
toward its provenance, and a retained “Technical screen complete · Preparation
retained” history strip forms before the broader priorities take over. Live
midpoint inspection exposed and corrected the former empty-shell/ghosting frame:
at the final transition midpoint the history strip is approximately 99%
established, Action Center is approximately 93% established, Preparation is
below 1% opacity, and exactly one narrative copy is readable. Reverse and rapid
direction changes restore the focused Preparation surface without stale Atlas
or Harborline content.

The desktop Action Center now uses a differentiated hierarchy. Northstar Labs
is the featured “Do now” / “Due today” row and keeps its interview and
preparation provenance; Atlas Systems and Harborline are quieter “Waiting” and
“Review later” rows. The CTA remains below the narrative progress indicator,
enters after Action Center establishes its hierarchy, reaches approximately 99%
opacity before release, and reads as the consequence of the resolved journey
rather than a separate product-mockup control.

The ScrollTrigger distance remains exactly 2.5 viewport heights. The desktop
release buffer is now `max(10rem, calc(100svh - 48rem))`, still bounded to this
section and containing no visual content. Live measurements at 1440×900 and
1280×900 put the footer's first visible pixel about 44px after the trigger end;
at 1024×768 the margin is about 177px. Immediately before the trigger end the
stage is fixed and the footer is outside the viewport; immediately after it the
stage is relative, and it remains unpinned when the footer first appears.

Live dark-theme QA covered the Preparation endpoint, E3 midpoint, settled
Action endpoint, slow/normal/fast movement, partial stops, reverse and rapid
reversal, CTA dwell, and release at 1440×900, 1280×900, and 1024×768. Light-mode
Action coverage and the new midpoint baseline were reviewed visually. At 768,
390, 320, and 1024×700, all four chapters remain in normal flow with zero pin
spacers and no horizontal overflow. Reduced motion continues to use the tested
complete linear fallback, and the hero remains unchanged.

Against the approved E2 build, the production main entry remains 282.95 kB raw /
84.80 kB gzip. The lazy landing chunk is 180.42 / 60.43 (+2.71 / +0.24), and CSS
is 119.43 / 18.80 (+0.27 / +0.02). GSAP and ScrollTrigger remain inside the lazy
landing chunk; no dependency or separate GSAP chunk was added. ESLint,
TypeScript, all 193 Vitest tests, the production build, hosting-header tests,
`git diff --check`, and the complete Playwright/accessibility matrix pass (118
passed, 42 intentional project-filtered skips).

## 2026-08-30 — E2 Interviews to Preparation spatial peak

Extended the approved E1 body-story language only through Interviews →
Preparation. The settled Interviews endpoint remains `scale: 1.035` with its
Recent opportunities context and Northstar handoff intact. Preparation now
moves the same persistent shell an additional 10–14px inward, reaching roughly
`x: -51px` at 1024px and `x: -60px` at 1440px, `y: -6px`, and `scale: 1.065`.
Together with a narrative width reduction from 92% in Interviews to 78% in
Preparation, this gives the product approximately three quarters of the
meaningful desktop story area without turning it into a viewport-filling zoom.

The full interview surface now compresses and fully demotes while a compact
Northstar Labs / Technical screen / date header settles as provenance. The
Preparation surface opens beneath it through bounded translation, vertical
expansion, clipping, and opacity. Its former equal-column card treatment was
reorganized into a clear hierarchy: readiness state, a dominant focused
checklist, candidate question, and supporting inherited context. The expanded
surface uses the added space for working content instead of filler, and receives
only a modest shadow increase for foreground separation.

Live midpoint QA initially found a dark, nearly empty shell: the provenance
header was only partly established while Preparation had not meaningfully
opened. The structural handoff and internal content entrance were moved earlier
within the same timeline. At the corrected midpoint the full interview is
non-readable, the compact interview header is approximately 95% established,
and the Preparation surface is approximately 73% established, so the frame
reads as one workspace transforming rather than two opaque screens or an empty
crossfade. Reverse scrolling restores the full interview, Recent opportunities,
and the E1 shell endpoint; rapid direction changes settle without stale
Preparation modules.

Live dark-theme QA covered slow, normal, fast, partial-stop, reverse, and rapid
reversal behavior at 1440×900, 1280×900, and 1024×768. The 1024 endpoint has no
internal vertical clipping, all three desktop sizes have no horizontal overflow,
and the refreshed visual coverage adds the Interviews → Preparation midpoint.
Short desktop height, 768px tablet, 390px, and 320px continue to render the four
normal-flow static chapters with no pin wrapper or overflow. Reduced motion
continues to create no GSAP lifecycle through the existing tested fallback.
Applications → Interviews, Preparation → Action Center, Action Center, CTA,
hero behavior, chapter boundaries, 2.5-viewport travel, and the one-timeline /
one-ScrollTrigger lifecycle remain unchanged.

Against the approved E1 build, the production main entry remains 282.95 kB raw /
84.80 kB gzip. The lazy landing chunk is 177.71 / 60.19 (+1.46 / +0.30), and CSS
is 119.16 / 18.78 (+0.84 / +0.10). No dependency or separate GSAP chunk was
added. ESLint, TypeScript, all 193 Vitest tests, production build,
hosting-header tests, `git diff --check`, and the complete Playwright /
accessibility matrix pass (117 passed, 38 intentional project-filtered skips).

## 2026-08-30 — E1 Applications to Interviews spatial proof (redone)

Rebuilt only the desktop Applications → Interviews handoff after reviewing the
first E1 attempt as provisional. Applications remains a broad, right-weighted
three-opportunity surface at `x: 14`, `y: 8`, `scale: 0.975`. As focus narrows,
the shell travels inward by 44–60px overall and grows to `scale: 1.035`; the
visual change is carried primarily by panel compression and expansion rather
than a full-surface crossfade.

The Applications panel now compresses and becomes non-readable while the Recent
opportunities strip settles into its supporting column. A short, restrained
Northstar handoff line connects the selected Northstar row to the expanding
Technical screen. The interview surface enters from the released right region
with bounded translation and horizontal expansion, reaching full prominence
only near the settled Interviews endpoint. Atlas and Harborline remain visible
as context but no longer compete with the active interview.

Live slow-scroll QA exposed and corrected three midpoint defects: a faint
compressed Applications ghost, double-exposed narrative copy, and a brief blank
narrative caused by the timeline's normalized `0.94` endpoint. Applications is
now hidden before it can ghost behind Recent context; exactly one chapter copy
is readable; and the decorative copy switches atomically at the existing 24%
semantic boundary while product transforms continue smoothly. Reverse and rapid
direction changes restore authoritative endpoint visibility without stale
surfaces.

Preparation, Action Center, the hero, chapter boundaries, 2.5-viewport travel,
one-timeline/one-ScrollTrigger ownership, release behavior, lazy-route isolation,
and mobile/tablet/short-viewport/reduced-motion fallbacks remain unchanged. The
visual baselines now include the broad Applications endpoint, a true partial
handoff, and the settled Interviews endpoint. Browser assertions verify outer
prominence change, hidden outgoing UI, retained context, one readable narrative,
reverse restoration, overflow, and fallback behavior.

Against the pre-E1 spatial-pass baseline, the production main entry remains
282.95 kB raw / 84.80 kB gzip. The lazy landing chunk is 176.25 / 59.89
(+0.97 / +0.24), and CSS is 118.32 / 18.68 (+0.21 / +0.05). The connector uses
existing color/opacity utilities; no dependency or separate GSAP chunk was
added. ESLint, TypeScript, all 193 Vitest tests, hosting-header tests, focused
desktop proof coverage, and the complete browser/accessibility matrix pass.

## 2026-08-30 — Connected Workspace spatial choreography refinement

Refined only the desktop Connected Workspace body story so its persistent
HireFlux shell now reallocates attention across Applications, Interviews,
Preparation, and Action Center. The chapter model, candidate data, one scoped
GSAP timeline, one timeline-owned ScrollTrigger, responsive and reduced-motion
fallbacks, lazy landing boundary, and hero choreography remain unchanged.

Applications is now a compact broad-search surface with a restrained Northstar
selection treatment rather than a tall mostly empty card. The shell begins
slightly right-weighted, shifts inward for Interviews, reaches its largest and
most central state for Preparation, then relaxes outward for Action Center.
The bounded desktop transform range is 40px horizontally with a 3.5% peak
scale increase. Supporting opportunity context narrows for Interviews,
preparation gains the largest work surface, and Action Center restores the
three-priority view with its CTA as the resolution of that movement.

The narrative column now uses a flow stack: layered visual copy, the four-step
indicator 28px below it, and the final CTA below the indicator. Chapter-specific
width/offset changes bring the text closer to the product as focus narrows.
Panel handoffs now fully demote outgoing surfaces before incoming surfaces use
the same region, with explicit visual stacking to prevent readable double
exposure at partial scroll stops.

Desktop pin travel is now 2.5 viewport heights. A viewport-derived release
buffer after the pinned stage gives the final Action Center and CTA enough
document headroom to settle and unpin before the footer enters; it adds no
content and is not rendered in the mobile, tablet, short-viewport, or
reduced-motion fallback.

The clean pre-change production baseline was main 282.95 kB raw / 84.80 kB
gzip, lazy landing 173.99 / 59.34, and CSS 117.27 / 18.47. After this pass the
main entry remains 282.95 / 84.80, the lazy landing chunk is 175.28 / 59.65,
and CSS is 118.11 / 18.63. No dependency or separate GSAP-related chunk was
added. The full 193-test Vitest suite and the full Playwright/accessibility
matrix (117 passed, 38 intentionally project-filtered skips), plus ESLint,
TypeScript, the production build, and hosting-header tests pass. Refreshed
baselines cover Applications, Interviews, Preparation, Action Center, and
light-mode Action Center.

## 2026-08-29 — Connected Workspace body-story redesign

Replaced the rejected body-level Northstar progression with a broader product
story: Applications → Interviews → Preparation → Action Center. The hero remains
the detailed one-opportunity narrative. In the body, Northstar is one compact
row beside Atlas Systems and Harborline, and the persistent HireFlux shell now
reallocates its navigation, primary workspace, and supporting context as the
visitor moves through the candidate's wider search.

The redesign preserves the lazy landing boundary, exact GSAP dependency,
`gsap.matchMedia()` lifecycle, one scoped timeline, one timeline-owned
ScrollTrigger, React boundary-only semantic state, and the existing desktop,
short-viewport, tablet, mobile, and reduced-motion split. The full body Flux
Rail, hero-sized application shell, static single-opportunity endpoints, and
3.4-viewport scroll assumption were retired. Desktop starts at 2.75 viewport
heights with chapter ranges at 0%, 24%, 46%, and 76%. The strongest handoff
compresses interview details into a contextual header while the preparation
workspace opens beneath it. Preparation then becomes retained history as three
differentiated Action Center priorities bring the whole search back into view.

The former late standalone CTA was removed. `Start Demo Workspace` now appears
inside the final story composition as Action Center settles and remains in the
normal document flow after pin release; the same action follows the final
normal-flow chapter on non-pinned layouts. The hero's incoming referral cue was
moved into a reserved strip above application identity, preventing transient
Capture copy from sharing the company-information region without changing the
rest of the hero choreography.

Implementation review deliberately reused authenticated product language—row
hierarchy, restrained statuses, contextual interview detail, readiness, and
Action Center provenance—without importing authenticated components or backend
policy into the marketing feature. Focused tests cover the four workspace
endpoints, three-opportunity model, differentiated priorities, CTA wiring,
semantic forward/reverse boundaries, reduced-motion fallback, and owned GSAP
cleanup. Live QA corrected two transition issues discovered between endpoints:
chapter copy briefly disappeared before Interviews became dominant, and an
early clipping transition could crop interview or preparation content. The
final choreography overlaps copy handoffs and uses bounded transform/opacity
reallocation so every intermediate stop remains legible.

The final production build keeps the main entry effectively unchanged at
282.95 kB raw / 84.80 kB gzip (baseline 282.87 / 84.76). The lazy landing chunk
is 173.99 / 59.34 kB (baseline 167.64 / 58.24), while deleting the retired body
rail/static endpoint CSS reduces the global stylesheet from 124.65 / 18.92 kB
to 117.27 / 18.47. ESLint, TypeScript, all 193 Vitest tests, the production
build, hosting-header tests, and `git diff --check` pass. The complete 155-case
Playwright/accessibility matrix produced 116 passes and 38 intentional viewport
skips; one unrelated desktop-1024 long-content fixture timed out once and passed
immediately in isolated rerun. Browser review covered dark/light 1280, 1024,
768, 390, and 320 layouts, pinned progression, reverse/fast traversal, release,
CTA timing, breakpoint recreation, reduced motion, overflow, and Axe contrast.

## 2026-08-29 — Final landing-page polish

Completed the final refinement pass after the Phase D experience audit without
adding or retiming motion. The hero, six-scene GSAP choreography, single pinned
body timeline, 3.4-viewport scroll distance, Flux Rail geometry, CTA, and all
reduced-motion and responsive fallbacks remain architecturally unchanged.

The body story now explains why continuity matters instead of repeating the
hero's overview. Its framing changed from generic product proof to a connected
workflow, and the four chapters now focus on decision-ready source context,
attached application history, informed interview preparation, and a next action
grounded in saved preparation. Northstar Labs remains the single continuous
example. The body composition's closing caption now reinforces retained context
rather than repeating the hero's “connected from capture to action” language.

Light-mode hierarchy was refined only inside the body story. The desktop and
static artboards now have clearer tonal separation from the page, persistent
product panels have more deliberate border contrast, Context, Interview,
Preparation, and Action surfaces receive restrained semantic tints, and the
inactive rail base and neutral stage nodes remain visible without increasing
stroke weight or accent saturation. Dark-mode styling is unchanged. Mobile copy
was shortened while preserving all four candidate questions, Northstar identity,
chapter endpoints, and static product visuals; the 320-pixel layout remains free
of horizontal overflow and retains 44-pixel hero controls.

Live browser review covered dark and light desktop at 1280 pixels, the complete
pinned progression and release, 768-pixel tablet, 390-pixel mobile, and
320-pixel narrow mobile. Intentional landing and body-story snapshots were
refreshed. ESLint, TypeScript, all 192 Vitest tests across 27 files, the
production build, all three hosting-header tests, and the complete 155-case
Playwright/accessibility matrix passed (117 passed and 38 intentional viewport
skips). The browser matrix reconfirmed reduced-motion completeness, Axe results,
responsive containment, theme persistence, and authenticated-route isolation.

Compared with the Phase D baseline, the main entry remains 282.87 kB raw /
84.76 kB gzip. The lazy landing chunk changes from 167.34 kB / 58.21 kB gzip to
167.64 kB / 58.24 kB gzip. CSS changes from 120.18 kB / 18.59 kB gzip to
124.65 kB / 18.92 kB gzip. The increase is confined to copy and scoped
light-mode story styling; no dependency or runtime animation architecture was
added, and direct authenticated entry still downloads no landing, GSAP, or
ScrollTrigger assets.

## 2026-08-29 — Phase D ScrollTrigger product story

Replaced the landing page's three-card proof selector with one continuous body
story for Capture → Progress → Prepare → Act. The Northstar Labs application,
Flux Rail, interview, preparation workspace, history proof, and Action Center
remain part of one persistent composition. Context is the first part of the
Progress range and Resolve completes the Prepare range before Act becomes
dominant. The independently controlled Phase C hero was not redesigned or
retimed.

The body story owns one `gsap.matchMedia()` lifecycle, one scoped GSAP context,
one master timeline, and one timeline-owned ScrollTrigger. It activates only at
1024 pixels and wider, 720 pixels and taller, and no motion reduction. The
stage pins at the viewport top for 3.4 viewport heights with a 0.35-second scrub,
uses labeled Capture, Context, Progress, Prepare, Resolve, Act, and settled
positions, and updates React chapter state only when the four semantic ranges
change. Native scrolling, pin spacing, and normal document release remain in
control; no snapping, observers, scroll listeners, smooth-scroll library, Flip,
MotionPath, or additional animation dependency was added.

Tablet, mobile, short-height, and reduced-motion presentations use a complete
normal-flow four-chapter layout with static endpoint visuals and no ScrollTrigger
or pin wrapper. Copy remains available in semantic order without live-region
scroll narration. The CTA and footer remain outside the pin, while the settled
Act composition stays visible as the pin releases.

Live browser QA found and corrected four implementation issues: the existing
section-reveal transform initially offset the fixed pin, the rail crossed the
Context shelf at 1024 pixels, the incoming Capture cue remained faintly visible
behind the organized record, and partial application opacity lowered transient
light-mode contrast. The proof wrapper now avoids the transformed reveal,
scroll-specific rail geometry has more separation, Capture resolves earlier,
and persistent application text stays fully opaque. Dark/light desktop, 1024,
768, 390, and 320-pixel states were reviewed, including reverse traversal,
release, and breakpoint changes.

Final validation passed ESLint, TypeScript, all 192 Vitest tests across 27
files, the production build, all three hosting-header tests, and the complete
155-case Playwright matrix (117 passed and 38 intentional viewport skips).
Browser coverage includes Axe, reduced motion, light/dark rendering, pin start
and release, fast/slow/reverse progression, 1280 → 768 → 1280 cleanup, overflow,
CTA/footer access, focused visual baselines, and authenticated-route network
proof. `git diff --check` passed with only Windows line-ending notices.

Compared with Phase C, the main entry remains unchanged at 282.87 kB raw /
84.76 kB gzip. The lazy landing chunk grows from 112.93 kB / 38.04 kB gzip to
167.34 kB / 58.21 kB gzip, and CSS grows from 114.44 kB / 18.03 kB gzip to
120.18 kB / 18.59 kB gzip. ScrollTrigger is folded into the lazy landing chunk;
there is no separate animation chunk, and direct authenticated entry still
requests neither the landing code nor GSAP/ScrollTrigger.

## 2026-08-29 — Phase C complete Flux Rail hero journey

Extended the landing-only Flux Rail proof into the complete finite hero story:
Capture → Context → Progress → Prepare → Resolve → Act. React remains the
semantic authority, the four accessible user controls remain Capture, Progress,
Prepare, and Act, and the existing scoped GSAP timeline now owns all six
internal choreography endpoints. The story autoplays once to Act and stops;
manual selection, pause, play, replay, reverse retargeting, Strict Mode cleanup,
and reduced-motion static endpoints remain deterministic.

Capture now begins as compact incoming referral data, forms the persistent
Northstar Labs application shell, attaches metadata and Applied status, and
activates the rail origin. The previous detached confirmation card was removed;
organization resolves inside the application record. Context expands from that
same record with location, compensation, follow-up timing, and decision context.
Progress and the protected Progress → Prepare handoff retain the Phase B
application-to-interview-to-preparation continuity.

Resolve completes readiness without celebration, changes two-of-three to
three-of-three, and preserves a preparation-history proof. Resolve → Act draws
the final rejoin segment, compacts the completed interview/preparation evidence,
and settles a credible Action Center instruction: send a thoughtful follow-up.
The rail gained restrained diamond junctions, a branch/rejoin endpoint, and
Capture-stage journey labels. Light surfaces received clearer separation and
controlled depth, while 320-pixel layouts drop redundant status chrome before
truncating the role or action meaning.

Live browser QA at desktop, 390, and 320 pixels caught and corrected a Context
shelf collision, an overlapping Act history layer, and narrow role compression.
Stable Capture, Progress, Prepare, and Act baselines now cover dark desktop 1280
and light mobile 390. Existing landing baselines changed only for the completed
hero composition. ScrollTrigger, pinned scrolling, body-story choreography,
path morphing, and additional animation systems remain out of scope.

Final validation passed ESLint, TypeScript, 188 Vitest tests across 26 files,
the production build, three hosting-header tests, and all 135 Playwright cases
(112 passed and 23 intentional viewport skips). Browser coverage includes Axe,
reduced motion, light/dark rendering, 320/390/768/1024/1280 layouts, overflow,
route cleanup, keyboard controls, and proof that authenticated entry does not
request the lazy landing/GSAP dependency graph. `git diff --check` passed with
only Windows line-ending notices.

Compared with Phase B, main JS remains effectively isolated at 282.87 kB raw /
84.76 kB gzip. The lazy landing chunk grew from 105.75 kB / 36.77 kB gzip to
112.93 kB / 38.04 kB gzip, and CSS grew from 105.38 kB / 17.31 kB gzip to
114.44 kB / 18.03 kB gzip. No new dependency or separate animation chunk was
introduced.

## 2026-08-29 — Phase B Flux Rail visual proof

Implemented the approved Phase B landing-page proof as commit `e36350d`
(`Implemented flux Rail, React and GSAP confined to lazy landing`). This was a
landing-only presentation change: the authenticated workspace, backend/API
contracts, demo identity behavior, persistence, and body proof section were
left unchanged.

### Process and implementation

Started from the Phase A landing architecture and kept React as the semantic
state authority. The landing story now has a centralized seven-stage narrative
model, a four-control visible milestone sequence, and a deterministic controller
whose normal autoplay runs Capture → Progress → Prepare once and settles. Act
remains manually selectable as the static Phase A presentation; reduced-motion
users start at Act, can explore the static stages, and never receive autoplay.

Added the exact `gsap@3.15.0` dependency only to the lazy landing dependency
graph. `FluxStoryVisual` owns one paused, labeled GSAP timeline inside a scoped
context, while `FluxRail` supplies stable responsive SVG geometry and testable
animation targets. The persistent Northstar Labs opportunity, application
identity, interview node, branch, marker, and preparation tray now make the
causal sequence legible: Capture → application progress → interview →
preparation. Retargeting kills only the prior targeting tween, and unmount or
reduced-motion cleanup kills the timeline and reverts scoped inline styles.

The implementation deliberately uses bounded transforms, opacity, SVG dash
offsets, clipping, and progress width. It does not add ScrollTrigger, pinned
scrolling, path morphing, MotionPath, observers, a second animation authority,
or continuous chart/page motion. Act remains the explicit stopping point for
the static fallback until a later phase is approved.

Live in-app-browser QA was used to inspect Capture, Progress, Prepare, reduced
motion, and narrow layouts. The first mobile pass exposed clipping in the
Prepare tray; the bounded artboard height and continuity-panel offsets were
adjusted, then rechecked at the supported 320, 390, 768, 1024, and 1280 pixel
widths. Six focused Flux Rail baselines were added for dark desktop 1280 and
light mobile 390; existing landing baselines were refreshed only for the
intentional hero change.

### Validation and bundle evidence

The focused landing unit suite passed 21 tests, including story-model ordering,
controller boundaries, persistent semantic nodes, tween retargeting, reduced
motion, Strict Mode cleanup, and static Act fallback. The full frontend suite
passed 187 tests. ESLint, TypeScript checking, the production build, the full
Playwright/accessibility matrix (135 cases: 112 passed and 23 intentional
skips), hosting-header tests, and `git diff --check` also passed. Browser checks
covered keyboard/ARIA controls, overflow, themes, reduced motion, route-away
cleanup, and authenticated chunk isolation.

The recorded Phase A baseline was main JS 282.83 kB raw / 84.74 kB gzip,
landing JS 23.12 kB / 6.84 kB gzip, and CSS 99.75 kB / 16.56 kB gzip. Phase B
measured main JS at 282.83 kB / 84.74 kB gzip, the lazy `LandingPage` chunk at
105.75 kB / 36.77 kB gzip, and CSS at 105.38 kB / 17.31 kB gzip.

Phase A had no dedicated landing chunk before the split; Phase B emits the
lazy `LandingPage` chunk and no separate GSAP chunk because GSAP is folded into
that lazy feature chunk. Production-browser network assertions confirmed the
authenticated dashboard does not request either landing or GSAP assets, while
the public root requests the landing chunk.

### Review outcome

The rail is materially stronger than the prior keyed card swap because the
application remains spatially present while the marker, branch, interview, and
preparation tray establish a readable chain of causality. The Progress →
Prepare handoff is strong enough to continue the concept, subject to product
review before adding the later Context, Resolve, Act choreography, or any
scroll-driven/pinned behavior. The deliberate open limitation is that Act is
still static and the proof section remains manually driven.

## 2026-08-29 — Applied-to-Draft correction

Added one controlled backward correction to the server-owned application
workflow: an `APPLIED` opportunity can now return to `DRAFT` when it was marked
applied by mistake. The correction clears the current `applied_date`, preserves
the immutable submission and milestone history, resets the current stage clock,
increments the version, and records correction-aware activity metadata.

Pipeline drag-and-drop, keyboard/touch `Move…`, and application-detail status
controls all consume the same backend-provided transition. The confirmation UI
explains the correction and does not request a replacement applied date. Other
backward moves remain forbidden, and re-applying still requires a new valid
applied date.

## 2026-08-27 — Applications opportunity workspace

Replaced the unfiltered Active Applications card collection with three exclusive,
server-classified groups: Needs your attention, Moving forward, and Waiting. Search,
filters, All, Archived, and explicit sorting now use one compact flat-row retrieval
presentation. Removed the collection-level Search button, attention shortcut,
Card/List preference, universal Manage action, generic Updated prominence, local New
application CTA, desktop table duplication, and the retired `ApplicationCard`.

Added pure deterministic opportunity classification, signed group pagination, and a
bounded `WORKSPACE_CONTEXT` next-interview projection. Workspace reads use four GSI2
status queries plus one GSI1 context query with no Scan, activity query, or interview
N+1. Interview transactions maintain the projection with independent optimistic
concurrency, and explicit local reconciliation rebuilds it for existing demo data.
Centralized frontend reason/action copy and kept all mutations in the authoritative
Application or Interviews workspace. Legacy layout URLs now normalize safely while
preserving other parameters and post-create return context.

Final validation passed Ruff lint and formatting, Mypy across 58 backend source
files, all 259 backend tests, ESLint, TypeScript type checking, all 145 frontend
tests, the production build, and `git diff --check`. The complete Playwright matrix
finished with 84 passes and 12 intentional viewport-specific skips, including Axe,
keyboard, direct-route, search, pagination, overflow, and visual-regression checks.
Live browser QA covered 320, 390, 768, 1024, and 1280 pixels. Pure 500-record
classification measured 1.21 ms p95 and the bounded response stayed near 13 KiB;
the Moto-backed 500-record endpoint measured 950 ms p95, so AWS staging must repeat
the latency measurement against real DynamoDB before maximum-bound performance is
qualified.

This log records the engineering work, decisions, problems, and validation completed for HireFlux. It is written so the project can be discussed clearly in portfolio reviews and technical interviews.

## 2026-08-27 - Interviews stabilization and hardening

Hardened interview scheduling around the saved workspace time zone. Create and edit flows now interpret browser `datetime-local` values as wall time in the validated IANA zone, submit UTC instants, reject daylight-saving gaps, and resolve repeated fall-back times deterministically. The application chooser now uses the existing server-side active-application search and pagination path, so records beyond an arbitrary first page remain schedulable without adding a scan or index.

Made URL-backed interview selection authoritative across pagination and refetch races. Deep links continue loading until the requested interview is found or the result set is exhausted, invalid IDs receive a deliberate not-found state, and newly scheduled selections survive query invalidation. Terminal applications reject candidate scheduling and no longer create preparation or follow-up pressure; the deterministic demo retains one trusted historical canceled fixture without exposing a route-level bypass.

Separated Essentials, Additional preparation, and Personal preparation in active and historical views, and limited custom-task deletion rebasing to persisted checklist state so unrelated unsaved notes and questions remain dirty. Centralized candidate-facing lifecycle copy, standardized Reflection terminology, corrected count pluralization, removed a redundant selected status badge, and strengthened the focused workspace's discard alert dialog, focus containment, Escape behavior, and return focus.

Final validation passed Ruff lint and formatting, Mypy across 57 backend source files, all 236 backend tests, ESLint, TypeScript type checking, all 145 frontend tests, the production build, and `git diff --check`. The complete 96-case Playwright matrix finished with 84 passes and 12 intentional viewport-specific skips across 1280, 768, 390, and 320 pixels, including axe WCAG A/AA scans, keyboard flows, deep-link refresh, overflow checks, and visual regression. Only the intentional dark and light Interviews baselines changed.

## 2026-08-27 - Coherent interview journey and application-owned next steps

Replaced card-count readiness with server-owned preparation outcomes: opportunity understanding, relevant evidence, conversation planning, and conditional interview requirements. Essential completion now drives the interview lifecycle independently from optional role depth and candidate-created tasks, so doing more preparation cannot make a candidate appear less prepared. Legacy completion IDs normalize conservatively, the retired logistics checkbox no longer counts, and missing access details become an exception that opens the canonical editor. Candidate-facing UI reports essentials remaining without a score or prediction.

Separated who owns the next move from when an opportunity should return to attention. Applications now store optional candidate/employer/none responsibility and bounded context through one optimistic, active-only next-step command, while `follow_up_date` remains a date-only check-back. Dashboard actions, application cards/list, Pipeline, Search Health, Interviews, filtering, exports, and Analytics now distinguish candidate work, employer waiting, scheduled check-backs, explicit no-action, and unresolved legacy records. Analytics preserves date-based follow-up coverage and adds a separate next-step summary. Completion behavior is responsibility-aware, activity is atomic, GSI3 remains date-owned and active-only, and no scan, migration, or new index was introduced.

Reframed post-interview debriefs as minimum-useful private Reflection. One substantive takeaway can complete a reflection; optional deeper prompts and explicit carry-forward remain interview-scoped. Operational next steps are handed off explicitly to the Application after reflection saves, with conflict refresh/retry that never rolls back the stored reflection or discards entered intent. Completed reflections open read-only, deliberate edits preserve the original timestamp, and later rounds show only the latest explicit carry-forward and primary takeaway without AI or synthetic relabeling.

Introduced one responsive Focused Workspace primitive for sustained preparation, reflection, historical review, and scheduling. It provides dialog semantics, focus containment/restoration, dirty-close confirmation, one scroll region, a stable footer, mobile safe areas, and reduced-motion-safe transitions. Interviews and Application detail now reuse one scheduling form and the existing nested endpoint, while the state-first queue and selected journey retain one dominant server-recommended action.

Final validation passed Ruff lint/format, Mypy across 57 backend source files, 235 backend tests, ESLint, TypeScript type checking, 134 frontend tests, the production build, and `git diff --check`. Live QA covered 1280, 768, 390, and 320 pixels, caught and corrected focused-workspace return focus, and confirmed URL-backed refresh, role-neutral guidance, responsive navigation, full-screen mobile workspaces, and no horizontal overflow. The complete 96-case Playwright matrix finished with 84 passes and 12 intentional viewport skips, including axe WCAG A/AA scans; only the intentional dark and light Interviews baselines changed.

## 2026-08-26 - Add Application quick capture and verification hardening

Replaced the database-style creation form with a dedicated single-screen quick-capture flow centered on Company, Role, Current stage, relevant optional context, and one Add application action. Saved, Applied, and Interviewing map to the existing `DRAFT`, `APPLIED`, and `INTERVIEW` lifecycle states. Applied dates adapt to the selected stage using the saved workspace time zone, remain available while switching stages in-session, and are omitted for Saved. Follow-up and role-family enrichment remain in the canonical application workspace rather than creation.

Added advisory duplicate candidates through an owner-scoped, quota-bounded GSI2 query with deterministic Unicode, company, title, location, URL, tracking-parameter, and requisition normalization. Exact posting or same-company requisition evidence is high confidence; recent exact company/title evidence is deliberately conservative. Advice is debounced, cancel-safe through query keys, limited to three minimal candidates, and never blocks creation or exposes another workspace. No scan, index, scraping integration, or persisted requisition field was added.

Creation now truthfully initializes an opportunity first learned about at Interview stage in one operation, including submitted, response, and interview milestones and one creation activity without synthetic transition history. Origin-aware route state returns Dashboard and Applications callers to their prior query context, while direct Add resets for another capture and retains a View application confirmation. The verification pass corrected hidden-error focus, stale duplicate presentation, cache invalidation, safe return-path validation, settings-load failure handling, and post-create confirmation/highlighting behavior, then added focused lifecycle, isolation, duplicate-contract, stage/date, failure, focus, and route-state coverage.

The final cross-stack quality gate passed Ruff lint and formatting, Mypy across 57 source files, 229 backend tests, ESLint, TypeScript type checking, 132 frontend tests, the production build, and 80 Playwright browser checks with 12 intentional viewport-specific skips. Browser coverage includes light and dark creation screenshots, axe scans, overflow checks, duplicate-service failure, responsive widths from 320 to 1280 pixels, and the quick-capture disclosure flow. `git diff --check` also passed; its only output was Git's existing LF-to-CRLF normalization warning on Windows.

## 2026-08-26 - Journey-first Interviews and reusable reflections

Reorganized Interviews around the candidate lifecycle—Prepare, Interview, Reflect, Follow up, and Next round. The left queue is now state-first: imminent conversations, uncaptured reflections, follow-up work, missed interviews, and unfinished preparation appear under Needs attention; ready conversations appear under Upcoming; completed and canceled records remain in a quiet disclosure. Each record appears once, the URL-backed selection remains intact, and the selected workspace now presents one server-recommended action beside a semantic lifecycle indicator.

Completed debriefs now produce the server-owned `REVIEW_DEBRIEF` action when no immediate application follow-up is required. Missing, due-today, and overdue follow-up work is generated only for active application statuses, so rejected, withdrawn, accepted, and archived opportunities do not acquire false warnings. Interview follow-up links focus the existing application `follow_up_date` field rather than introducing a duplicate mutation path.

Saved debriefs now surface a bounded reflection preview, open in a read-only Review mode, and enter editing only through an explicit action. Revisions preserve the original completion timestamp through the existing optimistic-concurrency endpoint. A scheduled later round can surface at most two forward-looking signals from the latest useful completed round in the same application; it never copies or summarizes reflection data into the current record. Completed preparation remains available as read-only history. The deterministic demo now includes a reflected recruiter screen followed by an upcoming technical round while preserving a separate Capture example.

## 2026-08-25 - Role-neutral layered Interview Preparation

Replaced the interview-type-only preparation catalog that made every technical screen read like a software-engineering interview. The backend now combines a universal foundation, role-neutral interview-type guidance, and a conservative application role family. Explicit candidate choices win; unambiguous titles may supply a clearly labeled suggestion; uncertain titles fall back to universal guidance. Technical architecture, debugging, and tradeoff content now enters only through the Software / IT profile.

The drawer presents transparent readiness, the next visible step, role-focus control, phase-grouped tasks, contextual prompts and tips, optional evidence-story structure, and balanced questions for evaluating the employer. Candidates can add two server-ID interview tasks and reorder up to eight saved questions. More tips and suggestions remain behind accessible disclosures, completed interviews remain debrief-first, and private preparation text is not copied into Analytics or activity summaries.

Application role context projects to interview records through the existing transactional synchronization path. Legacy items safely default to automatic/universal behavior; custom tasks remain embedded in the interview, versioned, owner-isolated, and TTL-covered. No table migration, scan, index, AI dependency, or external integration was introduced. The deterministic demo now includes technical, service, hospitality, sales, marketing, operations, manufacturing, education, and executive examples while preserving its application count and analytical distributions.

## 2026-08-25 - Interview journey workspace redesign

Rebuilt Interviews around the candidate's interview lifecycle instead of cards and summary counters. The page now uses a URL-backed chronological schedule and one selected workspace: desktop receives a schedule/detail composition, while tablet and phone keep the selected interview first and preserve a deliberate focus/scroll transition when another round is chosen. Each interview appears once in chronology, completed and canceled records move into Past interviews, and the selected workspace connects preparation, access details, application context, and all loaded rounds into a single journey.

Extended the existing server-owned workflow context with `IMMINENT` for interviews starting within four hours and `CAPTURE` for completed interviews whose debrief has not been completed. Their recommended actions are `JOIN_MEETING`/preparation as supported by the record and `CAPTURE_NOTES`; no reminder delivery, calendar sync, score, probability, employer feedback, or new persistence field was invented. Completed interview drawers now put the private debrief first while retaining the original preparation record. The `ALL` owner-index query returns newest interviews first so long histories cannot push the current journey off the initial page; upcoming-only ordering remains earliest first and no scan or index was added.

Focused integration and component coverage now exercises imminent, missed, capture, follow-up, terminal history, timezone rendering, deep-link selection, keyboard selection, pagination, safe cancellation, preparation drawers, and multiple-round timelines. Deterministic browser fixtures include the enriched global context for responsive visual and interaction QA, while the component fixture covers the two-round application journey directly.

## 2026-08-24 - Interviews workflow workspace

Interviews is now a dedicated candidate workflow surface rather than an upcoming-events-only list. The global interview API retains its backward-compatible `UPCOMING` view and adds an `ALL` view through the existing owner interview GSI, with view-bound cursors and server-owned application/workflow context. Context classifies preparation, upcoming, missed, follow-up, history, and canceled interviews using the saved workspace time zone and recommends the next action without moving policy into React.

The page now foregrounds the next interview, separates preparation and follow-up work into a Needs attention section, groups future conversations by Today/Tomorrow/This week/Later, and keeps completed or canceled rounds in a compact application-grouped history disclosure. Existing schedule, edit, completion, cancellation, preparation, debrief, optimistic-concurrency, meeting-link, and application-focus flows remain canonical; the global page reuses those service endpoints and links to the application Interviews tab for full round history. Calendar export and external calendar/notification integrations remain deferred.

## 2026-08-24 - P2/P3 release-hardening pass

Verified and remediated the six P2 and three P3 findings from the latest full-stack security audit. CSV exports now neutralize spreadsheet formula prefixes in user-controlled text while retaining standards-compliant CSV quoting. Hosted CSP generation accepts one exact HTTPS API origin, rejects wildcards, and keeps the committed policy fail closed. Application label edits transactionally synchronize every denormalized interview projection with optimistic interview-version checks, and the frontend invalidates nested and global interview caches.

Demo start/reset keys now belong to a logical operation: ambiguous network loss and an in-progress reservation retain the key, while success, explicit abandonment, and server-confirmed terminal failure dispose of it. Successful resets clear the prior workspace's manual-time-zone marker and let browser detection configure the replacement; failed resets restore both the prior session and its timezone semantics. The reviewed Applications redesign and Pipeline light-mode rendering now have deliberate Windows baselines, and the complete 76-case Playwright matrix is green with 64 passes and 12 intentional viewport skips.

FastAPI documentation exposure is now environment-controlled, with local/test enabled by default and staging/production disabled unless explicitly opted in; CI still emits an OpenAPI artifact. The new quality workflow uses Python 3.13, `uv.lock`, hash-verified `pip-audit`, Ruff, Mypy, pytest, npm audit, and CycloneDX SBOM artifacts. Local validation also completed on supported Python 3.14.7. Landing copy no longer hardcodes demo seed cardinality. Public demo abuse and AWS cost controls remain the separately tracked P1 and were intentionally not changed here.

## 2026-08-23 - Demo analytics dataset expanded to 30 applications

The deterministic demo workspace now seeds 30 fictional applications instead of 16. Four initial active records and ten additional active examples add richer Applied, Screening, Interview, and Offer coverage, while repeated sources provide enough sample depth for source-performance and Search Health comparisons. Existing notes, interviews, status coverage, follow-up scenarios, and workspace isolation remain intact.

## 2026-08-23 - Analytics timezone and filter hardening

Stage-aging analytics and its application-list drill-down now use the saved workspace IANA time zone for calendar boundaries. New browser workspaces automatically detect and persist the browser's time zone, while a manual Settings choice prevents later automatic replacement. Invalid `stage_age` combinations in shared application URLs are normalized in the frontend instead of reaching an API error state. The reconciliation fixture now includes the current interview workspace fields, keeping the full backend suite aligned with the domain model.

## 2026-08-10 - Milestone 1 local vertical slice

### Objective

Build the first complete local workflow:

```text
React + TypeScript -> FastAPI -> DynamoDB Local
```

The milestone had to work without an AWS account, real AWS credentials, infrastructure deployment, or billable services.

### Starting point

The repository contained a short vision README and eight UML/DFD PDFs. It did not yet contain application code. The diagrams were reviewed as design input and preserved unchanged.

Important conflicts were resolved in favor of the current architecture requirements:

- The initial target assumed Cognito would own passwords and sessions; the later public-demo decision replaced that requirement with temporary signed workspaces while preserving the rule that HireFlux never stores password hashes.
- UUIDs and Cognito `sub` replace integer user/application identifiers.
- The logical DFD data stores become item types in one DynamoDB table.
- `company_name` remains on the application instead of introducing a relational Company table.
- Reversible `ARCHIVED` behavior replaces permanent deletion.

### Architecture and documentation

Added living documentation for:

- local and target AWS architecture;
- authoritative domain fields and enums;
- access-pattern-first DynamoDB keys and indexes;
- application status-transition policy;
- milestone roadmap and acceptance criteria;
- architecture decisions for DynamoDB, local auth/Cognito, archiving, and optimistic concurrency;
- exact Windows setup, run, test, and shutdown commands.

The backend dependency direction is:

```text
routes -> application services -> repository protocols -> DynamoDB adapter
```

### Backend implementation

Implemented a FastAPI service with:

- `GET /health` and `GET /api/v1/me`;
- application create, list, get, edit, archive, restore, and status-transition operations;
- cursor-based list pagination and status filtering;
- an activity endpoint for creation and status history;
- local identity injection with fail-closed configuration checks;
- request IDs, explicit CORS, OpenAPI, and a stable error envelope;
- owner-qualified DynamoDB keys so another user's UUID cannot address a resource;
- HMAC-signed cursors bound to the current owner and filter;
- optimistic integer versions for stale-write protection;
- DynamoDB transactions for application/activity atomicity;
- Moto-backed tests that do not require Docker.

The status policy is centralized. Notable rules include:

- `REJECTED -> INTERVIEW` is forbidden;
- `INTERVIEW -> OFFER` is allowed;
- archive stores the prior status;
- restore is allowed only to that exact prior status;
- repeated same-status requests are idempotent no-ops;
- post-draft active statuses require `applied_date`.

### Frontend implementation

Implemented a responsive React application with:

- application list and status filtering;
- cursor pagination with cross-page ID deduplication;
- create and edit forms using React Hook Form and Zod;
- detail view and activity timeline;
- server-provided allowed status transitions;
- archive and exact-prior-status restore controls;
- loading, empty, validation, conflict, API-error, success, and not-found states;
- semantic HTML, keyboard focus styles, labeled inputs, and error summaries;
- centralized native-fetch API access with Zod response validation;
- Vitest, Testing Library, and MSW coverage for critical flows.

The visual direction uses an off-white workspace, white bordered surfaces, slate typography, one restrained blue accent, and status labels that communicate through text as well as color.

### DynamoDB Local

Added Docker Compose for the official DynamoDB Local image with:

- a host binding limited to `127.0.0.1:8001`;
- a named persistent Docker volume;
- an explicit, idempotent initialization script;
- schema validation for the table and both GSIs;
- startup retries so initialization can follow `docker compose up -d` safely;
- refusal to initialize a non-loopback or non-local target.

Normal FastAPI startup never creates a table.

### Problems found and resolved

- No system Python 3.13 was installed. The package was configured to require Python 3.13, while validation used the available bundled Python 3.12.13 runtime. Exact Python 3.13 validation remains an environment follow-up.
- Docker Desktop was installed but its engine was initially stopped. It was started for local validation.
- A new named Docker volume was not writable by the image's default user on Windows. The loopback-only local container now runs as root so SQLite can initialize that volume.
- Underscores in the original fake access key were rejected by DynamoDB Local 3.3.0. The example now uses alphanumeric, visibly local-only fake values.
- TypeScript 6 conflicted with the installed `typescript-eslint` peer range. TypeScript was pinned to compatible `5.9.3` rather than bypassing dependency checks.
- `react-router-dom` 7.18.0 was covered by a high-severity advisory. It was upgraded to the fixed 7.18.2 release and the dependency tree was audited again.
- Opening the site as `127.0.0.1` did not match the configured CORS origin. Local instructions now consistently use `http://localhost:5173`.

### Validation results

Backend validation:

- Ruff lint passed.
- Ruff formatting check passed.
- Strict mypy passed across 28 source files.
- Pytest passed: 59 tests.
- One upstream FastAPI/Starlette TestClient deprecation warning remained non-blocking.

Frontend validation:

- Clean `npm ci` succeeded from the lockfile.
- ESLint passed with zero warnings.
- TypeScript checking passed.
- Vitest passed: 10 tests across 5 files.
- The Vite production build passed.
- npm audit reported zero vulnerabilities for production and full dependency trees.

Local integration validation:

- Docker Compose started DynamoDB Local successfully.
- The table initializer succeeded repeatedly and confirmed schema compatibility.
- Health, profile, empty-list, CORS preflight, create, edit, transition, archive, restore, filtering, activity, and direct-route refresh behavior worked against the real local services.
- The browser console contained no warnings or errors during the smoke flow.
- Five synthetic smoke-test items were removed from their exact application partition afterward; the local application list was returned to empty.
- The HireFlux container was stopped with its persistent volume preserved.

### Security and scope confirmation

- No AWS resources were created.
- No real AWS credentials were used or committed.
- No application was deployed or published.
- No passwords or password hashes are stored.
- No DynamoDB `Scan` exists in a normal request path.
- No generated build output, virtual environment, `node_modules`, real `.env`, or coverage output is pending in Git.
- No Git commit was created.

## 2026-08-11 - Local developer handoff

Clarified the local run workflow for Windows Command Prompt users. The application intentionally uses Docker only for DynamoDB Local; FastAPI and Vite run directly on Windows for reload speed.

The reproducible commands remain in the repository [README](../README.md). The local site is `http://localhost:5173`, API documentation is `http://localhost:8000/docs`, and DynamoDB Local is visible in Docker Desktop under the HireFlux Compose project.

## 2026-08-11 - Isolated demo workspace

### Objective

Turn the fixed-user local application into a candidate-focused experience that still feels like a one-click public demo while giving every visitor a private, temporary owner identity. Two visitors entering at the same time must never see or modify one another's records.

### Backend session implementation

Added `POST /api/v1/demo-sessions` as the only public workspace-creation endpoint. A successful launch:

1. generates a random workspace UUID;
2. creates the temporary user profile;
3. seeds five fictional applications through the existing application service;
4. creates realistic transition activity for Interview, Offer, and Rejected examples;
5. returns an HMAC-SHA256-signed bearer token and its expiration time.

The token contains a version, token kind, workspace subject, issued time, and expiry. Verification uses constant-time signature comparison and rejects malformed, oversized, tampered, unsupported, or expired tokens. API errors distinguish `DEMO_SESSION_REQUIRED` from `DEMO_SESSION_EXPIRED` without exposing signing or persistence details.

`AUTH_MODE=demo` is separate from fixed `local` auth and future `cognito` auth. Demo signing keys must contain at least 32 bytes, and deployed environments reject the visibly local-only example key. Existing safeguards still reject local auth in staging, production, or a Lambda runtime.

### Seeded workspace and cost bounds

Every new workspace starts with fictional applications across:

- Draft;
- Applied;
- Interview;
- Offer;
- Rejected.

The seed path deliberately uses ordinary application creation and transition services instead of bypassing domain rules. The examples therefore produce the same transactionally written activity history, versions, allowed transitions, and ownership behavior as candidate-created records.

Application creation now transactionally increments a workspace quota item. The configured lifetime limit defaults to 100 applications, and the same DynamoDB transaction rolls the increment back if the application/activity write fails. This bounds database growth within one temporary identity without using `Scan` or trusting a browser-side count.

### Temporary-data lifecycle

Temporary profile, quota, application, and activity items carry the numeric DynamoDB `expires_at` attribute. The explicit table initializer enables TTL on that attribute and remains idempotent.

DynamoDB TTL deletion is asynchronous, so it is not treated as authorization. Access ends when the signed token expires. Reset creates a different owner identity and replaces the browser token immediately; old records become unreachable from that browser before DynamoDB physically removes them.

Archived applications were also removed from the active GSI projection. They remain queryable through the `ARCHIVED` status index, which keeps default active pages full without a filter expression.

### Frontend experience

Replaced the root redirect with a public, responsive candidate-focused landing page. **Explore the Demo** requests a workspace, stores the validated token in tab-scoped session storage, clears identity-specific TanStack Query data, and redirects to `/applications`.

Application list, create, detail, and edit routes now require an active demo session. Opening one directly without a token returns to the landing page with an explanation. The centralized API client attaches `Authorization: Bearer ...` and clears the token/cache when the API reports a missing or expired session.

The application header now provides:

- remaining workspace lifetime;
- a visible warning near expiration;
- a confirmed **Reset demo** flow;
- an **Exit demo** action;
- a success notice after reset.

Create and edit forms now block client-side navigation when fields are dirty and register a browser unload warning. Successful submissions bypass that guard so normal post-save navigation is not interrupted.

The interface retains semantic headings, labels, keyboard-visible focus, explicit loading/error states, reduced-motion support, and responsive layouts. A branded Open Graph image and matching social metadata were added for link previews.

### Security and ownership checks

- Request bodies still cannot set `owner_user_id`, IDs, timestamps, roles, or status through the general edit route.
- Every protected request derives its owner from the verified token.
- A valid token from a second workspace receives the same `404` for another workspace's application as it would for a missing record.
- Token tampering and invalid bearer formats return `401`.
- Reset and expiration clear user-specific query data so one identity's cached records cannot appear in another workspace.
- No passwords, password hashes, real AWS credentials, or session tokens are written to Git or logs.

### Environment and deployment preparation

Updated the default local configuration to use demo auth and documented separate local, staging, and production values. Staging and production must use different APIs, DynamoDB tables, signing keys, CORS origins, logs, alarms, and throttles.

The deployment guide now records the required Amplify single-page application rewrite, direct-route refresh tests, missing-asset `404` check, staging-to-production promotion sequence, and release gates for API throttling, Lambda concurrency, monitoring, log retention, and budget alerts. No AWS resources were provisioned during this work.

### Tests and validation

Added coverage for:

- token round-trip, malformed input, tampering, and expiration;
- deployed demo-key configuration failures;
- unauthenticated protected requests;
- five-record seed contents and activity history;
- separate-workspace ownership isolation;
- TTL metadata and initializer behavior;
- atomic workspace application limits;
- archive removal from the active index and archived-status discovery;
- protected frontend route redirects;
- bearer attachment, reset, expiry cleanup, and unsaved-form warnings.

Completion results:

- Ruff lint and formatting passed across 40 backend files.
- Strict mypy passed across 31 backend source files.
- Pytest passed: 67 tests. One upstream FastAPI/Starlette TestClient deprecation warning remains non-blocking.
- Frontend ESLint and TypeScript checks passed.
- Vitest passed: 15 tests across 6 files.
- The Vite production build passed.
- Live DynamoDB Local smoke testing returned five seeded statuses and a cross-workspace `404`.
- The local root page, direct application-route fallback, and social image returned `200`.

## Post-implementation QA and Python 3.14 support - August 12, 2026

Completed responsive browser QA at 1440 x 900 desktop, 768 x 1024 tablet, and
390 x 844 mobile viewports. The landing page, application list, detail page,
create form, reset dialog, and direct-route refresh behavior rendered without
horizontal overflow or browser console errors.

Keyboard QA identified two modal focus gaps: the unsaved-changes dialog did not
move focus inside when opened, and the reset dialog did not restore focus to its
trigger when closed. Both dialogs now share focus management that:

- moves focus to a safe initial action;
- traps Tab and Shift+Tab within the open dialog;
- supports Escape-to-close;
- restores focus to the invoking control when the dialog closes.

Python support now covers 3.13 and 3.14 through the declared range
`>=3.13,<3.15`, with both versions listed in package metadata. A fresh isolated
Python 3.14.7 environment successfully installed every pinned runtime and
development dependency.

Validation results:

- Ruff lint and format checks passed across 40 backend files on Python 3.14.7.
- Strict mypy passed across 31 backend source files on Python 3.14.7.
- Pytest passed: 67 tests on Python 3.14.7; the existing upstream
  FastAPI/Starlette TestClient deprecation warning remains non-blocking.
- Frontend ESLint and TypeScript checks passed.
- Vitest passed: 19 tests across 7 files, including modal focus containment,
  Escape handling, and focus restoration regressions.
- The Vite production build passed.

## Release-readiness audit and staging decision - August 12, 2026

Completed a broader release-readiness audit after adding Python 3.14 support.
The local application baseline is healthy and ready for the staging
infrastructure milestone; no AWS resources were created during this audit.

### Full validation

- Python 3.14.7 passed Ruff lint and formatting, strict mypy, all 67 backend
  tests, and `pip check`. A separate dependency audit reported no known
  vulnerabilities in the published packages; the local HireFlux package was
  skipped because it is not published on PyPI.
- Frontend ESLint, TypeScript, all 19 Vitest tests across 7 files, and the Vite
  production build passed. `npm audit` reported zero vulnerabilities.
- DynamoDB Local was validated against `amazon/dynamodb-local:3.3.0`. Running
  the initializer twice returned `already_valid`; the table remained active
  with on-demand billing, the expected primary key and two GSIs, and enabled
  TTL on `expires_at`.
- A 23-check live API flow passed, covering demo-session creation,
  authentication, pagination, cursor ownership, application creation and
  editing, stale-version conflicts, status transitions, activity history,
  archive and exact restore behavior, ownership isolation, request validation,
  CORS, and request IDs.
- The FastAPI service also launched successfully under Python 3.14.7 and passed
  health, session, profile, and seeded-application checks before shutting down
  cleanly.
- Browser QA passed at 1440 x 900 desktop, 768 x 1024 tablet, and 390 x 844
  mobile sizes. Create, edit, archive, restore, and `INTERVIEW -> OFFER` flows
  worked through the real UI without overflow or browser console errors.
- Keyboard-only modal focus, Escape handling, focus restoration, theme
  persistence, protected-route redirects, detail-page refresh, and unknown-route
  refresh all passed.
- Staging configuration correctly rejected local authentication, loopback
  DynamoDB endpoints, and wildcard CORS. The repository scan found no normal
  request-path DynamoDB scans, tracked private `.env` files, or likely committed
  secrets.

### Remaining staging prerequisites and outliers

- Commit the current application and QA baseline before beginning
  infrastructure work.
- Recreate the main `backend/.venv`, which still uses Python 3.12, with the
  installed Python 3.14 runtime. The isolated Python 3.14 validation environment
  proves compatibility but does not replace the main development environment.
- Add a reproducible Python transitive dependency lock file.
- Replace raw exception traceback logging in the API error handler with safe,
  structured logging before enabling centralized production logs.
- Add the Lambda/Mangum entry point and infrastructure code; neither exists yet.
- Configure an asset-aware Amplify SPA rewrite so application routes fall back
  to `index.html` while missing static assets remain `404`, and add deployment
  security headers.
- Add staging observability and safeguards: structured CloudWatch logs, finite
  retention, alarms, API throttling, modest Lambda reserved concurrency, a
  readiness check or synthetic canary, and budget alerts.
- The remaining FastAPI/Starlette TestClient deprecation warning is
  non-blocking. Major ESLint 10 and TypeScript 7 upgrades should be handled as
  separate compatibility work rather than folded into deployment.

### Milestone sequencing decision

The local functional baseline now satisfies the prerequisite for AWS work. For
a publicly accessible candidate demo, the next milestone is a cost-bounded staging stack,
implemented as TypeScript CDK: Python 3.14 Lambda and Mangum, HTTP API, DynamoDB,
Secrets Manager, CloudWatch, and an Amplify staging branch with explicit CORS,
SPA routing, security headers, and budget controls. Staging should be deployed
and manually smoke-tested before adding automated OIDC-based CI/CD. Cognito,
private attachments, email, and reminders remain out of scope for this staging
foundation.

## Application card and status workflow UX - August 12, 2026

Improved the application-list workflow by adding a visible `Edit` action to
each application card. The action opens that application's detail page rather
than bypassing the overview and navigating directly into the details form. From
the detail page, a visitor can review the full record, use the existing status
control, or choose `Edit details`.

Expanded the centralized status policy with an explicit `REJECTED -> OFFER`
correction path for applications marked rejected by mistake or later resulting
in an offer. The API remains authoritative for allowed transitions, status
changes continue through the dedicated version-checked endpoint, and each
successful correction is recorded in the activity timeline. The binding
`REJECTED -> INTERVIEW` prohibition remains enforced.

Validation results:

- Frontend ESLint and TypeScript checks passed.
- Vitest passed: 21 tests across 7 files, including card navigation and the
  rejected-to-offer interaction.
- The Vite production build passed.
- Backend Ruff lint and formatting passed across 40 files.
- Strict mypy passed across 31 backend source files.
- Pytest passed: 68 tests, including the complete transition matrix and the
  explicit rejected-to-offer correction. The existing upstream
  FastAPI/Starlette TestClient deprecation warning remains non-blocking.

## Milestone 2 local workspace home and richer workflow - August 12, 2026

### Objective and route flow

Completed the local product milestone before beginning any AWS architecture or
deployment work. The public `/` route remains a candidate-focused landing page,
while a newly created or reset 24-hour demo workspace now enters the protected
`/dashboard` Home. Valid direct links to applications, interviews, analytics,
and settings remain intact instead of being forced through Home.

Home is organized around the four questions established during product
planning:

1. How many jobs am I pursuing?
2. What needs my attention today?
3. How successful has my search been?
4. What should I do next?

The resulting dashboard presents whole-workspace and active-pursuit counts, a
prioritized action center, outcome rates with visible denominators, an
eight-week submission trend, current-status context, upcoming interviews, and
recent application movement. Follow-ups can be completed or rescheduled from
the action itself, with version checks and activity history preserved.

### Application workflow and server-owned list views

Expanded the workflow to all nine current statuses: `DRAFT`, `APPLIED`,
`SCREENING`, `INTERVIEW`, `OFFER`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, and
`ARCHIVED`. The centralized transition policy remains authoritative, including
the required `INTERVIEW -> OFFER` path, the forbidden `REJECTED -> INTERVIEW`
path, exact-prior-status archive restoration, and the explicit
`REJECTED -> OFFER` correction path.

The application page now supports server-owned search, source and work-mode
filters, current-status filtering, ascending or descending update order, and
three explicit views:

- `ACTIVE`: Applied, Screening, Interview, and Offer;
- `ALL`: every status, including Archived;
- `ARCHIVED`: archived records only.

The API queries only authenticated-owner index partitions. Multi-status views
fan out across the required GSI2 status partitions, merge within the bounded
workspace quota, and paginate with a signed logical cursor bound to owner,
view, explicit status, search, filters, and sort. This prevents the former
client-side active filtering problem, where a page could appear empty while a
matching record existed later. The React query cache includes the same filter
scope and still deduplicates IDs across best-effort cursor pages.

### Notes, interviews, and action history

Added owner-scoped application notes with create, edit, and delete operations,
and owner-scoped interviews with schedule, edit, complete, and cancel flows.
Child resource IDs, ownership, versions, and timestamps remain server-owned.
Application ownership is checked before child access, so another workspace sees
the same `404` as it would for a missing parent.

Scheduled interviews project into both the owner interview list and GSI3
schedule. Completing or canceling one removes it from the scheduled projection
transactionally. Follow-up completion, follow-up rescheduling, note mutations,
and interview mutations append ordinary activity items instead of rewriting
history. Upcoming interviews and due follow-ups are therefore actionable views
over canonical owned records rather than browser-invented state.

### Dashboard and analytics semantics

Added server-owned historical milestones for submission, first response,
screening, interview, offer, acceptance, and current-stage entry. Current status
does not erase a previously reached milestone. Response, interview, offer, and
acceptance rates use submitted applications as the denominator, expose both
counts and rates, and return zero rather than dividing by an empty population.

Analytics supports `30d`, `90d`, and `all` ranges plus current status, normalized
source, and work-mode filters. Rates, trends, funnels, source performance, and
work-mode comparisons use the submitted population inside the selected range.
For finite ranges, summary, current-status distribution, and stage aging use
in-range submitted records plus current drafts; all-time includes every current
record. Source comparisons are visibly marked as small samples until at least
three submitted applications are present. The page also reports average time to
first response and submitted applications still awaiting a response, with an
explicit statement that demo analytics are descriptive rather than predictive.

### Saved workspace preferences and calendar behavior

Added versioned, owner-scoped settings for a validated IANA time zone, default
follow-up interval, default application view, default dashboard range, and
theme. Settings carry the demo TTL and survive navigation within the isolated
workspace. Header theme changes and the Settings page persist through the same
authenticated API instead of relying only on browser-local state.

Follow-ups are stored as ISO date-only calendar values. “Overdue” and “today”
are evaluated against the current calendar date in the saved workspace time
zone; rendering does not convert the date through UTC or shift it to an adjacent
day. New-application defaults add the saved follow-up interval to the current
date in that same zone. Interviews remain timezone-aware instants stored in UTC
and are displayed in the selected workspace zone.

### DynamoDB projections and local operations

The table now has three sparse indexes. GSI1 carries non-archived applications
and a separate owner-interview partition, GSI2 partitions applications by
status, and GSI3 carries outstanding follow-ups plus scheduled interviews.
Application/status transactions maintain nine status counters and one
historical funnel counter alongside canonical metadata and activity. Dashboard
counter reads use a strongly consistent owner-partition `Query` over the
`COUNTER#` sort-key prefix; request paths still contain no `Scan`.

Added a guarded, idempotent local reconciliation command. It refuses non-local
targets and requires an exact table-name confirmation before its controlled
maintenance scans. Rewriting applications and interviews through current
serializers repairs their sparse index attributes, restores missing scheduled
interview projections, removes stale schedule keys from completed/canceled
interviews, and rebuilds status and funnel counters. A separate guarded local
reset command supports intentional clean-room testing without making table
creation or destructive maintenance an application-startup behavior.

### Candidate dataset, TTL, and security boundaries

Expanded each new demo from five examples to 16 deterministic fictional
applications covering every status, varied sources and work modes,
overdue/today/upcoming follow-ups, notes, scheduled/completed/canceled
interviews, historical milestones, and enough activity to demonstrate the
dashboard and analytics honestly. Seeding continues through ordinary services
and transactions instead of bypassing domain rules.

Every temporary item type now carries the workspace's numeric `expires_at`,
including settings, notes, interviews, counters, quota, applications,
activities, and profile. Signed-token expiry remains the immediate authorization
boundary because DynamoDB TTL cleanup is eventual. Ownership always comes from
the verified identity; request bodies cannot choose owners, roles, IDs,
timestamps, milestone fields, or general-edit status. CORS remains an explicit
allowlist, deployed clients omit local endpoints and explicit credentials, and
no passwords, uploads, real credentials, or private user data were introduced.

### Frontend quality and validation handoff

Implemented the protected Home, Analytics, Interviews, and Settings routes with
centralized API calls and Zod validation. New and changed views include labeled
controls, semantic sections and tables, visible keyboard focus, loading/empty/
error states, retry paths, responsive layouts, screen-reader equivalents for
visual trends, and text labels in addition to color. Mutations invalidate the
relevant application, activity, schedule, dashboard, and analytics queries.

At this documentation handoff, the suite collects 129 isolated backend tests
and contains 31 frontend tests across eight files. Ruff lint/format, strict
mypy, backend API/integration tests, frontend ESLint/TypeScript/Vitest, and the
production build were exercised throughout the milestone, including ownership,
TTL, cursor scope, view completeness, analytics denominators, projection
reconciliation, optimistic conflicts, route flow, settings persistence, and
accessible interactions. The final real-browser pass covered saved-time-zone
timestamp rendering, date-only follow-ups, session-boundary cache isolation,
responsive layouts, direct-route refreshes, and keyboard focus behavior. No
AWS resources were created during Milestone 2.

## Final Milestone 2 browser QA and session-isolation hardening - August 12, 2026

Completed the final local release gate against the running Vite, FastAPI, and
DynamoDB Local services. The browser pass covered 1440 x 900 desktop,
768 x 1024 tablet, 390 x 844 mobile, and a 320-pixel narrow fallback. The
dashboard, application list, application detail, analytics, interviews, and
settings views remained contained without page-level horizontal overflow.
Mobile navigation now uses five compact, accessible columns at supported phone
widths and wraps below 360 pixels, so every primary destination remains visible
without a horizontally scrolling menu. The compact `Apps` label retains the
accessible name `Applications`, and tablet and desktop labels remain unchanged.

The browser workflow exercised demo launch, all-status and archived views,
direct protected-route refresh, unauthenticated deep-link redirection, notes,
follow-up completion, status transitions, settings and theme persistence,
analytics filters, application creation, and reset. Modal QA confirmed an
`alertdialog` with an explicit label and description, safe initial focus, and
focus restoration to the reset trigger. Automated keyboard tests additionally
cover Tab and Shift+Tab containment, Escape dismissal, unsaved-change dialogs,
and focus restoration. The final dashboard refresh produced no browser console
warnings or errors.

The pass found and resolved three release-significant issues:

- Timestamp formatting outside Home had used the browser time zone instead of
  the saved workspace time zone. Global interviews, application cards, detail
  headers, activity, notes, nested interviews, and workspace expiry now all
  require and use the selected zone. Date-only follow-ups remain calendar-safe.
- The mobile primary navigation exposed a horizontal scrollbar and initially
  left `Settings` off-canvas. Its responsive grid now fits all destinations at
  390 pixels and wraps cleanly at 320 pixels while preserving 44-pixel targets.
- Replacing a demo identity could briefly render TanStack Query data from the
  prior workspace. Launch, reset, and exit now synchronously clear the query
  cache at the identity boundary. Protected routes unmount behind a neutral
  preparation state while a replacement session is issued, and only remount
  after the new token is active. A live 17-record-to-reset reproduction proved
  that the old total disappears during the transition and the new isolated
  workspace returns with exactly 16 applications and two drafts.

Final validation used Python 3.14.7. Ruff lint and format checks passed across
59 backend files, strict mypy passed across 43 source files, and Pytest passed
129 tests. Frontend ESLint and TypeScript checks passed, Vitest passed 31 tests
across eight files, and the production Vite build passed with route-level code
splitting. `pip check` and `git diff --check` passed. The Python dependency
audit reported no known vulnerabilities, and the npm production audit reported
zero vulnerabilities. The only remaining warning is the existing upstream
FastAPI/Starlette TestClient deprecation notice. DynamoDB Local, the backend,
and the frontend remained healthy, and the handoff browser was left on a clean
16-record dashboard at `http://localhost:5173/dashboard`.

## Full frontend visual redesign - August 13, 2026

### Purpose

Redesign the local demo workspace from a functional CRUD workspace into a
polished portfolio product experience. The goal was to make HireFlux feel like
a focused job-search command center: dark-first, easier to scan, more
comfortable for repeated use, stronger on mobile, and clearer about what a
candidate or visitor should try during a short demo session.

The redesign deliberately stayed inside the frontend boundary. Backend routes,
payloads, authentication/session behavior, ownership rules, application status
transition rules, and DynamoDB access patterns were not changed.

### Changes delivered

Completed the dark-first HireFlux workspace redesign without changing backend
routes, payloads, ownership rules, or status-transition policy. The visual
foundation now uses semantic canvas, surface, border, text, accent, success,
warning, and danger tokens; self-hosted variable Inter and Space Grotesk fonts;
and one Lucide outline-icon system. Dark remains the first-run default, while
explicit Light, Dark, and System preferences persist consistently. Shared
surface, page-header, field, tab, drawer, dialog, menu, icon-button, skeleton,
toast, and feedback primitives now provide consistent motion, focus, Escape,
and focus-restoration behavior.

The authenticated shell now provides a persistent collapsible desktop sidebar,
contextual utility bar, mobile top bar, safe-area-aware bottom navigation, and a
focused More sheet. Route changes restore scroll, announce the destination,
focus the new page heading, and update the document title. Reset and exit retain
their confirmation/session protections and also clear the session-only
search tour. The landing experience keeps the direct demo entry while
adding a stronger product-proof narrative and an explicitly decorative,
screen-reader-described workspace preview.

Applications now use URL-backed Active, All, and Archived views plus a
medium-screen card/list preference. Search remains submit-driven; status,
source, work mode, and sort changes are staged in a responsive filter drawer
until Apply, with result counts and removable filter chips after submission.
Cards and the semantic desktop table expose location, work mode, urgency,
timestamps, and a visible Manage route to the application overview. Narrow
screens intentionally fall back to cards rather than squeezing the table.

Application detail now exposes URL-backed Overview, Notes, Interviews, and
Activity tabs, lazily requesting each resource only when selected and retaining
React Query cache when revisited. The server-provided status policy remains the
only source of allowed transitions; it is presented in a sticky desktop rail
and a focused mobile/tablet sheet. Notes reveal their composer deliberately,
interview editing uses a drawer/sheet with explicit cancellation confirmation,
and create/edit forms keep essential fields open while optional fields collapse
until requested, pre-populated, or invalid. Required fields are semantic,
validation summaries link to invalid controls, and form actions remain visible
in a sticky footer.

Home now leads with a dismissible three-action search tour, a linked metric
strip, and a dominant action center grouped into Overdue, Today, and Upcoming.
Successful status, note, and interview actions alone advance session-only guide
progress. Analytics is divided into URL-backed Overview, Pipeline, and Sources
sections with staged secondary filters, accessible week labels, responsive
source cards, and a labeled desktop table. Interviews is organized around the
saved workspace calendar, and Settings presents profile, workspace lifecycle,
preferences, and account controls together while replacing unavailable
production controls with explanatory capability content.
Dashboard, analytics, and application filters retain previous data during
refetches and reserve layout-matched skeletons for initial loading.

### Validation and acceptance

The acceptance layer now includes JSX accessibility linting, twelve route and
open-overlay axe component checks, and deterministic Playwright coverage against
a production preview. Browser checks run at 320 x 720, 390 x 844, 768 x 1024,
and 1280 x 900 with reduced motion. They exercise computed dark and light
contrast, persisted theme choice, keyboard tabs, staged filters, drawer and
status-sheet focus restoration, card/list fallback, lazy query caching,
progressive form validation, route containment, and a desktop 200-percent zoom
equivalent. Ten stable desktop visual baselines cover the landing page, Home
shell, Applications, every application-detail tab, Interviews, Analytics, and
Settings.

Final validation passed ESLint, TypeScript, 58 Vitest tests across 11 files
(including all twelve axe scenarios), the production Vite build, and 47
Playwright checks with nine expected non-desktop skips for the desktop-only
theme, tab-snapshot, and zoom duplicates. Every principal browser route had
zero detected WCAG A/AA axe violations and no unintended page-level horizontal
overflow at the four tested widths. Dedicated browser scenarios also verified
layout-matched loading, explicit empty and failed-request/retry feedback, and
containment of extreme long application content. A final live pass launched a
fresh 16-record isolated workspace and verified the redesigned Home and
Applications flows against the running local API. `git diff --check` and the
npm production dependency audit also passed.

## Light-mode visual refinement - August 22, 2026

### Purpose

Refined the explicit light theme so it feels calmer and more legible across
different displays without changing the existing dark-first product identity.
The work stayed within presentation: no API contracts, routes, theme
persistence behavior, authentication, or backend architecture changed.

### Changes delivered

The light palette now uses a cool blue-gray canvas, near-white raised
surfaces, stronger semantic borders, darker readable muted text, and softer
cyan/violet lighting. Primary actions remain cyan/teal with white text, while
amber is reserved for warning and expiry states using a contained cream panel
and narrow warning rule rather than a bright yellow outline.

The landing page now uses semantic canvas and surface tokens, a quieter hero
gradient, clearer workspace-preview boundaries, gray-blue preview layers, and
consistent feature/proof-card separation. Status badges and remaining
legacy-palette feature screens use the same semantic light-mode compatibility
mapping, while the dark token values and layout remain unchanged.

### Validation

Added deterministic light-mode screenshots for the landing page at 320, 390,
768, and 1280 pixels, plus desktop light baselines for Dashboard,
Applications, Application Detail, Interviews, Analytics, and Settings. Light
routes are checked for WCAG A/AA axe violations, horizontal overflow, and
stable layout after the theme transition.

Final validation passed frontend ESLint, TypeScript, 68 Vitest tests across 12
files, the production Vite build, and 60 Playwright checks (51 passed with
nine expected desktop-only skips). Existing dark-route coverage also passed;
the Settings desktop baseline was refreshed to match the current Settings
page structure already present in the working tree. `git diff --check` passed.

## Analytics, resource bounds, and workflow-integrity hardening - August 22, 2026

### Purpose

Completed a correctness and resilience pass based on candidate-workflow review.
The work focused on preventing date-only values from becoming invalid
timestamps, keeping analytics consistent across equivalent workflows, making
bounded resources complete and affordable to read, and preserving recoverable
UI state when a demo reset fails.

### Analytics and date semantics

Established the separation between the user-entered `applied_date` calendar
value and server-owned UTC milestones. `applied_date` is validated against the
workspace's current calendar date and is never converted through UTC. The
analytics reporting window and submission trend use that canonical business
date, while elapsed-time metrics use ordered server timestamps such as
`submitted_at` and `first_response_at`.

Direct `APPLIED` creation and `DRAFT` to `APPLIED` transitions now resolve to
the same applied-date reporting window. Invalid legacy milestone ordering is
excluded from duration averages rather than producing negative response times.
The API, service, schema, and frontend form changes keep these rules
server-owned and display validation errors at the user input boundary.

### Archived workflow integrity

Archived applications continue to satisfy the required fields of their
remembered prior status. In particular, an archived later-stage application
cannot clear the `applied_date` that would be required when restored. Restore
requests can repair a legacy archived record that is missing this field before
the status transition is applied; the exact `archived_from_status` rule remains
authoritative.

### Resource quotas and bounded reads

Added per-application server-owned quotas with transactional counters: 100
notes, 25 interviews, and 500 append-only activity entries by default. Quota
updates happen atomically with child-resource creation or activity writes, and
deleting a note releases its slot. The local demo's existing 100-application
lifetime quota remains in place.

Notes, interviews, activity, and global upcoming-interview reads now return
bounded pages with signed, scope-bound cursors and continuation metadata. The
cursor contract hides DynamoDB keys and rejects tampering, cross-owner reuse,
and application/filter mismatches. Frontend panels accumulate pages safely,
deduplicate items, and expose load-more behavior so records beyond the first
page remain discoverable.

### Reset failure recovery

Demo reset no longer clears the active workspace or unmounts the protected
layout while the replacement session is being created. The current workspace
and reset dialog remain available until reset succeeds. If creation fails, the
dialog stays open with the explicit message that the existing workspace is
still available, a `Try again` action, and an assertive alert that receives
focus for screen readers and keyboard users. Query data is cleared only after
the replacement session exists, preserving the old identity on failure while
still enforcing cache isolation at the successful identity boundary.

### Validation

Added regression coverage for date validation, milestone consistency, archived
workflow repair, quota limits and rollback, signed cursor scope, complete
interview pagination, and failed-reset focus/retry behavior. The current
frontend validation passes 62 Vitest tests, ESLint, TypeScript checking, and
the production Vite build. Backend Ruff lint/format, strict mypy, and the full
backend suite also pass at 138 tests. `git diff --check` passes; existing
Git line-ending normalization warnings are non-blocking.

The durable contracts were updated in the dashboard/analytics, domain-model,
DynamoDB access-pattern, and isolated-demo-session ADR documents. No AWS
resources were created during this work.

## Browser security headers - August 22, 2026

### Hosted policy

Added the repository-root `customHttp.yml` monorepo configuration for Amplify
Hosting. Hosted responses now receive a deployable Content Security Policy,
HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, and cross-origin isolation headers. The policy permits
same-origin scripts only, blocks object/plugin content and inline event-handler
scripts, prevents framing, disables unused browser capabilities, and scopes API
connections to the planned us-east-1 API Gateway origin. Deployments using a
custom API domain or another AWS region must update `connect-src` before release.

The pre-React theme setup moved from an inline script in `frontend/index.html`
to `frontend/public/theme-bootstrap.js`, keeping first-paint theme selection
while allowing `script-src 'self'`. Vite development and preview servers now
send the same header family with an explicit local API allowlist and without
HSTS on HTTP. The development-only Vite React-refresh bootstrap is the sole
reason the local server allows inline scripts; the production preview and
hosted policy keep them blocked. The security-header helper has focused tests
covering inline script blocking, framing protection, local HTTP behavior, and
MIME sniffing protection.

This is defense in depth for the current temporary demo token in
`sessionStorage`; it does not make a bearer token unreadable to already-running
same-origin JavaScript. Production identity/session hardening remains a separate
deployment milestone.

## Python dependency lock and SBOM baseline - August 22, 2026

### Reproducible dependency graph

Generated and committed `backend/uv.lock` from the existing pinned
`backend/pyproject.toml`. The lock covers the runtime and development extra
across the supported Python 3.13 and 3.14 range, records transitive versions,
registry sources, and SHA-256 hashes for source and wheel artifacts. The
recommended environment setup is now `uv sync --project backend --extra dev
--locked`, and `uv lock --check` is the drift gate before validation.

The frontend already has a committed npm lockfile; the documented setup keeps
using `npm ci` so its package integrity metadata remains authoritative.

### Software inventory

Added `backend/scripts/generate_sbom.py`, a standard-library CycloneDX 1.5
generator that reads the Python lockfile and emits package URLs, dependency
edges, artifact hashes, and the lockfile digest. The supply-chain guide also
documents npm's CycloneDX SBOM command for the frontend. Generated SBOM files
are ignored local/CI artifacts rather than source files, so a future staging
workflow can upload the exact inventories alongside each build.

## Demo provisioning reliability - August 22, 2026

### Lifecycle state and failure cleanup

Demo creation now reserves a workspace lifecycle item as `PROVISIONING` before
writing the profile and seeded applications, activities, notes, interviews,
settings, quotas, and counters. The item becomes `READY` only after the full
seed completes. If any step fails, the service returns a safe persistence error,
marks the lifecycle `FAILED` with a 15-minute default TTL, and removes partial
owner/application records best-effort through bounded owner-scoped queries and
batch deletes. The failed marker and its optional idempotency record remain
briefly so an incomplete seed is distinguishable from a successful workspace;
they do not grant authorization.

### Retry safety

`POST /api/v1/demo-sessions` accepts an optional `Idempotency-Key`. The backend
stores only a SHA-256 hash of that key with the generated workspace reference.
Once provisioning is `READY`, replaying the same key returns the same
deterministic signed token and workspace expiry rather than creating a second
seed. Requests that collide with `PROVISIONING` or `FAILED` receive a conflict,
so callers can retry an incomplete operation with a new key after the failure
has been surfaced. The frontend generates a UUID key for each launch/reset
attempt, making transport-level replay safe without exposing internal
DynamoDB keys.

### Validation

Added Moto-backed integration coverage for the `READY` lifecycle marker,
idempotent replay, partial-seed cleanup, short failure TTL, and failed-key
conflict behavior. Added frontend coverage proving demo launch sends the
idempotency header. The local architecture and access-pattern documents now
describe the lifecycle and bounded cleanup path. No AWS resources were created.

## Settings draft refresh safety - August 22, 2026

Settings preferences now track dirty fields independently from the server
snapshot. When another control, such as the header theme toggle, refreshes the
shared settings query, untouched fields accept the latest server values while
locally edited fields remain in the draft. Saving replaces the draft with the
server-confirmed response and clears the dirty-field set.

Added a frontend regression test covering an unsaved dashboard-range change
surviving a header theme refresh while the refreshed theme is accepted.

## P1 audit remediation - August 22, 2026

### Browser Notes contract

The Playwright Notes-tab regression was caused by stale browser fixtures that
omitted `next_cursor` from paginated notes and activity responses. The real API
and frontend Zod schemas require the cursor field, so the fixture now matches
the production contract without weakening validation or suppressing parser
errors.

### Demo reset isolation

Demo reset now cancels active queries, clears React Query data, and removes the
stored demo token as soon as identity replacement begins. The protected app
stays mounted only to show a reset/provisioning state and the existing reset
dialog; old workspace records are not rendered behind it. If provisioning
fails, the previous valid session is restored explicitly, caches remain cleared,
and the dialog focuses the existing accessible error with retry/recovery
actions.

### Bounded synchronous export

`GET /api/v1/me/export` now sets `Cache-Control: no-store` and `Pragma:
no-cache` on successful responses. Synchronous export is capped by
`MAX_SYNC_EXPORT_RECORDS`, defaulting to 5,000 exported application, activity,
note, and interview records. Larger workspaces receive
`WORKSPACE_EXPORT_TOO_LARGE` instead of a partial download. The current default
resource quotas allow up to 100 applications, 10,000 notes, 2,500 interviews,
and 50,000 activity records, so a maximum workspace must move to a future async
S3 export path before AWS staging relies on production-scale data export.

## Unified Settings & profile controls - August 22, 2026

Settings & profile is now a single page: profile editing, workspace lifecycle,
preferences, and account controls render together without the former
Preferences/Demo workspace/Account preview section navigation. The page keeps
a useful candidate-facing export action for demo visitors:
`GET /api/v1/me/applications/export` produces a spreadsheet-friendly CSV of
the signed-in workspace's applications. The full versioned JSON export at
`GET /api/v1/me/export` remains reserved for future persistent accounts and is
rejected for demo identities. Both paths are owner-scoped, use bounded
Query-based access rather than a DynamoDB Scan, and never accept an owner
identifier from the client.

The frontend downloads the server-produced CSV with its attachment filename.
The unified page also presents a
production-readiness checklist for identity recovery, MFA/session controls,
notifications, retention, and portability. These remain clearly labeled
production concepts: the demo does not pretend to provide passwords, MFA,
email notification delivery, role switching, persistent login, or permanent
deletion. Application CSV export is the active account-control action in this
milestone. The profile name field is an explicit local simulation; email remains
read-only because there is no profile-write or delivery service in the local
demo.

Added API coverage proving application CSV export remains owner-scoped and
properly escaped, the full JSON export remains isolated for persistent
identities, and demo identities cannot bypass the UI boundary. Frontend lint,
typecheck, tests, and production build were rerun for the account-preview
change. This is still local demo functionality; no AWS identity, storage, or
notification resources were created.

### Candidate account and workflow preview

The unified page includes candidate-focused, deliberately non-authoritative
account previews. A candidate workflow guide connects Applications,
Interviews and notes, and Analytics without implying an ATS or organization
role model. It never changes the signed-in authorization or server identity.
Email notification controls remain visibly blocked: the reminder checkboxes
are disabled and explain that no delivery system exists in the demo.

The page distinguishes the active application CSV export
from production concepts such as recovery, MFA, session controls, retention,
and permanent deletion. Added frontend coverage for the candidate workflow,
the local-only profile simulation, disabled email notifications, and the
explicit authorization/message-delivery boundary. This keeps the demo useful
for public product review while preserving the server-owned security and business
rules.

## Localhost development reliability - August 22, 2026

The Vite development and preview servers now bind explicitly to IPv4
`127.0.0.1`. This keeps the documented `http://127.0.0.1:5173/` browser URL
working on Windows systems where `localhost` may resolve first to IPv6 `::1`.
The local FastAPI process remains a separate service on port 8000, with
DynamoDB Local on port 8001.

## Candidate-first product framing - August 23, 2026

Removed the Settings role-and-access simulation for Candidate, Recruiter,
Hiring manager, and Administrator because those organization personas implied
an applicant-tracking system that HireFlux does not provide. Settings now
describes a private personal account, labels the demo's focus as a candidate
job search, and links Applications, Interviews and notes, and Analytics as one
candidate workflow.

The dashboard's three-step walkthrough is now the Search tour. Its internal
event, types, and storage use candidate-neutral names while still reading the
legacy `hireflux-recruiter-guide` session value once so an existing visitor's
dismissed or completed state is not lost. Reset and exit clear both storage
keys. The public landing and current architecture/product documentation now
describe a candidate-focused demo available to any visitor.

Recruiter and hiring-manager vocabulary remains only where it represents real
candidate-side application data, such as an application source, recruiter call,
or interview participant. Server-side role fields remain authoritative and
reserved for future separately guarded capabilities; no role switcher, ATS
workflow, backend authorization change, or data migration was introduced.

## Interactive personal account control center - August 23, 2026

Enhanced the existing Personal account preview without removing its Data &
privacy, Personal account foundations, candidate workflow, notification, or
demo-boundary panels. Security, account protection, and notification capability
cards now identify whether behavior is available, simulated, or requires a
future production service. Each card opens an accessible product-preview drawer
that explains identity recovery, MFA enrollment, active sessions, or the
notification-delivery path. The simulations use the existing drawer focus trap,
Escape handling, backdrop close, and trigger-focus restoration.

Notification choices are now safe interactive previews rather than disabled
checkboxes. They persist in `sessionStorage` under a non-secret fingerprint of
the current demo token, so refreshes preserve the preview but another workspace
starts from the defaults. No preference is sent to the API and no message is
delivered. A new account-continuity panel shows which applications, stages,
notes, interviews, follow-ups, analytics, preferences, and export-ready data a
future conversion service could preserve, alongside an explicit lifecycle from
temporary demo to candidate-owned account.

The demo boundary remains explicit: no password, authenticator secret, recovery
challenge, persistent session, account conversion, email, deletion request, or
AWS identity resource is created. Application CSV export remains the only live
account-control action in this section. Added frontend coverage for preview
drawers, simulated completion, notification preference persistence and workspace
isolation, lifecycle content, Escape close, and focus restoration. No backend,
API, DynamoDB, authorization, or data-model change was required.

Follow-up UI polish improved the notification-delivery drawer's informational
callout contrast and constrained both the preview status text and production
implementation note to their available width. This keeps the copy readable and
contained at narrow drawer sizes without changing the simulation behavior.

The Personal account preview container now uses the same theme-aware surfaces,
ink colors, borders, accents, success states, warning treatment, spacing, and
card hierarchy as the rest of Settings. The parent grouping and nested panels
were softened into a cohesive raised-surface system, and the preview drawers
inherit the same visual language. This was a presentation-only change; all
existing preview actions, workspace-scoped persistence, and demo boundaries are
unchanged.

## Applications workspace UX refinement - August 27, 2026

Refined the existing server-classified Applications workspace without changing its
classifier, API, lifecycle rules, or DynamoDB model. The first server-ordered
attention item is now the single featured opportunity, while the remaining preview
items use compact divided rows. Desktop and tablet retain four preview items and
phones retain three. The zero-attention state is now a calm inline message.

Centralized reason-specific action labels and supporting context across featured,
compact, and flat rows. Candidate actions now use `Review next action` or
`Plan next action`; timing copy distinguishes interviews, planned check-backs,
candidate-owned dates, employer waiting, drafts, and applied dates without creating
new client-side urgency or grouping policy.

Removed the search/filter toolbar's heavy card chrome and added lightweight Active
retrieval orientation with a direct return to the grouped opportunity workspace.
Search debounce, URL state, staged filters, cursor pagination, sorting, live-region
updates, and existing API contracts remain intact.

Added a validated Applications-origin router-state contract. Collection role links
preserve the exact search/filter/scope URL without running actions. Contextual links
can carry a one-shot primary-action or interview-preparation intent, which detail and
Interviews consume with route replacement. Back links restore the exact Applications
URL, unsafe/external paths fall back locally, and drawer focus restoration begins at
the corresponding What’s next action. The detail identity header now keeps only More;
primary and secondary lifecycle actions share the What’s next panel.

Focused coverage verifies origin validation, one-shot consumption, focus restoration,
action de-duplication, featured attention hierarchy, reason-specific copy,
supporting-value precedence, and retrieval return behavior. This remains a
frontend/router-only refinement with no backend or persistence change.

Final validation passed Ruff check and format check, Mypy across 58 backend source
files, all 259 backend tests, frontend lint and typecheck, all 155 frontend tests,
and the production build. Playwright passed 84 tests across 320px, 390px, 768px,
and 1280px projects with 12 fixture-dependent skips; its route checks included Axe,
keyboard flows, overflow checks, deep-link refresh, and the existing 200% zoom
equivalent. Four intentional Applications/detail light/dark visual baselines were
reviewed and updated for the new hierarchy.

## Next recommended work

Freeze and commit the validated local Milestone 2 baseline, then build and
manually validate the cost-bounded AWS staging foundation described in the
roadmap: TypeScript CDK, Python 3.14
Lambda/Mangum, HTTP API, a separate DynamoDB table, secret-backed signing keys,
CloudWatch safeguards, and an Amplify staging branch with explicit CORS,
asset-aware SPA routing, security headers, throttling, constrained concurrency,
and budget alerts.

Automated OIDC-based CI/CD should follow only after the staging stack is stable
under manual smoke testing. Cognito accounts, private attachments, email, and
real reminder delivery remain deliberately deferred to their later milestones.
