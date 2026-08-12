from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response
from fastapi import status as http_status

from hireflux_backend.api.dependencies import (
    IdentityDependency,
    WorkspaceResourceServiceDependency,
)
from hireflux_backend.api.resource_schemas import (
    InterviewCreateRequest,
    InterviewListResponse,
    InterviewResponse,
    InterviewStatusRequest,
    InterviewUpdateRequest,
    NoteCreateRequest,
    NoteListResponse,
    NoteResponse,
    NoteUpdateRequest,
)
from hireflux_backend.application.resource_services import (
    CreateInterviewCommand,
    CreateNoteCommand,
    TransitionInterviewCommand,
    UpdateInterviewCommand,
    UpdateNoteCommand,
)

applications_router = APIRouter(
    prefix="/api/v1/applications/{application_id}", tags=["application resources"]
)
interviews_router = APIRouter(prefix="/api/v1/interviews", tags=["interviews"])


@applications_router.get("/notes", response_model=NoteListResponse)
def list_notes(
    application_id: UUID,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> NoteListResponse:
    notes = service.list_notes(identity, str(application_id))
    return NoteListResponse(items=[NoteResponse.from_domain(note) for note in notes])


@applications_router.post(
    "/notes", response_model=NoteResponse, status_code=http_status.HTTP_201_CREATED
)
def create_note(
    application_id: UUID,
    request: NoteCreateRequest,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> NoteResponse:
    note = service.create_note(
        identity,
        str(application_id),
        CreateNoteCommand(content=request.content),
    )
    return NoteResponse.from_domain(note)


@applications_router.patch("/notes/{note_id}", response_model=NoteResponse)
def update_note(
    application_id: UUID,
    note_id: UUID,
    request: NoteUpdateRequest,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> NoteResponse:
    note = service.update_note(
        identity,
        str(application_id),
        str(note_id),
        UpdateNoteCommand(
            expected_version=request.expected_version,
            content=request.content,
        ),
    )
    return NoteResponse.from_domain(note)


@applications_router.delete("/notes/{note_id}", status_code=http_status.HTTP_204_NO_CONTENT)
def delete_note(
    application_id: UUID,
    note_id: UUID,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
    expected_version: Annotated[int, Query(ge=1)],
) -> Response:
    service.delete_note(
        identity,
        str(application_id),
        str(note_id),
        expected_version=expected_version,
    )
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)


@applications_router.get("/interviews", response_model=InterviewListResponse)
def list_application_interviews(
    application_id: UUID,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> InterviewListResponse:
    interviews = service.list_interviews(identity, str(application_id))
    return InterviewListResponse(
        items=[InterviewResponse.from_domain(interview) for interview in interviews]
    )


@applications_router.post(
    "/interviews",
    response_model=InterviewResponse,
    status_code=http_status.HTTP_201_CREATED,
)
def create_interview(
    application_id: UUID,
    request: InterviewCreateRequest,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> InterviewResponse:
    interview = service.create_interview(
        identity,
        str(application_id),
        CreateInterviewCommand(
            interview_type=request.interview_type,
            scheduled_at=request.scheduled_at,
            duration_minutes=request.duration_minutes,
            location=request.location,
            meeting_url=str(request.meeting_url) if request.meeting_url else None,
            details=request.details,
        ),
    )
    return InterviewResponse.from_domain(interview)


@applications_router.patch("/interviews/{interview_id}", response_model=InterviewResponse)
def update_interview(
    application_id: UUID,
    interview_id: UUID,
    request: InterviewUpdateRequest,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> InterviewResponse:
    changes = request.model_dump(exclude={"expected_version"}, exclude_unset=True)
    if changes.get("meeting_url") is not None:
        changes["meeting_url"] = str(changes["meeting_url"])
    interview = service.update_interview(
        identity,
        str(application_id),
        str(interview_id),
        UpdateInterviewCommand(
            expected_version=request.expected_version,
            changes=changes,
        ),
    )
    return InterviewResponse.from_domain(interview)


@applications_router.post("/interviews/{interview_id}/status", response_model=InterviewResponse)
def transition_interview(
    application_id: UUID,
    interview_id: UUID,
    request: InterviewStatusRequest,
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
) -> InterviewResponse:
    interview = service.transition_interview(
        identity,
        str(application_id),
        str(interview_id),
        TransitionInterviewCommand(
            status=request.status,
            expected_version=request.expected_version,
        ),
    )
    return InterviewResponse.from_domain(interview)


@interviews_router.get("", response_model=InterviewListResponse)
def list_workspace_interviews(
    identity: IdentityDependency,
    service: WorkspaceResourceServiceDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> InterviewListResponse:
    interviews = service.list_owner_interviews(identity, limit=limit)
    return InterviewListResponse(
        items=[InterviewResponse.from_domain(interview) for interview in interviews]
    )
