from dataclasses import dataclass, replace
from enum import StrEnum
from typing import cast

from hireflux_backend.domain.enums import RoleFamily
from hireflux_backend.domain.interview_preparation_catalog import (
    INTERVIEW_TYPE_LABELS,
    INTERVIEW_TYPE_PROFILES,
    ROLE_PROFILES,
)
from hireflux_backend.domain.resources import Interview, InterviewType
from hireflux_backend.domain.role_context import (
    ROLE_FAMILY_LABELS,
    RoleFamilySource,
    role_context_for,
)


class PreparationPhase(StrEnum):
    UNDERSTAND = "UNDERSTAND"
    PREPARE = "PREPARE"
    CONFIRM = "CONFIRM"


class PreparationSource(StrEnum):
    UNIVERSAL = "UNIVERSAL"
    INTERVIEW_TYPE = "INTERVIEW_TYPE"
    ROLE_FAMILY = "ROLE_FAMILY"
    CANDIDATE = "CANDIDATE"


class PreparationCategory(StrEnum):
    ESSENTIAL = "ESSENTIAL"
    ADDITIONAL = "ADDITIONAL"
    CANDIDATE = "CANDIDATE"


class PreparationOutcome(StrEnum):
    OPPORTUNITY_UNDERSTANDING = "OPPORTUNITY_UNDERSTANDING"
    RELEVANT_EVIDENCE = "RELEVANT_EVIDENCE"
    CONVERSATION_PLAN = "CONVERSATION_PLAN"
    INTERVIEW_REQUIREMENTS = "INTERVIEW_REQUIREMENTS"


@dataclass(frozen=True, slots=True)
class InterviewChecklistItem:
    item_id: str
    label: str
    description: str
    phase: PreparationPhase
    source: PreparationSource
    source_label: str
    category: PreparationCategory
    outcome_id: PreparationOutcome | None = None
    removable: bool = False
    completed: bool = False


@dataclass(frozen=True, slots=True)
class EssentialPreparationOutcome:
    outcome_id: PreparationOutcome
    label: str
    description: str
    completed: bool
    action_item_id: str


@dataclass(frozen=True, slots=True)
class PreparationProgressGroup:
    completed: int
    total: int


@dataclass(frozen=True, slots=True)
class EssentialPreparationProgress(PreparationProgressGroup):
    complete: bool
    remaining_actions: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PreparationProgress:
    essentials: EssentialPreparationProgress
    additional: PreparationProgressGroup
    candidate: PreparationProgressGroup


@dataclass(frozen=True, slots=True)
class CuratedText:
    text: str
    source: PreparationSource
    source_label: str


@dataclass(frozen=True, slots=True)
class PreparationTip:
    title: str
    body: str
    source: PreparationSource
    source_label: str


@dataclass(frozen=True, slots=True)
class PreparationRoleContext:
    role_family: RoleFamily
    role_family_label: str
    source: RoleFamilySource
    explanation: str


@dataclass(frozen=True, slots=True)
class InterviewGuidance:
    role_context: PreparationRoleContext
    checklist_items: tuple[InterviewChecklistItem, ...]
    focus_prompts: tuple[CuratedText, ...]
    suggested_questions: tuple[CuratedText, ...]
    tips: tuple[PreparationTip, ...]
    essential_outcomes: tuple[EssentialPreparationOutcome, ...]
    progress: PreparationProgress


_UNIVERSAL_CHECKLIST = (
    InterviewChecklistItem(
        "research_company",
        "Review the company and role",
        "Understand what the organization does, the role's responsibilities, "
        "and why it interests you.",
        PreparationPhase.UNDERSTAND,
        PreparationSource.UNIVERSAL,
        "Useful for every interview",
        PreparationCategory.ESSENTIAL,
        PreparationOutcome.OPPORTUNITY_UNDERSTANDING,
    ),
    InterviewChecklistItem(
        "prepare_examples",
        "Prepare two evidence stories",
        "Choose situations where your actions solved a problem, helped someone, "
        "improved work, or demonstrated a relevant skill.",
        PreparationPhase.PREPARE,
        PreparationSource.UNIVERSAL,
        "Useful for every interview",
        PreparationCategory.ESSENTIAL,
        PreparationOutcome.RELEVANT_EVIDENCE,
    ),
    InterviewChecklistItem(
        "prepare_questions",
        "Write candidate questions",
        "Prepare at least two questions that help you evaluate the responsibilities, "
        "expectations, team, and environment.",
        PreparationPhase.PREPARE,
        PreparationSource.UNIVERSAL,
        "Useful for every interview",
        PreparationCategory.ESSENTIAL,
        PreparationOutcome.CONVERSATION_PLAN,
    ),
)

