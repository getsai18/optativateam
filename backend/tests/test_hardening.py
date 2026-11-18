import bcrypt

from app import audit, repos
from tests.conftest import auth_headers
from tests.test_api_auth import MARKER, _seed_admin
from tests.test_invoices import DRAFT_BODY


def test_marker_hash_login_rejected_when_demo_login_disabled(client, app, store):
    app.config["ALLOW_DEMO_LOGIN"] = False
    _seed_admin(store)
    response = client.post("/auth/login", json={"email": "admin@northwind.test", "password": "demo1234"})
    assert response.status_code == 401


def test_real_bcrypt_hash_still_logs_in_when_demo_login_disabled(client, app, store):
    app.config["ALLOW_DEMO_LOGIN"] = False
    _seed_admin(store)
    store.users[1]["password_hash"] = bcrypt.hashpw(b"demo1234", bcrypt.gensalt(4)).decode()
    response = client.post("/auth/login", json={"email": "admin@northwind.test", "password": "demo1234"})
    assert response.status_code == 200
    assert MARKER  # el marcador del seed ya no sirve como contraseña


class _FakeTable:
    def __init__(self):
        self.items = []

    def put_item(self, Item):
        self.items.append(Item)


def test_audit_event_ts_is_unique_for_same_millisecond(app, monkeypatch):
    table = _FakeTable()
    monkeypatch.setattr(audit, "_table", lambda: table)
    monkeypatch.setattr(audit, "iso_ms", lambda _v: "2026-10-13T12:00:00.000Z")
    app.config["AUDIT_BACKEND"] = "dynamodb"
    claims = {"sub": "usr_1"}
    with app.app_context():
        audit.write_entry(claims, "invoice.create", "invoice", "inv_1")
        audit.write_entry(claims, "invoice.issue", "invoice", "inv_1")
    keys = {(i["entity_key"], i["event_ts"]) for i in table.items}
    assert len(keys) == 2
    assert all(i["event_ts"].startswith("2026-10-13T12:00:00.000Z#") for i in table.items)


def test_dynamodb_write_failure_is_logged_not_buffered_in_memory(app, monkeypatch, caplog):
    def boom():
        raise RuntimeError("dynamodb down")

    monkeypatch.setattr(audit, "_table", boom)
    app.config["AUDIT_BACKEND"] = "dynamodb"
    audit.reset_memory()
    with app.app_context(), caplog.at_level("ERROR"):
        audit.write_entry({"sub": "usr_1"}, "invoice.pay", "invoice", "inv_1")
    assert audit._memory == []
    assert "AUDIT_WRITE_FAILED" in caplog.text


def test_state_changing_invoice_endpoints_lock_the_row(client, app, store, monkeypatch):
    locked = []
    original = repos.find_invoice_for_update

    def spy(invoice_id):
        locked.append(invoice_id)
        return original(invoice_id)

    monkeypatch.setattr(repos, "find_invoice_for_update", spy)
    headers = auth_headers(app)
    created = client.post("/invoices", json=DRAFT_BODY, headers=headers).get_json()
    invoice_id = created["id"]
    client.post(f"/invoices/{invoice_id}/issue", headers=headers)
    client.post(f"/invoices/{invoice_id}/payments", json={"method": "CASH"}, headers=headers)
    other = client.post("/invoices", json=DRAFT_BODY, headers=headers).get_json()["id"]
    client.post(f"/invoices/{other}/cancel", json={"reason": "duplicada"}, headers=headers)
    assert len(locked) >= 4  # issue (x2: carga + sello), pay, cancel
