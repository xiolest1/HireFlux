# Interview preparation contract

Interview Preparation is deterministic candidate guidance, not an interview predictor or an assessment of the candidate. The backend owns the catalog so every client receives the same checklist, prompts, questions, explanations, and readiness facts.

## Curation model

Guidance combines a four-item universal foundation, one item for the saved interview type, and one item for the effective application role family when a reliable family exists. Candidates may add up to two interview-scoped checklist items. The final checklist therefore contains five through eight visible items.

The effective role family is resolved in this order:

1. an explicit application-level candidate selection, including `GENERAL`;
2. one unambiguous match from the job title;
3. universal fallback.

Automatic classification never reads private notes, company name, application source, or the free-form job description. Conflicting and generic titles fall back instead of producing a confident guess. Every response identifies whether the focus was chosen, inferred from the title, or universal fallback.

Technical-screen and skills-assessment content is role-neutral. Software architecture, debugging, coding, and technical tradeoffs appear only when the effective role family is Software / IT. Other families receive their own curated evidence themes and employer-evaluation questions.

## Candidate data and readiness

Preparation notes, saved questions, checklist completion, and custom items remain on the owned interview record. They are not copied into Analytics or activity summaries. Candidate text is normalized, length-bounded, rendered as text, and protected by the same owner isolation and optimistic concurrency as every interview mutation.

Completed interview reflections remain interview-scoped and candidate-private. A completed debrief opens read-only; editing is deliberate and keeps the original `debrief_completed_at` value. The next scheduled round may display no more than two forward-looking values from the latest earlier completed debrief for the same application. This context is referenced in place, never copied into the later round, and never added to generated guidance or Analytics.

Readiness is exactly the number of completed visible checklist items. There is no hidden score, confidence model, employer prediction, or AI judgment. Custom tasks enter the same visible denominator. Unknown or stale completion IDs never increase readiness.

Evidence stories stay in one flexible notes field. The UI provides optional Situation, Role, Action, Result, and Reflection guidance without imposing structured STAR fields. Suggested questions remain distinct from saved candidate questions and combine universal, interview-type, and role-family context.

## Compatibility and future work

Role family and custom-item attributes are optional on existing DynamoDB records, require no index or table migration, and never introduce a scan. Application role changes synchronize the interview projection transactionally.

Possible future additions—not implemented—include optional AI-assisted job-description context, a richer occupation taxonomy, reusable preparation templates, candidate-created templates, and preparation history.
