"""Opt-in destructive verification on a newly created disposable loopback table only."""

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from threading import Event
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from hireflux_backend.app_factory import create_app
from hireflux_backend.auth.local import identity_from_settings
from hireflux_backend.config import Settings
from hireflux_backend.infrastructure.dynamodb.client import build_dynamodb_client
from hireflux_backend.infrastructure.dynamodb.manifest_backfill import backfill_local_manifest
from hireflux_backend.infrastructure.dynamodb.mapping import (
    application_partition,
    deserialize_item,
    serialize_item,
    user_partition,
)
from hireflux_backend.infrastructure.dynamodb.table_schema import (
    assert_safe_local_target,
    create_table_request,
)


class PausedClient:
    def __init__(self, client: Any) -> None:
        self.client = client
        self.armed = False
        self.arrived = Event()
        self.resume = Event()

    def __getattr__(self, name: str) -> Any:
        return getattr(self.client, name)

    def transact_write_items(self, **arguments: Any) -> Any:
        if self.armed:
            self.armed = False
            self.arrived.set()
            if not self.resume.wait(10):
                raise RuntimeError("The deterministic race barrier timed out.")
        return self.client.transact_write_items(**arguments)


def run(keep_for_browser: bool) -> None:
    original = Settings()  # type: ignore[call-arg]
    assert_safe_local_target(original)
    table = f"HireFluxPhase2C-{uuid4().hex[:12]}"
    settings = Settings.model_validate(
        original.model_dump()
        | {
            "auth_mode": "local",
            "dynamodb_table_name": table,
            "local_user_id": uuid4(),
            "account_erasure_max_items_per_request": 3,
            "cors_allowed_origins": "http://127.0.0.1:5175",
        }
    )
    assert_safe_local_target(settings)
    db = build_dynamodb_client(settings)
    db.create_table(**create_table_request(table))
    db.get_waiter("table_exists").wait(TableName=table)
    preserve = False
    try:
        owner = str(settings.local_user_id)
        paused = PausedClient(db)
        app = create_app(settings, dynamodb_client=paused)
        with TestClient(app) as client:
            assert client.post("/api/v1/me/bootstrap").status_code == 200
            application_ids = []
            for index in range(2):
                result = client.post(
                    "/api/v1/applications",
                    json={
                        "company_name": f"Fictional Erasure Labs {index}",
                        "job_title": "Engineer",
                        "status": "APPLIED",
                        "applied_date": "2026-10-05",
                        "follow_up_date": "2030-01-01",
                    },
                )
                assert result.status_code == 201, result.text
                application_id = result.json()["application_id"]
                application_ids.append(application_id)
                path = f"/api/v1/applications/{application_id}"
                assert (
                    client.post(
                        path + "/notes", json={"content": "Fictional local smoke note"}
                    ).status_code
                    == 201
                )
                assert (
                    client.post(
                        path + "/interviews",
                        json={
                            "interview_type": "TECHNICAL_SCREEN",
                            "scheduled_at": "2030-01-02T12:00:00Z",
                        },
                    ).status_code
                    == 201
                )
            assert (
                client.delete(
                    f"/api/v1/applications/{application_ids[1]}?expected_version=1"
                ).status_code
                == 200
            )
            assert (
                client.patch(
                    "/api/v1/settings",
                    json={"expected_version": 1, "time_zone": "Asia/Tokyo", "theme": "LIGHT"},
                ).status_code
                == 200
            )
            # Emulate a pre-2C workspace, then prove non-destructive, idempotent backfill.
            for raw in db.query(
                TableName=table,
                KeyConditionExpression="PK = :pk",
                ExpressionAttributeValues=serialize_item({":pk": user_partition(owner)}),
                ConsistentRead=True,
            )["Items"]:
                item = deserialize_item(raw)
                if item["SK"].startswith("APPLICATION_REF#"):
                    db.delete_item(TableName=table, Key={"PK": raw["PK"], "SK": raw["SK"]})
                elif item["SK"] == "WORKSPACE":
                    item.pop("application_manifest_version")
                    db.put_item(TableName=table, Item=serialize_item(item))
            assert (
                backfill_local_manifest(settings, confirmation=table, owner=owner, client=db) == 2
            )
            assert (
                backfill_local_manifest(settings, confirmation=table, owner=owner, client=db) == 2
            )
            exported = client.get("/api/v1/me/export")
            assert exported.status_code == 200, exported.text
            assert exported.json()["counts"]["applications"] == 2
            assert exported.json()["counts"]["notes"] == 2
            assert exported.json()["counts"]["interviews"] == 2
            assert exported.json()["settings"]["time_zone"] == "Asia/Tokyo"
            db.put_item(
                TableName=table,
                Item=serialize_item(
                    {
                        "PK": application_partition(owner, application_ids[0]),
                        "SK": "FUTURE#CHILD",
                        "content": "Synthetic owned record",
                    }
                ),
            )
            db.put_item(
                TableName=table,
                Item=serialize_item(
                    {
                        "PK": user_partition(owner),
                        "SK": "FUTURE#OWNER",
                        "content": "Synthetic owned record",
                    }
                ),
            )
            # Creation passed its HTTP/read preflight, pauses at the real transaction,
            # then the main thread commits the freeze before releasing that write.
            paused.armed = True
            with ThreadPoolExecutor(max_workers=1) as pool:
                write = pool.submit(
                    client.post,
                    "/api/v1/applications",
                    json={"company_name": "Denied Fictional Labs", "job_title": "Engineer"},
                )
                assert paused.arrived.wait(10)
                erasure = app.state.workspace_erasure_service
                identity = identity_from_settings(settings)
                workspace = erasure.status(identity).workspace
                erasure._repository.freeze(workspace, datetime.now(UTC))
                before = db.scan(TableName=table)["Items"]
                paused.resume.set()
                denied = write.result(timeout=10)
                assert denied.status_code == 409, denied.text
                assert denied.json()["error"]["code"] == "WORKSPACE_DELETING"
                assert db.scan(TableName=table)["Items"] == before
            assert (
                client.patch(
                    "/api/v1/settings", json={"expected_version": 2, "theme": "DARK"}
                ).json()["error"]["code"]
                == "WORKSPACE_DELETING"
            )
            passes = 0
            while passes < 100:
                result = client.delete("/api/v1/me")
                passes += 1
                if result.json()["state"] == "DELETED":
                    break
                assert result.status_code == 202
            assert result.json()["state"] == "DELETED" and passes > 1
            assert client.delete("/api/v1/me").json() == result.json()
            assert (
                client.post("/api/v1/me/bootstrap").json()["error"]["code"] == "WORKSPACE_DELETED"
            )
            remaining = [deserialize_item(raw) for raw in db.scan(TableName=table)["Items"]]
            assert len(remaining) == 1 and remaining[0]["SK"] == "WORKSPACE"
            assert remaining[0]["state"] == "DELETED" and "expires_at" not in remaining[0]
        # Repeat the paused-after-preflight race for the distinct settings write.
        second_settings = Settings.model_validate(
            settings.model_dump() | {"local_user_id": uuid4()}
        )
        paused = PausedClient(db)
        second_app = create_app(second_settings, dynamodb_client=paused)
        with TestClient(second_app) as client:
            assert client.post("/api/v1/me/bootstrap").status_code == 200
            paused.armed = True
            with ThreadPoolExecutor(max_workers=1) as pool:
                write = pool.submit(
                    client.patch, "/api/v1/settings", json={"expected_version": 1, "theme": "DARK"}
                )
                assert paused.arrived.wait(10)
                erasure = second_app.state.workspace_erasure_service
                workspace = erasure.status(identity_from_settings(second_settings)).workspace
                erasure._repository.freeze(workspace, datetime.now(UTC))
                before = db.scan(TableName=table)["Items"]
                paused.resume.set()
                denied = write.result(timeout=10)
                assert denied.json()["error"]["code"] == "WORKSPACE_DELETING"
                assert db.scan(TableName=table)["Items"] == before
            for _attempt in range(100):
                if client.delete("/api/v1/me").json()["state"] == "DELETED":
                    break
            else:
                raise AssertionError("Settings owner erasure failed to converge.")
        print(
            json.dumps(
                {
                    "real_dynamodb_local": "passed",
                    "application_race": "passed",
                    "settings_race": "passed",
                    "migration": "passed",
                    "erasure_passes": passes,
                    "table": table,
                }
            )
        )
        if keep_for_browser:
            browser_owner = str(uuid4())
            path = Path(".tools/phase2c-smoke-state.json")
            path.write_text(
                json.dumps({"table": table, "browser_owner": browser_owner}), encoding="utf-8"
            )
            preserve = True
    finally:
        if not preserve:
            assert_safe_local_target(settings)
            assert table == settings.dynamodb_table_name and table.startswith("HireFluxPhase2C-")
            db.delete_table(TableName=table)
            db.get_waiter("table_not_exists").wait(TableName=table)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-local-smoke", action="store_true", required=True)
    parser.add_argument("--keep-table-for-browser", action="store_true")
    args = parser.parse_args()
    run(args.keep_table_for_browser)
