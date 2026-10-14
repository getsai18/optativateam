from .config import API_CODE_STATUS


class ApiError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    @property
    def status(self) -> int:
        return API_CODE_STATUS.get(self.code, 500)


def unauthorized(message: str = "Session expired") -> ApiError:
    return ApiError("UNAUTHORIZED", message)


def forbidden() -> ApiError:
    return ApiError("FORBIDDEN", "You do not have permission to perform this action")


def not_found(message: str) -> ApiError:
    return ApiError("NOT_FOUND", message)


def validation(message: str) -> ApiError:
    return ApiError("VALIDATION", message)


def rate_limited() -> ApiError:
    return ApiError("RATE_LIMITED", "Too many attempts. Try again later")


def conflict(message: str) -> ApiError:
    return ApiError("CONFLICT", message)
