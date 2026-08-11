from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from hireflux_backend.domain.enums import ApplicationStatus
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity, UserProfile


@dataclass(frozen=True, slots=True)
class ApplicationPage:
    items: tuple[Application, ...]
    next_cursor: str | None


class UserRepository(Protocol):
    def get_or_create(self, identity: CurrentIdentity, *, now_iso: str) -> UserProfile: ...


class ApplicationRepository(Protocol):
    def create(self, application: Application, activity: Activity) -> None: ...

    def get(self, owner_user_id: str, application_id: str) -> Application | None: ...

    def list(
        self,
        owner_user_id: str,
        *,
        status: ApplicationStatus | None,
        limit: int,
        cursor: str | None,
    ) -> ApplicationPage: ...

    def replace_details(self, application: Application, *, expected_version: int) -> None: ...

    def replace_with_activity(
        self,
        application: Application,
        *,
        prior_status: ApplicationStatus,
        expected_version: int,
        activity: Activity,
    ) -> None: ...

    def list_activity(self, owner_user_id: str, application_id: str) -> tuple[Activity, ...]: ...


class DemoSessionTokenIssuer(Protocol):
    def issue(
        self,
        *,
        workspace_id: str,
        issued_at: datetime,
        expires_at: datetime,
    ) -> str: ...
