from dataclasses import replace
from datetime import date
from typing import Any

from botocore.exceptions import ClientError

from hireflux_backend.application.errors import (
    ConflictError,
    InvalidCursorError,
    PersistenceError,
)
from hireflux_backend.application.ports import ActivityPage, ApplicationPage, StageAgeBounds
from hireflux_backend.domain.enums import (
    ApplicationSort,
    ApplicationSource,
    ApplicationStatus,
    FollowUpFilter,
    WorkMode,
)
from hireflux_backend.domain.models import Activity, Application, CurrentIdentity, UserProfile
from hireflux_backend.domain.resources import (
    ACTIVE_APPLICATION_STATUSES,
    DefaultApplicationView,
)
from hireflux_backend.infrastructure.dynamodb.cursor import CursorCodec
from hireflux_backend.infrastructure.dynamodb.mapping import (
    activity_from_item,
    activity_sort_key,
    activity_to_item,
    application_from_item,
    application_partition,
    application_sort_key,
    application_to_item,
    deserialize_item,
    format_timestamp,
    owner_applications_key,
    owner_schedule_key,
    owner_status_key,
    parse_timestamp,
    profile_from_item,
    profile_to_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.resource_quota import resource_quota_update
from hireflux_backend.infrastructure.dynamodb.table_schema import GSI1_NAME, GSI2_NAME, GSI3_NAME


class DynamoUserRepository:
    def __init__(self, client: Any, table_name: str) -> None:
        self._client = client
        self._table_name = table_name

    def get_or_create(self, identity: CurrentIdentity, *, now_iso: str) -> UserProfile:
        now = parse_timestamp(now_iso)
        proposed = UserProfile(
            user_id=identity.user_id,
            name=identity.name,
            email=identity.email,
            role=identity.role,
            created_at=now,
            last_login_at=now,
            expires_at=identity.expires_at,
        )
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(profile_to_item(proposed)),
                ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
            )
            return proposed
        except ClientError as error:
            if _error_code(error) != "ConditionalCheckFailedException":
                raise PersistenceError("Unable to initialize the user profile.") from error

        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item({"PK": user_partition(identity.user_id), "SK": "PROFILE"}),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read the user profile.") from error
        item = response.get("Item")
        if item is None:
            raise PersistenceError("The user profile could not be initialized.")
        profile = profile_from_item(deserialize_item(item))
        if identity.name == "Demo Workspace" and profile.name == "Demo Recruiter":
            try:
                self._client.update_item(
                    TableName=self._table_name,
                    Key=serialize_item({"PK": user_partition(identity.user_id), "SK": "PROFILE"}),
                    UpdateExpression="SET #name = :name",
                    ExpressionAttributeNames={"#name": "name"},
                    ExpressionAttributeValues=serialize_item({":name": identity.name}),
                )
            except ClientError as error:
                raise PersistenceError("Unable to migrate the demo workspace profile.") from error
            return replace(profile, name=identity.name)
        return profile


