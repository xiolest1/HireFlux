"""Export the actual local table contract for offline CDK schema-parity checks."""

import argparse
import json
from pathlib import Path
from typing import Any

from hireflux_backend.infrastructure.dynamodb.table_schema import (
    TTL_ATTRIBUTE,
    create_table_request,
)


def schema_contract() -> dict[str, Any]:
    # Reuse the operator initializer's request; never initialize Settings or a client.
    schema = create_table_request("schema-parity-placeholder")
    schema.pop("TableName")
    schema["TimeToLiveSpecification"] = {"AttributeName": TTL_ATTRIBUTE, "Enabled": True}
    return {"schema_version": 1, "table_schema": schema}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    content = json.dumps(schema_contract(), sort_keys=True, indent=2) + "\n"
    if args.output is None:
        print(content, end="")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    main()
