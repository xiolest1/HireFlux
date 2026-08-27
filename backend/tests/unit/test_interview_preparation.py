from dataclasses import replace
from datetime import UTC, datetime

import pytest

from hireflux_backend.domain.enums import RoleFamily
from hireflux_backend.domain.interview_guidance import (
    PreparationCategory,
    PreparationOutcome,
    guidance_for,
)
from hireflux_backend.domain.resources import (
    CustomPreparationItem,
    Interview,
    InterviewStatus,
    InterviewType,
)
from hireflux_backend.domain.role_context import RoleFamilySource, role_context_for


def interview(
    title: str,
    interview_type: InterviewType = InterviewType.BEHAVIORAL,
    *,
    role_family: RoleFamily | None = None,
) -> Interview:
    now = datetime(2026, 8, 25, 15, tzinfo=UTC)
    return Interview(
        interview_id="44444444-4444-4444-8444-444444444444",
        application_id="11111111-1111-4111-8111-111111111111",
        owner_user_id="owner",
        company_name="Example",
        job_title=title,
        interview_type=interview_type,
        status=InterviewStatus.SCHEDULED,
        scheduled_at=now,
        duration_minutes=45,
        location=None,
        meeting_url=None,
        details=None,
        preparation_notes=None,
        completed_checklist_items=(),
        candidate_questions=(),
        debrief_went_well=None,
        debrief_improve=None,
        debrief_signals=None,
        debrief_next_step=None,
        debrief_completed_at=None,
        created_at=now,
        updated_at=now,
        version=1,
        application_role_family=role_family,
    )


@pytest.mark.parametrize(
    ("title", "expected", "expected_text"),
    (
        ("Cloud Engineer", RoleFamily.SOFTWARE_IT, "technical decision"),
        ("Restaurant Server", RoleFamily.HOSPITALITY_FOOD_SERVICE, "guest"),
        ("Customer Service Representative", RoleFamily.CUSTOMER_SERVICE, "customer"),
        ("Manufacturing Technician", RoleFamily.MANUFACTURING_SKILLED_TRADES, "safety"),
        ("Sales Representative", RoleFamily.SALES, "sales"),
        ("Marketing Manager", RoleFamily.MARKETING_COMMUNICATIONS, "audience"),
        ("Chief Executive Officer", RoleFamily.EXECUTIVE, "enterprise"),
    ),
)
def test_role_guidance_is_specific_without_cross_career_leakage(
    title: str,
    expected: RoleFamily,
    expected_text: str,
) -> None:
    guidance = guidance_for(interview(title))
    rendered = " ".join(
        [
            *(item.label + " " + item.description for item in guidance.checklist_items),
            *(item.text for item in guidance.focus_prompts),
            *(item.text for item in guidance.suggested_questions),
        ]
    ).casefold()

    assert guidance.role_context.role_family is expected
    assert guidance.role_context.source is RoleFamilySource.TITLE_INFERRED
    assert expected_text in rendered
    if expected is not RoleFamily.SOFTWARE_IT:
        assert "architecture" not in rendered
        assert "debugging" not in rendered


@pytest.mark.parametrize("title", ("Engineer", "Manager", "Sales Engineer", "Custom Role 42"))
def test_ambiguous_titles_use_universal_fallback(title: str) -> None:
    guidance = guidance_for(interview(title, InterviewType.RECRUITER_CALL))
    rendered = " ".join(item.text for item in guidance.suggested_questions).casefold()

    assert guidance.role_context.role_family is RoleFamily.GENERAL
    assert guidance.role_context.source is RoleFamilySource.UNIVERSAL_FALLBACK
    assert "technical" not in rendered
    assert len(guidance.checklist_items) == 3
    assert all(item.category is PreparationCategory.ESSENTIAL for item in guidance.checklist_items)
    assert guidance.progress.essentials.total == 3


def test_candidate_override_is_authoritative_including_general() -> None:
    selected = role_context_for("Cloud Engineer", RoleFamily.HOSPITALITY_FOOD_SERVICE)
    general = guidance_for(interview("Cloud Engineer", role_family=RoleFamily.GENERAL))

    assert selected.role_family is RoleFamily.HOSPITALITY_FOOD_SERVICE
    assert selected.source is RoleFamilySource.USER_SELECTED
    assert general.role_context.role_family is RoleFamily.GENERAL
    assert all(
        item.source_label != "Suggested for Software / IT roles" for item in general.checklist_items
    )


def test_role_and_interview_type_combine_deterministically() -> None:
    recruiter = guidance_for(interview("Cloud Engineer", InterviewType.RECRUITER_CALL))
    skills = guidance_for(interview("Cloud Engineer", InterviewType.TECHNICAL_SCREEN))

    assert recruiter.focus_prompts != skills.focus_prompts
    recruiter_evidence = next(
        item
        for item in recruiter.checklist_items
        if item.outcome_id is PreparationOutcome.RELEVANT_EVIDENCE
    )
    skills_evidence = next(
        item
        for item in skills.checklist_items
        if item.outcome_id is PreparationOutcome.RELEVANT_EVIDENCE
    )
    assert recruiter_evidence.label == "Practice your concise career summary"
    assert skills_evidence.label == "Review the skills being assessed"
    assert recruiter.progress.essentials.total == skills.progress.essentials.total == 3


def test_essential_completion_is_independent_of_additional_and_candidate_work() -> None:
    current = replace(
        interview("Customer Service Representative"),
        custom_preparation_items=(
            CustomPreparationItem(
                item_id="55555555-5555-4555-8555-555555555555",
                label="Bring availability notes",
            ),
        ),
    )
    initial = guidance_for(current)
    essential_ids = tuple(
        item.item_id
        for item in initial.checklist_items
        if item.category is PreparationCategory.ESSENTIAL
    )
    complete = guidance_for(replace(current, completed_checklist_items=essential_ids))
    stale = guidance_for(
        replace(current, completed_checklist_items=(*essential_ids, "stale-hidden-id"))
    )

    assert complete.progress.essentials.complete
    assert complete.progress.essentials.completed == complete.progress.essentials.total == 3
    assert complete.progress.additional.completed == 0
    assert complete.progress.candidate.completed == 0
    assert complete.progress.candidate.total == 1
    assert stale.progress == complete.progress