class DynamoApplicationRepository:
    def __init__(
        self,
        client: Any,
        table_name: str,
        cursor_codec: CursorCodec,
        *,
        max_applications: int = 100,
        max_activity_per_application: int = 500,
    ) -> None:
        self._client = client
        self._table_name = table_name
        self._cursor_codec = cursor_codec
        self._max_applications = max_applications
        self._max_activity = max_activity_per_application

    def create(self, application: Application, activity: Activity) -> None:
        quota_values: dict[str, object] = {
            ":entity_type": "WORKSPACE_QUOTA",
            ":limit": self._max_applications,
            ":one": 1,
            ":zero": 0,
        }
        quota_expression = (
            "SET entity_type = :entity_type, "
            "application_count = if_not_exists(application_count, :zero) + :one"
        )
        if application.expires_at is not None:
            quota_values[":expires_at"] = application.expires_at
            quota_expression += ", expires_at = :expires_at"
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Update": {
                            "TableName": self._table_name,
                            "Key": serialize_item(
                                {
                                    "PK": user_partition(application.owner_user_id),
                                    "SK": "WORKSPACE_QUOTA",
                                }
                            ),
                            "UpdateExpression": quota_expression,
                            "ConditionExpression": (
                                "attribute_not_exists(application_count) "
                                "OR application_count < :limit"
                            ),
                            "ExpressionAttributeValues": serialize_item(quota_values),
                        }
                    },
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(application_to_item(application)),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                    resource_quota_update(
                        self._table_name,
                        owner_user_id=application.owner_user_id,
                        application_id=application.application_id,
                        expires_at=application.expires_at,
                        max_activity=self._max_activity,
                    ),
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(activity_to_item(activity)),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                    _status_counter_update(self._table_name, application, application.status, 1),
                    _funnel_counter_update(
                        self._table_name,
                        application,
                        {
                            "total_tracked": 1,
                            "submitted_count": int(application.submitted_at is not None),
                            "response_count": int(application.first_response_at is not None),
                            "screening_count": int(application.first_screening_at is not None),
                            "interview_count": int(application.first_interview_at is not None),
                            "offer_count": int(application.first_offer_at is not None),
                            "acceptance_count": int(application.first_acceptance_at is not None),
                        },
                    ),
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    "The application could not be created because the workspace limit was "
                    "reached or the record already exists."
                ) from error
            raise PersistenceError("Unable to create the application.") from error

    def get(self, owner_user_id: str, application_id: str) -> Application | None:
        try:
            response = self._client.get_item(
                TableName=self._table_name,
                Key=serialize_item(
                    {
                        "PK": application_partition(owner_user_id, application_id),
                        "SK": "METADATA",
                    }
                ),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read the application.") from error
        item = response.get("Item")
        return application_from_item(deserialize_item(item)) if item else None

    def list(
        self,
        owner_user_id: str,
        *,
        status: ApplicationStatus | None,
        limit: int,
        cursor: str | None,
        q: str | None = None,
        source: ApplicationSource | None = None,
        work_mode: WorkMode | None = None,
        stage_age: StageAgeBounds | None = None,
        follow_up: FollowUpFilter | None = None,
        follow_up_today: date | None = None,
        sort: ApplicationSort = ApplicationSort.UPDATED_DESC,
        view: DefaultApplicationView | None = None,
    ) -> ApplicationPage:
        normalized_query = q.strip().lower() if q else None
        scope = "|".join(
            (
                status.value if status else "",
                view.value if view else "",
                normalized_query or "",
                source.value if source else "",
                work_mode.value if work_mode else "",
                stage_age.cursor_scope if stage_age else "",
                follow_up.value if follow_up else "",
                follow_up_today.isoformat() if follow_up_today else "",
                sort.value,
            )
        )
        if status is not None or view is not None:
            statuses = (status,) if status is not None else _application_statuses_for_view(view)
            return self._list_status_partitions(
                owner_user_id,
                statuses=statuses,
                limit=limit,
                cursor=cursor,
                normalized_query=normalized_query,
                source=source,
                work_mode=work_mode,
                stage_age=stage_age,
                follow_up=follow_up,
                follow_up_today=follow_up_today,
                sort=sort,
                scope=scope,
            )

        index_name = GSI2_NAME if status else GSI1_NAME
        partition_name = "GSI2PK" if status else "GSI1PK"
        sort_name = "GSI2SK" if status else "GSI1SK"
        partition_value = (
            owner_status_key(owner_user_id, status)
            if status
            else owner_applications_key(owner_user_id)
        )
        arguments: dict[str, Any] = {
            "TableName": self._table_name,
            "IndexName": index_name,
            "KeyConditionExpression": f"{partition_name} = :partition",
            "ExpressionAttributeValues": serialize_item({":partition": partition_value}),
            "ScanIndexForward": sort is ApplicationSort.UPDATED_ASC,
            "Limit": 100,
        }
        filters: list[str] = []
        names: dict[str, str] = {}
        values: dict[str, object] = {":partition": partition_value}
        if normalized_query:
            filters.append("contains(search_text, :search_text)")
            values[":search_text"] = normalized_query
        if source:
            filters.append("#source = :source")
            names["#source"] = "source"
            values[":source"] = source.value
        if work_mode:
            filters.append("work_mode = :work_mode")
            values[":work_mode"] = work_mode.value
        _append_stage_age_filter(filters, values, stage_age)
        _append_follow_up_filter(filters, values, follow_up, follow_up_today)
        arguments["ExpressionAttributeValues"] = serialize_item(values)
        if filters:
            arguments["FilterExpression"] = " AND ".join(filters)
        if names:
            arguments["ExpressionAttributeNames"] = names
        if cursor:
            position = self._cursor_codec.decode(
                cursor,
                kind="applications",
                owner_user_id=owner_user_id,
                scope=scope,
            )
            arguments["ExclusiveStartKey"] = serialize_item(
                {
                    "PK": application_partition(owner_user_id, position.item_id),
                    "SK": "METADATA",
                    partition_name: partition_value,
                    sort_name: application_sort_key(position.timestamp, position.item_id),
                }
            )

        try:
            response = self._client.query(**arguments)
        except ClientError as error:
            if cursor and _error_code(error) == "ValidationException":
                raise InvalidCursorError("The pagination cursor is no longer valid.") from error
            raise PersistenceError("Unable to list applications.") from error

        loaded_applications = tuple(
            application_from_item(deserialize_item(item)) for item in response.get("Items", [])
        )
        applications = loaded_applications[:limit]
        next_cursor: str | None = None
        if (response.get("LastEvaluatedKey") or len(loaded_applications) > limit) and applications:
            last = applications[-1]
            next_cursor = self._cursor_codec.encode(
                kind="applications",
                owner_user_id=owner_user_id,
                scope=scope,
                timestamp=format_timestamp(last.updated_at),
                item_id=last.application_id,
            )
        return ApplicationPage(items=applications, next_cursor=next_cursor)

    def _list_status_partitions(
        self,
        owner_user_id: str,
        *,
        statuses: tuple[ApplicationStatus, ...],
        limit: int,
        cursor: str | None,
        normalized_query: str | None,
        source: ApplicationSource | None,
        work_mode: WorkMode | None,
        stage_age: StageAgeBounds | None,
        follow_up: FollowUpFilter | None,
        follow_up_today: date | None,
        sort: ApplicationSort,
        scope: str,
    ) -> ApplicationPage:
        position = (
            self._cursor_codec.decode(
                cursor,
                kind="applications",
                owner_user_id=owner_user_id,
                scope=scope,
            )
            if cursor
            else None
        )
        loaded_by_id: dict[str, Application] = {}
        try:
            for application_status in statuses:
                partition_value = owner_status_key(owner_user_id, application_status)
                values: dict[str, object] = {":partition": partition_value}
                names: dict[str, str] = {}
                filters: list[str] = []
                if normalized_query:
                    filters.append("contains(search_text, :search_text)")
                    values[":search_text"] = normalized_query
                if source:
                    filters.append("#source = :source")
                    names["#source"] = "source"
                    values[":source"] = source.value
                if work_mode:
                    filters.append("work_mode = :work_mode")
                    values[":work_mode"] = work_mode.value
                _append_stage_age_filter(filters, values, stage_age)
                _append_follow_up_filter(filters, values, follow_up, follow_up_today)

                arguments: dict[str, Any] = {
                    "TableName": self._table_name,
                    "IndexName": GSI2_NAME,
                    "KeyConditionExpression": "GSI2PK = :partition",
                    "ExpressionAttributeValues": serialize_item(values),
                }
                if filters:
                    arguments["FilterExpression"] = " AND ".join(filters)
                if names:
                    arguments["ExpressionAttributeNames"] = names

                while True:
                    response = self._client.query(**arguments)
                    for item in response.get("Items", []):
                        application = application_from_item(deserialize_item(item))
                        loaded_by_id[application.application_id] = application
                    last_key = response.get("LastEvaluatedKey")
                    if not last_key:
                        break
                    arguments["ExclusiveStartKey"] = last_key
        except ClientError as error:
            raise PersistenceError("Unable to list applications.") from error

        applications = list(loaded_by_id.values())
        applications.sort(
            key=lambda item: application_sort_key(
                format_timestamp(item.updated_at), item.application_id
            ),
            reverse=sort is ApplicationSort.UPDATED_DESC,
        )
        if position is not None:
            cursor_key = application_sort_key(position.timestamp, position.item_id)
            if sort is ApplicationSort.UPDATED_ASC:
                applications = [
                    item
                    for item in applications
                    if application_sort_key(format_timestamp(item.updated_at), item.application_id)
                    > cursor_key
                ]
            else:
                applications = [
                    item
                    for item in applications
                    if application_sort_key(format_timestamp(item.updated_at), item.application_id)
                    < cursor_key
                ]

        page_items = tuple(applications[:limit])
        next_cursor: str | None = None
        if len(applications) > limit and page_items:
            last = page_items[-1]
            next_cursor = self._cursor_codec.encode(
                kind="applications",
                owner_user_id=owner_user_id,
                scope=scope,
                timestamp=format_timestamp(last.updated_at),
                item_id=last.application_id,
            )
        return ApplicationPage(items=page_items, next_cursor=next_cursor)

    def list_all(self, owner_user_id: str) -> tuple[Application, ...]:
        applications: list[Application] = []
        for status in ApplicationStatus:
            arguments: dict[str, Any] = {
                "TableName": self._table_name,
                "IndexName": GSI2_NAME,
                "KeyConditionExpression": "GSI2PK = :partition",
                "ExpressionAttributeValues": serialize_item(
                    {":partition": owner_status_key(owner_user_id, status)}
                ),
            }
            try:
                while True:
                    response = self._client.query(**arguments)
                    applications.extend(
                        application_from_item(deserialize_item(item))
                        for item in response.get("Items", [])
                    )
                    last_key = response.get("LastEvaluatedKey")
                    if not last_key:
                        break
                    arguments["ExclusiveStartKey"] = last_key
            except ClientError as error:
                raise PersistenceError("Unable to list workspace applications.") from error
        return tuple(sorted(applications, key=lambda item: item.updated_at, reverse=True))

    def get_status_counts(self, owner_user_id: str) -> dict[ApplicationStatus, int]:
        items = self._read_counters(owner_user_id)
        return {
            status: int(items.get(f"COUNTER#STATUS#{status.value}", {}).get("count", 0))
            for status in ApplicationStatus
        }

    def get_funnel_counts(self, owner_user_id: str) -> dict[str, int]:
        return {
            key: int(value)
            for key, value in self._read_counters(owner_user_id).get("COUNTER#FUNNEL", {}).items()
            if key.endswith("_count") or key == "total_tracked"
        }

    def list_follow_ups_due(
        self, owner_user_id: str, *, due_on_or_before: date, limit: int
    ) -> tuple[Application, ...]:
        try:
            response = self._client.query(
                TableName=self._table_name,
                IndexName=GSI3_NAME,
                KeyConditionExpression=(
                    "GSI3PK = :partition AND GSI3SK BETWEEN :lower_bound AND :upper_bound"
                ),
                ExpressionAttributeValues=serialize_item(
                    {
                        ":partition": owner_schedule_key(owner_user_id),
                        ":lower_bound": "FOLLOW_UP#",
                        ":upper_bound": f"FOLLOW_UP#{due_on_or_before.isoformat()}#\uffff",
                    }
                ),
                ScanIndexForward=True,
                Limit=limit,
            )
        except ClientError as error:
            raise PersistenceError("Unable to list due workspace follow-ups.") from error
        return tuple(
            application_from_item(deserialize_item(item)) for item in response.get("Items", [])
        )

    def _read_counters(self, owner_user_id: str) -> dict[str, dict[str, Any]]:
        try:
            response = self._client.query(
                TableName=self._table_name,
                KeyConditionExpression="PK = :partition AND begins_with(SK, :prefix)",
                ExpressionAttributeValues=serialize_item(
                    {
                        ":partition": user_partition(owner_user_id),
                        ":prefix": "COUNTER#",
                    }
                ),
                ConsistentRead=True,
            )
        except ClientError as error:
            raise PersistenceError("Unable to read workspace counters.") from error
        return {
            str(item["SK"]): item
            for item in (deserialize_item(raw_item) for raw_item in response.get("Items", []))
        }

    def replace_details(self, application: Application, *, expected_version: int) -> None:
        try:
            self._client.put_item(
                TableName=self._table_name,
                Item=serialize_item(application_to_item(application)),
                ConditionExpression="attribute_exists(PK) AND #version = :expected_version",
                ExpressionAttributeNames={"#version": "version"},
                ExpressionAttributeValues=serialize_item({":expected_version": expected_version}),
            )
        except ClientError as error:
            if _error_code(error) == "ConditionalCheckFailedException":
                raise ConflictError(
                    "The application was changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError("Unable to update the application.") from error

    def replace_details_with_activity(
        self,
        application: Application,
        *,
        expected_version: int,
        activity: Activity,
    ) -> None:
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(application_to_item(application)),
                            "ConditionExpression": (
                                "attribute_exists(PK) AND #version = :expected_version"
                            ),
                            "ExpressionAttributeNames": {"#version": "version"},
                            "ExpressionAttributeValues": serialize_item(
                                {":expected_version": expected_version}
                            ),
                        }
                    },
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(activity_to_item(activity)),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                    resource_quota_update(
                        self._table_name,
                        owner_user_id=application.owner_user_id,
                        application_id=application.application_id,
                        expires_at=application.expires_at,
                        max_activity=self._max_activity,
                    ),
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    "The application was changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError("Unable to update the application.") from error

    def replace_with_activity(
        self,
        application: Application,
        *,
        prior_application: Application,
        expected_version: int,
        activity: Activity,
    ) -> None:
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(application_to_item(application)),
                            "ConditionExpression": (
                                "attribute_exists(PK) AND #version = :expected_version "
                                "AND #status = :prior_status"
                            ),
                            "ExpressionAttributeNames": {
                                "#version": "version",
                                "#status": "status",
                            },
                            "ExpressionAttributeValues": serialize_item(
                                {
                                    ":expected_version": expected_version,
                                    ":prior_status": prior_application.status.value,
                                }
                            ),
                        }
                    },
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": serialize_item(activity_to_item(activity)),
                            "ConditionExpression": (
                                "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                            ),
                        }
                    },
                    resource_quota_update(
                        self._table_name,
                        owner_user_id=application.owner_user_id,
                        application_id=application.application_id,
                        expires_at=application.expires_at,
                        max_activity=self._max_activity,
                    ),
                    _status_counter_update(
                        self._table_name, application, prior_application.status, -1
                    ),
                    _status_counter_update(self._table_name, application, application.status, 1),
                    _funnel_counter_update(
                        self._table_name,
                        application,
                        _transition_funnel_deltas(prior_application, application),
                    ),
                ]
            )
        except ClientError as error:
            if _error_code(error) == "TransactionCanceledException":
                raise ConflictError(
                    "The application was changed by another request. Refresh and try again."
                ) from error
            raise PersistenceError("Unable to change the application status.") from error

    def list_activity(
        self,
        owner_user_id: str,
        application_id: str,
        *,
        limit: int,
        cursor: str | None,
    ) -> ActivityPage:
        arguments: dict[str, Any] = {
            "TableName": self._table_name,
            "KeyConditionExpression": "PK = :partition AND begins_with(SK, :prefix)",
            "ExpressionAttributeValues": serialize_item(
                {
                    ":partition": application_partition(owner_user_id, application_id),
                    ":prefix": "ACTIVITY#",
                }
            ),
            "ScanIndexForward": True,
            "Limit": limit + 1,
        }
        if cursor:
            position = self._cursor_codec.decode(
                cursor,
                kind="application-activity",
                owner_user_id=owner_user_id,
                scope=application_id,
            )
            arguments["ExclusiveStartKey"] = serialize_item(
                {
                    "PK": application_partition(owner_user_id, application_id),
                    "SK": activity_sort_key(position.timestamp, position.item_id),
                }
            )
        try:
            response = self._client.query(**arguments)
        except ClientError as error:
            raise PersistenceError("Unable to list application activity.") from error
        raw_activities = [
            activity_from_item(deserialize_item(item)) for item in response.get("Items", [])
        ]
        activities = raw_activities[:limit]
        next_cursor = None
        if activities and (len(raw_activities) > limit or response.get("LastEvaluatedKey")):
            last = activities[-1]
            next_cursor = self._cursor_codec.encode(
                kind="application-activity",
                owner_user_id=owner_user_id,
                scope=application_id,
                timestamp=format_timestamp(last.created_at),
                item_id=last.activity_id,
            )
        return ActivityPage(items=tuple(activities), next_cursor=next_cursor)


