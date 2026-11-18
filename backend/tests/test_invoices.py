from app import audit
from app.domain import utcnow
from tests.conftest import auth_headers

DRAFT_BODY = {"customerId": "cus_1", "lines": [{"serviceId": "svc_1", "quantity": 2}]}


def _create_draft(client, app, body=None):
    return client.post("/invoices", json=body or DRAFT_BODY, headers=auth_headers(app, sub="usr_1"))


def test_create_draft_with_totals(client, app, store):
    audit.reset_memory()
    response = _create_draft(client, app)
    assert response.status_code == 200
    invoice = response.get_json()
    assert invoice["status"] == "DRAFT"
    assert invoice["folio"] is None
    assert invoice["uuid"] is None
    assert invoice["customerId"] == "cus_1"
    assert invoice["createdBy"] == "usr_1"
    assert invoice["issuer"]["name"].startswith("Northwind")
    assert invoice["receiver"]["taxId"] == "GAL860415HX3"
    assert invoice["subtotal"] == 9000.0
    assert invoice["taxTotal"] == 1440.0
    assert invoice["total"] == 10440.0
    line = invoice["lines"][0]
    assert line["id"] == "L1"
    assert line["serviceId"] == "svc_1"
    assert line["quantity"] == 2
    assert line["unitPrice"] == 4500.0
    assert line["taxes"][0] == {"taxId": "tax_1", "code": "VAT16", "rate": 0.16, "amount": 1440.0}
    assert audit._memory[-1]["action"] == "invoice.create"
    assert audit._memory[-1]["entityId"] == invoice["id"]


def test_save_draft_requires_active_customer(client, app, store):
    body = {"customerId": "cus_2", "lines": [{"serviceId": "svc_1", "quantity": 1}]}
    response = _create_draft(client, app, body)
    assert response.status_code == 400
    assert response.get_json()["message"] == "Choose an active customer"


def test_save_draft_requires_lines(client, app, store):
    response = _create_draft(client, app, {"customerId": "cus_1", "lines": []})
    assert response.status_code == 400
    assert response.get_json()["message"] == "Add at least one service"


def test_save_draft_rejects_inactive_service(client, app, store):
    body = {"customerId": "cus_1", "lines": [{"serviceId": "svc_2", "quantity": 1}]}
    response = _create_draft(client, app, body)
    assert response.status_code == 400
    assert response.get_json()["message"] == "A selected service is no longer available"


def test_save_draft_rejects_bad_quantity(client, app, store):
    body = {"customerId": "cus_1", "lines": [{"serviceId": "svc_1", "quantity": 0}]}
    response = _create_draft(client, app, body)
    assert response.status_code == 400
    assert response.get_json()["message"] == "Quantities must be whole numbers between 1 and 9999"


def test_issue_assigns_folio_and_uuid(client, app, store):
    created = _create_draft(client, app).get_json()
    response = client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app, sub="usr_1"))
    assert response.status_code == 200
    invoice = response.get_json()
    year = utcnow().year
    assert invoice["status"] == "ISSUED"
    assert invoice["folio"] == f"INV-{year}-0001"
    assert invoice["uuid"]
    assert invoice["issuedAt"]
    assert audit._memory[-1]["action"] == "invoice.issue"


def test_issue_twice_conflicts(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    response = client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    assert response.status_code == 409
    assert response.get_json()["message"] == "Only draft invoices can be issued"


def test_save_and_issue_single_call(client, app, store):
    audit.reset_memory()
    response = client.post("/invoices?issue=true", json=DRAFT_BODY, headers=auth_headers(app))
    assert response.status_code == 200
    invoice = response.get_json()
    assert invoice["status"] == "ISSUED"
    assert invoice["folio"]
    actions = [entry["action"] for entry in audit._memory]
    assert actions == ["invoice.create", "invoice.issue"]


def test_update_draft_reprices_and_recalculates(client, app, store):
    created = _create_draft(client, app).get_json()
    body = {"customerId": "cus_1", "lines": [{"serviceId": "svc_1", "quantity": 1}]}
    response = client.put(f"/invoices/{created['id']}", json=body, headers=auth_headers(app))
    assert response.status_code == 200
    invoice = response.get_json()
    assert invoice["subtotal"] == 4500.0
    assert invoice["taxTotal"] == 720.0
    assert invoice["total"] == 5220.0
    assert audit._memory[-1]["action"] == "invoice.update"


def test_update_issued_invoice_conflicts(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    response = client.put(f"/invoices/{created['id']}", json=DRAFT_BODY, headers=auth_headers(app))
    assert response.status_code == 409
    assert response.get_json()["message"] == "Only draft invoices can be edited"


def test_issue_requotes_taxes_with_history(client, app, store):
    store.taxes[2] = {"id": 2, "code": "IEPS", "name": "IEPS", "current_rate": 0.03, "active": 1}
    store.tax_history.append(
        {"id": 9, "tax_id": 2, "rate": 0.05, "valid_from": "2020-01-01", "valid_to": None}
    )
    store.service_tax[1] = [1, 2]
    created = _create_draft(client, app).get_json()
    assert created["taxTotal"] == 1890.0
    invoice = client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app)).get_json()
    assert invoice["taxTotal"] == 1890.0
    assert invoice["total"] == 10890.0
    assert len(invoice["lines"][0]["taxes"]) == 2


