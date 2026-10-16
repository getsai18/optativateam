import bcrypt

from tests.conftest import auth_headers


def test_list_users_requires_admin(client, app, store):
    store.users[1] = {
        "id": 1,
        "email": "admin@northwind.test",
        "password_hash": "x",
        "full_name": "Admin",
        "role": "ADMIN",
        "customer_id": None,
        "active": 1,
    }
    response = client.get("/users", headers=auth_headers(app))
    assert response.status_code == 200
    assert response.get_json()[0]["email"] == "admin@northwind.test"


def test_create_customer_user_requires_customer_link(client, app, store):
    payload = {"email": "c@x.test", "fullName": "Cliente", "role": "CUSTOMER", "active": True}
    response = client.post("/users", json=payload, headers=auth_headers(app))
    assert response.status_code == 400
    assert response.get_json()["message"] == "Customer users must be linked to a customer"


def test_create_customer_user_with_unknown_customer(client, app, store):
    payload = {
        "email": "c@x.test",
        "fullName": "Cliente",
        "role": "CUSTOMER",
        "customerId": "cus_99",
        "active": True,
    }
    response = client.post("/users", json=payload, headers=auth_headers(app))
    assert response.status_code == 404


def test_create_customer_user_and_login(client, app, store):
    payload = {
        "email": "customer@client.test",
        "fullName": "Ricardo Meza",
        "role": "CUSTOMER",
        "customerId": "cus_1",
        "active": True,
        "password": "Clave-segura-2026",
    }
    response = client.post("/users", json=payload, headers=auth_headers(app))
    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == "usr_1"
    assert data["customerId"] == "cus_1"
    stored_hash = store.users[1]["password_hash"]
    assert bcrypt.checkpw(b"Clave-segura-2026", stored_hash.encode("utf-8"))
    login = client.post("/auth/login", json={"email": "customer@client.test", "password": "Clave-segura-2026"})
    assert login.status_code == 200
    assert login.get_json()["claims"]["customerId"] == "cus_1"


def test_create_duplicate_email_conflict(client, app, store):
    store.users[1] = {
        "id": 1,
        "email": "admin@northwind.test",
        "password_hash": "x",
        "full_name": "Admin",
        "role": "ADMIN",
        "customer_id": None,
        "active": 1,
    }
    payload = {"email": "Admin@Northwind.test", "fullName": "Otro", "role": "BILLER", "active": True}
    response = client.post("/users", json=payload, headers=auth_headers(app))
    assert response.status_code == 409
    assert response.get_json()["message"] == "A user with this email already exists"


def test_cannot_remove_own_admin_access(client, app, store):
    store.users[1] = {
        "id": 1,
        "email": "admin@northwind.test",
        "password_hash": "x",
        "full_name": "Admin",
        "role": "ADMIN",
        "customer_id": None,
        "active": 1,
    }
    payload = {"email": "admin@northwind.test", "fullName": "Admin", "role": "BILLER", "active": True}
    response = client.put("/users/usr_1", json=payload, headers=auth_headers(app, sub="usr_1"))
    assert response.status_code == 400
    assert response.get_json()["message"] == "You cannot remove your own administrator access"


def test_update_user_ok(client, app, store):
    store.users[2] = {
        "id": 2,
        "email": "biller@northwind.test",
        "password_hash": "x",
        "full_name": "Diego Herrera",
        "role": "BILLER",
        "customer_id": None,
        "active": 1,
    }
    payload = {"email": "b2@northwind.test", "fullName": "Diego H.", "role": "BILLER", "active": False}
    response = client.put("/users/usr_2", json=payload, headers=auth_headers(app, sub="usr_1"))
    assert response.status_code == 200
    assert store.users[2]["active"] == 0
    assert store.users[2]["email"] == "b2@northwind.test"


def test_create_user_without_password_is_rejected(client, app, store):
    payload = {"email": "nopass@client.test", "fullName": "Sin Clave", "role": "BILLER", "active": True}
    response = client.post("/users", json=payload, headers=auth_headers(app))
    assert response.status_code == 400
    assert store.users == {}


def test_token_of_deactivated_user_is_rejected(client, app, store):
    store.users[2] = {
        "id": 2,
        "email": "biller@test.local",
        "password_hash": "x",
        "full_name": "Biller",
        "role": "BILLER",
        "customer_id": None,
        "active": 1,
    }
    headers = auth_headers(app, "BILLER", "usr_2")
    assert client.get("/invoices", headers=headers).status_code == 200
    store.users[2]["active"] = 0
    assert client.get("/invoices", headers=headers).status_code == 401


def test_token_role_follows_database_role(client, app, store):
    store.users[2] = {
        "id": 2,
        "email": "biller@test.local",
        "password_hash": "x",
        "full_name": "Biller",
        "role": "BILLER",
        "customer_id": None,
        "active": 1,
    }
    headers = auth_headers(app, "ADMIN", "usr_2")  # token viejo que dice ADMIN
    assert client.get("/users", headers=headers).status_code == 403
