"""Finite, server-owned Demo issuance policy; independent of token admission."""

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from hireflux_backend.application.errors import (
    DemoAdmissionUnavailableError,
    DemoQuotaExhaustedError,
)

DEFAULT_DAILY_LIMIT = 10
DEFAULT_MINUTE_LIMIT = 2
COUNTER_RETENTION_SECONDS = 172_800
IDEMPOTENCY_RETENTION_SECONDS = 86_400


def integer(value: object, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)):
        raise DemoAdmissionUnavailableError()
    if isinstance(value, Decimal) and not value.is_finite():
        raise DemoAdmissionUnavailableError()
    if value != int(value) or not minimum <= value <= maximum:
        raise DemoAdmissionUnavailableError()
    return int(value)


@dataclass(frozen=True, slots=True)
class DemoIssuancePolicy:
    enabled: bool
    version: int
    daily_limit: int = DEFAULT_DAILY_LIMIT
    minute_limit: int = DEFAULT_MINUTE_LIMIT
    local_default: bool = False

    def __post_init__(self) -> None:
        if type(self.enabled) is not bool or type(self.local_default) is not bool:
            raise DemoAdmissionUnavailableError()
        integer(self.version, 1, 2_147_483_647)
        integer(self.daily_limit, 1, 1_000)
        integer(self.minute_limit, 1, 60)

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> "DemoIssuancePolicy":
        if record.get("schema_version") != 1 or isinstance(record.get("schema_version"), bool):
            raise DemoAdmissionUnavailableError()
        if type(record.get("enabled")) is not bool:
            raise DemoAdmissionUnavailableError()
        return cls(
            enabled=record["enabled"],
            version=integer(record.get("version"), 1, 2_147_483_647),
            daily_limit=integer(record.get("daily_limit"), 1, 1_000),
            minute_limit=integer(record.get("minute_limit"), 1, 60),
        )


@dataclass(frozen=True, slots=True)
class DemoAdmission:
    policy: DemoIssuancePolicy
    day_start: int
    minute_start: int
    now: int

    def require_capacity(self, day_used: int, minute_used: int) -> None:
        wait = 0
        if day_used >= self.policy.daily_limit:
            wait = self.day_start + 86_400 - self.now
        if minute_used >= self.policy.minute_limit:
            wait = max(wait, self.minute_start + 60 - self.now)
        if wait:
            raise DemoQuotaExhaustedError(wait)

    @classmethod
    def at(cls, policy: DemoIssuancePolicy, now: datetime) -> "DemoAdmission":
        timestamp = int(now.astimezone(UTC).timestamp())
        return cls(policy, timestamp - timestamp % 86_400, timestamp - timestamp % 60, timestamp)
