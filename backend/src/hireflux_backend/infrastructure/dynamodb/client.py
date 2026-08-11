from typing import Any

import boto3

from hireflux_backend.config import Settings


def build_dynamodb_client(settings: Settings) -> Any:
    arguments: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.dynamodb_endpoint_url is not None:
        arguments.update(
            {
                "endpoint_url": settings.dynamodb_endpoint_url,
                "aws_access_key_id": settings.aws_access_key_id.get_secret_value()
                if settings.aws_access_key_id
                else None,
                "aws_secret_access_key": settings.aws_secret_access_key.get_secret_value()
                if settings.aws_secret_access_key
                else None,
            }
        )
    return boto3.client("dynamodb", **arguments)
