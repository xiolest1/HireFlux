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
@pytest.mark.parametrize("environment", ["test", "production"])
def test_provider_configuration_required(name: str, environment: str) -> None:
    config: dict[str, object] = dict(COGNITO_CONFIG)
    config[name] = None
    with pytest.raises(ValidationError):
        build_settings(
            environment=environment,
            auth_mode="cognito",
            auth_capabilities="demo,cognito",
            cursor_signing_key="C" * 64,
            demo_session_signing_key="D" * 64,
            **config,
        )


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
@pytest.mark.parametrize("environment", ["test", "production"])
def test_provider_trust_is_fixed(name: str, value: str, environment: str) -> None:
    config = {**COGNITO_CONFIG, name: value}
    with pytest.raises(ValidationError):
        build_settings(environment=environment, auth_mode="cognito", **config)


@pytest.mark.parametrize("capabilities", [None, "cognito", "demo,cognito", "cognito,demo"])
def test_production_requires_cognito_anchor_and_explicit_demo_opt_in(
    capabilities: str | None,
) -> None:
    secure = {
        "environment": "production",
        "cursor_signing_key": "C" * 64,
        "demo_session_signing_key": "D" * 64,
        **COGNITO_CONFIG,
    }
    configured = build_settings(auth_mode="cognito", auth_capabilities=capabilities, **secure)
    assert configured.enabled_auth_capabilities == (
        (AuthMode.DEMO, AuthMode.COGNITO)
        if capabilities in {"demo,cognito", "cognito,demo"}
        else (AuthMode.COGNITO,)
    )
    assert not configured.cognito_self_registration_enabled
    assert not configured.persistent_account_management_enabled
    with pytest.raises(ValidationError, match="AUTH_MODE=cognito"):
        build_settings(auth_mode="demo", auth_capabilities="demo,cognito", **secure)


@pytest.mark.parametrize(
    ("mode", "capabilities"),
    [
        ("demo", None),
        ("demo", "demo"),
        ("cognito", "demo"),
        ("cognito", ""),
        ("cognito", "demo,cognito,"),
        ("cognito", "cognito,cognito"),
        ("cognito", "demo,cognito,demo"),
        ("cognito", "local,cognito"),
        ("cognito", "unknown,cognito"),
        ("local", "local"),
    ],
)
def test_unsafe_production_capabilities_fail_closed(mode: str, capabilities: str | None) -> None:
    with pytest.raises(ValidationError):
        build_settings(
            environment="production",
            auth_mode=mode,
            auth_capabilities=capabilities,
            cursor_signing_key="C" * 64,
            demo_session_signing_key="D" * 64,
            **COGNITO_CONFIG,
        )


@pytest.mark.parametrize("hours", [1, 23, 25, 168])
def test_production_demo_lifetime_is_exactly_24_hours(hours: int) -> None:
    with pytest.raises(ValidationError, match="24-hour"):
        build_settings(
            environment="production",
            auth_mode="cognito",
            auth_capabilities="demo,cognito",
            cursor_signing_key="C" * 64,
            demo_session_signing_key="D" * 64,
            demo_session_ttl_hours=hours,
            **COGNITO_CONFIG,
        )


@pytest.mark.parametrize("environment", ["test", "local", "staging"])
def test_existing_demo_anchor_and_configurable_lifetime_remain_compatible(environment: str) -> None:
    configured = build_settings(
        environment=environment,
        auth_mode="demo",
        auth_capabilities="demo,cognito",
        cursor_signing_key="C" * 64,
        demo_session_signing_key="D" * 64,
        demo_session_ttl_hours=1,
        **COGNITO_CONFIG,
    )
    assert configured.enabled_auth_capabilities == (AuthMode.DEMO, AuthMode.COGNITO)
    assert configured.demo_session_ttl_hours == 1


def test_management_requires_explicit_cognito_opt_in() -> None:
    with pytest.raises(ValidationError, match="Cognito capability"):
        build_settings(
            auth_mode="demo", persistent_account_management_enabled=True, **COGNITO_CONFIG
        )
    assert not build_settings(
        auth_mode="cognito", **COGNITO_CONFIG
    ).persistent_account_management_enabled
    assert build_settings(
        auth_mode="cognito", persistent_account_management_enabled=True, **COGNITO_CONFIG
    ).persistent_account_management_enabled
