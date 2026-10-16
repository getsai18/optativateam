import time

import jwt

from tests.conftest import auth_headers, make_token

MARKER = "$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234"


def _seed_admin(store):
    store.users[1] = {
        "id": 1,
        "email": "admin@northwind.test",
        "password_hash": MARKER,
        "full_name": "Sofía Navarro",
        "role": "ADMIN",
        "customer_id": None,
        "active": 1,
    }


def test_login_success(client, store):
    _seed_admin(store)
    response = client.post("/auth/login", json={"email": "admin@northwind.test", "password": "demo1234"})
    assert response.status_code == 200
    data = response.get_json()
    assert data["token"]
    claims = data["claims"]
    assert claims["sub"] == "usr_1"
    assert claims["role"] == "ADMIN"
    assert int(time.time()) < claims["exp"] <= int(time.time()) + 1800


def test_login_trims_and_lowercases_email(client, store):
    _seed_admin(store)
    response = client.post("/auth/login", json={"email": "  Admin@Northwind.TEST ", "password": "demo1234"})
    assert response.status_code == 200


def test_login_wrong_password(client, store):
    _seed_admin(store)
    response = client.post("/auth/login", json={"email": "admin@northwind.test", "password": "nope"})
    assert response.status_code == 401
    assert response.get_json() == {"code": "UNAUTHORIZED", "message": "Invalid email or password"}


def test_login_unknown_user(client, store):
    response = client.post("/auth/login", json={"email": "ghost@x.test", "password": "demo1234"})
    assert response.status_code == 401


def test_login_inactive_account(client, store):
    _seed_admin(store)
    store.users[1]["active"] = 0
    response = client.post("/auth/login", json={"email": "admin@northwind.test", "password": "demo1234"})
    assert response.status_code == 403
    assert response.get_json()["message"] == "This account has been deactivated"


def test_missing_token_is_unauthorized(client):
    response = client.get("/users")
    assert response.status_code == 401
    assert response.get_json() == {"code": "UNAUTHORIZED", "message": "Session expired"}


def test_expired_token_is_unauthorized(client, app):
    claims = {
        "sub": "usr_1",
        "email": "a@b.test",
        "name": "A",
        "role": "ADMIN",
        "exp": int(time.time()) - 1,
    }
    token = jwt.encode(claims, app.config["JWT_SECRET"], algorithm="HS256")
    response = client.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_forbidden_role(client, app, store):
    response = client.get("/users", headers=auth_headers(app, role="CUSTOMER", customer_id="cus_1"))
    assert response.status_code == 403
    assert response.get_json() == {
        "code": "FORBIDDEN",
        "message": "You do not have permission to perform this action",
    }


def test_customers_blocked_for_customers(client, app, store):
    response = client.get("/customers", headers=auth_headers(app, role="BILLER"))
    assert response.status_code == 200
    response = client.get("/customers", headers=auth_headers(app, role="CUSTOMER", customer_id="cus_1"))
    assert response.status_code == 403


def test_token_from_other_secret_rejected(client, app):
    claims = {
        "sub": "usr_1",
        "email": "a@b.test",
        "name": "A",
        "role": "ADMIN",
        "exp": int(time.time()) + 100,
    }
    token = jwt.encode(claims, "another-secret-0123456789-01234567-xy", algorithm="HS256")
    response = client.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_make_token_helper_shape(client, app):
    token = make_token(app, role="BILLER", sub="usr_2")
    assert token.count(".") == 2
