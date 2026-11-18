import datetime

from app import audit
from app.domain import utcnow
from tests.conftest import auth_headers


def test_dashboard_totals(client, app, store):
    store.add_invoice(status="DRAFT", total=100.0)
    store.add_invoice(status="ISSUED", total=200.0)
    store.add_invoice(status="PAID", total=300.0)
    store.add_invoice(status="CANCELLED", total=400.0)
    response = client.get("/dashboard", headers=auth_headers(app, role="BILLER", sub="usr_2"))
    assert response.status_code == 200
    data = response.get_json()
    assert data["totalInvoiced"] == 500.0
    assert data["paid"] == 300.0
    assert data["pending"] == 200.0
    assert data["cancelled"] == 400.0
    assert data["drafts"] == 1
    assert [row["status"] for row in data["byStatus"]] == ["DRAFT", "ISSUED", "PAID", "CANCELLED"]
    assert len(data["monthly"]) == 6
    assert len(data["recent"]) == 4


def test_dashboard_forbidden_for_customers(client, app, store):
    response = client.get("/dashboard", headers=auth_headers(app, role="CUSTOMER", customer_id="cus_1"))
    assert response.status_code == 403


def test_dashboard_monthly_buckets_use_utc(client, app, store):
    now = utcnow()
    issued_at = datetime.datetime(now.year, now.month, 15, 12, 0, 0)
    store.add_invoice(status="ISSUED", total=1000.0, issued_at=issued_at)
    response = client.get("/dashboard", headers=auth_headers(app))
    data = response.get_json()
    key = f"{now.year:04d}-{now.month:02d}"
    month = next(row for row in data["monthly"] if row["key"] == key)
    assert month["invoiced"] == 1000.0


def test_audit_requires_admin(client, app, store):
    response = client.get("/audit", headers=auth_headers(app, role="BILLER"))
    assert response.status_code == 403


def test_audit_rows_enriched(client, app, store):
    audit.reset_memory()
    client.post(
        "/customers",
        json={
            "name": "Nueva Empresa S.A.",
            "taxId": "NUE000000AA1",
            "email": "nueva@example.test",
            "address": "Calle Nueva 1",
        },
        headers=auth_headers(app, sub="usr_1"),
    )
    response = client.get("/audit", headers=auth_headers(app))
    assert response.status_code == 200
    row = response.get_json()[0]
    assert row["action"] == "customer.create"
    assert row["entityType"] == "customer"
    assert row["entityId"] == "cus_3"
    assert row["entityLabel"] == "Nueva Empresa S.A."
    assert row["userId"] == "usr_1"


def test_audit_invoice_label_uses_folio(client, app, store):
    audit.reset_memory()
    invoice_id = store.add_invoice(status="DRAFT", customer_id=1)
    with app.app_context():
        audit.write_entry({"sub": "usr_1"}, "invoice.create", "invoice", f"inv_{invoice_id}")
    response = client.get("/audit", headers=auth_headers(app))
    row = response.get_json()[0]
    assert row["entityLabel"] == "Draft invoice"
