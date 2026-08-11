from pydantic import ValidationError

from hireflux_backend.config import Settings
from hireflux_backend.infrastructure.dynamodb.table_schema import (
    TableSchemaMismatchError,
    UnsafeTableTargetError,
    initialize_local_table,
)


def main() -> None:
    try:
        settings = Settings()  # type: ignore[call-arg]
        result = initialize_local_table(settings)
    except (ValidationError, UnsafeTableTargetError, TableSchemaMismatchError) as error:
        raise SystemExit(f"Local table initialization refused: {error}") from error
    print(f"DynamoDB Local table {settings.dynamodb_table_name}: {result.value}.")


if __name__ == "__main__":
    main()
