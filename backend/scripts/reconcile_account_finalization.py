"""Future owner-authorized operator procedure. No AWS calls without --live.

Default invocation/help is inert. --live is NOT authorized by Phase 5D.
The operator needs only provider metadata reads and exact-tombstone DDB access;
this tool cannot call AdminDeleteUser or erase workspace content.
"""

import argparse
import re
import sys
from pathlib import Path

import boto3
from botocore.config import Config

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from hireflux_backend.application.account_reconciliation import reconcile_account
from hireflux_backend.auth.cognito import safe_text
from hireflux_backend.infrastructure.cognito_identity import CognitoIdentityAbsence
from hireflux_backend.infrastructure.dynamodb.workspace_finalization_repository import (
    DynamoFinalizationRepository,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Requires separate owner authorization")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Conditionally mark completion only after verified absence",
    )
    parser.add_argument("--account")
    parser.add_argument("--pool-id")
    parser.add_argument("--table-arn")
    parser.add_argument("--owner-sub")
    args = parser.parse_args()
    if not args.live:
        parser.exit(
            0, "OFFLINE_ONLY: no AWS access; --live requires separate owner authorization.\n"
        )
    if (
        not args.account
        or not re.fullmatch(r"\d{8}9465", args.account)
        or not args.pool_id
        or not re.fullmatch(r"us-east-1_[A-Za-z0-9]{1,55}", args.pool_id)
        or not safe_text(args.owner_sub, 128, key_component=True)
        or not args.table_arn
        or not re.fullmatch(
            rf"arn:aws:dynamodb:us-east-1:{args.account}:table/[A-Za-z0-9_.-]+", args.table_arn
        )
    ):
        parser.error(
            "Exact qualified staging account, pool, table ARN and owner subject are required."
        )
    try:
        session = boto3.Session(profile_name="hireflux-operator", region_name="us-east-1")
        credentials = session.get_credentials()
        if credentials is None or not credentials.get_frozen_credentials().token:
            raise ValueError("Temporary non-root credentials are required.")
        options = Config(connect_timeout=1, read_timeout=2, retries={"total_max_attempts": 1})

        def client(service: str):
            return session.client(
                service, endpoint_url=f"https://{service}.us-east-1.amazonaws.com", config=options
            )

        identity = client("sts").get_caller_identity()
        if identity.get("Account") != args.account or identity.get("Arn", "").endswith(":root"):
            raise ValueError("Unexpected operator identity.")
        repository = DynamoFinalizationRepository(
            client("dynamodb"), args.table_arn.split("table/", 1)[1]
        )
        provider = CognitoIdentityAbsence(
            args.pool_id,
            f"arn:aws:cognito-idp:us-east-1:{args.account}:userpool/{args.pool_id}",
            client("cognito-idp"),
        )
        result = reconcile_account(repository, provider, owner=args.owner_sub, apply=args.apply)
    except Exception:
        parser.exit(
            1, "STOP: reconciliation remains unverified; no automatic retry or provider deletion.\n"
        )
    print(result)


if __name__ == "__main__":
    main()
