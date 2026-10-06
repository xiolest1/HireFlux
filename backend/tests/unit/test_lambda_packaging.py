import importlib.util
import json
import stat
import struct
import zipfile
from pathlib import Path
from typing import Any

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/build_lambda_artifact.py"
SPEC = importlib.util.spec_from_file_location("lambda_builder", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
builder: Any = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


def test_zip_is_sorted_normalized_and_independent_of_source_mtime(tmp_path: Path) -> None:
    stage = tmp_path / "package"
    stage.mkdir()
    (stage / "z.py").write_bytes(b"z = 1\n")
    (stage / "a.py").write_bytes(b"a = 1\n")
    first = builder.write_zip(stage, tmp_path / "first.zip")
    (stage / "a.py").touch()
    (stage / "z.py").chmod(0o600)
    second = builder.write_zip(stage, tmp_path / "second.zip")
    assert first == second
    with zipfile.ZipFile(tmp_path / "first.zip") as archive:
        assert archive.namelist() == ["a.py", "z.py"]
        for member in archive.infolist():
            assert member.date_time == (1980, 1, 1, 0, 0, 0)
            assert member.external_attr >> 16 == stat.S_IFREG | 0o644
    assert str(tmp_path) not in json.dumps(first)


@pytest.mark.parametrize(
    "name",
    [
        ".env",
        ".env.production",
        "frontend/index.js",
        "tests/test_app.py",
        "pytest/__init__.py",
        "pkg/__pycache__/cached.pyc",
        "pkg/native.pyd",
        ".aws/credentials",
        "pkg/direct_url.json",
    ],
)
def test_prohibited_files_fail_the_build(tmp_path: Path, name: str) -> None:
    path = tmp_path / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"forbidden")
    with pytest.raises(ValueError, match="Prohibited"):
        builder.checked_file(path, tmp_path)


def test_native_binary_requires_linux_x86_64_elf(tmp_path: Path) -> None:
    path = tmp_path / "native.so"
    path.write_bytes(b"MZ" + bytes(30))
    with pytest.raises(ValueError, match="ELF"):
        builder.checked_file(path, tmp_path)
    header = bytearray(64)
    header[:6] = b"\x7fELF\x02\x01"
    struct.pack_into("<H", header, 18, 183)  # EM_AARCH64
    path.write_bytes(header)
    with pytest.raises(ValueError, match="ELF"):
        builder.checked_file(path, tmp_path)


def test_sdk_runtime_docs_are_preserved(tmp_path: Path) -> None:
    path = tmp_path / "boto3/docs/__init__.py"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"# Runtime SDK helper\n")
    assert builder.checked_file(path, tmp_path)


def test_symlinks_are_rejected_without_requiring_windows_link_privileges(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    path = tmp_path / "linked.py"
    path.write_bytes(b"linked")
    monkeypatch.setattr(Path, "is_symlink", lambda self: self == path)
    with pytest.raises(ValueError, match="Symlinks"):
        builder.checked_file(path, tmp_path)


def test_expanded_artifact_budget_is_enforced(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    stage = tmp_path / "package"
    stage.mkdir()
    (stage / "large.py").write_bytes(bytes(64))
    monkeypatch.setattr(builder, "EXPANDED_LIMIT", 32)
    with pytest.raises(ValueError, match="budget"):
        builder.write_zip(stage, tmp_path / "oversized.zip")
