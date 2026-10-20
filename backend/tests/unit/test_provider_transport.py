import ssl
from typing import Any
from unittest.mock import Mock

import pytest

from hireflux_backend.application.errors import AuthenticationUnavailableError
from hireflux_backend.auth.provider import AuthBudget, HttpsProviderTransport, json_object

ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY"
DOMAIN = "https://hireflux-test-only.auth.us-east-1.amazoncognito.com"


def transport_fixture(monkeypatch: pytest.MonkeyPatch) -> tuple[HttpsProviderTransport, Mock, Mock]:
    response = Mock(status=200)
    response.getheader.side_effect = lambda name, default=None: default
    response.read1.side_effect = [b'{"keys":[]}', b""]
    connection = Mock()
    connection.getresponse.return_value = response
    constructor = Mock(return_value=connection)
    monkeypatch.setattr("hireflux_backend.auth.provider.http.client.HTTPSConnection", constructor)
    transport = HttpsProviderTransport(ISSUER, DOMAIN)
    assert transport._tls.verify_mode == ssl.CERT_REQUIRED
    assert transport._tls.check_hostname is True
    return transport, connection, response


def test_pinned_tls_transport_one_request_and_no_redirects(monkeypatch: pytest.MonkeyPatch) -> None:
    transport, connection, _ = transport_fixture(monkeypatch)
    response = transport.get(
        ISSUER + "/.well-known/jwks.json",
        bearer=None,
        max_bytes=65536,
        budget=AuthBudget(4, lambda: 0),
    )
    assert response.status == 200 and response.body == b'{"keys":[]}'
    connection.connect.assert_called_once()
    connection.request.assert_called_once_with(
        "GET",
        "/us-east-1_TESTONLY/.well-known/jwks.json",
        headers={"Accept": "application/json", "Accept-Encoding": "identity"},
    )
    connection.close.assert_called_once()


@pytest.mark.parametrize(
    "url",
    [
        "http://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTONLY/.well-known/jwks.json",
        "https://attacker.invalid/jwks",
        DOMAIN + "/oauth2/userInfo?other=1",
        ISSUER + "/other",
    ],
)
def test_untrusted_urls_never_open_connection(monkeypatch: pytest.MonkeyPatch, url: str) -> None:
    transport, connection, _ = transport_fixture(monkeypatch)
    with pytest.raises(AuthenticationUnavailableError):
        transport.get(url, bearer=None, max_bytes=65536, budget=AuthBudget(4, lambda: 0))
    connection.connect.assert_not_called()


@pytest.mark.parametrize("status", [301, 302, 401, 403, 429, 500])
def test_no_error_body_read_retry_or_redirect(monkeypatch: pytest.MonkeyPatch, status: int) -> None:
    transport, connection, response = transport_fixture(monkeypatch)
    response.status = status
    result = transport.get(
        DOMAIN + "/oauth2/userInfo",
        bearer="synthetic-test-only",
        max_bytes=16384,
        budget=AuthBudget(4, lambda: 0),
    )
    assert result.status == status and result.body == b""
    response.read1.assert_not_called()
    connection.request.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize("failure", ["length", "encoding", "stream", "timeout", "dribble", "json"])
def test_transport_size_time_and_response_limits(
    monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    transport, connection, response = transport_fixture(monkeypatch)
    ticks = [0.0]
    if failure == "length":
        response.getheader.side_effect = lambda name, default=None: (
            "65537" if name == "Content-Length" else default
        )
    elif failure == "encoding":
        response.getheader.side_effect = lambda name, default=None: (
            "gzip" if name == "Content-Encoding" else default
        )
    elif failure == "stream":
        response.read1.side_effect = [b"a" * 65536, b"a"]
    elif failure == "timeout":
        connection.connect.side_effect = TimeoutError(
            "untrusted diagnostic with synthetic credential"
        )
    elif failure == "dribble":

        def dribble(*args: Any) -> bytes:
            ticks[0] += 1.1
            return b"a"

        response.read1.side_effect = dribble
    else:
        with pytest.raises(ValueError):
            json_object(b'{"sub":"a","sub":"b"}')
        return
    with pytest.raises(AuthenticationUnavailableError) as result:
        transport.get(
            ISSUER + "/.well-known/jwks.json",
            bearer=None,
            max_bytes=65536,
            budget=AuthBudget(4, lambda: ticks[0]),
        )
    assert "untrusted" not in str(result.value) and "credential" not in str(result.value)
    assert connection.connect.call_count == 1 and connection.request.call_count <= 1
    connection.close.assert_called_once()
