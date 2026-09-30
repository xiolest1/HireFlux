"""Runtime ASGI entry point; importing it validates deployment configuration."""

from hireflux_backend.app_factory import create_app

app = create_app()
