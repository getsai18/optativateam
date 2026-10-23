import pytest

from app.views import auth as auth_view
from tests.conftest import auth_headers


@pytest.fixture(autouse=True)
def _reset_limiter():
    auth_view.reset_rate_limit()


def test_sql_injection_in_login_is_just_a_wrong_credential(client, store):
    for payload in ("' OR '1'='1", "admin@x.test'--", "a@b.c'; DROP TABLE app_user;--"):
        r = client.post("/auth/login", json={"email": payload, "password": "' OR '1'='1"})
        assert r.status_code == 401
        assert r.get_json()["code"] == "UNAUTHORIZED"


def test_login_is_rate_limited(client, store):
    for _ in range(auth_view.MAX_FAILS):
        assert client.post("/auth/login", json={"email": "x@y.test", "password": "bad"}).status_code == 401
    r = client.post("/auth/login", json={"email": "x@y.test", "password": "bad"})
    assert r.status_code == 429
    assert r.get_json()["code"] == "RATE_LIMITED"


def test_forged_and_unsigned_tokens_are_rejected(client, app):
    import base64
    import json

    def b64(obj):
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()

    none_token = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': 'usr_1', 'role': 'ADMIN', 'exp': 9999999999999})}."
    for token in (none_token, "garbage", ""):
        r = client.get("/users", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401


def test_customer_cannot_reach_admin_routes(client, app):
    headers = auth_headers(app, role="CUSTOMER", sub="usr_9", customer_id="cus_1")
    for path in ("/users", "/audit", "/customers", "/dashboard", "/services"):
        assert client.get(path, headers=headers).status_code == 403


def test_oversized_and_malformed_fields_are_rejected(client, app, store):
    headers = auth_headers(app)
    base = {"name": "Acme", "taxId": "AAA010101AAA", "email": "a@acme.test", "address": "Calle 1"}
    assert client.post("/customers", json=base, headers=headers).status_code == 200
    bad = [
        {**base, "name": "x" * 10_000},
        {**base, "email": "not-an-email"},
        {**base, "taxId": "T" * 50},
        {**base, "address": "ok\x00null"},
        {**base, "name": {"$ne": ""}},
    ]
    for body in bad:
        assert client.post("/customers", json=body, headers=headers).status_code == 400


def test_non_finite_numbers_are_rejected(client, app, store):
    headers = auth_headers(app)
    raw = '{"code":"S-1","name":"n","basePrice":NaN,"category":"Consulting"}'
    r = client.post("/services", data=raw, content_type="application/json", headers=headers)
    assert r.status_code == 400
    raw = '{"rate":Infinity,"validFrom":"2999-01-01"}'
    r = client.post("/taxes/tax_1/rates", data=raw, content_type="application/json", headers=headers)
    assert r.status_code in (400, 404)


def test_security_headers_present(client):
    r = client.get("/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"


def test_default_secret_refuses_to_boot(monkeypatch):
    from app import create_app

    monkeypatch.setenv("JWT_SECRET", "dev-secret-change-me")
    with pytest.raises(RuntimeError):
        create_app({"TESTING": False})