def _application_statuses_for_view(
    view: DefaultApplicationView | None,
) -> tuple[ApplicationStatus, ...]:
    if view is DefaultApplicationView.ACTIVE:
        return ACTIVE_APPLICATION_STATUSES
    if view is DefaultApplicationView.ARCHIVED:
        return (ApplicationStatus.ARCHIVED,)
    if view is DefaultApplicationView.ALL:
        return tuple(ApplicationStatus)
    raise ValueError("An application view is required.")


def _append_stage_age_filter(
    filters: list[str], values: dict[str, object], bounds: StageAgeBounds | None
) -> None:
    if bounds is None:
        return
    if bounds.entered_on_or_after is not None:
        filters.append("stage_entered_at >= :stage_entered_on_or_after")
        values[":stage_entered_on_or_after"] = bounds.entered_on_or_after.isoformat()
    if bounds.entered_before is not None:
        filters.append("stage_entered_at < :stage_entered_before")
        values[":stage_entered_before"] = bounds.entered_before.isoformat()


def _append_follow_up_filter(
    filters: list[str],
    values: dict[str, object],
    follow_up: FollowUpFilter | None,
    today: date | None,
) -> None:
    if follow_up is FollowUpFilter.NEEDS_ATTENTION and today is not None:
        filters.append(
            "(attribute_not_exists(follow_up_date) OR follow_up_date <= :follow_up_today)"
        )
        values[":follow_up_today"] = today.isoformat()


