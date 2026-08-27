# Interview preparation and reflection contract

HireFlux provides deterministic, candidate-private interview support. It does not score readiness, evaluate a candidate, predict an employer decision, or send preparation text to an AI service. The backend owns outcome applicability and aggregation so every client renders the same lifecycle facts.

## Outcome-based preparation

Preparation is organized around stable outcomes instead of counting every visible card equally:

- `OPPORTUNITY_UNDERSTANDING`: understand the role, employer, and conversation context;
- `RELEVANT_EVIDENCE`: select examples that demonstrate relevant experience;
- `CONVERSATION_PLAN`: prepare useful questions and a deliberate conversation plan;
- `INTERVIEW_REQUIREMENTS`: confirm an assessment environment only when the interview catalog marks it applicable.

The catalog classifies work as `ESSENTIAL`, `ADDITIONAL`, or `CANDIDATE`. Only applicable essential outcomes determine whether lifecycle preparation is complete. Role-family exercises, onsite mapping, deeper prompts, and candidate-created tasks remain useful additional work but can never reduce essential completion. Candidates may add up to two interview-scoped tasks, tracked independently.

Concrete essential copy can adapt to interview type without changing the underlying outcome. Technical-screen and coding-assessment defaults remain role-neutral; software architecture, debugging, coding, and tradeoff guidance appears only for the Software / IT role family. The effective role family resolves in this order:

1. an explicit application-level candidate choice, including `GENERAL`;
2. one unambiguous, high-confidence job-title match;
3. universal fallback.

Automatic classification never reads private notes, company name, source, or the free-form description. Every response identifies whether focus was selected, title-inferred, or a universal fallback.

Company, role, schedule, interview type, access details, and prior rounds form an unscored Interview brief. Access details are exception-based: when both location and meeting access are absent, the candidate is directed to the canonical interview editor rather than given a permanent logistics checkbox.

## Completion and compatibility

The backend returns `essential_outcomes`, item-level category/outcome/completion facts, and separate progress for essentials, additional work, and candidate tasks. React groups and explains those facts; it does not calculate lifecycle readiness. Candidate-facing language is factual—such as “2 essentials remaining” or “Essentials prepared”—and never presents a percentage, hidden score, or judgment.

Existing completion IDs map conservatively to outcomes. `research_company`, `prepare_examples`, and `prepare_questions` retain their intended meaning; applicable type-specific legacy work maps through the catalog. The retired `confirm_logistics` completion is ignored and removed on the next valid save. Unknown IDs remain invalid, while stale context-owned IDs cannot inflate completion. No DynamoDB migration, index, or scan is required.

## Private reflection

Post-interview work is called Reflection in the product. The underlying legacy `debrief_*` fields remain compatible, while new records may use `debrief_primary_reflection` for “What stands out?” and `debrief_carry_forward` for an explicit next-round reminder.

A reflection may be completed when at least one substantive trimmed value exists in the primary reflection, went-well, improvement, signals, or carry-forward fields. The legacy `debrief_next_step` remains readable but does not qualify as reflection and is not collected by the new capture flow. Operational next steps belong to the Application, not the Interview.

Completed reflections open read-only, require a deliberate Edit reflection action, and preserve the original `debrief_completed_at` timestamp. A later scheduled round may reference at most the explicit carry-forward and primary takeaway from the latest earlier completed round in the same application. It never relabels improvement notes, combines rounds, copies reflection into another record, or invents a summary. If the new fields are absent, the candidate can review the full legacy reflection without a synthetic preview.

Preparation notes, evidence stories, saved questions, checklist state, custom tasks, and reflection text remain on the owned interview record. They are excluded from Analytics and activity summaries, normalized and length-bounded at the API, rendered as text, and protected by owner isolation and optimistic concurrency.

## Focused workspace and future work

Active preparation, reflection capture/review, historical preparation, and scheduling share the responsive `FocusedWorkspace` dialog shell. It provides one scroll region, a stable footer, focus containment/restoration, Escape handling, body locking, safe-area behavior, and dirty-close confirmation. Filters and short actions continue using the general Drawer.

Possible future additions—not implemented—include optional AI-assisted job-description context, richer occupation taxonomies, reusable preparation templates, candidate-created templates, and preparation history.
