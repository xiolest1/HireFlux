import pytest

from hireflux_backend.application.errors import InvalidCursorError
from hireflux_backend.infrastructure.dynamodb.cursor import CursorCodec


@pytest.fixture
def codec() -> CursorCodec:
    return CursorCodec("test-signing-key-that-is-at-least-32-bytes")


def test_cursor_round_trip(codec: CursorCodec) -> None:
    token = codec.encode(
        kind="applications",
        owner_user_id="owner-a",
        scope="ALL",
        timestamp="2026-08-10T12:00:00.000000Z",
        item_id="application-id",
    )
    assert "GSI" not in token
    position = codec.decode(
        token,
        kind="applications",
        owner_user_id="owner-a",
        scope="ALL",
    )
    assert position.item_id == "application-id"
    assert position.timestamp == "2026-08-10T12:00:00.000000Z"


@pytest.mark.parametrize(
    ("owner", "scope"),
    [("owner-b", "ALL"), ("owner-a", "APPLIED")],
)
def test_cursor_is_bound_to_owner_and_query(codec: CursorCodec, owner: str, scope: str) -> None:
    token = codec.encode(
        kind="applications",
        owner_user_id="owner-a",
        scope="ALL",
        timestamp="2026-08-10T12:00:00.000000Z",
        item_id="application-id",
    )
    with pytest.raises(InvalidCursorError):
        codec.decode(token, kind="applications", owner_user_id=owner, scope=scope)


def test_cursor_rejects_tampering(codec: CursorCodec) -> None:
    token = codec.encode(
        kind="applications",
        owner_user_id="owner-a",
        scope="ALL",
        timestamp="2026-08-10T12:00:00.000000Z",
        item_id="application-id",
    )
    payload, signature = token.split(".")
    replacement = "A" if payload[-1] != "A" else "B"
    with pytest.raises(InvalidCursorError):
        codec.decode(
            f"{payload[:-1]}{replacement}.{signature}",
            kind="applications",
            owner_user_id="owner-a",
            scope="ALL",
        )


def test_cursor_rejects_malformed_value(codec: CursorCodec) -> None:
    with pytest.raises(InvalidCursorError):
        codec.decode("not-a-cursor", kind="applications", owner_user_id="owner", scope="ALL")
