"""Generate a CycloneDX SBOM from the committed uv lock file."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tomllib
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

JsonObject = dict[str, Any]
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LOCK_FILE = REPOSITORY_ROOT / "backend" / "uv.lock"
DEFAULT_OUTPUT_FILE = REPOSITORY_ROOT / "sbom" / "hireflux-backend.cdx.json"


def _normalized_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def _pypi_ref(name: str, version: str) -> str:
    return f"pkg:pypi/{quote(_normalized_name(name), safe='-')}@{quote(version, safe='.+-')}"


def _package_entries(lock_data: JsonObject) -> list[JsonObject]:
    entries = lock_data.get("package")
    if not isinstance(entries, list):
        raise ValueError("uv.lock does not contain a package list")
    packages = [entry for entry in entries if isinstance(entry, dict)]
    if not packages:
        raise ValueError("uv.lock does not contain any package entries")
    return packages


def _dependency_names(package: JsonObject) -> set[str]:
    names: set[str] = set()
    dependencies = package.get("dependencies", [])
    if isinstance(dependencies, list):
        for dependency in dependencies:
            if isinstance(dependency, dict) and isinstance(dependency.get("name"), str):
                names.add(dependency["name"])

    optional_dependencies = package.get("optional-dependencies", {})
    if isinstance(optional_dependencies, dict):
        for optional in optional_dependencies.values():
            if not isinstance(optional, list):
                continue
            for dependency in optional:
                if isinstance(dependency, dict) and isinstance(dependency.get("name"), str):
                    names.add(dependency["name"])
    return names


def _artifact_hashes(package: JsonObject) -> list[JsonObject]:
    hashes: set[str] = set()
    sdist = package.get("sdist")
    if isinstance(sdist, dict) and isinstance(sdist.get("hash"), str):
        hashes.add(sdist["hash"].removeprefix("sha256:"))

    wheels = package.get("wheels", [])
    if isinstance(wheels, list):
        for wheel in wheels:
            if isinstance(wheel, dict) and isinstance(wheel.get("hash"), str):
                hashes.add(wheel["hash"].removeprefix("sha256:"))
    return [{"alg": "SHA-256", "content": value} for value in sorted(hashes)]


def build_sbom(lock_file: Path) -> JsonObject:
    lock_bytes = lock_file.read_bytes()
    lock_data = tomllib.loads(lock_bytes.decode("utf-8"))
    packages = _package_entries(lock_data)

    refs_by_name: dict[str, str] = {}
    components: list[JsonObject] = []
    project_ref: str | None = None
    project_component: JsonObject | None = None

    for package in packages:
        name = package.get("name")
        version = package.get("version")
        if not isinstance(name, str) or not isinstance(version, str):
            raise ValueError("Every uv.lock package must have a name and version")

        is_project = isinstance(package.get("source"), dict) and "editable" in package["source"]
        reference = (
            f"application:{_normalized_name(name)}@{version}"
            if is_project
            else _pypi_ref(name, version)
        )
        refs_by_name[_normalized_name(name)] = reference

        component: JsonObject = {
            "bom-ref": reference,
            "name": name,
            "type": "application" if is_project else "library",
            "version": version,
        }
        if not is_project:
            component["hashes"] = _artifact_hashes(package)
            component["purl"] = _pypi_ref(name, version)
            component["properties"] = [
                {"name": "hireflux:source", "value": "PyPI"},
            ]
            components.append(component)
        else:
            project_ref = reference
            project_component = component

    if project_ref is None or project_component is None:
        raise ValueError("uv.lock does not contain the editable HireFlux project")

    dependency_edges: list[JsonObject] = []
    for package in packages:
        name = package["name"]
        version = package["version"]
        parent_ref = refs_by_name[_normalized_name(name)]
        children = sorted(
            {
                refs_by_name[_normalized_name(dependency)]
                for dependency in _dependency_names(package)
                if _normalized_name(dependency) in refs_by_name
            }
        )
        if children:
            dependency_edges.append({"dependsOn": children, "ref": parent_ref})

    lock_digest = hashlib.sha256(lock_bytes).hexdigest()
    serial_number = f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, f'hireflux-uv-lock:{lock_digest}')}"
    try:
        lock_display = lock_file.relative_to(REPOSITORY_ROOT).as_posix()
    except ValueError:
        lock_display = str(lock_file)
    return {
        "bomFormat": "CycloneDX",
        "components": sorted(components, key=lambda component: str(component["bom-ref"])),
        "dependencies": sorted(dependency_edges, key=lambda edge: str(edge["ref"])),
        "metadata": {
            "component": project_component,
            "properties": [
                {"name": "hireflux:lock-file", "value": lock_display},
                {"name": "hireflux:lock-sha256", "value": lock_digest},
            ],
        },
        "serialNumber": serial_number,
        "specVersion": "1.5",
        "version": 1,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lock-file", type=Path, default=DEFAULT_LOCK_FILE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE)
    args = parser.parse_args()

    sbom = build_sbom(args.lock_file.resolve())
    args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.output.resolve().write_text(
        json.dumps(sbom, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.output} with {len(sbom['components'])} package components.")


if __name__ == "__main__":
    main()
