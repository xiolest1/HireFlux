"""Validated deployed CORS input; local middleware keeps its established defaults."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class CorsPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    allow_methods: tuple[Literal["GET", "POST", "PATCH", "DELETE", "OPTIONS"], ...]
    allow_headers: tuple[str, ...]
    expose_headers: tuple[str, ...]
    allow_credentials: Literal[False]

    @field_validator("allow_methods", "allow_headers", "expose_headers")
    @classmethod
    def validate_explicit_entries(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if (
            not value
            or len(value) != len(set(value))
            or any(
                not entry
                or "*" in entry
                or not entry.isascii()
                or not entry.replace("-", "").isalnum()
                for entry in value
            )
        ):
            raise ValueError("CORS entries must be explicit unique tokens.")
        return value
