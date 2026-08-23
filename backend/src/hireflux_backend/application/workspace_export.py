import csv
import io
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TypeVar

from hireflux_backend.application.errors import ForbiddenError, WorkspaceExportTooLargeError
from hireflux_backend.application.resource_ports import ResourcePage
from hireflux_backend.application.resource_services import WorkspaceResourceService
from hireflux_backend.application.services import ApplicationService, UserService
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity, UserProfile
from hireflux_backend.domain.resources import Interview, Note, WorkspaceSettings


@dataclass(frozen=True, slots=True)
class WorkspaceExport:
    exported_at: datetime
    profile: UserProfile
    settings: WorkspaceSettings
    applications: tuple[Application, ...]
    activities: tuple[Activity, ...]
    notes: tuple[Note, ...]
    interviews: tuple[Interview, ...]


ResourceT = TypeVar("ResourceT")


class WorkspaceExportService:
    """Build an owner-scoped, bounded export without exposing storage details."""

    _PAGE_SIZE = 100

    def __init__(
        self,
        user_service: UserService,
        application_service: ApplicationService,
        resource_service: WorkspaceResourceService,
        *,
        max_records: int,
    ) -> None:
        self._users = user_service
        self._applications = application_service
        self._resources = resource_service
        self._max_records = max_records

    def export(self, identity: CurrentIdentity) -> WorkspaceExport:
        if identity.is_demo:
            raise ForbiddenError(
                "Full account data export is unavailable for temporary demo workspaces."
            )
        applications = self._applications.list_all(identity)
        record_count = len(applications)
        self._ensure_record_limit(record_count)
        activities: list[Activity] = []
        notes: list[Note] = []
        interviews: list[Interview] = []
        for application in applications:
            application_activities = self._all_activity(identity, application.application_id)
            record_count += len(application_activities)
            self._ensure_record_limit(record_count)
            activities.extend(application_activities)

            application_notes = self._all_notes(identity, application.application_id)
            record_count += len(application_notes)
            self._ensure_record_limit(record_count)
            notes.extend(application_notes)

            application_interviews = self._all_interviews(identity, application.application_id)
            record_count += len(application_interviews)
            self._ensure_record_limit(record_count)
            interviews.extend(application_interviews)

        return WorkspaceExport(
            exported_at=datetime.now(UTC),
            profile=self._users.get_or_create_profile(identity),
            settings=self._resources.get_settings(identity),
            applications=applications,
            activities=tuple(activities),
            notes=tuple(notes),
            interviews=tuple(interviews),
        )

    def export_applications_csv(self, identity: CurrentIdentity) -> str:
        """Build one owner-scoped, human-readable row per application."""
        output = io.StringIO(newline="")
        writer = csv.writer(output, lineterminator="\r\n")
        writer.writerow(
            (
                "Company",
                "Job Title",
                "Status",
                "Applied Date",
                "Source",
                "Source Detail",
                "Location",
                "Work Mode",
                "Follow-up Date",
                "Job URL",
                "Salary",
                "Description",
                "Created At",
                "Updated At",
            )
        )
        for application in self._applications.list_all(identity):
            writer.writerow(
                (
                    application.company_name,
                    application.job_title,
                    application.status.value,
                    application.applied_date.isoformat() if application.applied_date else "",
                    application.source.value if application.source else "",
                    application.source_detail or "",
                    application.location or "",
                    application.work_mode.value if application.work_mode else "",
                    application.follow_up_date.isoformat() if application.follow_up_date else "",
                    application.job_url or "",
                    application.salary_text or "",
                    application.description or "",
                    _format_export_timestamp(application.created_at),
                    _format_export_timestamp(application.updated_at),
                )
            )
        return output.getvalue()

    def _ensure_record_limit(self, record_count: int) -> None:
        if record_count <= self._max_records:
            return
        raise WorkspaceExportTooLargeError(
            "This workspace is too large for synchronous JSON export. "
            "A production-scale export will use an asynchronous downloadable artifact."
        )

    def _all_activity(self, identity: CurrentIdentity, application_id: str) -> tuple[Activity, ...]:
        items: list[Activity] = []
        cursor: str | None = None
        while True:
            page = self._applications.list_activity(
                identity, application_id, limit=self._PAGE_SIZE, cursor=cursor
            )
            items.extend(page.items)
            if page.next_cursor is None:
                return tuple(items)
            cursor = page.next_cursor

    def _all_notes(self, identity: CurrentIdentity, application_id: str) -> tuple[Note, ...]:
        return tuple(
            self._all_resource_pages(
                lambda cursor: self._resources.list_notes(
                    identity, application_id, limit=self._PAGE_SIZE, cursor=cursor
                )
            )
        )

    def _all_interviews(
        self, identity: CurrentIdentity, application_id: str
    ) -> tuple[Interview, ...]:
        return tuple(
            self._all_resource_pages(
                lambda cursor: self._resources.list_interviews(
                    identity, application_id, limit=self._PAGE_SIZE, cursor=cursor
                )
            )
        )

    @staticmethod
    def _all_resource_pages(
        fetch: Callable[[str | None], ResourcePage[ResourceT]],
    ) -> list[ResourceT]:
        items: list[ResourceT] = []
        cursor: str | None = None
        while True:
            page = fetch(cursor)
            items.extend(page.items)
            if page.next_cursor is None:
                return items
            cursor = page.next_cursor


def _format_export_timestamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
