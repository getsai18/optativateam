"""Límite de login distribuido: contador en DynamoDB y respaldo local.

El fake de DynamoDB replica lo justo de boto3 (put/get/update/delete con condición)
para ejercitar el código real de app.views.auth sin red ni credenciales AWS.
"""

import time

import pytest
from botocore.exceptions import ClientError

from app.views import auth as auth_view


class FakeTable:
    """Table de boto3 en memoria: suficiente para el contador de intentos."""

    def __init__(self):
        self.items: dict[str, dict] = {}

    def put_item(self, Item, ConditionExpression=None, **_kwargs):
        key = Item["session_id"]
        if ConditionExpression == "attribute_not_exists(session_id)" and key in self.items:
            raise ClientError(
                {"Error": {"Code": "ConditionalCheckFailedException", "Message": "exists"}},
                "PutItem",
            )
        self.items[key] = dict(Item)
        return {}

    def get_item(self, Key, **_kwargs):
        item = self.items.get(Key["session_id"])
        return {"Item": dict(item)} if item is not None else {}

    def update_item(self, Key, UpdateExpression, ExpressionAttributeValues, **_kwargs):
        item = self.items.setdefault(Key["session_id"], {"session_id": Key["session_id"], "attempts": 0})
        if "ADD attempts :one" in UpdateExpression:
            item["attempts"] = int(item.get("attempts", 0)) + int(ExpressionAttributeValues[":one"])
        item["ttl"] = int(ExpressionAttributeValues[":ttl"])
        return {"Attributes": {"attempts": item["attempts"]}}

    def delete_item(self, Key, **_kwargs):
        self.items.pop(Key["session_id"], None)
        return {}


class _FakeResource:
    def __init__(self, table):
        self._table = table

    def Table(self, name):
        assert name == "billing_user_session"
        return self._table


@pytest.fixture(autouse=True)
def _reset_limiter():
    auth_view.reset_rate_limit()
    yield
    auth_view.reset_rate_limit()


@pytest.fixture()
def fake_dynamo(monkeypatch):
    table = FakeTable()
    monkeypatch.setenv("DYNAMODB_RATE_LIMIT", "1")
    monkeypatch.setenv("DYNAMODB_ENDPOINT", "http://127.0.0.1:8000")
    monkeypatch.setenv("USER_SESSION_TABLE", "billing_user_session")
    monkeypatch.setattr(auth_view.boto3, "resource", lambda *_a, **_k: _FakeResource(table))
    return table


def _bad_login(client, email):
    return client.post("/auth/login", json={"email": email, "password": "bad"})


def test_five_failures_block_login_in_dynamodb(client, store, fake_dynamo):
    email = "x@y.test"
    for _ in range(auth_view.MAX_FAILS):
        assert _bad_login(client, email).status_code == 401

    blocked = _bad_login(client, email)
    assert blocked.status_code == 429
    assert blocked.get_json()["code"] == "RATE_LIMITED"

    item = fake_dynamo.items["login:127.0.0.1:x@y.test"]
    assert item["attempts"] == auth_view.MAX_FAILS
    remaining = item["ttl"] - int(time.time())
    assert auth_view.WINDOW_S - 5 <= remaining <= auth_view.WINDOW_S
    assert not auth_view._FAILS  # con DynamoDB disponible no se usa el dict local


def test_successful_login_clears_remote_counter(client, store, fake_dynamo):
    store.users[1] = {
        "id": 1,
        "email": "ok@y.test",
        "password_hash": "seed-placeholder",  # con ALLOW_DEMO_LOGIN acepta DEMO_PASSWORD
        "full_name": "Ok User",
        "role": "ADMIN",
        "customer_id": None,
        "active": 1,
    }
    key = "login:127.0.0.1:ok@y.test"
    assert _bad_login(client, "ok@y.test").status_code == 401
    assert _bad_login(client, "ok@y.test").status_code == 401
    assert fake_dynamo.items[key]["attempts"] == 2

    ok = client.post("/auth/login", json={"email": "ok@y.test", "password": "demo1234"})
    assert ok.status_code == 200
    assert key not in fake_dynamo.items

    assert _bad_login(client, "ok@y.test").status_code == 401
    assert fake_dynamo.items[key]["attempts"] == 1


def test_expired_remote_counter_is_ignored(client, store, fake_dynamo):
    key = "login:127.0.0.1:x@y.test"
    fake_dynamo.items[key] = {"session_id": key, "attempts": 5, "ttl": int(time.time()) - 1}
    assert _bad_login(client, "x@y.test").status_code == 401
    # El contador vencido se descarta: el siguiente fallo empieza desde 1.
    assert fake_dynamo.items[key]["attempts"] == 1


def test_local_fallback_without_endpoint(client, store, monkeypatch):
    monkeypatch.delenv("DYNAMODB_ENDPOINT", raising=False)
    monkeypatch.delenv("DYNAMODB_ENDPOINT_URL", raising=False)
    monkeypatch.delenv("DYNAMODB_RATE_LIMIT", raising=False)
    monkeypatch.delenv("AWS_LAMBDA_FUNCTION_NAME", raising=False)
    auth_view.reset_rate_limit()

    for _ in range(auth_view.MAX_FAILS):
        assert _bad_login(client, "x@y.test").status_code == 401
    assert _bad_login(client, "x@y.test").status_code == 429
    assert len(auth_view._FAILS[("127.0.0.1", "x@y.test")]) == auth_view.MAX_FAILS


def test_local_fallback_when_dynamodb_errors(client, store, monkeypatch):
    monkeypatch.setenv("DYNAMODB_RATE_LIMIT", "1")
    monkeypatch.setenv("DYNAMODB_ENDPOINT", "http://127.0.0.1:8000")

    class BrokenTable:
        def get_item(self, **_kwargs):
            raise RuntimeError("DynamoDB unavailable")

        def put_item(self, **_kwargs):
            raise RuntimeError("DynamoDB unavailable")

        def update_item(self, **_kwargs):
            raise RuntimeError("DynamoDB unavailable")

        def delete_item(self, **_kwargs):
            raise RuntimeError("DynamoDB unavailable")

    monkeypatch.setattr(auth_view.boto3, "resource", lambda *_a, **_k: _FakeResource(BrokenTable()))
    auth_view.reset_rate_limit()

    for _ in range(auth_view.MAX_FAILS):
        assert _bad_login(client, "x@y.test").status_code == 401
    assert _bad_login(client, "x@y.test").status_code == 429
    assert len(auth_view._FAILS[("127.0.0.1", "x@y.test")]) == auth_view.MAX_FAILS