def test_register_payment_marks_paid(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    audit.reset_memory()
    response = client.post(
        f"/invoices/{created['id']}/payments", json={"method": "TRANSFER"}, headers=auth_headers(app, sub="usr_1")
    )
    assert response.status_code == 200
    payment = response.get_json()
    assert payment["method"] == "TRANSFER"
    assert payment["amount"] == 10440.0
    assert payment["reference"].startswith("SIM-")
    assert payment["registeredBy"] == "usr_1"
    assert store.invoices[1]["status"] == "PAID"
    assert audit._memory[-1]["action"] == "invoice.pay"


def test_second_payment_conflicts(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    client.post(f"/invoices/{created['id']}/payments", json={"method": "CASH"}, headers=auth_headers(app))
    response = client.post(
        f"/invoices/{created['id']}/payments", json={"method": "CASH"}, headers=auth_headers(app)
    )
    assert response.status_code == 409
    assert response.get_json()["message"] == "Only issued invoices can be paid"


def test_payment_conflict_when_payment_exists_on_issued(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    store.payments[1] = {
        "id": 1,
        "invoice_id": 1,
        "method": "CASH",
        "amount": 100.0,
        "reference": "SIM-TEST01",
        "paid_at": utcnow(),
        "registered_by": 1,
    }
    response = client.post(
        f"/invoices/{created['id']}/payments", json={"method": "CASH"}, headers=auth_headers(app)
    )
    assert response.status_code == 409
    assert response.get_json()["message"] == "This invoice already has a payment"


def test_cannot_pay_draft(client, app, store):
    created = _create_draft(client, app).get_json()
    response = client.post(
        f"/invoices/{created['id']}/payments", json={"method": "CARD"}, headers=auth_headers(app)
    )
    assert response.status_code == 409
    assert response.get_json()["message"] == "Only issued invoices can be paid"


def test_invalid_payment_method(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    response = client.post(
        f"/invoices/{created['id']}/payments", json={"method": "BITCOIN"}, headers=auth_headers(app)
    )
    assert response.status_code == 400


def test_list_payments_requires_access(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    response = client.get(f"/invoices/{created['id']}/payments", headers=auth_headers(app))
    assert response.status_code == 200
    assert response.get_json() == []


def test_cancel_draft_with_reason(client, app, store):
    created = _create_draft(client, app).get_json()
    response = client.post(
        f"/invoices/{created['id']}/cancel",
        json={"reason": "Cancelación a solicitud del cliente"},
        headers=auth_headers(app),
    )
    assert response.status_code == 200
    invoice = response.get_json()
    assert invoice["status"] == "CANCELLED"
    assert invoice["cancellationReason"] == "Cancelación a solicitud del cliente"


def test_cancel_requires_reason(client, app, store):
    created = _create_draft(client, app).get_json()
    response = client.post(
        f"/invoices/{created['id']}/cancel", json={"reason": "abc"}, headers=auth_headers(app)
    )
    assert response.status_code == 400
    assert response.get_json()["message"] == "A cancellation reason is required"


def test_cannot_cancel_paid(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    client.post(f"/invoices/{created['id']}/payments", json={"method": "CASH"}, headers=auth_headers(app))
    response = client.post(
        f"/invoices/{created['id']}/cancel", json={"reason": "motivo largo"}, headers=auth_headers(app)
    )
    assert response.status_code == 409
    assert response.get_json()["message"] == "Paid or already cancelled invoices cannot be cancelled"


def test_delete_draft(client, app, store):
    created = _create_draft(client, app).get_json()
    response = client.delete(f"/invoices/{created['id']}", headers=auth_headers(app))
    assert response.status_code == 200
    assert store.invoices == {}


def test_cannot_delete_issued(client, app, store):
    created = _create_draft(client, app).get_json()
    client.post(f"/invoices/{created['id']}/issue", headers=auth_headers(app))
    response = client.delete(f"/invoices/{created['id']}", headers=auth_headers(app))
    assert response.status_code == 409
    assert response.get_json()["message"] == "Only draft invoices can be deleted"


def test_customer_sees_only_own_non_draft(client, app, store):
    draft_id = store.add_invoice(status="DRAFT", customer_id=1)
    own_issued = store.add_invoice(status="ISSUED", customer_id=1)
    other = store.add_invoice(status="ISSUED", customer_id=2)
    headers = auth_headers(app, role="CUSTOMER", sub="usr_5", customer_id="cus_1")
    response = client.get("/invoices", headers=headers)
    assert response.status_code == 200
    ids = [invoice["id"] for invoice in response.get_json()]
    assert ids == [f"inv_{own_issued}"]
    assert client.get(f"/invoices/inv_{draft_id}", headers=headers).status_code == 404
    assert client.get(f"/invoices/inv_{other}", headers=headers).status_code == 404
    assert client.get(f"/invoices/inv_{own_issued}", headers=headers).status_code == 200


def test_customer_payments_of_other_invoice_hidden(client, app, store):
    other = store.add_invoice(status="ISSUED", customer_id=2)
    headers = auth_headers(app, role="CUSTOMER", sub="usr_5", customer_id="cus_1")
    response = client.get(f"/invoices/inv_{other}/payments", headers=headers)
    assert response.status_code == 404


def test_get_invoice_not_found(client, app, store):
    response = client.get("/invoices/inv_999", headers=auth_headers(app))
    assert response.status_code == 404
    assert response.get_json()["message"] == "Invoice not found"


def test_list_invoices_admin_order(client, app, store):
    store.add_invoice(status="ISSUED", customer_id=1)
    store.add_invoice(status="DRAFT", customer_id=1)
    response = client.get("/invoices", headers=auth_headers(app))
    assert response.status_code == 200
    assert len(response.get_json()) == 2
