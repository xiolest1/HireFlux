import argparse

from pydantic import ValidationError

from hireflux_backend.config import Settings
from hireflux_backend.infrastructure.dynamodb.table_schema import (
    TableSchemaMismatchError,
    UnsafeTableTargetError,
    reset_local_table,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild the disposable DynamoDB Local table.")
    parser.add_argument(
        "--confirm-table",
        required=True,
        help="Exact DYNAMODB_TABLE_NAME value; all data in that local table will be removed.",
    )
    arguments = parser.parse_args()
    try:
        settings = Settings()  # type: ignore[call-arg]
        result = reset_local_table(settings, confirmation=arguments.confirm_table)
    except (ValidationError, UnsafeTableTargetError, TableSchemaMismatchError) as error:
        raise SystemExit(f"Local table reset refused: {error}") from error
    print(f"DynamoDB Local table {settings.dynamodb_table_name}: {result.value}.")


if __name__ == "__main__":
    main()
