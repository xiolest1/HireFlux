class HireFluxError(Exception):
    """Base class for errors that can be safely translated at the HTTP boundary."""


class NotFoundError(HireFluxError):
    pass


class ConflictError(HireFluxError):
    pass


class ValidationError(HireFluxError):
    pass


class InvalidCursorError(HireFluxError):
    pass


class PersistenceError(HireFluxError):
    pass


class AuthenticationUnavailableError(HireFluxError):
    pass
