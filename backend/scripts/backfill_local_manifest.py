import argparse

from pydantic import ValidationError

from hireflux_backend.application.errors import HireFluxError
from hireflux_backend.config import Settings
from hireflux_backend.infrastructure.dynamodb.manifest_backfill import backfill_local_manifest
from hireflux_backend.infrastructure.dynamodb.table_schema import UnsafeTableTargetError


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify one existing LOCAL application manifest without resetting data."
    )
    parser.add_argument("--confirm-table", required=True)
    parser.add_argument("--owner", required=True)
    arguments = parser.parse_args()
    try:
        settings = Settings()  # type: ignore[call-arg]
        count = backfill_local_manifest(
            settings, confirmation=arguments.confirm_table, owner=arguments.owner
        )
    except (ValidationError, ValueError, HireFluxError, UnsafeTableTargetError) as error:
        raise SystemExit(f"Local manifest backfill refused: {error}") from error
    print(f"Verified {count} application references in the confirmed local table.")


if __name__ == "__main__":
    main()
