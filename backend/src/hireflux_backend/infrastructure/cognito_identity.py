"""Pool-pinned administrative deletion; no discovery or SDK retry."""

from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.account_lifecycle import DefiniteProviderRejection
from hireflux_backend.application.errors import PersistenceError, WorkspaceBootstrapConflictError


class CognitoIdentityDeletion:
    def __init__(self, pool_id: str, region: str, *, client: Any | None = None) -> None:
        self.pool_id = pool_id
        self.region = region
        self._client = client

    def delete(self, username: str) -> None:
        try:
            if self._client is None:
                self._client = boto3.client(
                    "cognito-idp",
                    region_name=self.region,
                    endpoint_url=f"https://cognito-idp.{self.region}.amazonaws.com",
                    config=Config(
                        connect_timeout=1,
                        read_timeout=2,
                        retries={"total_max_attempts": 1},
                    ),
                )
            self._client.admin_delete_user(UserPoolId=self.pool_id, Username=username)
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code == "UserNotFoundException":
                return
            if code in {
                "AccessDeniedException",
                "NotAuthorizedException",
                "TooManyRequestsException",
                "InvalidParameterException",
            }:
                raise DefiniteProviderRejection(
                    "Identity removal was rejected; an explicit retry may be requested."
                ) from None
            raise PersistenceError("Identity removal outcome requires operator review.") from None
        except BotoCoreError:
            raise PersistenceError("Identity removal outcome requires operator review.") from None


class CognitoIdentityAbsence:
    """Operator reads only. The application execution role has no such permissions."""

    def __init__(self, pool_id: str, pool_arn: str, client: Any) -> None:
        self.pool_id, self.pool_arn, self.client = pool_id, pool_arn, client

    def absent(self, owner: str) -> bool:
        try:
            pool = self.client.describe_user_pool(UserPoolId=self.pool_id)["UserPool"]
            if (
                pool.get("Id") != self.pool_id
                or pool.get("Arn") != self.pool_arn
                or pool.get("UsernameAttributes") != ["email"]
                or pool.get("AliasAttributes")
            ):
                raise WorkspaceBootstrapConflictError("Provider lineage requires operator review.")
            try:
                found = self.client.admin_get_user(UserPoolId=self.pool_id, Username=owner)
            except ClientError as error:
                if error.response.get("Error", {}).get("Code") == "UserNotFoundException":
                    return True
                raise PersistenceError("Provider absence could not be established.") from None
            subject = [
                a.get("Value") for a in found.get("UserAttributes", []) if a.get("Name") == "sub"
            ]
            if found.get("Username") != owner or subject != [owner]:
                raise WorkspaceBootstrapConflictError(
                    "Canonical provider identity is inconsistent."
                )
            return False
        except (ClientError, BotoCoreError, KeyError):
            raise PersistenceError("Provider absence could not be established.") from None
