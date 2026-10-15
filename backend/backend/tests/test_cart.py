from tests.conftest import auth_headers

VALID = {"invoiceId": None, "customerId": "cus_1", "lines": [{"serviceId": "svc_1", "quantity": 2}], "step": 1}


def test_cart_requires_auth(client):
    assert client.get("/cart").status_code == 401


def test_cart_forbidden_for_customer(client, app):
    response = client.get("/cart", headers=auth_headers(app, "CUSTOMER", "usr_9", "cus_1"))
    assert response.status_code == 403


def test_cart_empty_roundtrip_and_delete(client, app):
    headers = auth_headers(app, "BILLER", "usr_2")
    assert client.get("/cart", headers=headers).get_json()["lines"] == []
    assert client.put("/cart", json=VALID, headers=headers).status_code == 200
    assert client.get("/cart", headers=headers).get_json() == VALID
    assert client.delete("/cart", headers=headers).get_json() == {"ok": True}
    assert client.get("/cart", headers=headers).get_json()["lines"] == []


def test_cart_isolated_per_user(client, app):
    a, b = auth_headers(app, "BILLER", "usr_2"), auth_headers(app, "ADMIN", "usr_1")
    client.put("/cart", json=VALID, headers=a)
    assert client.get("/cart", headers=b).get_json()["lines"] == []


def test_cart_validation(client, app):
    headers = auth_headers(app, "ADMIN")
    bad = [
        {**VALID, "lines": [{"serviceId": "svc_1", "quantity": 0}]},
        {**VALID, "lines": [{"serviceId": "svc_1", "quantity": True}]},
        {**VALID, "lines": [{"serviceId": "svc_1", "quantity": 1}] * 2},
        {**VALID, "lines": "x"},
        {**VALID, "step": "1"},
    ]
    for body in bad:
        assert client.put("/cart", json=body, headers=headers).status_code == 400


def test_cart_step_clamped(client, app):
    headers = auth_headers(app, "ADMIN")
    assert client.put("/cart", json={**VALID, "step": 99}, headers=headers).get_json()["step"] == 3
