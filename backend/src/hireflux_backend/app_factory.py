"""Construct the API without initializing a runtime application on import."""

import re
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from starlette.middleware.cors import CORSMiddleware

from hireflux_backend.api.error_handlers import register_exception_handlers
from hireflux_backend.api.export_schemas import export_record_size
from hireflux_backend.api.routes import (
    applications,
    demo_sessions,
    health,
    insights,
    me,
    pipeline,
    workspace_resources,
)
from hireflux_backend.api.routes import (
    settings as settings_routes,
)
from hireflux_backend.application.demo_sessions import DemoSessionService
from hireflux_backend.application.insights import InsightsService
from hireflux_backend.application.opportunity_workspace import OpportunityWorkspaceService
from hireflux_backend.application.pipeline import PipelineService
from hireflux_backend.application.resource_services import WorkspaceResourceService
from hireflux_backend.application.services import ApplicationService, UserService
from hireflux_backend.application.workspace_bootstrap import WorkspaceBootstrapService
from hireflux_backend.application.workspace_export import WorkspaceExportService
from hireflux_backend.application.workspace_safety import WorkspaceErasureService
from hireflux_backend.auth.demo import DemoSessionCodec
from hireflux_backend.config import Settings, get_settings
from hireflux_backend.cors_policy import CorsPolicy
from hireflux_backend.infrastructure.dynamodb.client import build_dynamodb_client
from hireflux_backend.infrastructure.dynamodb.cursor import CursorCodec
from hireflux_backend.infrastructure.dynamodb.demo_workspace_repository import (
    DynamoDemoWorkspaceRepository,
)
from hireflux_backend.infrastructure.dynamodb.repositories import (
    DynamoApplicationRepository,
    DynamoUserRepository,
)
from hireflux_backend.infrastructure.dynamodb.resource_repositories import (
    DynamoWorkspaceResourceRepository,
)
from hireflux_backend.infrastructure.dynamodb.workspace_bootstrap_repository import (
    DynamoWorkspaceBootstrapRepository,
)
from hireflux_backend.infrastructure.dynamodb.workspace_safety_repository import (
    DynamoWorkspaceSafetyRepository,
)

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def create_app(
    settings: Settings | None = None,
    *,
    dynamodb_client: Any | None = None,
    cors_policy: CorsPolicy | None = None,
) -> FastAPI:
    configured = settings or get_settings()
    client = dynamodb_client or build_dynamodb_client(configured)
    cursor_codec = CursorCodec(configured.cursor_signing_key.get_secret_value())

    app = FastAPI(
        title="HireFlux API",
        version="0.1.0",
        description="Local workspace and demo API for the HireFlux application tracker.",
        docs_url="/docs" if configured.expose_api_docs else None,
        redoc_url="/redoc" if configured.expose_api_docs else None,
        openapi_url="/openapi.json" if configured.expose_api_docs else None,
    )
    app.state.settings = configured
    app.state.workspace_bootstrap_service = WorkspaceBootstrapService(
        DynamoWorkspaceBootstrapRepository(client, configured.dynamodb_table_name)
    )
    user_service = UserService(DynamoUserRepository(client, configured.dynamodb_table_name))
    application_repository = DynamoApplicationRepository(
        client,
        configured.dynamodb_table_name,
        cursor_codec,
        max_applications=configured.max_applications_per_workspace,
        max_activity_per_application=configured.max_activity_per_application,
    )
    workspace_resource_repository = DynamoWorkspaceResourceRepository(
        client,
        configured.dynamodb_table_name,
        cursor_codec,
        max_notes_per_application=configured.max_notes_per_application,
        max_interviews_per_application=configured.max_interviews_per_application,
        max_activity_per_application=configured.max_activity_per_application,
    )
    workspace_resource_service = WorkspaceResourceService(
        application_repository, workspace_resource_repository
    )
    application_service = ApplicationService(
        application_repository,
        workspace_time_zone=lambda identity: (
            workspace_resource_service.get_settings(identity).time_zone
        ),
    )
    demo_session_codec = DemoSessionCodec(configured.demo_session_signing_key.get_secret_value())
    demo_workspace_repository = DynamoDemoWorkspaceRepository(
        client, configured.dynamodb_table_name
    )
    app.state.user_service = user_service
    app.state.application_service = application_service
    app.state.opportunity_workspace_service = OpportunityWorkspaceService(
        application_repository,
        workspace_resource_repository,
        cursor_codec,
        workspace_time_zone=lambda identity: (
            workspace_resource_service.get_settings(identity).time_zone
        ),
    )
    app.state.insights_service = InsightsService(
        application_repository, resource_service=workspace_resource_service
    )
    app.state.pipeline_service = PipelineService(
        application_repository,
        workspace_time_zone=lambda identity: (
            workspace_resource_service.get_settings(identity).time_zone
        ),
    )
    app.state.workspace_resource_service = workspace_resource_service
    workspace_safety_repository = DynamoWorkspaceSafetyRepository(
        client,
        configured.dynamodb_table_name,
        max_items=configured.account_erasure_max_items_per_request,
        max_seconds=configured.account_erasure_max_seconds_per_request,
        max_applications=configured.max_applications_per_workspace,
    )
    app.state.workspace_erasure_service = WorkspaceErasureService(workspace_safety_repository)
    app.state.workspace_export_service = WorkspaceExportService(
        user_service,
        application_service,
        workspace_resource_service,
        max_records=configured.max_sync_export_records,
        inventory=workspace_safety_repository,
        record_size=export_record_size,
        max_bytes=configured.max_sync_export_bytes,
        max_seconds=configured.max_sync_export_work_seconds,
    )
    app.state.demo_session_codec = demo_session_codec
    app.state.demo_session_service = DemoSessionService(
        user_service,
        application_service,
        demo_session_codec,
        ttl_hours=configured.demo_session_ttl_hours,
        failure_ttl_minutes=configured.demo_session_failure_ttl_minutes,
        resource_service=workspace_resource_service,
        workspace_repository=demo_workspace_repository,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(configured.cors_origins),
        allow_credentials=cors_policy.allow_credentials if cors_policy else True,
        allow_methods=list(cors_policy.allow_methods)
        if cors_policy
        else ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=list(cors_policy.allow_headers)
        if cors_policy
        else ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
        expose_headers=list(cors_policy.expose_headers)
        if cors_policy
        else ["X-Request-ID", "Content-Disposition"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next: Any) -> Response:
        supplied = request.headers.get("X-Request-ID", "")
        request_id = supplied if _SAFE_REQUEST_ID.fullmatch(supplied) else str(uuid4())
        request.state.request_id = request_id
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(demo_sessions.router)
    app.include_router(me.router)
    app.include_router(applications.router)
    app.include_router(insights.router)
    app.include_router(pipeline.router)
    app.include_router(settings_routes.router)
    app.include_router(workspace_resources.applications_router)
    app.include_router(workspace_resources.interviews_router)
    return app
