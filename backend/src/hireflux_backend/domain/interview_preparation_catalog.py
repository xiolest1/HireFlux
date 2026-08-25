from dataclasses import dataclass

from hireflux_backend.domain.enums import RoleFamily
from hireflux_backend.domain.resources import InterviewType


@dataclass(frozen=True, slots=True)
class PreparationProfile:
    checklist_label: str
    checklist_description: str
    prompts: tuple[str, str]
    questions: tuple[str, str]
    tip_title: str
    tip_body: str


INTERVIEW_TYPE_LABELS: dict[InterviewType, str] = {
    InterviewType.RECRUITER_CALL: "recruiter screens",
    InterviewType.TECHNICAL_SCREEN: "technical or skills screens",
    InterviewType.BEHAVIORAL: "behavioral interviews",
    InterviewType.CODING_ASSESSMENT: "skills assessments",
    InterviewType.HIRING_MANAGER: "hiring-manager conversations",
    InterviewType.ONSITE: "onsite or panel interviews",
    InterviewType.FINAL: "final interviews",
    InterviewType.OTHER: "this interview format",
}

INTERVIEW_TYPE_PROFILES: dict[InterviewType, PreparationProfile] = {
    InterviewType.RECRUITER_CALL: PreparationProfile(
        "Practice your concise career summary",
        "Connect your experience, interest, availability, and broad role expectations.",
        (
            "Why does this opportunity interest you now?",
            "Which experience establishes your fit most clearly?",
        ),
        (
            "How is the interview process structured from here?",
            "What would make someone especially successful in this position?",
        ),
        "For a recruiter screen",
        "Keep your summary concise and be ready to clarify availability and "
        "practical expectations.",
    ),
    InterviewType.TECHNICAL_SCREEN: PreparationProfile(
        "Review the skills being assessed",
        "Identify the relevant skills, examples, and reasoning you may need to explain.",
        (
            "Which role-relevant skill may need the clearest explanation?",
            "How will you explain your approach and how you checked your work?",
        ),
        (
            "Which capabilities matter most in this stage?",
            "How will the discussion or assessment be evaluated?",
        ),
        "For a skills screen",
        "Confirm what is being assessed and prepare to explain your process, not only the outcome.",
    ),
    InterviewType.BEHAVIORAL: PreparationProfile(
        "Prepare a range of behavioral examples",
        "Cover collaboration, conflict, ownership, adaptability, and learning.",
        (
            "Which example best shows ownership?",
            "What changed because of your actions, and what did you learn?",
        ),
        (
            "What behaviors distinguish strong performers here?",
            "How is feedback usually shared and acted on?",
        ),
        "For behavioral interviews",
        "Use specific examples with enough context to distinguish your actions "
        "from the team's work.",
    ),
    InterviewType.CODING_ASSESSMENT: PreparationProfile(
        "Confirm the assessment environment",
        "Check the format, tools, permitted resources, time limit, and expected communication.",
        (
            "What will you clarify before beginning?",
            "How will you check edge cases and communicate uncertainty?",
        ),
        (
            "What should I prioritize during the exercise?",
            "May I state assumptions and ask clarifying questions as I work?",
        ),
        "For a timed assessment",
        "Test the required tools beforehand and reserve time to review your work.",
    ),
    InterviewType.HIRING_MANAGER: PreparationProfile(
        "Connect your experience to the manager's needs",
        "Prepare relevant accomplishments, working preferences, and questions about the team.",
        (
            "What problems would this manager expect you to own?",
            "How have you delivered useful results in an unfamiliar setting?",
        ),
        (
            "What should this person accomplish in the first 90 days?",
            "How do you support growth and give feedback?",
        ),
        "For a hiring-manager conversation",
        "Connect each example to the role's likely responsibilities and the support "
        "you need to succeed.",
    ),
    InterviewType.ONSITE: PreparationProfile(
        "Map the interview schedule",
        "Note each conversation's likely perspective so your examples remain varied.",
        (
            "Which examples fit each interviewer or topic?",
            "How will you maintain context and energy across the schedule?",
        ),
        (
            "How do the groups represented today work together?",
            "What challenge is the team actively trying to improve?",
        ),
        "For a panel or onsite",
        "Expect repeated themes, but adapt the level of detail to each interviewer's perspective.",
    ),
    InterviewType.FINAL: PreparationProfile(
        "Clarify your remaining decision criteria",
        "Review motivation, major accomplishments, expectations, and unresolved questions.",
        (
            "What should the final decision-makers understand about your fit?",
            "What remaining information do you need to evaluate the opportunity?",
        ),
        (
            "How will success be evaluated after six months?",
            "What unresolved priority should the successful candidate be ready to address?",
        ),
        "For a final interview",
        "Revisit the strongest evidence of fit while making room for your own remaining questions.",
    ),
    InterviewType.OTHER: PreparationProfile(
        "Define the purpose of this conversation",
        "Write what you want the interviewer to understand and what you need to learn.",
        (
            "What should the other person understand by the end?",
            "What evidence will help you communicate that clearly?",
        ),
        (
            "What outcome would make this conversation useful?",
            "What is the most important next step after this conversation?",
        ),
        "For this conversation",
        "Confirm the format and decide what you want to communicate and learn.",
    ),
}


