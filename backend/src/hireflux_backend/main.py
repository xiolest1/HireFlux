import re
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from starlette.middleware.cors import CORSMiddleware

from hireflux_backend.api.error_handlers import register_exception_handlers
from hireflux_backend.api.routes import applications, health, me
from hireflux_backend.application.services import ApplicationService, UserService
from hireflux_backend.config import Settings, get_settings
from hireflux_backend.infrastructure.dynamodb.client import build_dynamodb_client
from hireflux_backend.infrastructure.dynamodb.cursor import CursorCodec
from hireflux_backend.infrastructure.dynamodb.repositories import (
    DynamoApplicationRepository,
    DynamoUserRepository,
)

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def create_app(
    settings: Settings | None = None,
    *,
    dynamodb_client: Any | None = None,
) -> FastAPI:
    configured = settings or get_settings()
    client = dynamodb_client or build_dynamodb_client(configured)
    cursor_codec = CursorCodec(configured.cursor_signing_key.get_secret_value())

    app = FastAPI(
        title="HireFlux API",
        version="0.1.0",
        description="Local Milestone 1 API for the HireFlux application tracker.",
    )
    app.state.settings = configured
    app.state.user_service = UserService(
        DynamoUserRepository(client, configured.dynamodb_table_name)
    )
    app.state.application_service = ApplicationService(
        DynamoApplicationRepository(client, configured.dynamodb_table_name, cursor_codec)
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(configured.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
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
    app.include_router(me.router)
    app.include_router(applications.router)
    return app


app = create_app()
