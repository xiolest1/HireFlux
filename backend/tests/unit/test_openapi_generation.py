import json
import os
import subprocess
import sys
from pathlib import Path

from hireflux_backend.config import Settings

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def isolated_environment() -> dict[str, str]:
    # conftest's settings would otherwise hide the clean-runner import failure.
    settings_keys = {name.upper() for name in Settings.model_fields}
    settings_keys.update({"AWS_LAMBDA_FUNCTION_NAME", "AWS_EXECUTION_ENV"})
    environment = {
        key: value for key, value in os.environ.items() if key.upper() not in settings_keys
    }
    environment["PYTHONPATH"] = str(REPOSITORY_ROOT / "backend" / "src")
    environment["AWS_EC2_METADATA_DISABLED"] = "true"
    return environment


def test_openapi_generation_without_runtime_configuration(tmp_path: Path) -> None:
    output = tmp_path / "artifacts" / "contract.json"
    result = subprocess.run(
        [
            sys.executable,
            str(REPOSITORY_ROOT / "backend" / "scripts" / "generate_openapi.py"),
            "--output",
            str(output),
        ],
        cwd=tmp_path,
        env=isolated_environment(),
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    contract = json.loads(output.read_text(encoding="utf-8"))
    assert contract["info"]["title"] == "HireFlux API"
    assert "/health" in contract["paths"]
    assert "/api/v1/applications" in contract["paths"]
    assert "/api/v1/demo-sessions" in contract["paths"]


def test_factory_import_does_not_initialize_aws_or_runtime_app(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import boto3, sys\n"
            "def forbidden_client(*args, **kwargs):\n"
            "    raise AssertionError('Import must not initialize an AWS client')\n"
            "boto3.client = forbidden_client\n"
            "from hireflux_backend.app_factory import create_app\n"
            "assert callable(create_app)\n"
            "assert 'hireflux_backend.main' not in sys.modules\n",
        ],
        cwd=tmp_path,
        env=isolated_environment(),
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr


def test_runtime_entry_point_still_requires_configuration(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import hireflux_backend.main"],
        cwd=tmp_path,
        env=isolated_environment(),
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode != 0
    assert "ValidationError" in result.stderr
    for field in ("environment", "auth_mode", "cursor_signing_key"):
        assert f"{field}\n  Field required" in result.stderr
