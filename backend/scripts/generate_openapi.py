"""Generate the API contract without exposing documentation routes in deployment."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from hireflux_backend.config import Settings
from hireflux_backend.main import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("artifacts/hireflux-openapi.json"))
    args = parser.parse_args()
    settings = Settings(
        _env_file=None,
        environment="test",
        auth_mode="local",
        cursor_signing_key="openapi-generation-key-that-is-at-least-32-bytes",
        dynamodb_endpoint_url=None,
    )
    application = create_app(settings, dynamodb_client=object())
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(application.openapi(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output}.")


if __name__ == "__main__":
    main()
