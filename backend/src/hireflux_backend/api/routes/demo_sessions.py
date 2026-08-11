from fastapi import APIRouter
from fastapi import status as http_status

from hireflux_backend.api.dependencies import (
    DemoSessionServiceDependency,
    SettingsDependency,
)
from hireflux_backend.api.schemas import DemoSessionResponse
from hireflux_backend.application.errors import AuthenticationUnavailableError
from hireflux_backend.config import AuthMode

router = APIRouter(prefix="/api/v1/demo-sessions", tags=["demo sessions"])


@router.post("", response_model=DemoSessionResponse, status_code=http_status.HTTP_201_CREATED)
def create_demo_session(
    settings: SettingsDependency,
    service: DemoSessionServiceDependency,
) -> DemoSessionResponse:
    if settings.auth_mode is not AuthMode.DEMO:
        raise AuthenticationUnavailableError(
            "Temporary demo sessions are not enabled in this environment."
        )
    session = service.create()
    return DemoSessionResponse(
        access_token=session.access_token,
        expires_at=session.expires_at,
    )
