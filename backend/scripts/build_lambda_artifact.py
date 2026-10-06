"""Build a locked, deterministic Python 3.14 Linux x86_64 Lambda ZIP."""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import json
import shutil
import stat
import struct
import subprocess
import sys
import tempfile
import warnings
import zipfile
from email.parser import Parser
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
OUTPUT = ROOT / "artifacts/lambda/hireflux-backend-lambda.zip"
UV_VERSION = "0.12.5"
PLATFORM = "x86_64-manylinux_2_34"
MIB = 1024 * 1024
COMPRESSED_LIMIT = 40 * MIB
EXPANDED_LIMIT = 200 * MIB
FORBIDDEN_PARTS = {
    "__pycache__",
    ".git",
    "node_modules",
    ".venv",
    ".aws",
}
FORBIDDEN_ROOTS = {
    "backend",
    "frontend",
    "infra",
    "tests",
    "test",
    "docs",
    "scripts",
    "Diagrams",
    "pytest",
    "_pytest",
    "moto",
    "mypy",
    "ruff",
    "httpx",
    "boto3-stubs",
    "botocore-stubs",
}
FORBIDDEN_SUFFIXES = {".pyc", ".pyo", ".pyd", ".dll", ".exe", ".whl"}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def checked_file(path: Path, root: Path) -> bytes:
    relative = path.relative_to(root)
    if path.is_symlink() or any(parent.is_symlink() for parent in path.parents if parent != root):
        raise ValueError(f"Symlinks are forbidden: {relative.as_posix()}")
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Package member escaped the staging directory.")
    if (
        any(part in FORBIDDEN_PARTS or part.startswith(".env") for part in relative.parts)
        or relative.parts[0] in FORBIDDEN_ROOTS
        or path.suffix.lower() in FORBIDDEN_SUFFIXES
        or path.name in {"credentials", "config.json", "direct_url.json"}
    ):
        raise ValueError(f"Prohibited package member: {relative.as_posix()}")
    data = path.read_bytes()
    if path.suffix == ".so":
        # ELF64, little-endian, EM_X86_64. Actual linking/import is tested in Linux.
        if data[:6] != b"\x7fELF\x02\x01" or struct.unpack_from("<H", data, 18)[0] != 62:
            raise ValueError(f"Not a Linux x86_64 ELF library: {relative.as_posix()}")
    return data


def normalize_install(stage: Path) -> None:
    # Console launchers and uv's install lock are not Lambda runtime inputs.
    launchers = stage / "bin"
    if launchers.exists():
        if launchers.is_symlink() or not launchers.resolve().is_relative_to(stage.resolve()):
            raise ValueError("Unsafe launcher directory.")
        shutil.rmtree(launchers)
    (stage / ".lock").unlink(missing_ok=True)
    # Keep valid, relative RECORD metadata after excluding console launchers.
    for record in sorted(stage.glob("*.dist-info/RECORD")):
        rows = []
        for row in csv.reader(io.StringIO(record.read_text(encoding="utf-8"))):
            name = row[0]
            member = stage / name
            if not member.resolve().is_relative_to(stage.resolve()):
                raise ValueError("Installed metadata contains an external path.")
            if not member.is_file():
                continue
            if member == record:
                rows.append((name, "", ""))
            else:
                data = checked_file(member, stage)
                checksum = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=")
                rows.append((name, "sha256=" + checksum.decode("ascii"), str(len(data))))
        stream = io.StringIO(newline="")
        csv.writer(stream, lineterminator="\n").writerows(sorted(rows))
        record.write_bytes(stream.getvalue().encode("utf-8"))


def write_zip(stage: Path, output: Path) -> dict[str, Any]:
    files = []
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(
            stage.rglob("*"), key=lambda member: member.relative_to(stage).as_posix()
        ):
            if path.is_symlink():
                raise ValueError("Symlinks are forbidden in the package tree.")
            if not path.is_file():
                continue
            data = checked_file(path, stage)
            name = path.relative_to(stage).as_posix()
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
            files.append({"path": name, "bytes": len(data), "sha256": digest(data)})
    compressed = output.stat().st_size
    expanded = sum(file["bytes"] for file in files)
    if compressed > COMPRESSED_LIMIT or expanded > EXPANDED_LIMIT:
        raise ValueError(
            "Lambda artifact exceeds the project's 40 MiB ZIP / 200 MiB expanded budget."
        )
    if compressed > 30 * MIB or expanded > 150 * MIB:
        warnings.warn("Lambda artifact is approaching the project size budget.", stacklevel=2)
    distributions = []
    for metadata in sorted(stage.glob("*.dist-info/METADATA")):
        parsed = Parser().parsestr(metadata.read_text(encoding="utf-8"))
        distributions.append({"name": parsed["Name"], "version": parsed["Version"]})
    return {
        "schema_version": 1,
        "runtime": "python3.14",
        "architecture": "x86_64",
        "wheel_platform": PLATFORM,
        "handler": "hireflux_backend.lambda_handler.handler",
        "uv_version": UV_VERSION,
        "lock_sha256": digest((BACKEND / "uv.lock").read_bytes()),
        "project_sha256": digest((BACKEND / "pyproject.toml").read_bytes()),
        "sha256": digest(output.read_bytes()),
        "compressed_bytes": compressed,
        "expanded_bytes": expanded,
        "file_count": len(files),
        "distributions": distributions,
        "files": files,
    }


def build(uv: str, output: Path) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="hireflux-lambda-build-") as temporary:
        scratch = Path(temporary)
        requirements = scratch / "requirements.txt"
        stage = scratch / "package"
        subprocess.run(
            [
                uv,
                "export",
                "--project",
                str(BACKEND),
                "--locked",
                "--no-dev",
                "--no-emit-project",
                "--no-header",
                "--no-annotate",
                "--python",
                sys.executable,
                "--output-file",
                str(requirements),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        subprocess.run(
            [
                uv,
                "pip",
                "install",
                "--python",
                sys.executable,
                "--python-version",
                "3.14",
                "--python-platform",
                PLATFORM,
                "--only-binary",
                ":all:",
                "--require-hashes",
                "--no-deps",
                "--no-config",
                "--target",
                str(stage),
                "-r",
                str(requirements),
            ],
            check=True,
        )
        normalize_install(stage)
        source = BACKEND / "src/hireflux_backend"
        if source.is_symlink() or any(path.is_symlink() for path in source.rglob("*")):
            raise ValueError("Symlinks are forbidden in the application source tree.")
        for path in sorted(source.rglob("*.py")):
            data = checked_file(path, source).replace(b"\r\n", b"\n")
            destination = stage / "hireflux_backend" / path.relative_to(source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        return write_zip(stage, output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uv", default="uv", help="Path to the pinned uv executable")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--verify-reproducible", action="store_true")
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 14):
        parser.error("Run this builder with standard CPython 3.14.")
    version = subprocess.check_output([args.uv, "--version"], text=True).split()
    if version[:2] != ["uv", UV_VERSION]:
        parser.error(f"uv {UV_VERSION} is required.")
    manifest = build(args.uv, args.output)
    if args.verify_reproducible:
        with tempfile.TemporaryDirectory(prefix="hireflux-lambda-repeat-") as temporary:
            repeated = build(args.uv, Path(temporary) / "repeat.zip")
        if manifest != repeated:
            raise RuntimeError("Two clean builds produced different ZIP bytes or inventories.")
        print("Two clean builds: identical SHA-256, sizes, distributions and file inventory.")
    manifest_path = args.output.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                key: manifest[key]
                for key in ("sha256", "compressed_bytes", "expanded_bytes", "file_count")
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
