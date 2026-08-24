import asyncio
import json
import logging

from pytest import LogCaptureFixture
from starlette.requests import Request

from hireflux_backend.api.error_handlers import (
    demo_provisioning_in_progress_handler,
    unexpected_exception_handler,
)
from hireflux_backend.application.errors import DemoProvisioningInProgressError


def test_demo_provisioning_conflict_has_a_retriable_error_code() -> None:
    request = Request({"type": "http", "method": "POST", "path": "/demo", "headers": []})
    request.state.request_id = "retry-request-id"

    response = asyncio.run(
        demo_provisioning_in_progress_handler(
            request,
            DemoProvisioningInProgressError("Retry with the same Idempotency-Key."),
        )
    )

    assert response.status_code == 409
    assert json.loads(response.body)["error"] == {
        "code": "DEMO_PROVISIONING_IN_PROGRESS",
        "message": "Retry with the same Idempotency-Key.",
        "request_id": "retry-request-id",
    }


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
