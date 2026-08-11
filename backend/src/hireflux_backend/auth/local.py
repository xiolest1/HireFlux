from hireflux_backend.application.errors import AuthenticationUnavailableError
from hireflux_backend.config import AuthMode, Settings
from hireflux_backend.domain.models import CurrentIdentity


def identity_from_settings(settings: Settings) -> CurrentIdentity:
    if settings.auth_mode is not AuthMode.LOCAL:
        raise AuthenticationUnavailableError(
            "Cognito authentication is not available in Milestone 1."
        )
    return CurrentIdentity(
        user_id=str(settings.local_user_id),
        name=settings.local_user_name,
        email=str(settings.local_user_email),
        role=settings.local_user_role,
    )
