"""Lambda entry point: hireflux_backend.lambda_handler.handler."""

import logging

from mangum import Mangum

from hireflux_backend.app_factory import create_app
from hireflux_backend.lambda_settings import get_lambda_settings


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

# Reuse the app and SDK client across warm invocations. No startup/shutdown hooks
# exist today; reassess lifespan if the factory acquires asynchronous resources.
app = create_app(get_lambda_settings())
handler = Mangum(app, lifespan="off")
