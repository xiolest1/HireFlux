import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from hireflux_backend.application.errors import (
    AuthenticationUnavailableError,
    ConflictError,
    DemoSessionExpiredError,
    DemoSessionRequiredError,
    InvalidCursorError,
    NotFoundError,
    PersistenceError,
    ValidationError,
)

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, request_validation_handler)
    app.add_exception_handler(NotFoundError, not_found_handler)
    app.add_exception_handler(ConflictError, conflict_handler)
    app.add_exception_handler(ValidationError, domain_validation_handler)
    app.add_exception_handler(InvalidCursorError, invalid_cursor_handler)
    app.add_exception_handler(PersistenceError, persistence_handler)
    app.add_exception_handler(AuthenticationUnavailableError, authentication_handler)
    app.add_exception_handler(DemoSessionRequiredError, demo_session_required_handler)
    app.add_exception_handler(DemoSessionExpiredError, demo_session_expired_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unexpected_exception_handler)


async def request_validation_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, RequestValidationError)
    details = [
        {
            "location": [str(part) for part in issue.get("loc", ())],
            "message": issue.get("msg", "Invalid value."),
            "type": issue.get("type", "validation_error"),
        }
        for issue in error.errors()
    ]
    return _response(
        request,
        status_code=422,
        code="VALIDATION_ERROR",
        message="The request contains invalid data.",
        details=details,
    )


async def not_found_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, NotFoundError)
    return _response(request, 404, "NOT_FOUND", str(error))


async def conflict_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, ConflictError)
    return _response(request, 409, "CONFLICT", str(error))


async def domain_validation_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, ValidationError)
    return _response(request, 422, "DOMAIN_VALIDATION_ERROR", str(error))


async def invalid_cursor_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, InvalidCursorError)
    return _response(request, 400, "INVALID_CURSOR", str(error))


async def persistence_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, PersistenceError)
    return _response(
        request,
        503,
        "PERSISTENCE_UNAVAILABLE",
        "The data store is temporarily unavailable. Please try again.",
    )


async def authentication_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, AuthenticationUnavailableError)
    return _response(
        request,
        503,
        "AUTHENTICATION_UNAVAILABLE",
        "Authentication is not configured for this environment.",
    )


async def demo_session_required_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DemoSessionRequiredError)
    response = _response(request, 401, "DEMO_SESSION_REQUIRED", str(error))
    response.headers["WWW-Authenticate"] = "Bearer"
    return response


async def demo_session_expired_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DemoSessionExpiredError)
    response = _response(request, 401, "DEMO_SESSION_EXPIRED", str(error))
    response.headers["WWW-Authenticate"] = "Bearer"
    return response


async def http_exception_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, HTTPException)
    message = (
        error.detail if isinstance(error.detail, str) else "The request could not be completed."
    )
    return _response(request, error.status_code, "HTTP_ERROR", message)


async def unexpected_exception_handler(request: Request, error: Exception) -> JSONResponse:
    logger.exception(
        "Unhandled request error",
        extra={"request_id": _request_id(request), "error_type": type(error).__name__},
    )
    return _response(
        request,
        500,
        "INTERNAL_ERROR",
        "An unexpected error occurred.",
    )


def _response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: Any | None = None,
) -> JSONResponse:
    request_id = _request_id(request)
    content: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
        }
    }
    if details is not None:
        content["error"]["details"] = details
    return JSONResponse(
        status_code=status_code, content=content, headers={"X-Request-ID": request_id}
    )


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", "unavailable"))
