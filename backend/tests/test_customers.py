from app import audit
from tests.conftest import auth_headers

CUSTOMER_PAYLOAD = {
    "name": "Farmacias del Valle S.A. de C.V.",
    "taxId": "FVA881110KM2",
    "email": "billing@farmaciasdelvalle.example",
    "phone": "+52 55 2345 6789",
    "address": "Av. Constitución 880, Monterrey, N.L.",
}


def test_list_customers(client, app, store):
    response = client.get("/customers", headers=auth_headers(app, role="BILLER"))
    assert response.status_code == 200
    data = response.get_json()
    assert data[0]["id"] == "cus_1"
    assert data[0]["taxId"] == "GAL860415HX3"


def test_customer_without_phone_omits_key(client, app, store):
    response = client.get("/customers", headers=auth_headers(app))
    inactive = next(c for c in response.get_json() if c["id"] == "cus_2")
    assert "phone" not in inactive


def test_create_customer_and_audit(client, app, store):
    audit.reset_memory()
    response = client.post("/customers", json=CUSTOMER_PAYLOAD, headers=auth_headers(app))
    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == "cus_3"
    assert data["active"] is True
    assert audit._memory[0]["action"] == "customer.create"
    assert audit._memory[0]["entityId"] == "cus_3"


def test_create_customer_duplicate_tax_id(client, app, store):
    payload = dict(CUSTOMER_PAYLOAD, taxId="GAL860415HX3")
    response = client.post("/customers", json=payload, headers=auth_headers(app))
    assert response.status_code == 409
    assert response.get_json() == {"code": "CONFLICT", "message": "A customer with this tax ID already exists"}


def test_create_customer_invalid_body(client, app, store):
    response = client.post("/customers", json={"name": "X"}, headers=auth_headers(app))
    assert response.status_code == 400
    assert response.get_json()["code"] == "VALIDATION"


def test_update_customer_not_found(client, app, store):
    payload = dict(CUSTOMER_PAYLOAD)
    response = client.put("/customers/cus_99", json=payload, headers=auth_headers(app))
    assert response.status_code == 404
    assert response.get_json() == {"code": "NOT_FOUND", "message": "Customer not found"}


def test_update_customer_clears_phone(client, app, store):
    payload = dict(CUSTOMER_PAYLOAD, phone="", active=False)
    response = client.put("/customers/cus_1", json=payload, headers=auth_headers(app))
    assert response.status_code == 200
    data = response.get_json()
    assert "phone" not in data
    assert data["active"] is False
    assert store.customers[1]["phone"] is None


def test_update_customer_duplicate_email_conflict(client, app, store):
    store.customers[3] = {
        "id": 3,
        "name": "Otro",
        "tax_id": "OTR000000AA1",
        "email": "other@example.test",
        "phone": None,
        "address": "X",
        "active": 1,
    }
    payload = dict(CUSTOMER_PAYLOAD, email="billing@alameda.example")
    response = client.put("/customers/cus_3", json=payload, headers=auth_headers(app))
    assert response.status_code == 409
    assert response.get_json()["message"] == "A customer with this email already exists"


def test_customer_requires_billler_role_for_create(client, app, store):
    response = client.post("/customers", json=CUSTOMER_PAYLOAD, headers=auth_headers(app, role="CUSTOMER", customer_id="cus_1"))
    assert response.status_code == 403
