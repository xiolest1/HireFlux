from datetime import datetime
from typing import Protocol

from hireflux_backend.domain.models import Activity
from hireflux_backend.domain.resources import Interview, Note, WorkspaceSettings


class WorkspaceResourceRepository(Protocol):
    def get_settings(self, owner_user_id: str) -> WorkspaceSettings | None: ...

    def create_settings(self, settings: WorkspaceSettings) -> WorkspaceSettings: ...

    def replace_settings(self, settings: WorkspaceSettings, *, expected_version: int) -> None: ...

    def create_note(self, note: Note, activity: Activity) -> None: ...

    def get_note(self, owner_user_id: str, application_id: str, note_id: str) -> Note | None: ...

    def list_notes(self, owner_user_id: str, application_id: str) -> tuple[Note, ...]: ...

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

    def list_interviews(self, owner_user_id: str, application_id: str) -> tuple[Interview, ...]: ...

    def list_owner_interviews(
        self, owner_user_id: str, *, scheduled_after: datetime, limit: int
    ) -> tuple[Interview, ...]: ...

    def replace_interview(
        self, interview: Interview, *, expected_version: int, activity: Activity
    ) -> None: ...
