import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from hireflux_backend.infrastructure.dynamodb.table_schema import (
    TTL_ATTRIBUTE,
    create_table_request,
)

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "backend/scripts/export_dynamodb_schema.py"


def test_export_uses_the_live_initializer_contract_without_configuration(tmp_path: Path) -> None:
    environment = {
        name: value
        for name, value in os.environ.items()
        if not name.startswith("AWS_") and name not in {"ENVIRONMENT", "AUTH_MODE"}
    }
    environment["PYTHONPATH"] = str(ROOT / "backend/src")
    output = tmp_path / "schema.json"
    guarded_export = (
        "import boto3, socket, runpy, sys\n"
        "def forbidden(*args, **kwargs):\n"
        "    raise AssertionError('Schema export cannot create clients or use network')\n"
        "boto3.client = forbidden\n"
        "boto3.session.Session.client = forbidden\n"
        "socket.socket.connect = forbidden\n"
        "socket.getaddrinfo = forbidden\n"
        "sys.argv = sys.argv[1:]\n"
        "runpy.run_path(sys.argv[0], run_name='__main__')\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", guarded_export, str(SCRIPT), "--output", str(output)],
        cwd=tmp_path,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    exported = json.loads(output.read_text())
    expected = create_table_request("unused")
    expected.pop("TableName")
    expected["TimeToLiveSpecification"] = {"AttributeName": TTL_ATTRIBUTE, "Enabled": True}
    assert exported == {"schema_version": 1, "table_schema": expected}
    assert result.stdout == ""


def test_export_reflects_canonical_schema_and_ttl_changes(monkeypatch: pytest.MonkeyPatch) -> None:
    spec = importlib.util.spec_from_file_location("export_schema", SCRIPT)
    assert spec is not None and spec.loader is not None
    helper: Any = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    altered = create_table_request("unused")
    altered["GlobalSecondaryIndexes"][1]["KeySchema"][1]["AttributeName"] = "GSI2_SORT"
    monkeypatch.setattr(helper, "create_table_request", lambda name: altered)
    monkeypatch.setattr(helper, "TTL_ATTRIBUTE", "expiration")
    exported = helper.schema_contract()["table_schema"]
    assert exported["GlobalSecondaryIndexes"][1]["KeySchema"][1]["AttributeName"] == "GSI2_SORT"
    assert exported["TimeToLiveSpecification"]["AttributeName"] == "expiration"
