import csv
import io
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from time import monotonic

from hireflux_backend.application.errors import ForbiddenError, WorkspaceExportTooLargeError
from hireflux_backend.application.resource_services import WorkspaceResourceService
from hireflux_backend.application.services import ApplicationService, UserService
from hireflux_backend.application.workspace_safety import (
    WorkspaceSafetyRepository,
    require_active_workspace,
    require_complete_manifest,
    require_durable_workspace,
)
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity, UserProfile
from hireflux_backend.domain.resources import Interview, Note, WorkspaceSettings

ExportSizedRecord = Application | Activity | Note | Interview | UserProfile | WorkspaceSettings


@dataclass(frozen=True, slots=True)
class WorkspaceExport:
    exported_at: datetime
    profile: UserProfile
    settings: WorkspaceSettings
    applications: tuple[Application, ...]
    activities: tuple[Activity, ...]
    notes: tuple[Note, ...]
    interviews: tuple[Interview, ...]


_SPREADSHEET_FORMULA_PREFIXES = ("=", "+", "-", "@")


class WorkspaceExportService:
    """Build an owner-scoped, bounded export without exposing storage details."""

    def __init__(
        self,
        user_service: UserService,
        application_service: ApplicationService,
        resource_service: WorkspaceResourceService,
        *,
        max_records: int,
        inventory: WorkspaceSafetyRepository,
        record_size: Callable[[ExportSizedRecord], int],
        max_bytes: int = 4_000_000,
        max_seconds: float = 5,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self._users = user_service
        self._applications = application_service
        self._resources = resource_service
        self._max_records = max_records
        self._inventory = inventory
        self._record_size = record_size
        self._max_bytes = max_bytes
        self._max_seconds = max_seconds
        self._clock = clock

    def export(self, identity: CurrentIdentity) -> WorkspaceExport:
        if identity.is_demo:
            raise ForbiddenError(
                "Full account data export is unavailable for temporary demo workspaces."
            )
        workspace = require_durable_workspace(
            identity, self._inventory.get_workspace(identity.user_id)
        )
        require_active_workspace(workspace)
        require_complete_manifest(workspace)
        started = self._clock()
        records = 0
        byte_count = 512
        applications: list[Application] = []
        activities: list[Activity] = []
        notes: list[Note] = []
        interviews: list[Interview] = []

        def account(
            item: Application | Activity | Note | Interview | UserProfile | WorkspaceSettings,
        ) -> None:
            nonlocal records, byte_count
            if not isinstance(item, (UserProfile, WorkspaceSettings)):
                records += 1
                self._ensure_record_limit(records)
            # Account before accumulating; transport checks the exact final response too.
            byte_count += self._record_size(item) + 32
            self.validate_download(byte_count, self._clock() - started)

        profile = self._users.get_profile(identity)
        account(profile)
        settings = self._resources.get_settings(identity)
        account(settings)
        for item in self._inventory.export_records(
            identity.user_id, lambda: self.validate_download(byte_count, self._clock() - started)
        ):
            account(item)
            if isinstance(item, Application):
                applications.append(item)
            elif isinstance(item, Activity):
                activities.append(item)
            elif isinstance(item, Note):
                notes.append(item)
            elif isinstance(item, Interview):
                interviews.append(item)
        self.validate_download(byte_count, self._clock() - started)
        return WorkspaceExport(
            datetime.now(UTC),
            profile,
            settings,
            tuple(applications),
            tuple(activities),
            tuple(notes),
            tuple(interviews),
        )

    def validate_download(self, byte_count: int, elapsed_seconds: float) -> None:
        if byte_count > self._max_bytes or elapsed_seconds > self._max_seconds:
            raise WorkspaceExportTooLargeError(
                "This workspace exceeds synchronous export limits. No partial export was returned."
            )

    def export_applications_csv(self, identity: CurrentIdentity) -> str:
        """Build one owner-scoped, human-readable row per application."""
        started = self._clock()
        records = 0
        byte_count = 0
        output = io.StringIO(newline="")
        writer = csv.writer(output, lineterminator="\r\n")
        writer.writerow(
            (
                "Company",
                "Job Title",
                "Status",
                "Preparation Role Family",
                "Applied Date",
                "Source",
                "Source Detail",
                "Location",
                "Work Mode",
                "Follow-up Date",
                "Next-step Responsibility",
                "Next-step Note",
                "Job URL",
                "Salary",
                "Description",
                "Created At",
                "Updated At",
            )
        )
        for application in self._applications.list_all(identity):
            records += 1
            self._ensure_record_limit(records)
            before = output.tell()
            writer.writerow(
                (
                    neutralize_spreadsheet_formula(application.company_name),
                    neutralize_spreadsheet_formula(application.job_title),
                    application.status.value,
                    application.role_family.value if application.role_family else "Automatic",
                    application.applied_date.isoformat() if application.applied_date else "",
                    application.source.value if application.source else "",
                    neutralize_spreadsheet_formula(application.source_detail),
                    neutralize_spreadsheet_formula(application.location),
                    application.work_mode.value if application.work_mode else "",
                    application.follow_up_date.isoformat() if application.follow_up_date else "",
                    (
                        application.next_step_responsibility.value
                        if application.next_step_responsibility
                        else ""
                    ),
                    neutralize_spreadsheet_formula(application.next_step_note),
                    neutralize_spreadsheet_formula(application.job_url),
                    neutralize_spreadsheet_formula(application.salary_text),
                    neutralize_spreadsheet_formula(application.description),
                    _format_export_timestamp(application.created_at),
                    _format_export_timestamp(application.updated_at),
                )
            )
            end = output.tell()
            output.seek(before)
            byte_count += len(output.read().encode("utf-8"))
            output.seek(end)
            self.validate_download(byte_count, self._clock() - started)
        result = output.getvalue()
        self.validate_download(len(result.encode("utf-8")), self._clock() - started)
        return result

    def _ensure_record_limit(self, record_count: int) -> None:
        if record_count <= self._max_records:
            return
        raise WorkspaceExportTooLargeError(
            "This workspace is too large for synchronous export. "
            "A production-scale export will use an asynchronous downloadable artifact."
        )


def _format_export_timestamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def neutralize_spreadsheet_formula(value: str | None) -> str:
    """Preserve text while preventing spreadsheet formula interpretation."""
    if value is None:
        return ""
    if value.lstrip().startswith(_SPREADSHEET_FORMULA_PREFIXES):
        return f"'{value}"
    return value
