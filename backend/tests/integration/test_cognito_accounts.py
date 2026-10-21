from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError
from cognito_fixtures import COGNITO_CONFIG, Harness
from conftest import test_settings as build_settings
from fastapi.testclient import TestClient

from hireflux_backend.app_factory import create_app
from hireflux_backend.auth.cognito import CognitoVerifier
from hireflux_backend.config import AuthMode
from hireflux_backend.infrastructure.dynamodb.mapping import (
    deserialize_item,
    serialize_item,
    user_partition,
)

API = "/api/v1"


def headers(h: Harness, **claims: Any) -> dict[str, str]:
    return {"Authorization": "Bearer " + h.token(**claims)}


def app_client(h: Harness, db: Any, **settings: Any) -> TestClient:
    config = h.settings if not settings else build_settings(**settings)
    return TestClient(
        create_app(
            config,
            dynamodb_client=db,
            cognito_authentication=h.verifier,
            account_clock=lambda: h.clock.now,
        )
    )


def items(db: Any, partition: str) -> list[dict[str, Any]]:
    return [
        deserialize_item(item)
        for item in db.query(
            TableName="HireFluxTest",
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues=serialize_item({":pk": partition}),
            ConsistentRead=True,
        )["Items"]
    ]


def test_public_config_has_no_provider_database_identity_or_secret_work(
    cognito_harness: Harness,
) -> None:
    h = cognito_harness
    db = Mock()
    with app_client(h, db) as client:
        result = client.get(API + "/auth/config", headers={"Authorization": "malformed"})
    assert result.status_code == 200
    assert result.headers["Cache-Control"] == "no-store"
    assert result.json() == {
        "version": 1,
        "environment": "test",
        "capabilities": ["demo", "cognito"],
        "account_data_policy": "local_development",
        "account_management_enabled": False,
        "cognito": {
            "issuer": h.settings.cognito_issuer,
            "client_id": COGNITO_CONFIG["cognito_app_client_id"],
            "domain": COGNITO_CONFIG["cognito_domain"],
            "scopes": ["openid", "email", "profile"],
            "self_registration_enabled": False,
        },
    }
    db.assert_not_called()
    assert not db.mock_calls and not h.provider.calls
    body = result.text
    assert h.settings.cursor_signing_key.get_secret_value() not in body
    assert h.settings.local_user_email not in body and "LOCAL" not in body


@pytest.mark.parametrize("mode", ["local", "demo"])
def test_legacy_config_omits_cognito_without_network(mode: str) -> None:
    db = Mock()
    with TestClient(create_app(build_settings(auth_mode=mode), dynamodb_client=db)) as client:
        result = client.get(API + "/auth/config")
    assert result.status_code == 200
    assert result.json()["capabilities"] == (["demo"] if mode == "demo" else [])
    assert "cognito" not in result.json()
    assert not db.mock_calls


@pytest.mark.parametrize(
    "authorization",
    [
        [],
        [("Authorization", "Bearer a.b.c"), ("Authorization", "Bearer a.b.c")],
        [("Authorization", "Basic a.b.c")],
        [("Authorization", "Bearer  a.b.c")],
        [("Authorization", "Bearer\ta.b.c")],
        [("Authorization", "Bearer a.b.c ")],
        [("Authorization", "Bearer a.b.c, Bearer d.e.f")],
        [("Authorization", "Bearer a.b.c\nx")],
        [("Authorization", "Bearer a.b.c.d")],
        [("Authorization", "Bearer " + "a" * 8192 + ".b.c")],
    ],
)
def test_ambiguous_credentials_never_reach_either_verifier(
    cognito_harness: Harness, authorization: list[tuple[str, str]]
) -> None:
    h = cognito_harness
    db = Mock()
    with app_client(h, db) as client:
        result = client.get(API + "/me", headers=authorization)
    assert result.status_code == 401
    assert result.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert result.headers["WWW-Authenticate"] == "Bearer"
    assert not h.provider.calls and not db.mock_calls


