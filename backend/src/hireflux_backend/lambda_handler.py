"""Lambda entry point: hireflux_backend.lambda_handler.handler."""

import base64
import json
import logging
from typing import Any

from mangum import Mangum

from hireflux_backend.app_factory import create_app
from hireflux_backend.lambda_settings import get_lambda_cors_policy, get_lambda_settings


class _SafeAdapterLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Starlette re-raises after sending the safe 500 envelope. Mangum would
        # otherwise log that internal exception and its traceback a second time.
        if record.exc_info:
            record.msg = "Lambda ASGI adapter encountered an internal error."
            record.args = ()
            record.exc_info = None
            record.exc_text = None
        return True


logging.getLogger("mangum.http").addFilter(_SafeAdapterLogFilter())


# The proxy envelope escapes JSON a second time. Preserve the 4 MB public export
# budget by switching to base64 when needed (4/3 overhead), which HTTP API decodes.
MAX_PROXY_RESPONSE_BYTES = 6 * 1024 * 1024 - 64 * 1024


def bound_proxy_response(response: dict[str, Any]) -> dict[str, Any]:
    def size() -> int:
        return len(json.dumps(response, ensure_ascii=False).encode("utf-8"))

    if size() <= MAX_PROXY_RESPONSE_BYTES:
        return response
    if not response.get("isBase64Encoded", False) and isinstance(response.get("body"), str):
        response = {
            **response,
            "body": base64.b64encode(response["body"].encode("utf-8")).decode("ascii"),
            "isBase64Encoded": True,
        }
        if size() <= MAX_PROXY_RESPONSE_BYTES:
            return response
    request_id = response.get("headers", {}).get("x-request-id", "")
    return {
        "statusCode": 413,
        "headers": {"content-type": "application/json", "x-request-id": request_id},
        "body": json.dumps(
            {
                "error": {
                    "code": "RESPONSE_TOO_LARGE",
                    "message": "This response exceeds synchronous transport limits.",
                    "request_id": request_id,
                }
            }
        ),
        "isBase64Encoded": False,
    }


class _BoundedMangum(Mangum):
    def __call__(self, event: dict[str, Any], context: Any) -> dict[str, Any]:
        response: dict[str, Any] = super().__call__(event, context)
        return bound_proxy_response(response)


# Reuse the app and SDK client across warm invocations. No startup/shutdown hooks
# exist today; reassess lifespan if the factory acquires asynchronous resources.
app = create_app(get_lambda_settings(), cors_policy=get_lambda_cors_policy())
handler = _BoundedMangum(app, lifespan="off")
