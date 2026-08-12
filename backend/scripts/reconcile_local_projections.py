import argparse

from pydantic import ValidationError

from hireflux_backend.application.errors import PersistenceError
from hireflux_backend.config import Settings
from hireflux_backend.infrastructure.dynamodb.reconciliation import reconcile_local_projections
from hireflux_backend.infrastructure.dynamodb.table_schema import UnsafeTableTargetError


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rebuild DynamoDB Local application indexes and analytics counters."
    )
    parser.add_argument("--confirm-table", required=True)
    arguments = parser.parse_args()
    try:
        settings = Settings()  # type: ignore[call-arg]
        count = reconcile_local_projections(settings, confirmation=arguments.confirm_table)
    except (ValidationError, UnsafeTableTargetError, PersistenceError) as error:
        raise SystemExit(f"Local projection reconciliation refused: {error}") from error
    print(f"Reconciled {count} applications in {settings.dynamodb_table_name}.")


if __name__ == "__main__":
    main()