def test_persistent_bootstrap_empty_idempotent_and_trusted_projection(
    cognito_harness: Harness, dynamodb_client: Any
) -> None:
    h = cognito_harness
    owner = "CaseSensitive-Opaque-Subject"
    auth = headers(h)
    with app_client(h, dynamodb_client) as client:
        assert (
            client.get(API + "/me", headers=auth).json()["error"]["code"]
            == "WORKSPACE_BOOTSTRAP_REQUIRED"
        )
        assert not items(dynamodb_client, user_partition(owner))
        result = client.post(API + "/me/bootstrap", headers=auth, json={})
        assert result.status_code == 200
        first = result.json()
        assert first["identity_kind"] == "PERSISTENT"
        assert first["profile"]["user_id"] == owner
        assert first["profile"]["last_login_at"] is None
        assert client.get(API + "/applications", headers=auth).json()["items"] == []
        assert client.post(API + "/me/bootstrap", headers=auth).json() == first
        assert (
            client.patch(
                API + "/settings",
                headers=auth,
                json={"expected_version": 1, "time_zone": "America/New_York"},
            ).status_code
            == 200
        )
        before = items(dynamodb_client, user_partition(owner))
        h.clock.advance(60)
        h.provider.profile.update({"email": "changed@example.com", "name": "Changed trusted name"})
        profile = client.get(API + "/me", headers=auth).json()
        assert profile["email"] == "changed@example.com"
        assert before == items(dynamodb_client, user_partition(owner))
        changed = client.post(API + "/me/bootstrap", headers=auth).json()
        assert changed["profile"]["email"] == "changed@example.com"
        assert changed["profile"]["created_at"] == first["profile"]["created_at"]
        assert changed["settings"]["time_zone"] == "America/New_York"
        after = items(dynamodb_client, user_partition(owner))
        assert {item["SK"] for item in after} == {"PROFILE", "SETTINGS", "WORKSPACE"}
        assert all("expires_at" not in item for item in after)
        assert client.post(API + "/me/bootstrap", headers=auth).json() == changed
        assert after == items(dynamodb_client, user_partition(owner))
        for body in (
            {"owner_user_id": "attacker"},
            {"email": "browser@example.com"},
            {"role": "ADMIN"},
        ):
            assert client.post(API + "/me/bootstrap", headers=auth, json=body).status_code == 422


def test_owner_isolation_lifetime_and_persistent_deletion_gate(
    cognito_harness: Harness, dynamodb_client: Any
) -> None:
    h = cognito_harness
    a, b = headers(h, username="CaseSensitive-Opaque-Subject"), headers(h, sub="Other-subject")
    with app_client(h, dynamodb_client) as client:
        for auth in (a, b):
            assert client.post(API + "/me/bootstrap", headers=auth).status_code == 200
        made = client.post(
            API + "/applications",
            headers=a,
            json={
                "company_name": "Fictional Company",
                "job_title": "Engineer",
                "status": "APPLIED",
                "applied_date": datetime.now(UTC).date().isoformat(),
            },
        )
        assert made.status_code == 201, made.text
        application = made.json()
        application_id = application["application_id"]
        path = API + "/applications/" + application_id
        assert (
            client.post(path + "/notes", headers=a, json={"content": "Fictional note"}).status_code
            == 201
        )
        interview = client.post(
            path + "/interviews",
            headers=a,
            json={
                "interview_type": "TECHNICAL_SCREEN",
                "scheduled_at": "2030-01-01T12:00:00Z",
                "duration_minutes": 30,
            },
        )
        assert interview.status_code == 201, interview.text
        assert (
            client.patch(
                path, headers=a, json={"expected_version": 99, "job_title": "Stale"}
            ).status_code
            == 409
        )
        assert client.get(path, headers=b).status_code == 404
        assert (
            client.get(
                API + "/applications/00000000-0000-4000-8000-000000000099", headers=b
            ).status_code
            == 404
        )
        assert client.get(API + "/applications", headers=b).json()["items"] == []
        demo = client.post(API + "/demo-sessions").json()["access_token"]
        demo_auth = {"Authorization": "Bearer " + demo}
        assert client.get(path, headers=demo_auth).status_code == 404
        demo_apps = client.get(API + "/applications", headers=demo_auth).json()["items"]
        assert (
            client.get(
                API + "/applications/" + demo_apps[0]["application_id"], headers=a
            ).status_code
            == 404
        )
        assert client.post(API + "/me/bootstrap", headers=demo_auth).status_code == 403
        owner_items = items(dynamodb_client, user_partition("CaseSensitive-Opaque-Subject"))
        application_items = items(
            dynamodb_client,
            user_partition("CaseSensitive-Opaque-Subject") + "#APPLICATION#" + application_id,
        )
        assert any(item["SK"].startswith("APPLICATION_REF#") for item in owner_items)
        assert any("QUOTA" in item["SK"] for item in owner_items)
        assert "COUNTER#FUNNEL" in {item["SK"] for item in owner_items}
        assert any(item["SK"].startswith("COUNTER#STATUS#") for item in owner_items)
        assert {item.get("entity_type") for item in application_items} >= {"NOTE", "INTERVIEW"}
        assert "RESOURCE_QUOTA" in {item["SK"] for item in application_items}
        assert len(application_items) >= 6
        assert all("expires_at" not in item for item in owner_items + application_items)
        exported = client.get(API + "/me/export", headers=a)
        assert exported.status_code == 200 and exported.headers["Cache-Control"] == "no-store"
        for method, endpoint in (("DELETE", "/me"), ("POST", "/me/deletion/retry")):
            denied = client.request(method, API + endpoint, headers=a)
            assert denied.status_code == 403
            assert denied.json()["error"]["code"] == "ACCOUNT_MANAGEMENT_UNAVAILABLE"
        assert owner_items == items(dynamodb_client, user_partition("CaseSensitive-Opaque-Subject"))
        h.clock.advance(3660)
        expired = client.get(path, headers=a)
        assert expired.status_code == 401 and expired.json()["error"]["code"] == "SESSION_EXPIRED"
        assert owner_items == items(dynamodb_client, user_partition("CaseSensitive-Opaque-Subject"))
        fresh = headers(h)
        assert client.get(path, headers=fresh).status_code == 200


