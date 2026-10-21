"""Real JWT/fresh admission + Moto erasure/finalization; no provider traffic."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from typing import Any
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError, ReadTimeoutError
from cognito_fixtures import Harness
from fastapi.testclient import TestClient

from hireflux_backend.app_factory import create_app
from hireflux_backend.application.account_lifecycle import DefiniteProviderRejection
from hireflux_backend.application.errors import PersistenceError, WorkspaceBootstrapConflictError
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import ProviderFinalizationState
from hireflux_backend.infrastructure.cognito_identity import CognitoIdentityDeletion
from hireflux_backend.infrastructure.dynamodb.mapping import (
    deserialize_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.workspace_finalization_repository import (
    DynamoFinalizationRepository,
)

OWNER = "CaseSensitive-Opaque-Subject"
CONFIRM = {"confirmation": "DELETE_MY_ACCOUNT"}
API = "/api/v1"


def auth(h: Harness, **claims: Any) -> dict[str, str]:
    return {"Authorization": "Bearer " + h.token(username=OWNER, **claims)}


def owner_items(db: Any, owner: str = OWNER) -> list[dict[str, Any]]:
    return [
        deserialize_item(item)
        for item in db.query(
            TableName="HireFluxTest",
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues=serialize_item({":pk": user_partition(owner)}),
            ConsistentRead=True,
        )["Items"]
    ]


def client_for(h: Harness, db: Any, provider: Any, **settings: Any) -> TestClient:
    configured = h.settings.model_copy(
        update={"persistent_account_management_enabled": True, **settings}
    )
    return TestClient(
        create_app(
            configured,
            dynamodb_client=db,
            cognito_authentication=h.verifier,
            identity_deletion=provider,
            account_clock=lambda: h.clock.now,
        )
    )


def bootstrap(client: TestClient, headers: dict[str, str]) -> None:
    assert client.post(API + "/me/bootstrap", headers=headers).status_code == 200


def test_erase_precedes_provider_and_leaves_only_minimal_terminal_tombstone(
    cognito_harness: Harness, dynamodb_client: Any
) -> None:
    h, db = cognito_harness, dynamodb_client
    provider = Mock()

    def verify_erased(username: str) -> None:
        assert username == OWNER
        rows = owner_items(db)
        assert len(rows) == 1 and rows[0]["state"] == "DELETED"
        assert rows[0]["provider_finalization"] == "REVIEW_REQUIRED"
        assert "email" not in str(rows) and "expires_at" not in str(rows)

    provider.delete.side_effect = verify_erased
    with client_for(h, db, provider) as client:
        headers = auth(h)
        bootstrap(client, headers)
        made = client.post(
            API + "/applications",
            headers=headers,
            json={"company_name": "Fictional", "job_title": "Test", "status": "DRAFT"},
        )
        assert made.status_code == 201
        result = client.request("DELETE", API + "/me", headers=headers, json=CONFIRM)
        assert result.status_code == 200, result.text
        assert result.json()["provider_finalization"] == "COMPLETE"
        assert result.json()["provider_finalized_at"]
        assert result.headers["Cache-Control"] == "no-store"
        assert (
            client.post(API + "/me/bootstrap", headers=headers).json()["error"]["code"]
            == "WORKSPACE_DELETED"
        )
        assert client.get(API + "/applications", headers=headers).status_code == 409
        assert client.get(API + "/me/export", headers=headers).status_code == 409
        assert (
            client.post(API + "/me/deletion/retry", headers=headers, json=CONFIRM).status_code
            == 200
        )
    provider.delete.assert_called_once_with(OWNER)
    rows = owner_items(db)
    assert len(rows) == 1 and rows[0]["provider_finalization"] == "COMPLETE"
    assert not any(
        key in rows[0]
        for key in (
            "name",
            "email",
            "access_token",
            "refresh_token",
            "application_manifest_version",
        )
    )


@pytest.mark.parametrize(
    "confirmation",
    [
        None,
        {},
        {"confirmation": "delete_my_account"},
        {"confirmation": "DELETE_MY_ACCOUNT", "owner_user_id": "foreign"},
    ],
)
def test_confirmation_is_enforced_before_any_erase(
    cognito_harness: Harness, dynamodb_client: Any, confirmation: Any
) -> None:
    h, db, provider = cognito_harness, dynamodb_client, Mock()
    with client_for(h, db, provider) as client:
        headers = auth(h)
        bootstrap(client, headers)
        before = owner_items(db)
        result = client.request("DELETE", API + "/me", headers=headers, json=confirmation)
        assert result.status_code == 422
        assert owner_items(db) == before
    provider.delete.assert_not_called()


@pytest.mark.parametrize("age", [301, 3600])
def test_refresh_iat_does_not_replace_recent_auth_time_for_export_or_delete(
    cognito_harness: Harness, dynamodb_client: Any, age: int
) -> None:
    h, db, provider = cognito_harness, dynamodb_client, Mock()
    with client_for(h, db, provider) as client:
        bootstrap(client, auth(h))
        headers = auth(h, auth_time=int(h.clock.now) - age)
        before = owner_items(db)
        for method, path, kwargs in [
            ("GET", "/me/export", {}),
            ("DELETE", "/me", {"json": CONFIRM}),
        ]:
            result = client.request(method, API + path, headers=headers, **kwargs)
            assert result.status_code == 403
            assert result.json()["error"]["code"] == "RECENT_AUTHENTICATION_REQUIRED"
        assert owner_items(db) == before
        assert client.get(API + "/me/applications/export", headers=headers).status_code == 200
    provider.delete.assert_not_called()


def test_full_json_requires_uncached_verified_admission_and_exact_principal(
    cognito_harness: Harness, dynamodb_client: Any
) -> None:
    h, db, provider = cognito_harness, dynamodb_client, Mock()
    with client_for(h, db, provider) as client:
        headers = auth(h)
        bootstrap(client, headers)
        calls = len(h.provider.token_hashes)
        assert client.get(API + "/me/export", headers=headers).status_code == 200
        assert len(h.provider.token_hashes) == calls + 1
        h.provider.profile["email_verified"] = "false"
        assert (
            client.get(API + "/me/export", headers=headers).json()["error"]["code"]
            == "ACCOUNT_NOT_VERIFIED"
        )
        h.provider.profile["email_verified"] = "true"
        h.provider.user_failure = True
        assert (
            client.request("DELETE", API + "/me", headers=headers, json=CONFIRM).status_code == 503
        )
        assert owner_items(db)[-1]["state"] == "ACTIVE"
    provider.delete.assert_not_called()


@pytest.mark.parametrize(
    "failure", [PersistenceError("ambiguous"), DefiniteProviderRejection("definite")]
)
def test_provider_failures_never_reactivate_and_unknown_outcome_is_not_retried(
    cognito_harness: Harness, dynamodb_client: Any, failure: Exception
) -> None:
    h, db, provider = cognito_harness, dynamodb_client, Mock()
    provider.delete.side_effect = failure
    with client_for(h, db, provider) as client:
        headers = auth(h)
        bootstrap(client, headers)
        result = client.request("DELETE", API + "/me", headers=headers, json=CONFIRM)
        assert result.status_code == 202 and result.json()["state"] == "DELETED"
        expected = (
            "PENDING" if isinstance(failure, DefiniteProviderRejection) else "REVIEW_REQUIRED"
        )
        assert result.json()["provider_finalization"] == expected
        assert client.post(API + "/me/bootstrap", headers=headers).status_code == 409
        if expected == "REVIEW_REQUIRED":
            assert (
                client.post(API + "/me/deletion/retry", headers=headers, json=CONFIRM).json()[
                    "provider_finalization"
                ]
                == expected
            )
            provider.delete.assert_called_once()
        else:
            provider.delete.side_effect = None
            assert (
                client.post(API + "/me/deletion/retry", headers=headers, json=CONFIRM).json()[
                    "provider_finalization"
                ]
                == "COMPLETE"
            )
            assert provider.delete.call_count == 2


def test_success_then_completion_write_loss_requires_operator_reconciliation(
    cognito_harness: Harness, dynamodb_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    h, db, provider = cognito_harness, dynamodb_client, Mock()
    app = client_for(h, db, provider)
    service = app.app.state.account_lifecycle_service
    monkeypatch.setattr(
        service.finalization, "complete", Mock(side_effect=PersistenceError("lost write"))
    )
    with app as client:
        headers = auth(h)
        bootstrap(client, headers)
        result = client.request("DELETE", API + "/me", headers=headers, json=CONFIRM)
        assert result.json()["provider_finalization"] == "REVIEW_REQUIRED"
        h.provider.user_status = 401  # Provider deletion has removed login/admission.
        assert (
            client.post(API + "/me/deletion/retry", headers=headers, json=CONFIRM).status_code
            == 401
        )
    provider.delete.assert_called_once()
    repository = DynamoFinalizationRepository(db, "HireFluxTest")
    terminal = repository.read(OWNER)
    assert (
        repository.reconcile_absent(terminal).provider_finalization
        is ProviderFinalizationState.COMPLETE
    )


def test_foreign_or_alias_identity_cannot_target_another_workspace(
    cognito_harness: Harness, dynamodb_client: Any
) -> None:
    h, db, provider = cognito_harness, dynamodb_client, Mock()
    with client_for(h, db, provider) as client:
        bootstrap(client, auth(h))
        before = owner_items(db)
        other = {
            "Authorization": "Bearer " + h.token(sub="Other-Subject", username="Other-Subject")
        }
        assert client.request("DELETE", API + "/me", headers=other, json=CONFIRM).status_code == 409
        alias = {"Authorization": "Bearer " + h.token(username="tester@example.com")}
        assert client.request("DELETE", API + "/me", headers=alias, json=CONFIRM).status_code == 401
        assert before == owner_items(db)
    provider.delete.assert_not_called()


def test_conditional_dispatch_has_one_winner_and_provenance_failures_close(
    cognito_harness: Harness, dynamodb_client: Any
) -> None:
    h, db, provider = cognito_harness, dynamodb_client, Mock()
    provider.delete.side_effect = PersistenceError("uncertain")
    with client_for(h, db, provider) as client:
        headers = auth(h)
        bootstrap(client, headers)
        client.request("DELETE", API + "/me", headers=headers, json=CONFIRM)
    repository = DynamoFinalizationRepository(db, "HireFluxTest")
    terminal = repository.read(OWNER)
    pending = repository.rejected(terminal)
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(lambda _: repository.arm(pending), range(2))).count(True) == 1
    with pytest.raises(WorkspaceBootstrapConflictError):
        repository.arm(replace(terminal, identity_kind=IdentityKind.LOCAL))


@pytest.mark.parametrize(
    "code",
    [
        "UserNotFoundException",
        "AccessDeniedException",
        "TooManyRequestsException",
        "InternalErrorException",
    ],
)
def test_provider_adapter_is_one_attempt_and_distinguishes_explicit_rejection(code: str) -> None:
    sdk = Mock()
    sdk.admin_delete_user.side_effect = ClientError({"Error": {"Code": code}}, "AdminDeleteUser")
    adapter = CognitoIdentityDeletion("us-east-1_TESTONLY", "us-east-1", client=sdk)
    if code == "UserNotFoundException":
        adapter.delete(OWNER)
    else:
        expected = (
            DefiniteProviderRejection
            if code in {"AccessDeniedException", "TooManyRequestsException"}
            else PersistenceError
        )
        with pytest.raises(expected):
            adapter.delete(OWNER)
    sdk.admin_delete_user.assert_called_once_with(UserPoolId="us-east-1_TESTONLY", Username=OWNER)


def test_provider_timeout_is_ambiguous_without_retry() -> None:
    sdk = Mock()
    sdk.admin_delete_user.side_effect = ReadTimeoutError(endpoint_url="https://synthetic.invalid")
    with pytest.raises(PersistenceError):
        CognitoIdentityDeletion("us-east-1_TESTONLY", "us-east-1", client=sdk).delete(OWNER)
    sdk.admin_delete_user.assert_called_once()
