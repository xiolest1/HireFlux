from dataclasses import dataclass
from enum import StrEnum

from hireflux_backend.domain.enums import RoleFamily
from hireflux_backend.domain.interview_preparation_catalog import (
    INTERVIEW_TYPE_LABELS,
    INTERVIEW_TYPE_PROFILES,
    ROLE_PROFILES,
)
from hireflux_backend.domain.resources import Interview
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


@dataclass(frozen=True, slots=True)
class InterviewChecklistItem:
    item_id: str
    label: str
    description: str
    phase: PreparationPhase
    source: PreparationSource
    source_label: str
    removable: bool = False


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
    completed_steps: int
    total_steps: int
    ready_for_interview: bool
    missing_actions: tuple[str, ...]


_UNIVERSAL_CHECKLIST = (
    InterviewChecklistItem(
        "research_company",
        "Review the company and role",
        "Understand what the organization does, the role's responsibilities, "
        "and why it interests you.",
        PreparationPhase.UNDERSTAND,
        PreparationSource.UNIVERSAL,
        "Useful for every interview",
    ),
    InterviewChecklistItem(
        "prepare_examples",
        "Prepare two evidence stories",
        "Choose situations where your actions solved a problem, helped someone, "
        "improved work, or demonstrated a relevant skill.",
        PreparationPhase.PREPARE,
        PreparationSource.UNIVERSAL,
        "Useful for every interview",
    ),
    InterviewChecklistItem(
        "prepare_questions",
        "Write candidate questions",
        "Prepare at least two questions that help you evaluate the responsibilities, "
        "expectations, team, and environment.",
        PreparationPhase.PREPARE,
        PreparationSource.UNIVERSAL,
        "Useful for every interview",
    ),
    InterviewChecklistItem(
        "confirm_logistics",
        "Confirm interview logistics",
        "Verify the date, time, time zone, format, location or link, duration, "
        "and required materials.",
        PreparationPhase.CONFIRM,
        PreparationSource.UNIVERSAL,
        "Useful for every interview",
    ),
)

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
    items.append(
        InterviewChecklistItem(
            "review_interview_format",
            type_profile.checklist_label,
            type_profile.checklist_description,
            PreparationPhase.PREPARE,
            PreparationSource.INTERVIEW_TYPE,
            f"Suggested for {INTERVIEW_TYPE_LABELS[interview.interview_type]}",
        )
    )
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
    valid_ids = {item.item_id for item in items}
    completed = valid_ids.intersection(interview.completed_checklist_items)
    missing = tuple(item.label for item in items if item.item_id not in completed)
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
        completed_steps=len(completed),
        total_steps=len(items),
        ready_for_interview=len(completed) == len(items),
        missing_actions=missing,
    )


def _deduplicate(values: list[CuratedText]) -> list[CuratedText]:
    seen: set[str] = set()
    result: list[CuratedText] = []
    for value in values:
        key = value.text.casefold()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result