def _error_code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", ""))


def _status_counter_update(
    table_name: str, application: Application, status: ApplicationStatus, delta: int
) -> dict[str, Any]:
    values: dict[str, object] = {
        ":entity_type": "STATUS_COUNTER",
        ":delta": delta,
        ":zero": 0,
    }
    expression = "SET entity_type = :entity_type, #count = if_not_exists(#count, :zero) + :delta"
    if application.expires_at is not None:
        values[":expires_at"] = application.expires_at
        expression += ", expires_at = :expires_at"
    update: dict[str, Any] = {
        "TableName": table_name,
        "Key": serialize_item(
            {
                "PK": user_partition(application.owner_user_id),
                "SK": f"COUNTER#STATUS#{status.value}",
            }
        ),
        "UpdateExpression": expression,
        "ExpressionAttributeNames": {"#count": "count"},
        "ExpressionAttributeValues": serialize_item(values),
    }
    return {"Update": update}


def _funnel_counter_update(
    table_name: str, application: Application, deltas: dict[str, int]
) -> dict[str, Any]:
    values: dict[str, object] = {":entity_type": "FUNNEL_COUNTER", ":zero": 0}
    assignments = ["entity_type = :entity_type"]
    names: dict[str, str] = {}
    for index, (field, delta) in enumerate(deltas.items()):
        placeholder = f"#counter{index}"
        delta_key = f":delta{index}"
        names[placeholder] = field
        values[delta_key] = delta
        assignments.append(f"{placeholder} = if_not_exists({placeholder}, :zero) + {delta_key}")
    if application.expires_at is not None:
        values[":expires_at"] = application.expires_at
        assignments.append("expires_at = :expires_at")
    return {
        "Update": {
            "TableName": table_name,
            "Key": serialize_item(
                {"PK": user_partition(application.owner_user_id), "SK": "COUNTER#FUNNEL"}
            ),
            "UpdateExpression": "SET " + ", ".join(assignments),
            "ExpressionAttributeNames": names,
            "ExpressionAttributeValues": serialize_item(values),
        }
    }


def _transition_funnel_deltas(prior: Application, application: Application) -> dict[str, int]:
    if (
        prior.status is ApplicationStatus.ARCHIVED
        or application.status is ApplicationStatus.ARCHIVED
    ):
        return {
            "submitted_count": 0,
            "response_count": 0,
            "screening_count": 0,
            "interview_count": 0,
            "offer_count": 0,
            "acceptance_count": 0,
        }
    return {
        "submitted_count": int(prior.submitted_at is None and application.submitted_at is not None),
        "response_count": int(
            prior.first_response_at is None and application.first_response_at is not None
        ),
        "screening_count": int(
            prior.first_screening_at is None and application.first_screening_at is not None
        ),
        "interview_count": int(
            prior.first_interview_at is None and application.first_interview_at is not None
        ),
        "offer_count": int(prior.first_offer_at is None and application.first_offer_at is not None),
        "acceptance_count": int(
            prior.first_acceptance_at is None and application.first_acceptance_at is not None
        ),
    }
