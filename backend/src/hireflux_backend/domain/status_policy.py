from dataclasses import dataclass
from datetime import date

from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Application


class StatusPolicyError(ValueError):
    """Raised when a requested application status violates the workflow."""


ACTIVE_STATUSES_REQUIRING_APPLIED_DATE = frozenset(
    {
        ApplicationStatus.APPLIED,
        ApplicationStatus.SCREENING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    }
)

_ALLOWED: dict[ApplicationStatus, frozenset[ApplicationStatus]] = {
    ApplicationStatus.DRAFT: frozenset({ApplicationStatus.APPLIED, ApplicationStatus.ARCHIVED}),
    ApplicationStatus.APPLIED: frozenset(
        {
            ApplicationStatus.SCREENING,
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.OFFER,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
            ApplicationStatus.ARCHIVED,
        }
    ),
    ApplicationStatus.SCREENING: frozenset(
        {
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.OFFER,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
            ApplicationStatus.ARCHIVED,
        }
    ),
    ApplicationStatus.INTERVIEW: frozenset(
        {
            ApplicationStatus.OFFER,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
            ApplicationStatus.ARCHIVED,
        }
    ),
    ApplicationStatus.OFFER: frozenset(
        {
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
            ApplicationStatus.ARCHIVED,
        }
    ),
    ApplicationStatus.ACCEPTED: frozenset({ApplicationStatus.ARCHIVED}),
    ApplicationStatus.REJECTED: frozenset({ApplicationStatus.OFFER, ApplicationStatus.ARCHIVED}),
    ApplicationStatus.WITHDRAWN: frozenset({ApplicationStatus.ARCHIVED}),
    ApplicationStatus.ARCHIVED: frozenset(),
}


@dataclass(frozen=True, slots=True)
class TransitionDecision:
    changed: bool
    status: ApplicationStatus
    applied_date: date | None
    archived_from_status: ApplicationStatus | None


def validate_initial_status(status: ApplicationStatus, applied_date: date | None) -> None:
    if status not in {ApplicationStatus.DRAFT, ApplicationStatus.APPLIED}:
        raise StatusPolicyError("Applications can only be created as DRAFT or APPLIED.")
    if status is ApplicationStatus.APPLIED and applied_date is None:
        raise StatusPolicyError("applied_date is required when creating an APPLIED application.")


def validate_applied_date(applied_date: date | None, *, today: date) -> None:
    if applied_date is not None and applied_date > today:
        raise StatusPolicyError("applied_date cannot be in the future.")


def allowed_transitions(application: Application) -> tuple[ApplicationStatus, ...]:
    if application.status is ApplicationStatus.ARCHIVED:
        if application.archived_from_status is None:
            return ()
        return (application.archived_from_status,)
    return tuple(sorted(_ALLOWED[application.status], key=lambda status: status.value))


def decide_transition(
    application: Application,
    target: ApplicationStatus,
    supplied_applied_date: date | None = None,
) -> TransitionDecision:
    current = application.status
    if target is current:
        return TransitionDecision(
            changed=False,
            status=current,
            applied_date=application.applied_date,
            archived_from_status=application.archived_from_status,
        )

    if current is ApplicationStatus.ARCHIVED:
        if target is not application.archived_from_status:
            raise StatusPolicyError(
                "An archived application can only be restored to its previous status."
            )
        archived_from_status = None
    else:
        if target not in _ALLOWED[current]:
            raise StatusPolicyError(
                f"Transition from {current.value} to {target.value} is forbidden."
            )
        archived_from_status = current if target is ApplicationStatus.ARCHIVED else None

    applied_date = application.applied_date or supplied_applied_date
    if target in ACTIVE_STATUSES_REQUIRING_APPLIED_DATE and applied_date is None:
        raise StatusPolicyError("applied_date is required before entering this status.")

    return TransitionDecision(
        changed=True,
        status=target,
        applied_date=applied_date,
        archived_from_status=archived_from_status,
    )
