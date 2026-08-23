from dataclasses import dataclass

from hireflux_backend.domain.resources import Interview, InterviewType


@dataclass(frozen=True, slots=True)
class InterviewChecklistItem:
    item_id: str
    label: str
    description: str


@dataclass(frozen=True, slots=True)
class InterviewGuidance:
    checklist_items: tuple[InterviewChecklistItem, ...]
    focus_prompts: tuple[str, ...]
    suggested_questions: tuple[str, ...]
    completed_steps: int
    total_steps: int
    ready_for_interview: bool
    missing_actions: tuple[str, ...]


_BASE_CHECKLIST = (
    InterviewChecklistItem(
        "research_company",
        "Review the company and role",
        "Identify the product, team context, and the role's most important outcomes.",
    ),
    InterviewChecklistItem(
        "prepare_examples",
        "Prepare two evidence stories",
        "Capture concrete examples that show impact, decisions, and lessons learned.",
    ),
    InterviewChecklistItem(
        "prepare_questions",
        "Write candidate questions",
        "Prepare at least two questions that help you evaluate the role and team.",
    ),
    InterviewChecklistItem(
        "confirm_logistics",
        "Confirm interview logistics",
        "Verify the time, location or link, format, and expected duration.",
    ),
)

_TYPE_CHECKLIST: dict[InterviewType, InterviewChecklistItem] = {
    InterviewType.RECRUITER_CALL: InterviewChecklistItem(
        "career_summary",
        "Practice your career summary",
        (
            "Connect your recent experience, search goals, and interest in this role "
            "in under two minutes."
        ),
    ),
    InterviewType.TECHNICAL_SCREEN: InterviewChecklistItem(
        "technical_tradeoffs",
        "Rehearse technical tradeoffs",
        "Choose an example where constraints, alternatives, and validation shaped your decision.",
    ),
    InterviewType.BEHAVIORAL: InterviewChecklistItem(
        "behavioral_range",
        "Cover a range of behaviors",
        "Prepare examples for collaboration, conflict, ambiguity, ownership, and learning.",
    ),
    InterviewType.CODING_ASSESSMENT: InterviewChecklistItem(
        "coding_environment",
        "Confirm the coding environment",
        (
            "Check the platform, language, permitted resources, and how you will "
            "communicate your reasoning."
        ),
    ),
    InterviewType.HIRING_MANAGER: InterviewChecklistItem(
        "first_ninety_days",
        "Define your first-90-day approach",
        "Be ready to discuss how you would learn the domain, build trust, and deliver early value.",
    ),
    InterviewType.ONSITE: InterviewChecklistItem(
        "interviewer_map",
        "Map the interview loop",
        "Note each conversation's likely focus so your examples stay varied and relevant.",
    ),
    InterviewType.FINAL: InterviewChecklistItem(
        "decision_criteria",
        "Clarify your decision criteria",
        "List the remaining facts you need before deciding whether this opportunity fits.",
    ),
    InterviewType.OTHER: InterviewChecklistItem(
        "conversation_goal",
        "Define the conversation goal",
        "Write what you want the interviewer to understand and what you need to learn.",
    ),
}

_TYPE_PROMPTS: dict[InterviewType, tuple[str, ...]] = {
    InterviewType.RECRUITER_CALL: (
        "Why this company and role now?",
        "What scope, location, and compensation constraints should be clear?",
        "Which experience best establishes immediate relevance?",
    ),
    InterviewType.TECHNICAL_SCREEN: (
        "Which architecture or debugging story demonstrates your reasoning?",
        "How will you explain tradeoffs and validation instead of only the final answer?",
        "Which fundamentals are most likely to be tested for this role?",
    ),
    InterviewType.BEHAVIORAL: (
        "Which examples show ownership, collaboration, and learning?",
        "What measurable result followed from your actions?",
        "What would you do differently with hindsight?",
    ),
    InterviewType.CODING_ASSESSMENT: (
        "How will you clarify requirements before coding?",
        "How will you communicate complexity, edge cases, and tests?",
        "What is your fallback when you become stuck?",
    ),
    InterviewType.HIRING_MANAGER: (
        "What problems would this manager expect you to own?",
        "How have you built trust and delivered in an unfamiliar domain?",
        "What support and feedback help you do your best work?",
    ),
    InterviewType.ONSITE: (
        "Which examples should be reserved for each conversation?",
        "How will you maintain energy and consistency across the loop?",
        "What repeated signals would strengthen or weaken your interest?",
    ),
    InterviewType.FINAL: (
        "What unresolved risk might prevent mutual fit?",
        "What impact would you aim to make in the first six months?",
        "Which decision criteria still need evidence?",
    ),
    InterviewType.OTHER: (
        "What should the other person understand by the end?",
        "What evidence will make that clear?",
        "What do you need to learn to choose the next step?",
    ),
}

_TYPE_QUESTIONS: dict[InterviewType, tuple[str, ...]] = {
    InterviewType.RECRUITER_CALL: (
        "What business need led the team to open this role?",
        "How is the interview process structured from here?",
        "What would make someone especially successful in this position?",
    ),
    InterviewType.TECHNICAL_SCREEN: (
        "What technical decisions will this role influence most?",
        "How does the team balance delivery speed with reliability?",
        "What does technical growth look like on this team?",
    ),
    InterviewType.BEHAVIORAL: (
        "How does the team handle disagreement on important decisions?",
        "What behaviors distinguish the strongest people on the team?",
        "How is feedback usually shared and acted on?",
    ),
    InterviewType.CODING_ASSESSMENT: (
        "What should I optimize for during this exercise?",
        "May I state assumptions and ask clarifying questions as I work?",
        "How will the solution and communication be evaluated?",
    ),
    InterviewType.HIRING_MANAGER: (
        "What would you want this person to accomplish in the first 90 days?",
        "Where does the team need the most leverage right now?",
        "How do you support growth and give feedback?",
    ),
    InterviewType.ONSITE: (
        "How do the groups represented today work together?",
        "What is one challenge the team is actively trying to improve?",
        "What should I understand about the culture that is hard to see externally?",
    ),
    InterviewType.FINAL: (
        "What remaining concern would you want the successful candidate to address?",
        "How will success be evaluated after six months?",
        "What makes people stay and grow here?",
    ),
    InterviewType.OTHER: (
        "What outcome would make this conversation useful for you?",
        "What context about the role or team should I understand?",
        "What is the most important next step after this conversation?",
    ),
}


def checklist_items_for(interview_type: InterviewType) -> tuple[InterviewChecklistItem, ...]:
    return (*_BASE_CHECKLIST, _TYPE_CHECKLIST[interview_type])


def checklist_ids_for(interview_type: InterviewType) -> frozenset[str]:
    return frozenset(item.item_id for item in checklist_items_for(interview_type))


def guidance_for(interview: Interview) -> InterviewGuidance:
    items = checklist_items_for(interview.interview_type)
    completed = frozenset(interview.completed_checklist_items)
    missing = tuple(item.label for item in items if item.item_id not in completed)
    return InterviewGuidance(
        checklist_items=items,
        focus_prompts=_TYPE_PROMPTS[interview.interview_type],
        suggested_questions=_TYPE_QUESTIONS[interview.interview_type],
        completed_steps=len(items) - len(missing),
        total_steps=len(items),
        ready_for_interview=not missing,
        missing_actions=missing,
    )
