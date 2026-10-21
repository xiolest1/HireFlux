import runpy
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError

from hireflux_backend.application.account_reconciliation import reconcile_account
from hireflux_backend.application.errors import PersistenceError, WorkspaceBootstrapConflictError
from hireflux_backend.domain.models import IdentityKind
from hireflux_backend.domain.workspace import (
    DurableWorkspace,
    DurableWorkspaceState,
    ProviderFinalizationState,
)
from hireflux_backend.infrastructure.cognito_identity import CognitoIdentityAbsence

POOL = "us-east-1_TESTONLY"
ARN = "arn:aws:cognito-idp:us-east-1:111111119465:userpool/" + POOL
OWNER = "Canonical-Owner"


def terminal() -> DurableWorkspace:
    now = datetime.now(UTC)
    return DurableWorkspace(
        OWNER,
        IdentityKind.PERSISTENT,
        DurableWorkspaceState.DELETED,
        1,
        now,
        now,
        deletion_started_at=now,
        deletion_completed_at=now,
        provider_finalization=ProviderFinalizationState.REVIEW_REQUIRED,
    )


def provider() -> Mock:
    client = Mock()
    client.describe_user_pool.return_value = {
        "UserPool": {"Id": POOL, "Arn": ARN, "UsernameAttributes": ["email"]}
    }
    client.admin_get_user.side_effect = ClientError(
        {"Error": {"Code": "UserNotFoundException"}}, "AdminGetUser"
    )
    return client


def test_operator_only_absence_proof_is_dry_by_default_and_conditional_on_apply() -> None:
    repository = Mock()
    repository.read.return_value = terminal()
    client = provider()
    absence = CognitoIdentityAbsence(POOL, ARN, client)
    assert reconcile_account(repository, absence, owner=OWNER) == "ABSENCE_VERIFIED_REVIEW_ONLY"
    repository.reconcile_absent.assert_not_called()
    repository.reconcile_absent.return_value = replace(
        terminal(),
        provider_finalization=ProviderFinalizationState.COMPLETE,
        provider_finalized_at=datetime.now(UTC),
    )
    assert (
        reconcile_account(repository, absence, owner=OWNER, apply=True) == "FINALIZATION_COMPLETE"
    )
    repository.reconcile_absent.assert_called_once_with(repository.read.return_value)
    client.admin_delete_user.assert_not_called()


@pytest.mark.parametrize(
    "fault",
    [
        "wrong-pool",
        "wrong-arn",
        "alias-pool",
        "wrong-username",
        "foreign-subject",
        "denied",
        "present",
    ],
)
def test_reconciliation_cannot_guess_identity_absence_or_follow_aliases(fault: str) -> None:
    client = provider()
    pool = client.describe_user_pool.return_value["UserPool"]
    if fault == "wrong-pool":
        pool["Id"] = "us-east-1_OTHER"
    if fault == "wrong-arn":
        pool["Arn"] = ARN.replace("9465", "9999")
    if fault == "alias-pool":
        pool["AliasAttributes"] = ["email"]
    if fault in {"wrong-username", "foreign-subject", "present"}:
        client.admin_get_user.side_effect = None
        client.admin_get_user.return_value = {
            "Username": "mutable@example.com" if fault == "wrong-username" else OWNER,
            "UserAttributes": [
                {"Name": "sub", "Value": "Foreign" if fault == "foreign-subject" else OWNER}
            ],
        }
    if fault == "denied":
        client.admin_get_user.side_effect = ClientError(
            {"Error": {"Code": "AccessDeniedException"}}, "AdminGetUser"
        )
    repository = Mock()
    repository.read.return_value = terminal()
    if fault == "present":
        assert (
            reconcile_account(
                repository, CognitoIdentityAbsence(POOL, ARN, client), owner=OWNER, apply=True
            )
            == "IDENTITY_PRESENT_REVIEW_REQUIRED"
        )
    else:
        with pytest.raises((PersistenceError, WorkspaceBootstrapConflictError)):
            reconcile_account(
                repository, CognitoIdentityAbsence(POOL, ARN, client), owner=OWNER, apply=True
            )
    repository.reconcile_absent.assert_not_called()
    client.admin_delete_user.assert_not_called()


def test_operator_cli_is_inert_without_explicit_live_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    script = Path(__file__).parents[2] / "scripts/reconcile_account_finalization.py"
    session = Mock()
    monkeypatch.setattr("boto3.Session", session)
    monkeypatch.setattr("sys.argv", [str(script)])
    with pytest.raises(SystemExit) as stopped:
        runpy.run_path(str(script), run_name="__main__")
    assert stopped.value.code == 0
    session.assert_not_called()
