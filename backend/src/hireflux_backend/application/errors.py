class HireFluxError(Exception):
    """Base class for errors that can be safely translated at the HTTP boundary."""


class NotFoundError(HireFluxError):
    pass


class ConflictError(HireFluxError):
    pass


class DemoProvisioningInProgressError(ConflictError):
    pass


class DemoIssuancePausedError(HireFluxError):
    pass


class DemoQuotaExhaustedError(HireFluxError):
    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__("Demo creation is temporarily at capacity. Please try again later.")
        self.retry_after_seconds = max(1, min(86_400, retry_after_seconds))


class DemoAdmissionUnavailableError(HireFluxError):
    def __init__(self) -> None:
        super().__init__(
            "Demo creation is temporarily unavailable. Existing workspaces are preserved."
        )


class DemoAdmissionUncertainError(HireFluxError):
    def __init__(self) -> None:
        super().__init__(
            "Demo preparation could not be confirmed. Retry explicitly with the same request; "
            "do not start a replacement automatically."
        )


class ValidationError(HireFluxError):
    pass


class InvalidCursorError(HireFluxError):
    pass


class PersistenceError(HireFluxError):
    pass


class AuthenticationUnavailableError(HireFluxError):
    pass


class AuthenticationRequiredError(HireFluxError):
    pass


class SessionExpiredError(AuthenticationRequiredError):
    pass


class AccountNotVerifiedError(HireFluxError):
    pass


class AccountManagementUnavailableError(HireFluxError):
    pass


class RecentAuthenticationRequiredError(HireFluxError):
    pass


class ForbiddenError(HireFluxError):
    pass


class DemoSessionRequiredError(HireFluxError):
    pass


class DemoSessionExpiredError(HireFluxError):
    pass


class WorkspaceExportTooLargeError(HireFluxError):
    pass


class WorkspaceBootstrapRequiredError(HireFluxError):
    pass


class WorkspaceBootstrapConflictError(ConflictError):
    pass


class WorkspaceDeletingError(ConflictError):
    pass


class WorkspaceDeletedError(ConflictError):
    pass


class WorkspaceManifestIncompleteError(ConflictError):
    pass
