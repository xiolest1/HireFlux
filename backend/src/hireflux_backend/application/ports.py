from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from hireflux_backend.domain.enums import (
    ApplicationSort,
    ApplicationSource,
    ApplicationStatus,
    FollowUpFilter,
    WorkMode,
)
from hireflux_backend.domain.models import (
    Activity,
    Application,
    CurrentIdentity,
    DemoWorkspace,
    UserProfile,
)
from hireflux_backend.domain.resources import DefaultApplicationView


@dataclass(frozen=True, slots=True)
class ApplicationPage:
    items: tuple[Application, ...]
    next_cursor: str | None


@dataclass(frozen=True, slots=True)
class StageAgeBounds:
    entered_on_or_after: date | None
    entered_before: date | None

    @property
    def cursor_scope(self) -> str:
        return "#".join(
            (
                self.entered_on_or_after.isoformat() if self.entered_on_or_after else "",
                self.entered_before.isoformat() if self.entered_before else "",
            )
        )


@dataclass(frozen=True, slots=True)
class ActivityPage:
    items: tuple[Activity, ...]
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
        q: str | None = None,
        source: ApplicationSource | None = None,
        work_mode: WorkMode | None = None,
        stage_age: StageAgeBounds | None = None,
        follow_up: FollowUpFilter | None = None,
        follow_up_today: date | None = None,
        sort: ApplicationSort = ApplicationSort.UPDATED_DESC,
        view: DefaultApplicationView | None = None,
    ) -> ApplicationPage: ...

    def list_all(self, owner_user_id: str) -> tuple[Application, ...]: ...

    def get_status_counts(self, owner_user_id: str) -> dict[ApplicationStatus, int]: ...

    def get_funnel_counts(self, owner_user_id: str) -> dict[str, int]: ...

    def list_follow_ups_due(
        self, owner_user_id: str, *, due_on_or_before: date, limit: int
    ) -> tuple[Application, ...]: ...

    def replace_details(
        self,
        application: Application,
        *,
        expected_version: int,
        sync_interview_labels: bool = False,
    ) -> None: ...

    def replace_details_with_activity(
        self,
        application: Application,
        *,
        expected_version: int,
        activity: Activity,
        sync_interview_labels: bool = False,
    ) -> None: ...

    def replace_with_activity(
        self,
        application: Application,
        *,
        prior_application: Application,
        expected_version: int,
        activity: Activity,
    ) -> None: ...

    def list_activity(
        self,
        owner_user_id: str,
        application_id: str,
        *,
        limit: int,
        cursor: str | None,
        order: str = "asc",
    ) -> ActivityPage: ...


class DemoSessionTokenIssuer(Protocol):
    def issue(
        self,
        *,
        workspace_id: str,
        issued_at: datetime,
        expires_at: datetime,
    ) -> str: ...


@dataclass(frozen=True, slots=True)
class DemoWorkspaceReservation:
    workspace: DemoWorkspace
    is_new: bool


class DemoWorkspaceRepository(Protocol):
    def reserve(
        self,
        workspace_id: str,
        *,
        issued_at: datetime,
        expires_at: int,
        idempotency_key: str | None,
    ) -> DemoWorkspaceReservation: ...

    def mark_ready(self, workspace: DemoWorkspace) -> None: ...

    def mark_failed(self, workspace: DemoWorkspace, *, expires_at: int) -> None: ...

    def cleanup(self, workspace_id: str, *, application_ids: tuple[str, ...] = ()) -> None: ...