@pytest.mark.parametrize("state", ["DELETING", "DELETED", "LOCAL", "TTL", "UNMARKED"])
def test_provenance_and_lifecycle_cannot_be_converted(
    cognito_harness: Harness, dynamodb_client: Any, state: str
) -> None:
    h = cognito_harness
    auth = headers(h)
    owner = "CaseSensitive-Opaque-Subject"
    with app_client(h, dynamodb_client) as client:
        assert client.post(API + "/me/bootstrap", headers=auth).status_code == 200
        key = serialize_item({"PK": user_partition(owner), "SK": "WORKSPACE"})
        if state == "UNMARKED":
            dynamodb_client.delete_item(TableName="HireFluxTest", Key=key)
        else:
            field, value = (
                ("identity_kind", "LOCAL")
                if state == "LOCAL"
                else ("expires_at", 1900003600)
                if state == "TTL"
                else ("state", state)
            )
            dynamodb_client.update_item(
                TableName="HireFluxTest",
                Key=key,
                UpdateExpression="SET #f = :v",
                ExpressionAttributeNames={"#f": field},
                ExpressionAttributeValues=serialize_item({":v": value}),
            )
        before = items(dynamodb_client, user_partition(owner))
        result = client.post(API + "/me/bootstrap", headers=auth)
        assert result.status_code == 409
        assert result.json()["error"]["code"] == (
            "WORKSPACE_" + state
            if state in {"DELETING", "DELETED"}
            else "WORKSPACE_BOOTSTRAP_CONFLICT"
        )
        assert before == items(dynamodb_client, user_partition(owner))


def test_concurrent_bootstrap_converges(cognito_harness: Harness, dynamodb_client: Any) -> None:
    h = cognito_harness
    auth = headers(h)
    with app_client(h, dynamodb_client) as client:
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(
                pool.map(lambda _: client.post(API + "/me/bootstrap", headers=auth), range(4))
            )
        assert all(result.status_code == 200 for result in results), [
            (result.status_code, result.json()) for result in results
        ]
        assert all(result.json() == results[0].json() for result in results)
    assert len(items(dynamodb_client, user_partition("CaseSensitive-Opaque-Subject"))) == 3


def test_provider_outage_does_not_break_demo_and_errors_are_private(
    cognito_harness: Harness, dynamodb_client: Any, caplog: pytest.LogCaptureFixture
) -> None:
    h = cognito_harness
    h.provider.key_failure = True
    token = h.token()
    with app_client(h, dynamodb_client) as client:
        result = client.post(API + "/me/bootstrap", headers={"Authorization": "Bearer " + token})
        assert result.status_code == 503
        assert result.json()["error"]["code"] == "AUTHENTICATION_UNAVAILABLE"
        assert result.json()["error"]["request_id"] == result.headers["X-Request-ID"]
        assert not items(dynamodb_client, user_partition("CaseSensitive-Opaque-Subject"))
        demo = client.post(API + "/demo-sessions")
        assert demo.status_code == 201
        assert (
            client.get(
                API + "/me", headers={"Authorization": "Bearer " + demo.json()["access_token"]}
            ).status_code
            == 200
        )
        assert len(h.provider.calls) == 1
    for private in (
        token,
        "tester@example.com",
        "CaseSensitive-Opaque-Subject",
        "Synthetic provider outage",
    ):
        assert private not in result.text + caplog.text


def test_cognito_only_disables_demo_without_db_or_provider_work(cognito_harness: Harness) -> None:
    h = cognito_harness
    config = build_settings(auth_mode="cognito", **COGNITO_CONFIG)
    db = Mock()
    with TestClient(
        create_app(config, dynamodb_client=db, cognito_authentication=h.verifier)
    ) as client:
        assert client.post(API + "/demo-sessions").status_code == 503
        assert client.get(API + "/me", headers={"Authorization": "Bearer a.b"}).status_code == 401
    assert not db.mock_calls and not h.provider.calls


