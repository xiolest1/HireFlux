import pytest
from cognito_fixtures import COGNITO_CONFIG
from conftest import test_settings as build_settings
from pydantic import ValidationError

from hireflux_backend.config import AuthMode


@pytest.mark.parametrize(
    ("mode", "capabilities", "expected"),
    [
        ("local", None, (AuthMode.LOCAL,)),
        ("demo", None, (AuthMode.DEMO,)),
        ("local", "local", (AuthMode.LOCAL,)),
        ("demo", "demo", (AuthMode.DEMO,)),
        ("cognito", "cognito", (AuthMode.COGNITO,)),
        ("cognito", None, (AuthMode.COGNITO,)),
        ("demo", "demo,cognito", (AuthMode.DEMO, AuthMode.COGNITO)),
        ("cognito", "cognito,demo", (AuthMode.DEMO, AuthMode.COGNITO)),
    ],
)
def test_valid_capabilities(
    mode: str, capabilities: str | None, expected: tuple[AuthMode, ...]
) -> None:
    settings = build_settings(auth_mode=mode, auth_capabilities=capabilities, **COGNITO_CONFIG)
    assert settings.enabled_auth_capabilities == expected


@pytest.mark.parametrize(
    "capabilities", ["", "demo,", ",demo", "demo,demo", "other", "local,demo", "local,cognito"]
)
def test_invalid_capabilities(capabilities: str) -> None:
    with pytest.raises(ValidationError):
        build_settings(auth_mode="demo", auth_capabilities=capabilities, **COGNITO_CONFIG)


def test_anchor_and_environments_cannot_enable_local_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError, match="belong"):
        build_settings(auth_mode="local", auth_capabilities="demo,cognito", **COGNITO_CONFIG)
    for environment in ("staging", "production"):
        with pytest.raises(ValidationError, match="forbidden outside"):
            build_settings(environment=environment, auth_capabilities="local")
    monkeypatch.setenv("AWS_EXECUTION_ENV", "AWS_Lambda_python3.14")
    with pytest.raises(ValidationError, match="Lambda"):
        build_settings(auth_capabilities="local")


@pytest.mark.parametrize("name", list(COGNITO_CONFIG))
def test_provider_configuration_required(name: str) -> None:
    config: dict[str, object] = dict(COGNITO_CONFIG)
    config[name] = None
    with pytest.raises(ValidationError):
        build_settings(auth_mode="demo", auth_capabilities="demo,cognito", **config)


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("cognito_user_pool_id", "eu-west-1_TEST"),
        ("cognito_user_pool_id", "us-east-1_pool/other"),
        ("cognito_app_client_id", "has spaces"),
        ("aws_region", "eu-west-1"),
        ("cognito_domain", "http://hireflux.auth.us-east-1.amazoncognito.com"),
        ("cognito_domain", "https://hireflux.auth.eu-west-1.amazoncognito.com"),
        ("cognito_domain", "https://hireflux.auth.us-east-1.amazoncognito.com/"),
        ("cognito_domain", "https://hireflux.auth.us-east-1.amazoncognito.com?x=1"),
        ("cognito_domain", "https://hireflux.auth.us-east-1.amazoncognito.com.attacker.invalid"),
        ("cognito_domain", "https://u@hireflux.auth.us-east-1.amazoncognito.com"),
        ("cognito_domain", "https://hireflux.auth.us-east-1.amazoncognito.com:443"),
    ],
)
def test_provider_trust_is_fixed(name: str, value: str) -> None:
    config = {**COGNITO_CONFIG, name: value}
    with pytest.raises(ValidationError):
        build_settings(auth_mode="cognito", **config)


def test_production_only_cognito_and_account_management_stays_off() -> None:
    secure = {
        "environment": "production",
        "cursor_signing_key": "C" * 64,
        "demo_session_signing_key": "D" * 64,
        **COGNITO_CONFIG,
    }
    assert build_settings(auth_mode="cognito", **secure).enabled_auth_capabilities == (
        AuthMode.COGNITO,
    )
    with pytest.raises(ValidationError, match="Cognito-only"):
        build_settings(auth_mode="demo", auth_capabilities="demo,cognito", **secure)
    for mode in ("demo", "cognito"):
        with pytest.raises(ValidationError, match="5D"):
            build_settings(
                auth_mode=mode, persistent_account_management_enabled=True, **COGNITO_CONFIG
            )
