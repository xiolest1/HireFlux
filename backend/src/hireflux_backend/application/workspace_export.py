from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TypeVar

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
    ) -> None:
        self._users = user_service
        self._applications = application_service
        self._resources = resource_service

    def export(self, identity: CurrentIdentity) -> WorkspaceExport:
        applications = self._applications.list_all(identity)
        activities: list[Activity] = []
        notes: list[Note] = []
        interviews: list[Interview] = []
        for application in applications:
            activities.extend(self._all_activity(identity, application.application_id))
            notes.extend(self._all_notes(identity, application.application_id))
            interviews.extend(self._all_interviews(identity, application.application_id))

        return WorkspaceExport(
            exported_at=datetime.now(UTC),
            profile=self._users.get_or_create_profile(identity),
            settings=self._resources.get_settings(identity),
            applications=applications,
            activities=tuple(activities),
            notes=tuple(notes),
            interviews=tuple(interviews),
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