def test_provider_initialization_is_network_free_and_disabled_cognito_has_no_fallback(
    cognito_harness: Harness,
) -> None:
    h = cognito_harness
    db = Mock()
    verifier = CognitoVerifier(h.settings)  # real transport construction, network fenced
    assert verifier is not None
    app = create_app(
        build_settings(auth_mode="demo"), dynamodb_client=db, cognito_authentication=h.verifier
    )
    assert app.state.settings.enabled_auth_capabilities == (AuthMode.DEMO,)
    with TestClient(app) as client:
        result = client.get(API + "/me", headers=headers(h))
    assert result.status_code == 401 and not db.mock_calls and not h.provider.calls


@pytest.mark.parametrize(
    ("provider_status", "verified", "expected", "code"),
    [
        (401, "true", 401, "AUTHENTICATION_REQUIRED"),
        (429, "true", 503, "AUTHENTICATION_UNAVAILABLE"),
        (503, "true", 503, "AUTHENTICATION_UNAVAILABLE"),
        (200, "false", 403, "ACCOUNT_NOT_VERIFIED"),
    ],
)
def test_provider_admission_api_errors_are_safe(
    cognito_harness: Harness, provider_status: int, verified: str, expected: int, code: str
) -> None:
    h = cognito_harness
    h.provider.user_status = provider_status
    h.provider.profile["email_verified"] = verified
    db = Mock()
    with app_client(h, db) as client:
        result = client.post(API + "/me/bootstrap", headers=headers(h))
    assert result.status_code == expected and result.json()["error"]["code"] == code
    assert not db.mock_calls
    assert (
        "tester@example.com" not in result.text
        and "CaseSensitive-Opaque-Subject" not in result.text
    )


def test_failed_persistent_transaction_is_atomic(
    cognito_harness: Harness, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unavailable(**kwargs: Any) -> None:
        raise ClientError(
            {"Error": {"Code": "ProvisionedThroughputExceededException"}}, "TransactWriteItems"
        )

    monkeypatch.setattr(dynamodb_client, "transact_write_items", unavailable)
    with app_client(cognito_harness, dynamodb_client) as client:
        auth = headers(cognito_harness)
        assert client.post(API + "/me/bootstrap", headers=auth).status_code == 503
        assert (
            client.get(API + "/me", headers=auth).json()["error"]["code"]
            == "WORKSPACE_BOOTSTRAP_REQUIRED"
        )
    assert not items(dynamodb_client, user_partition("CaseSensitive-Opaque-Subject"))


def test_trusted_profile_sync_cannot_race_workspace_freeze(
    cognito_harness: Harness, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = cognito_harness
    owner = "CaseSensitive-Opaque-Subject"
    auth = headers(h)
    with app_client(h, dynamodb_client) as client:
        initial = client.post(API + "/me/bootstrap", headers=auth).json()
        original = dynamodb_client.transact_write_items

        def freeze_then_commit(**kwargs: Any) -> Any:
            dynamodb_client.update_item(
                TableName="HireFluxTest",
                Key=serialize_item({"PK": user_partition(owner), "SK": "WORKSPACE"}),
                UpdateExpression="SET #state = :state",
                ExpressionAttributeNames={"#state": "state"},
                ExpressionAttributeValues=serialize_item({":state": "DELETING"}),
            )
            return original(**kwargs)

        monkeypatch.setattr(dynamodb_client, "transact_write_items", freeze_then_commit)
        h.clock.advance(60)
        h.provider.profile["name"] = "New trusted name"
        result = client.post(API + "/me/bootstrap", headers=auth)
        assert result.status_code == 409 and result.json()["error"]["code"] == "WORKSPACE_DELETING"
        profile = next(
            item
            for item in items(dynamodb_client, user_partition(owner))
            if item["SK"] == "PROFILE"
        )
        assert profile["name"] == initial["profile"]["name"]


@pytest.mark.parametrize("component", ["PROFILE", "SETTINGS"])
def test_active_persistent_recovery_preserves_preferences_or_fails_closed(
    cognito_harness: Harness, dynamodb_client: Any, component: str
) -> None:
    h = cognito_harness
    owner = "CaseSensitive-Opaque-Subject"
    auth = headers(h)
    with app_client(h, dynamodb_client) as client:
        first = client.post(API + "/me/bootstrap", headers=auth).json()
        dynamodb_client.delete_item(
            TableName="HireFluxTest",
            Key=serialize_item({"PK": user_partition(owner), "SK": component}),
        )
        before = items(dynamodb_client, user_partition(owner))
        result = client.post(API + "/me/bootstrap", headers=auth)
        if component == "SETTINGS":
            assert result.status_code == 409
            assert result.json()["error"]["code"] == "WORKSPACE_BOOTSTRAP_CONFLICT"
            assert before == items(dynamodb_client, user_partition(owner))
        else:
            assert result.status_code == 200
            assert result.json()["settings"] == first["settings"]
            assert result.json()["profile"]["email"] == "tester@example.com"
            assert all(
                "expires_at" not in item for item in items(dynamodb_client, user_partition(owner))
            )