def _profile(
    checklist: tuple[str, str],
    prompts: tuple[str, str],
    questions: tuple[str, str],
    tip: tuple[str, str],
) -> PreparationProfile:
    return PreparationProfile(*checklist, prompts, questions, *tip)


ROLE_PROFILES: dict[RoleFamily, PreparationProfile] = {
    RoleFamily.SOFTWARE_IT: _profile(
        (
            "Review technical evidence",
            "Choose a project, debugging example, or technical decision and explain its tradeoffs.",
        ),
        (
            "Which technical decision best demonstrates your reasoning?",
            "How did you validate a solution or respond when the first approach failed?",
        ),
        (
            "How does the team make technical decisions and tradeoffs?",
            "How are reliability, delivery, and technical growth supported?",
        ),
        (
            "For Software / IT roles",
            "Consider one example that shows both technical judgment and collaboration.",
        ),
    ),
    RoleFamily.CUSTOMER_SERVICE: _profile(
        (
            "Prepare a service-recovery example",
            "Choose a time you clarified a concern, de-escalated tension, or improved "
            "a customer's experience.",
        ),
        (
            "How have you handled a difficult customer interaction?",
            "How do you prioritize when several customers need help?",
        ),
        (
            "How does the team define excellent customer service?",
            "What support is available for complex or escalated situations?",
        ),
        (
            "For customer-facing roles",
            "Consider an example where listening and clear follow-through improved the outcome.",
        ),
    ),
    RoleFamily.SALES: _profile(
        (
            "Prepare a sales-results example",
            "Choose evidence of prospecting, relationship building, objection handling, "
            "or target ownership.",
        ),
        (
            "How have you moved a difficult opportunity forward?",
            "How do you organize pipeline work and learn from lost opportunities?",
        ),
        (
            "How is success measured during the first six months?",
            "What does the current sales process and support structure look like?",
        ),
        (
            "For sales roles",
            "Be ready to explain both the result and the repeatable process behind it.",
        ),
    ),
    RoleFamily.MARKETING_COMMUNICATIONS: _profile(
        (
            "Prepare a campaign or communication example",
            "Choose work that connects audience insight, execution, and a measurable outcome.",
        ),
        (
            "How did audience insight change your approach?",
            "How have you balanced brand, stakeholder, and performance needs?",
        ),
        (
            "Which audiences or business priorities matter most right now?",
            "How are marketing decisions evaluated across the team?",
        ),
        (
            "For marketing roles",
            "Choose an example that explains your reasoning as clearly as the finished "
            "deliverable.",
        ),
    ),
    RoleFamily.FINANCE_ACCOUNTING: _profile(
        (
            "Review an accuracy and judgment example",
            "Prepare evidence of analysis, controls, reconciliation, reporting, or "
            "responsible decision-making.",
        ),
        (
            "How have you found and resolved a material discrepancy?",
            "How do you communicate financial information to non-specialists?",
        ),
        (
            "Which financial priorities or reporting challenges are most important?",
            "How does the team balance accuracy, timeliness, and business support?",
        ),
        (
            "For finance roles",
            "Consider how you checked your work and communicated risk or uncertainty.",
        ),
    ),
    RoleFamily.HUMAN_RESOURCES: _profile(
        (
            "Prepare a people-practice example",
            "Choose evidence of trusted communication, fair process, recruiting, "
            "development, or sensitive problem-solving.",
        ),
        (
            "How have you handled a sensitive people issue responsibly?",
            "How do you build trust while applying policy consistently?",
        ),
        (
            "What people priorities need the most attention?",
            "How does HR partner with managers and employees here?",
        ),
        (
            "For Human Resources roles",
            "Protect confidentiality when describing examples; focus on your process and judgment.",
        ),
    ),
    RoleFamily.ADMINISTRATIVE: _profile(
        (
            "Prepare an organization example",
            "Choose a time you coordinated competing priorities, protected accuracy, "
            "or improved an office process.",
        ),
        (
            "How do you prioritize requests from several people?",
            "What system helps you prevent details from being missed?",
        ),
        (
            "Which responsibilities require the most judgment in this role?",
            "What tools and working relationships are central to the position?",
        ),
        (
            "For administrative roles",
            "Use an example that shows reliability, discretion, and proactive communication.",
        ),
    ),
    RoleFamily.PROJECT_PROGRAM_MANAGEMENT: _profile(
        (
            "Prepare a delivery example",
            "Choose a project that shows planning, stakeholder alignment, risk management, "
            "and adaptation.",
        ),
        (
            "How have you recovered a project that was at risk?",
            "How do you make ownership and tradeoffs visible to stakeholders?",
        ),
        (
            "Which programs or delivery risks need attention first?",
            "How are priorities and decisions governed across stakeholders?",
        ),
        (
            "For project roles",
            "Explain how your coordination changed the outcome, not only the timeline "
            "you maintained.",
        ),
    ),
    RoleFamily.OPERATIONS_LOGISTICS: _profile(
        (
            "Prepare an operational-improvement example",
            "Choose evidence involving flow, reliability, capacity, inventory, handoffs, "
            "or service levels.",
        ),
        (
            "How have you found and removed an operational bottleneck?",
            "How do you respond when priorities or capacity change quickly?",
        ),
        (
            "What are the biggest operational priorities for this team?",
            "Which service, quality, or efficiency measures matter most?",
        ),
        (
            "For operations roles",
            "Describe the process before and after your action, including the practical result.",
        ),
    ),
    RoleFamily.MANUFACTURING_SKILLED_TRADES: _profile(
        (
            "Prepare a safety and quality example",
            "Choose evidence of safe work, process adherence, troubleshooting, quality, "
            "or equipment care.",
        ),
        (
            "How have you addressed a safety, quality, or equipment concern?",
            "How do you balance pace with process and workmanship?",
        ),
        (
            "What safety and quality expectations are most important here?",
            "What training, equipment, and shift support are provided?",
        ),
        (
            "For manufacturing and trade roles",
            "Use a concrete example that shows safe judgment as well as the result.",
        ),
    ),
    RoleFamily.HOSPITALITY_FOOD_SERVICE: _profile(
        (
            "Prepare a guest-experience example",
            "Choose a time you handled a rush, recovered a service issue, or supported "
            "the team under pressure.",
        ),
        (
            "How have you handled several guest needs during a busy period?",
            "What did you do when a guest experience was going poorly?",
        ),
        (
            "What does a successful first month look like?",
            "How does the team coordinate during peak service periods?",
        ),
        (
            "For hospitality roles",
            "Consider an example showing composure, teamwork, and attention to the guest.",
        ),
    ),
    RoleFamily.HEALTHCARE: _profile(
        (
            "Prepare a care and communication example",
            "Choose evidence of safe practice, empathy, teamwork, prioritization, or "
            "responsible escalation.",
        ),
        (
            "How have you protected safety while managing competing needs?",
            "How do you communicate clearly with patients, families, or colleagues?",
        ),
        (
            "What patient-care priorities and team challenges are most important?",
            "How are orientation, supervision, and escalation handled?",
        ),
        (
            "For healthcare roles",
            "Protect patient privacy and focus examples on your judgment, communication, "
            "and actions.",
        ),
    ),
    RoleFamily.EDUCATION: _profile(
        (
            "Prepare a learning-impact example",
            "Choose evidence involving instruction, support, inclusion, classroom decisions, "
            "or learner progress.",
        ),
        (
            "How have you adapted when a learner or group needed a different approach?",
            "How do you build trust while maintaining clear expectations?",
        ),
        (
            "What outcomes and learner needs are most important this year?",
            "How do educators collaborate and receive support here?",
        ),
        (
            "For education roles",
            "Choose an example that connects your approach to a learner or community outcome.",
        ),
    ),
    RoleFamily.MANAGEMENT_LEADERSHIP: _profile(
        (
            "Prepare a leadership-impact example",
            "Choose evidence of delegation, accountability, conflict resolution, team "
            "development, or execution.",
        ),
        (
            "How have you raised performance while maintaining trust?",
            "How do you make decisions when priorities or evidence conflict?",
        ),
        (
            "What are the biggest challenges this leader needs to solve?",
            "How are authority, accountability, and team development structured?",
        ),
        (
            "For leadership roles",
            "Explain the environment you created for others, not only the result you "
            "personally delivered.",
        ),
    ),
    RoleFamily.EXECUTIVE: _profile(
        (
            "Prepare an enterprise-impact narrative",
            "Connect strategy, financial or mission impact, transformation, and "
            "stakeholder alignment.",
        ),
        (
            "Which enterprise decision best demonstrates your leadership philosophy?",
            "How have you aligned a board, executive team, or major stakeholders through change?",
        ),
        (
            "What outcomes define success over the next 12 to 18 months?",
            "Which strategic, financial, or organizational constraints will shape the mandate?",
        ),
        (
            "For executive roles",
            "Frame examples around enterprise outcomes, tradeoffs, stakeholder alignment, "
            "and what you would learn first.",
        ),
    ),
}
