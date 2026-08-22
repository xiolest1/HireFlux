from datetime import datetime

from pydantic import BaseModel

from hireflux_backend.api.resource_schemas import InterviewResponse, NoteResponse, SettingsResponse
from hireflux_backend.api.schemas import (
    ActivityResponse,
    ApplicationResponse,
    UserResponse,
)
from hireflux_backend.application.workspace_export import WorkspaceExport


class WorkspaceExportCounts(BaseModel):
    applications: int
    activities: int
    notes: int
    interviews: int


class WorkspaceExportResponse(BaseModel):
    export_version: int = 1
    exported_at: datetime
    profile: UserResponse
    settings: SettingsResponse
    applications: list[ApplicationResponse]
    activities: list[ActivityResponse]
    notes: list[NoteResponse]
    interviews: list[InterviewResponse]
    counts: WorkspaceExportCounts

    @classmethod
    def from_domain(cls, export: WorkspaceExport) -> "WorkspaceExportResponse":
        return cls(
            exported_at=export.exported_at,
            profile=UserResponse.from_domain(export.profile),
            settings=SettingsResponse.from_domain(export.settings),
            applications=[ApplicationResponse.from_domain(item) for item in export.applications],
            activities=[ActivityResponse.from_domain(item) for item in export.activities],
            notes=[NoteResponse.from_domain(item) for item in export.notes],
            interviews=[InterviewResponse.from_domain(item) for item in export.interviews],
            counts=WorkspaceExportCounts(
                applications=len(export.applications),
                activities=len(export.activities),
                notes=len(export.notes),
                interviews=len(export.interviews),
            ),
        )
