import hashlib
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from botocore.exceptions import BotoCoreError, ClientError

from hireflux_backend.application.demo_admission import (
    COUNTER_RETENTION_SECONDS,
    IDEMPOTENCY_RETENTION_SECONDS,
    DemoAdmission,
    DemoIssuancePolicy,
    integer,
)
from hireflux_backend.application.errors import (
    ConflictError,
    DemoAdmissionUnavailableError,
    DemoAdmissionUncertainError,
    DemoIssuancePausedError,
    DemoProvisioningInProgressError,
    DemoQuotaExhaustedError,
    PersistenceError,
)
from hireflux_backend.application.ports import DemoWorkspaceReservation
from hireflux_backend.domain.enums import ApplicationStatus, DemoWorkspaceState
from hireflux_backend.domain.models import DemoWorkspace
from hireflux_backend.infrastructure.dynamodb.demo_cleanup import cleanup_failed_demo
from hireflux_backend.infrastructure.dynamodb.mapping import (
    deserialize_item,
    format_timestamp,
    parse_timestamp,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import GSI2_NAME

POLICY_KEY = {"PK": "DEMO_ADMISSION#CONTROL", "SK": "POLICY"}
_POLICY_FIELDS = {"schema_version", "enabled", "version", "daily_limit", "minute_limit"}
_ABSENT = "attribute_not_exists(PK) AND attribute_not_exists(SK)"


def counter_key(period: str, start: int) -> dict[str, str]:
    return {"PK": f"DEMO_ADMISSION#{period}#{start}", "SK": "COUNTER"}


class DynamoDemoWorkspaceRepository:
    def __init__(self, client: Any, table_name: str) -> None:
        self._client = client
        self._table_name = table_name

    def _get(self, key: dict[str, str]) -> dict[str, Any] | None:
        try:
            response = self._client.get_item(
                TableName=self._table_name, Key=serialize_item(key), ConsistentRead=True
            )
            if not _successful(response):
                raise DemoAdmissionUnavailableError()
            item = response.get("Item")
            if item is None:
                return None
            if not isinstance(item, dict) or not item:
                raise DemoAdmissionUnavailableError()
            decoded = deserialize_item(item)
            if any(decoded.get(name) != value for name, value in key.items()):
                raise DemoAdmissionUnavailableError()
            return decoded
        except (
            ClientError,
            BotoCoreError,
            ValueError,
            TypeError,
            AttributeError,
            KeyError,
        ) as error:
            raise DemoAdmissionUnavailableError() from error

    def read_issuance_policy(self) -> dict[str, object] | None:
        item = self._get(POLICY_KEY)
        if item is None:
            return None
        if (
            set(item) != {"PK", "SK", "entity_type", *_POLICY_FIELDS}
            or item.get("entity_type") != "DEMO_ISSUANCE_POLICY"
        ):
            raise DemoAdmissionUnavailableError()
        return {key: item[key] for key in _POLICY_FIELDS}

    def find_reservation(
        self, idempotency_key: str, *, now: datetime
    ) -> DemoWorkspaceReservation | None:
        record_hash = _hash_idempotency_key(idempotency_key)
        assert record_hash is not None
        record = self._get(_idempotency_key(record_hash))
        if record is None:
            return None
        try:
            if record.get("entity_type") != "DEMO_IDEMPOTENCY":
                raise DemoAdmissionUnavailableError()
            deadline = integer(
                record.get("session_expires_at", record.get("expires_at")), 1, 253_402_300_799
            )
            if deadline <= int(now.timestamp()):
                raise ConflictError(
                    "The demo workspace has expired. Retry with a new Idempotency-Key."
                )
            workspace = self._get_workspace(str(record["workspace_id"]))
            if workspace is None or workspace.idempotency_key_hash != record_hash:
                raise DemoAdmissionUnavailableError()
            if (
                record.get("reservation_id") != workspace.reservation_id
                or record.get("state") != workspace.state.value
            ):
                raise DemoAdmissionUnavailableError()
            if workspace.reservation_id and (
                record.get("issued_at") != format_timestamp(workspace.issued_at)
                or (
                    record.get("session_expires_at") != workspace.expires_at
                    and workspace.state is not DemoWorkspaceState.FAILED
                )
            ):
                raise DemoAdmissionUnavailableError()
        except (KeyError, ValueError, TypeError) as error:
            raise DemoAdmissionUnavailableError() from error
        if workspace.state is DemoWorkspaceState.PROVISIONING:
            raise DemoProvisioningInProgressError(
                "Demo workspace provisioning is still in progress. "
                "Retry explicitly with the same Idempotency-Key."
            )
        if workspace.state is DemoWorkspaceState.FAILED:
            raise ConflictError(
                "The previous demo workspace provisioning attempt failed. "
                "Retry with a new Idempotency-Key."
            )
        if workspace.expires_at != deadline:
            raise DemoAdmissionUnavailableError()
        return DemoWorkspaceReservation(workspace, is_new=False)

    def reserve(
        self,
        workspace_id: str,
        *,
        issued_at: datetime,
        expires_at: int,
        idempotency_key: str | None,
        admission: DemoAdmission,
    ) -> DemoWorkspaceReservation:
        workspace = DemoWorkspace(
            workspace_id,
            DemoWorkspaceState.PROVISIONING,
            issued_at,
            issued_at,
            expires_at,
            _hash_idempotency_key(idempotency_key),
            str(uuid4()),
        )
        try:
            counters = self._counters(admission)
        except DemoQuotaExhaustedError:
            # A same-key winner may have committed since the service's first read.
            if idempotency_key:
                previous = self.find_reservation(idempotency_key, now=issued_at)
                if previous is not None:
                    return previous
            raise
        # Do not pay for namespace discovery after a known exhausted budget.
        self._assert_namespace_unused(workspace_id)
        transactions = [self._policy_check(admission.policy), *counters]
        # Discovery rejects known collisions; exact conditions fence every known root.
        roots = [
            "PROFILE",
            "SETTINGS",
            "WORKSPACE_QUOTA",
            "COUNTER#FUNNEL",
            *[f"COUNTER#STATUS#{status.value}" for status in ApplicationStatus],
        ]
        for sk in roots:
            transactions.append(
                {
                    "ConditionCheck": {
                        "TableName": self._table_name,
                        "Key": serialize_item({"PK": user_partition(workspace_id), "SK": sk}),
                        "ConditionExpression": _ABSENT,
                    }
                }
            )
        transactions.append(
            {
                "Put": {
                    "TableName": self._table_name,
                    "Item": serialize_item(_workspace_to_item(workspace)),
                    "ConditionExpression": _ABSENT,
                }
            }
        )
        if workspace.idempotency_key_hash:
            transactions.append(
                {
                    "Put": {
                        "TableName": self._table_name,
                        "Item": serialize_item(
                            _idempotency_to_item(workspace.idempotency_key_hash, workspace)
                        ),
                        "ConditionExpression": _ABSENT,
                    }
                }
            )
        try:
            # The SDK repeats identical payload/token within a call. Durable application
            # idempotency remains authoritative beyond the AWS token's ten-minute window.
            response = self._client.transact_write_items(
                TransactItems=transactions, ClientRequestToken=str(uuid4())
            )
            if not _successful(response):
                raise DemoAdmissionUncertainError()
        except (ClientError, BotoCoreError, DemoAdmissionUncertainError) as error:
            if idempotency_key:
                try:
                    existing = self.find_reservation(idempotency_key, now=issued_at)
                except DemoAdmissionUnavailableError as read_error:
                    raise DemoAdmissionUncertainError() from read_error
                if existing is not None:
                    return existing
            code = _error_code(error)
            if code == "TransactionCanceledException":
                current = self.read_issuance_policy()
                if current is None and not admission.policy.local_default:
                    raise DemoIssuancePausedError() from error
                if current is not None and not DemoIssuancePolicy.from_record(current).enabled:
                    raise DemoIssuancePausedError() from error
                if (
                    current is not None
                    and DemoIssuancePolicy.from_record(current) != admission.policy
                ):
                    raise DemoAdmissionUnavailableError() from error
                self._counters(admission)
                raise DemoAdmissionUnavailableError() from error
            if code in {
                "ProvisionedThroughputExceededException",
                "ThrottlingException",
                "AccessDeniedException",
                "ValidationException",
                "IdempotentParameterMismatchException",
            }:
                raise DemoAdmissionUnavailableError() from error
            raise DemoAdmissionUncertainError() from error
        return DemoWorkspaceReservation(workspace, is_new=True)

    def _assert_namespace_unused(self, workspace_id: str) -> None:
        try:
            response = self._client.query(
                TableName=self._table_name,
                KeyConditionExpression="PK = :pk",
                ExpressionAttributeValues=serialize_item({":pk": user_partition(workspace_id)}),
                ConsistentRead=True,
                Limit=1,
            )
            if response.get("Items") or response.get("LastEvaluatedKey"):
                raise DemoAdmissionUnavailableError()
            for status in ApplicationStatus:
                response = self._client.query(
                    TableName=self._table_name,
                    IndexName=GSI2_NAME,
                    KeyConditionExpression="GSI2PK = :pk",
                    ExpressionAttributeValues=serialize_item(
                        {":pk": f"USER#{workspace_id}#STATUS#{status.value}"}
                    ),
                    Limit=1,
                )
                if response.get("Items") or response.get("LastEvaluatedKey"):
                    raise DemoAdmissionUnavailableError()
        except (ClientError, BotoCoreError) as error:
            raise DemoAdmissionUnavailableError() from error

    def _policy_check(self, policy: DemoIssuancePolicy) -> dict[str, Any]:
        check: dict[str, Any] = {"TableName": self._table_name, "Key": serialize_item(POLICY_KEY)}
        if policy.local_default:
            check["ConditionExpression"] = _ABSENT
        else:
            check.update(
                {
                    "ConditionExpression": (
                        "entity_type = :kind AND schema_version = :schema AND enabled = :enabled "
                        "AND #version = :version AND daily_limit = :daily "
                        "AND minute_limit = :minute AND attribute_not_exists(expires_at)"
                    ),
                    "ExpressionAttributeNames": {"#version": "version"},
                    "ExpressionAttributeValues": serialize_item(
                        {
                            ":kind": "DEMO_ISSUANCE_POLICY",
                            ":schema": 1,
                            ":enabled": True,
                            ":version": policy.version,
                            ":daily": policy.daily_limit,
                            ":minute": policy.minute_limit,
                        }
                    ),
                }
            )
        return {"ConditionCheck": check}

    def _counters(self, admission: DemoAdmission) -> list[dict[str, Any]]:
        result = []
        counts = []
        for period, start, seconds in [
            ("DAY", admission.day_start, 86_400),
            ("MINUTE", admission.minute_start, 60),
        ]:
            key = counter_key(period, start)
            item = self._get(key)
            expected = {
                **key,
                "entity_type": "DEMO_ADMISSION_COUNTER",
                "window_start": start,
                "window_seconds": seconds,
                "expires_at": start + seconds + COUNTER_RETENTION_SECONDS,
            }
            used = 0
            if item is not None:
                used = integer(item.get("used"), 0, 1_000)
                if set(item) != {*expected, "used"} or any(
                    item.get(k) != v for k, v in expected.items()
                ):
                    raise DemoAdmissionUnavailableError()
            counts.append(used)
            values = {
                ":kind": expected["entity_type"],
                ":start": start,
                ":seconds": seconds,
                ":ttl": expected["expires_at"],
                ":next": used + 1,
                ":previous": used,
            }
            condition = (
                _ABSENT
                if item is None
                else (
                    "entity_type = :kind AND window_start = :start "
                    "AND window_seconds = :seconds AND expires_at = :ttl AND #used = :previous"
                )
            )
            if item is None:
                del values[":previous"]
            result.append(
                {
                    "Update": {
                        "TableName": self._table_name,
                        "Key": serialize_item(key),
                        "UpdateExpression": (
                            "SET entity_type = :kind, window_start = :start, "
                            "window_seconds = :seconds, expires_at = :ttl, #used = :next"
                        ),
                        "ConditionExpression": condition,
                        "ExpressionAttributeNames": {"#used": "used"},
                        "ExpressionAttributeValues": serialize_item(values),
                    }
                }
            )
        admission.require_capacity(counts[0], counts[1])
        return result

    def mark_ready(self, workspace: DemoWorkspace) -> None:
        self._update_state(workspace, DemoWorkspaceState.READY, workspace.expires_at)

    def mark_failed(self, workspace: DemoWorkspace, *, expires_at: int) -> None:
        self._update_state(
            workspace, DemoWorkspaceState.FAILED, min(expires_at, workspace.expires_at)
        )

    def cleanup(self, workspace: DemoWorkspace, *, application_ids: tuple[str, ...] = ()) -> None:
        cleanup_failed_demo(
            self._client, self._table_name, workspace, application_ids=application_ids
        )

    def _get_workspace(self, workspace_id: str) -> DemoWorkspace | None:
        item = self._get(_workspace_key(workspace_id))
        if item is None:
            return None
        if item.get("entity_type") != "DEMO_WORKSPACE" or item.get("workspace_id") != workspace_id:
            raise DemoAdmissionUnavailableError()
        if any(
            name in item
            for name in [
                "identity_kind",
                "bootstrap_version",
                "application_manifest_version",
                "deletion_started_at",
                "deletion_completed_at",
                "provider_finalization",
                "provider_finalized_at",
                "owner_user_id",
                "user_id",
            ]
        ):
            raise DemoAdmissionUnavailableError()
        try:
            workspace = _workspace_from_item(item)
            if workspace.reservation_id:
                if not isinstance(workspace.reservation_id, str):
                    raise DemoAdmissionUnavailableError()
                expiry = integer(item.get("data_expires_at"), workspace.expires_at, 253_402_300_799)
                if expiry <= int(workspace.issued_at.timestamp()):
                    raise DemoAdmissionUnavailableError()
            return workspace
        except (ValueError, TypeError, KeyError, OverflowError) as error:
            raise DemoAdmissionUnavailableError() from error

    def _update_state(
        self, workspace: DemoWorkspace, state: DemoWorkspaceState, expires_at: int
    ) -> None:
        if workspace.reservation_id is None:
            raise PersistenceError("A qualified reservation is required to update Demo state.")
        common = {
            ":provisioning": "PROVISIONING",
            ":state": state.value,
            ":issued": format_timestamp(workspace.issued_at),
            ":reservation": workspace.reservation_id,
            ":data_expiry": workspace.expires_at,
            ":updated": format_timestamp(datetime.now(UTC)),
            ":owner": workspace.workspace_id,
        }
        no_durable = " AND ".join(
            f"attribute_not_exists({name})"
            for name in [
                "identity_kind",
                "bootstrap_version",
                "application_manifest_version",
                "deletion_started_at",
                "deletion_completed_at",
                "provider_finalization",
                "provider_finalized_at",
                "owner_user_id",
                "user_id",
            ]
        )
        transaction = [
            {
                "Update": {
                    "TableName": self._table_name,
                    "Key": serialize_item(_workspace_key(workspace.workspace_id)),
                    "ConditionExpression": (
                        "entity_type = :kind AND #state = :provisioning AND issued_at = :issued "
                        "AND workspace_id = :owner AND reservation_id = :reservation "
                        "AND data_expires_at = :data_expiry AND expires_at = :data_expiry AND "
                        + (
                            "idempotency_key_hash = :hash AND "
                            if workspace.idempotency_key_hash
                            else "attribute_not_exists(idempotency_key_hash) AND "
                        )
                        + no_durable
                    ),
                    "UpdateExpression": (
                        "SET #state = :state, updated_at = :updated, expires_at = :expiry"
                    ),
                    "ExpressionAttributeNames": {"#state": "state"},
                    "ExpressionAttributeValues": serialize_item(
                        {
                            **common,
                            ":expiry": expires_at,
                            ":kind": "DEMO_WORKSPACE",
                            **(
                                {":hash": workspace.idempotency_key_hash}
                                if workspace.idempotency_key_hash
                                else {}
                            ),
                        }
                    ),
                }
            }
        ]
        if workspace.idempotency_key_hash:
            transaction.append(
                {
                    "Update": {
                        "TableName": self._table_name,
                        "Key": serialize_item(_idempotency_key(workspace.idempotency_key_hash)),
                        "ConditionExpression": (
                            "entity_type = :kind AND #state = :provisioning "
                            "AND issued_at = :issued "
                            "AND workspace_id = :owner AND reservation_id = :reservation "
                            "AND session_expires_at = :data_expiry "
                            "AND expires_at = :retained AND " + no_durable
                        ),
                        "UpdateExpression": "SET #state = :state, updated_at = :updated",
                        "ExpressionAttributeNames": {"#state": "state"},
                        "ExpressionAttributeValues": serialize_item(
                            {
                                **common,
                                ":kind": "DEMO_IDEMPOTENCY",
                                ":retained": workspace.expires_at + IDEMPOTENCY_RETENTION_SECONDS,
                            }
                        ),
                    }
                }
            )
        try:
            response = self._client.transact_write_items(
                TransactItems=transaction, ClientRequestToken=str(uuid4())
            )
            if not _successful(response):
                raise DemoAdmissionUncertainError()
        except (ClientError, BotoCoreError, DemoAdmissionUncertainError) as error:
            try:
                actual = self._get_workspace(workspace.workspace_id)
            except DemoAdmissionUnavailableError as read_error:
                raise PersistenceError(
                    "Unable to confirm the Demo workspace state."
                ) from read_error
            if (
                actual
                and actual.reservation_id == workspace.reservation_id
                and actual.idempotency_key_hash == workspace.idempotency_key_hash
                and actual.issued_at == workspace.issued_at
                and actual.state is state
                and actual.expires_at == expires_at
            ):
                return
            raise PersistenceError("Unable to confirm the Demo workspace state.") from error


def _workspace_key(workspace_id: str) -> dict[str, str]:
    return {"PK": user_partition(workspace_id), "SK": "WORKSPACE"}


def _idempotency_key(record_hash: str) -> dict[str, str]:
    return {"PK": f"DEMO_IDEMPOTENCY#{record_hash}", "SK": "SESSION"}


def _hash_idempotency_key(key: str | None) -> str | None:
    return hashlib.sha256(key.encode("utf-8")).hexdigest() if key is not None else None


def _workspace_to_item(workspace: DemoWorkspace) -> dict[str, object]:
    return {
        **_workspace_key(workspace.workspace_id),
        "entity_type": "DEMO_WORKSPACE",
        "workspace_id": workspace.workspace_id,
        "state": workspace.state.value,
        "issued_at": format_timestamp(workspace.issued_at),
        "updated_at": format_timestamp(workspace.updated_at),
        "expires_at": workspace.expires_at,
        "data_expires_at": workspace.expires_at,
        "idempotency_key_hash": workspace.idempotency_key_hash,
        "reservation_id": workspace.reservation_id,
    }


def _workspace_from_item(item: dict[str, Any]) -> DemoWorkspace:
    return DemoWorkspace(
        str(item["workspace_id"]),
        DemoWorkspaceState(str(item["state"])),
        parse_timestamp(str(item["issued_at"])),
        parse_timestamp(str(item["updated_at"])),
        integer(item["expires_at"], 1, 253_402_300_799),
        item.get("idempotency_key_hash"),
        item.get("reservation_id"),
    )


def _idempotency_to_item(record_hash: str, workspace: DemoWorkspace) -> dict[str, object]:
    return {
        **_idempotency_key(record_hash),
        "entity_type": "DEMO_IDEMPOTENCY",
        "workspace_id": workspace.workspace_id,
        "state": workspace.state.value,
        "issued_at": format_timestamp(workspace.issued_at),
        "updated_at": format_timestamp(workspace.updated_at),
        "expires_at": workspace.expires_at + IDEMPOTENCY_RETENTION_SECONDS,
        "session_expires_at": workspace.expires_at,
        "reservation_id": workspace.reservation_id,
    }


def _successful(response: Any) -> bool:
    return (
        isinstance(response, dict)
        and isinstance(response.get("ResponseMetadata"), dict)
        and response["ResponseMetadata"].get("HTTPStatusCode") == 200
    )


def _error_code(error: Exception) -> str:
    return (
        str(error.response.get("Error", {}).get("Code", ""))
        if isinstance(error, ClientError)
        else ""
    )