_OUTCOME_LABELS = {
    PreparationOutcome.OPPORTUNITY_UNDERSTANDING: "Understand the opportunity",
    PreparationOutcome.RELEVANT_EVIDENCE: "Prepare relevant evidence",
    PreparationOutcome.CONVERSATION_PLAN: "Plan the conversation",
    PreparationOutcome.INTERVIEW_REQUIREMENTS: "Prepare for the interview format",
}

# Interview type can adapt the concrete work for a stable outcome without
# expanding preparation into a type-specific required checklist.
_TYPE_OUTCOMES: dict[InterviewType, PreparationOutcome | None] = {
    InterviewType.RECRUITER_CALL: PreparationOutcome.RELEVANT_EVIDENCE,
    InterviewType.TECHNICAL_SCREEN: PreparationOutcome.RELEVANT_EVIDENCE,
    InterviewType.BEHAVIORAL: PreparationOutcome.RELEVANT_EVIDENCE,
    InterviewType.CODING_ASSESSMENT: PreparationOutcome.INTERVIEW_REQUIREMENTS,
    InterviewType.HIRING_MANAGER: PreparationOutcome.RELEVANT_EVIDENCE,
    InterviewType.ONSITE: None,
    InterviewType.FINAL: PreparationOutcome.CONVERSATION_PLAN,
    InterviewType.OTHER: PreparationOutcome.OPPORTUNITY_UNDERSTANDING,
}

_OUTCOME_ITEM_IDS = {
    PreparationOutcome.OPPORTUNITY_UNDERSTANDING: "research_company",
    PreparationOutcome.RELEVANT_EVIDENCE: "prepare_examples",
    PreparationOutcome.CONVERSATION_PLAN: "prepare_questions",
    PreparationOutcome.INTERVIEW_REQUIREMENTS: "review_interview_format",
}

_UNIVERSAL_PROMPTS = (
    "What should the interviewer understand about your interest and relevant experience?",
    "Which concrete result or lesson best supports that message?",
)

_UNIVERSAL_QUESTIONS = (
    "What would success in this role look like during the first several months?",
    "What are the most important priorities or challenges for the person joining this team?",
)


def checklist_items_for(interview: Interview) -> tuple[InterviewChecklistItem, ...]:
    context = role_context_for(interview.job_title, interview.application_role_family)
    type_profile = INTERVIEW_TYPE_PROFILES[interview.interview_type]
    items: list[InterviewChecklistItem] = [*_UNIVERSAL_CHECKLIST]
    type_outcome = _TYPE_OUTCOMES[interview.interview_type]
    type_item = InterviewChecklistItem(
        _OUTCOME_ITEM_IDS[type_outcome] if type_outcome is not None else "review_interview_format",
        type_profile.checklist_label,
        type_profile.checklist_description,
        PreparationPhase.PREPARE,
        PreparationSource.INTERVIEW_TYPE,
        f"Suggested for {INTERVIEW_TYPE_LABELS[interview.interview_type]}",
        (
            PreparationCategory.ESSENTIAL
            if type_outcome is not None
            else PreparationCategory.ADDITIONAL
        ),
        type_outcome,
    )
    if type_outcome in {
        PreparationOutcome.OPPORTUNITY_UNDERSTANDING,
        PreparationOutcome.RELEVANT_EVIDENCE,
        PreparationOutcome.CONVERSATION_PLAN,
    }:
        items = [type_item if item.outcome_id is type_outcome else item for item in items]
    else:
        items.append(type_item)
    role_profile = ROLE_PROFILES.get(context.role_family)
    if role_profile is not None:
        items.append(
            InterviewChecklistItem(
                "review_role_topics",
                role_profile.checklist_label,
                role_profile.checklist_description,
                PreparationPhase.PREPARE,
                PreparationSource.ROLE_FAMILY,
                f"Suggested for {ROLE_FAMILY_LABELS[context.role_family]} roles",
                PreparationCategory.ADDITIONAL,
            )
        )
    items.extend(
        InterviewChecklistItem(
            custom.item_id,
            custom.label,
            "Added by you for this interview.",
            PreparationPhase.PREPARE,
            PreparationSource.CANDIDATE,
            "Added by you",
            PreparationCategory.CANDIDATE,
            None,
            True,
        )
        for custom in interview.custom_preparation_items
    )
    return tuple(items)


def checklist_ids_for(interview: Interview) -> frozenset[str]:
    return frozenset(item.item_id for item in checklist_items_for(interview))


