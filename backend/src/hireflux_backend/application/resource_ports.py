from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol, TypeVar

from hireflux_backend.application.opportunity_workspace import OpportunityContext
from hireflux_backend.domain.models import Activity
from hireflux_backend.domain.resources import Interview, Note, WorkspaceSettings

ResourceT = TypeVar("ResourceT")


@dataclass(frozen=True, slots=True)
class ResourcePage[ResourceT]:
    items: tuple[ResourceT, ...]
    next_cursor: str | None

    def __iter__(self) -> Iterator[ResourceT]:
        return iter(self.items)


@dataclass(frozen=True, slots=True)
class NotePreview:
    items: tuple[Note, ...]
    total_count: int


class WorkspaceResourceRepository(Protocol):
    def get_settings(self, owner_user_id: str) -> WorkspaceSettings | None: ...

    def create_settings(self, settings: WorkspaceSettings) -> WorkspaceSettings: ...

    def replace_settings(self, settings: WorkspaceSettings, *, expected_version: int) -> None: ...

    def create_note(self, note: Note, activity: Activity) -> None: ...

    def get_note(self, owner_user_id: str, application_id: str, note_id: str) -> Note | None: ...

    def list_notes(
        self, owner_user_id: str, application_id: str, *, limit: int, cursor: str | None
    ) -> ResourcePage[Note]: ...

    def preview_notes(
        self, owner_user_id: str, application_id: str, *, limit: int
    ) -> NotePreview: ...

    def replace_note(self, note: Note, *, expected_version: int, activity: Activity) -> None: ...

    def delete_note(
        self,
        owner_user_id: str,
        application_id: str,
        note_id: str,
        *,
        expected_version: int,
        activity: Activity,
    ) -> None: ...

    def create_interview(self, interview: Interview, activity: Activity) -> None: ...

    def get_interview(
        self, owner_user_id: str, application_id: str, interview_id: str
    ) -> Interview | None: ...

    def list_interviews(
        self, owner_user_id: str, application_id: str, *, limit: int, cursor: str | None
    ) -> ResourcePage[Interview]: ...

    def list_owner_interviews(
        self,
        owner_user_id: str,
        *,
        scheduled_after: datetime | None,
        include_history: bool = False,
        limit: int,
        cursor: str | None = None,
    ) -> ResourcePage[Interview]: ...

    def replace_interview(
        self, interview: Interview, *, expected_version: int, activity: Activity
    ) -> None: ...

    def list_opportunity_contexts(self, owner_user_id: str) -> tuple[OpportunityContext, ...]: ...
