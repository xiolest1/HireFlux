import re
from dataclasses import dataclass
from enum import StrEnum

from hireflux_backend.domain.enums import RoleFamily


class RoleFamilySource(StrEnum):
    USER_SELECTED = "USER_SELECTED"
    TITLE_INFERRED = "TITLE_INFERRED"
    UNIVERSAL_FALLBACK = "UNIVERSAL_FALLBACK"


@dataclass(frozen=True, slots=True)
class RoleContext:
    role_family: RoleFamily
    source: RoleFamilySource


ROLE_FAMILY_LABELS: dict[RoleFamily, str] = {
    RoleFamily.GENERAL: "General",
    RoleFamily.SOFTWARE_IT: "Software / IT",
    RoleFamily.CUSTOMER_SERVICE: "Customer Service",
    RoleFamily.SALES: "Sales",
    RoleFamily.MARKETING_COMMUNICATIONS: "Marketing / Communications",
    RoleFamily.FINANCE_ACCOUNTING: "Finance / Accounting",
    RoleFamily.HUMAN_RESOURCES: "Human Resources",
    RoleFamily.ADMINISTRATIVE: "Administrative",
    RoleFamily.PROJECT_PROGRAM_MANAGEMENT: "Project / Program Management",
    RoleFamily.OPERATIONS_LOGISTICS: "Operations / Logistics",
    RoleFamily.MANUFACTURING_SKILLED_TRADES: "Manufacturing / Skilled Trades",
    RoleFamily.HOSPITALITY_FOOD_SERVICE: "Hospitality / Food Service",
    RoleFamily.HEALTHCARE: "Healthcare",
    RoleFamily.EDUCATION: "Education",
    RoleFamily.MANAGEMENT_LEADERSHIP: "Management / Leadership",
    RoleFamily.EXECUTIVE: "Executive",
}

# Strong phrases only. A title must match exactly one family; conflicting or generic
# titles deliberately receive universal preparation instead of a confident guess.
_TITLE_SIGNALS: dict[RoleFamily, tuple[str, ...]] = {
    RoleFamily.EXECUTIVE: (
        r"\bchief (executive|financial|operating|marketing|people|technology|"
        r"information) officer\b",
        r"\bceo\b|\bcfo\b|\bcoo\b|\bcmo\b|\bchro\b|\bcto\b|\bcio\b",
    ),
    RoleFamily.SOFTWARE_IT: (
        r"\b(software|cloud|devops|data|security|frontend|backend|full[ -]?stack|"
        r"platform|machine learning) engineer\b",
        r"\b(database administrator|systems administrator|network administrator|"
        r"software developer|web developer)\b",
    ),
    RoleFamily.CUSTOMER_SERVICE: (
        r"\b(customer service|customer support|guest support|call center|contact center)\b",
    ),
    RoleFamily.SALES: (
        r"\b(sales representative|account executive|sales associate|business development)\b",
    ),
    RoleFamily.MARKETING_COMMUNICATIONS: (
        r"\b(marketing|communications|public relations|content strategist|"
        r"brand manager|copywriter)\b",
    ),
    RoleFamily.FINANCE_ACCOUNTING: (
        r"\b(accountant|accounting|financial analyst|bookkeeper|controller|auditor|"
        r"payroll specialist)\b",
    ),
    RoleFamily.HUMAN_RESOURCES: (
        r"\b(human resources|people operations|talent acquisition|recruiter|hr specialist)\b",
    ),
    RoleFamily.ADMINISTRATIVE: (
        r"\b(administrative assistant|executive assistant|office coordinator|"
        r"receptionist|office administrator)\b",
    ),
    RoleFamily.PROJECT_PROGRAM_MANAGEMENT: (
        r"\b(project manager|program manager|project coordinator|scrum master)\b",
    ),
    RoleFamily.OPERATIONS_LOGISTICS: (
        r"\b(operations analyst|operations coordinator|logistics|warehouse|"
        r"supply chain|dispatcher|inventory)\b",
    ),
    RoleFamily.MANUFACTURING_SKILLED_TRADES: (
        r"\b(manufacturing|production technician|maintenance technician|machinist|"
        r"welder|electrician|plumber|mechanic)\b",
    ),
    RoleFamily.HOSPITALITY_FOOD_SERVICE: (
        r"\b(restaurant server|food server|bartender|barista|line cook|chef|hostess?|"
        r"hotel|hospitality)\b",
    ),
    RoleFamily.HEALTHCARE: (
        r"\b(nurse|medical assistant|physician|therapist|pharmacist|patient care|clinical)\b",
    ),
    RoleFamily.EDUCATION: (
        r"\b(teacher|educator|school counselor|instructional|professor|teaching assistant)\b",
    ),
    RoleFamily.MANAGEMENT_LEADERSHIP: (
        r"\b(general manager|regional manager|department manager|team lead|people manager)\b",
    ),
}


def role_context_for(job_title: str, selected: RoleFamily | None) -> RoleContext:
    if selected is not None:
        return RoleContext(selected, RoleFamilySource.USER_SELECTED)
    normalized = " ".join(job_title.casefold().split())
    matches = {
        family
        for family, patterns in _TITLE_SIGNALS.items()
        if any(re.search(pattern, normalized) for pattern in patterns)
    }
    if len(matches) == 1:
        return RoleContext(matches.pop(), RoleFamilySource.TITLE_INFERRED)
    return RoleContext(RoleFamily.GENERAL, RoleFamilySource.UNIVERSAL_FALLBACK)
