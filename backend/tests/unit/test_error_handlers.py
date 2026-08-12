import asyncio
import json
import logging

from pytest import LogCaptureFixture
from starlette.requests import Request

from hireflux_backend.api.error_handlers import unexpected_exception_handler


def test_unexpected_error_response_and_log_do_not_expose_exception(
    caplog: LogCaptureFixture,
) -> None:
    request = Request({"type": "http", "method": "GET", "path": "/boom", "headers": []})
    request.state.request_id = "safe-request-id"

    with caplog.at_level(logging.ERROR):
        response = asyncio.run(
            unexpected_exception_handler(request, ValueError("private persistence detail"))
        )

    assert response.status_code == 500
    assert json.loads(response.body) == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred.",
            "request_id": "safe-request-id",
        }
    }
    assert "private persistence detail" not in caplog.text
    assert "Traceback" not in caplog.text
    assert "ValueError" not in caplog.text