def guidance_for(interview: Interview) -> InterviewGuidance:
    context = role_context_for(interview.job_title, interview.application_role_family)
    context_label = ROLE_FAMILY_LABELS[context.role_family]
    if context.source is RoleFamilySource.USER_SELECTED:
        explanation = f"Chosen by you for this application: {context_label}."
    elif context.source is RoleFamilySource.TITLE_INFERRED:
        explanation = f"Suggested from the job title; you can change the {context_label} focus."
    else:
        explanation = "The title was not specific enough, so HireFlux is using universal guidance."

    type_profile = INTERVIEW_TYPE_PROFILES[interview.interview_type]
    role_profile = ROLE_PROFILES.get(context.role_family)
    type_label = f"Suggested for {INTERVIEW_TYPE_LABELS[interview.interview_type]}"
    role_label = f"Suggested for {context_label} roles"

    prompts = [
        CuratedText(
            _UNIVERSAL_PROMPTS[0], PreparationSource.UNIVERSAL, "Useful for every interview"
        ),
        CuratedText(type_profile.prompts[0], PreparationSource.INTERVIEW_TYPE, type_label),
    ]
    if role_profile is None:
        prompts.extend(
            (
                CuratedText(
                    _UNIVERSAL_PROMPTS[1],
                    PreparationSource.UNIVERSAL,
                    "Useful for every interview",
                ),
                CuratedText(type_profile.prompts[1], PreparationSource.INTERVIEW_TYPE, type_label),
            )
        )
    else:
        prompts.extend(
            CuratedText(prompt, PreparationSource.ROLE_FAMILY, role_label)
            for prompt in role_profile.prompts
        )

    questions = [
        CuratedText(question, PreparationSource.UNIVERSAL, "Useful for every interview")
        for question in _UNIVERSAL_QUESTIONS
    ]
    questions.extend(
        CuratedText(question, PreparationSource.INTERVIEW_TYPE, type_label)
        for question in type_profile.questions
    )
    if role_profile is not None:
        questions.extend(
            CuratedText(question, PreparationSource.ROLE_FAMILY, role_label)
            for question in role_profile.questions
        )

    tips = [
        PreparationTip(
            "Build evidence, not a script",
            "Prepare enough context to explain what happened, what you personally did, "
            "and what changed.",
            PreparationSource.UNIVERSAL,
            "Useful for every interview",
        ),
        PreparationTip(
            type_profile.tip_title,
            type_profile.tip_body,
            PreparationSource.INTERVIEW_TYPE,
            type_label,
        ),
    ]
    if role_profile is not None:
        tips.append(
            PreparationTip(
                role_profile.tip_title,
                role_profile.tip_body,
                PreparationSource.ROLE_FAMILY,
                role_label,
            )
        )

    items = checklist_items_for(interview)
    completed_ids = _normalized_completion_ids(interview, items)
    items = tuple(replace(item, completed=item.item_id in completed_ids) for item in items)
    essential_items = tuple(
        item
        for item in items
        if item.category is PreparationCategory.ESSENTIAL and item.outcome_id is not None
    )
    outcomes = tuple(
        EssentialPreparationOutcome(
            outcome_id=cast(PreparationOutcome, item.outcome_id),
            label=_OUTCOME_LABELS[cast(PreparationOutcome, item.outcome_id)],
            description=item.description,
            completed=item.completed,
            action_item_id=item.item_id,
        )
        for item in essential_items
    )
    additional = tuple(item for item in items if item.category is PreparationCategory.ADDITIONAL)
    candidate = tuple(item for item in items if item.category is PreparationCategory.CANDIDATE)
    remaining = tuple(item.label for item in essential_items if not item.completed)
    return InterviewGuidance(
        role_context=PreparationRoleContext(
            role_family=context.role_family,
            role_family_label=context_label,
            source=context.source,
            explanation=explanation,
        ),
        checklist_items=items,
        focus_prompts=tuple(prompts[:4]),
        suggested_questions=tuple(_deduplicate(questions)[:6]),
        tips=tuple(tips[:3]),
        essential_outcomes=outcomes,
        progress=PreparationProgress(
            essentials=EssentialPreparationProgress(
                completed=sum(item.completed for item in essential_items),
                total=len(essential_items),
                complete=all(item.completed for item in essential_items),
                remaining_actions=remaining,
            ),
            additional=PreparationProgressGroup(
                completed=sum(item.completed for item in additional),
                total=len(additional),
            ),
            candidate=PreparationProgressGroup(
                completed=sum(item.completed for item in candidate),
                total=len(candidate),
            ),
        ),
    )


def _normalized_completion_ids(
    interview: Interview, items: tuple[InterviewChecklistItem, ...]
) -> frozenset[str]:
    current_ids = {item.item_id for item in items}
    completed = set(interview.completed_checklist_items).intersection(current_ids)
    if "review_interview_format" in interview.completed_checklist_items:
        type_outcome = _TYPE_OUTCOMES[interview.interview_type]
        if type_outcome is not None:
            completed.add(_OUTCOME_ITEM_IDS[type_outcome])
    return frozenset(completed)


def _deduplicate(values: list[CuratedText]) -> list[CuratedText]:
    seen: set[str] = set()
    result: list[CuratedText] = []
    for value in values:
        key = value.text.casefold()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result
