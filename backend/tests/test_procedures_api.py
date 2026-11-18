"""Flujos respaldados por Stored Procedures: retenciones, descuentos, reportes y catálogo."""

import datetime

from app import repos
from app.db import BusinessRuleError
from app.domain import calculate_totals
from tests.conftest import auth_headers

DRAFT_BODY = {"customerId": "cus_1", "lines": [{"serviceId": "svc_1", "quantity": 2}]}


def _add_withholding_tax(store):
    store.taxes[2] = {"id": 2, "code": "RET_ISR", "name": "ISR retenido", "current_rate": 0.10, "active": 1,
                      "kind": "WITHHELD"}
    store.tax_history.append(
        {"id": 2, "tax_id": 2, "rate": 0.10, "valid_from": datetime.date(2020, 1, 1), "valid_to": None}
    )
    store.service_tax[1] = [1, 2]


def _issued_invoice(client, app):
    response = client.post("/invoices?issue=true", json=DRAFT_BODY, headers=auth_headers(app))
    assert response.status_code == 200
    return response.get_json()


def test_calculate_totals_subtracts_withholding():
    taxes = {
        "tax_1": {"code": "VAT16", "current_rate": 0.16, "kind": "TRANSFER"},
        "tax_2": {"code": "RET_ISR", "current_rate": 0.10, "kind": "WITHHELD"},
    }
    lines = [{"service_id": 1, "service_name": "S", "quantity": 1, "unit_price": 1000.0,
              "tax_ids": ["tax_1", "tax_2"]}]
    totals = calculate_totals(lines, taxes, {}, datetime.date(2026, 1, 1))
    assert totals["tax_total"] == 160.0
    assert totals["withholding_total"] == 100.0
    assert totals["total"] == 1060.0
    assert totals["lines"][0]["line_total"] == 1060.0


def test_invoice_with_withholding_and_discount(client, app, store):
    _add_withholding_tax(store)
    store.discounts[1] = 0.05
    invoice = _issued_invoice(client, app)
    # subtotal 9000, descuento 5 % = 450, IVA 1440*0.95 = 1368, ISR 900*0.95 = 855
    assert invoice["subtotal"] == 9000.0
    assert invoice["discountPct"] == 0.05
    assert invoice["discountTotal"] == 450.0
    assert invoice["taxTotal"] == 1368.0
    assert invoice["withholdingTotal"] == 855.0
    assert invoice["total"] == 9063.0
    kinds = {tax["code"]: tax["kind"] for tax in invoice["lines"][0]["taxes"]}
    assert kinds == {"VAT16": "TRANSFER", "RET_ISR": "WITHHELD"}
    assert invoice["lines"][0]["withholdingAmount"] == 900.0


def test_issue_assigns_folio_and_ledger(client, app, store):
    invoice = _issued_invoice(client, app)
    assert invoice["status"] == "ISSUED"
    assert invoice["folio"].startswith("INV-")
    entries = client.get(f"/invoices/{invoice['id']}/accounting", headers=auth_headers(app)).get_json()
    assert [e["entryType"] for e in entries] == ["ISSUE"]


def test_cancel_issued_invoice_creates_reversal(client, app, store):
    invoice = _issued_invoice(client, app)
    response = client.post(
        f"/invoices/{invoice['id']}/cancel", json={"reason": "Error en datos"}, headers=auth_headers(app)
    )
    assert response.status_code == 200
    assert response.get_json()["status"] == "CANCELLED"
    entries = client.get(f"/invoices/{invoice['id']}/accounting", headers=auth_headers(app)).get_json()
    assert [e["entryType"] for e in entries] == ["ISSUE", "REVERSAL"]


def test_stored_procedure_rule_maps_to_conflict(client, app, store, monkeypatch):
    invoice = _issued_invoice(client, app)

    def rejected(*_args, **_kwargs):
        raise BusinessRuleError("Payment amount must match the invoice total")

    monkeypatch.setattr(repos, "register_payment", rejected)
    response = client.post(
        f"/invoices/{invoice['id']}/payments", json={"method": "CARD"}, headers=auth_headers(app)
    )
    assert response.status_code == 409
    assert response.get_json() == {"code": "CONFLICT", "message": "Payment amount must match the invoice total"}


def test_stamp_payload_only_for_issued(client, app, store):
    draft = client.post("/invoices", json=DRAFT_BODY, headers=auth_headers(app)).get_json()
    response = client.get(f"/invoices/{draft['id']}/stamp", headers=auth_headers(app))
    assert response.status_code == 409
    invoice = _issued_invoice(client, app)
    payload = client.get(f"/invoices/{invoice['id']}/stamp", headers=auth_headers(app)).get_json()
    assert payload["Version"] == "4.0"
    assert payload["Folio"] == invoice["folio"]


def test_customer_cannot_stamp_other_customer_invoice(client, app, store):
    invoice = _issued_invoice(client, app)
    headers = auth_headers(app, role="CUSTOMER", sub="usr_9", customer_id="cus_2")
    assert client.get(f"/invoices/{invoice['id']}/stamp", headers=headers).status_code == 404


def test_aging_report(client, app, store):
    invoice_id = store.add_invoice(status="ISSUED", total=500.0,
                                   issued_at=datetime.datetime.now() - datetime.timedelta(days=45))
    store.invoices[invoice_id]["folio"] = "INV-2026-0099"
    rows = client.get("/reports/aging", headers=auth_headers(app, role="BILLER")).get_json()
    assert rows[0]["customerId"] == "cus_1"
    assert rows[0]["days31To60"] == 500.0
    assert rows[0]["balance"] == 500.0


def test_aging_report_rejects_bad_date(client, app, store):
    response = client.get("/reports/aging?asOf=2026-13-40", headers=auth_headers(app))
    assert response.status_code == 400


def test_fiscal_closing_run_and_list(client, app, store):
    invoice = _issued_invoice(client, app)
    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    response = client.post(
        "/reports/fiscal-closings", json={"periodType": "DAY", "date": today}, headers=auth_headers(app)
    )
    assert response.status_code == 200
    closing = response.get_json()
    assert closing["invoiceCount"] == 1
    assert closing["total"] == invoice["total"]
    listed = client.get("/reports/fiscal-closings", headers=auth_headers(app, role="BILLER")).get_json()
    assert len(listed) == 1


def test_fiscal_closing_requires_admin(client, app, store):
    response = client.post(
        "/reports/fiscal-closings", json={"periodType": "MONTH", "date": "2026-01-01"},
        headers=auth_headers(app, role="BILLER"),
    )
    assert response.status_code == 403


def test_fiscal_closing_rejects_future_date(client, app, store):
    response = client.post(
        "/reports/fiscal-closings", json={"periodType": "DAY", "date": "2999-01-01"}, headers=auth_headers(app)
    )
    assert response.status_code == 409


def test_payment_validation_reports_inconsistencies(client, app, store):
    store.add_invoice(status="PAID", total=100.0, issued_at=datetime.datetime.now())
    rows = client.get("/reports/payment-validation", headers=auth_headers(app)).get_json()
    assert [row["validation"] for row in rows] == ["PAID_WITHOUT_PAYMENT"]
    assert client.get("/reports/payment-validation", headers=auth_headers(app, role="BILLER")).status_code == 403


def test_bulk_assign_features(client, app, store):
    store.features[1] = {"id": 1, "name": "Storage", "description": "", "unit": "GB"}
    response = client.post(
        "/features/bulk-assign",
        json={"serviceIds": ["svc_1", "svc_2"], "featureIds": ["feat_1"], "value": "100"},
        headers=auth_headers(app),
    )
    assert response.status_code == 200
    assert response.get_json() == {"affected": 2}
    assert {"feature_id": 1, "value": "100"} in store.service_features[2]


def test_bulk_assign_requires_admin_and_valid_ids(client, app, store):
    body = {"serviceIds": ["svc_1"], "featureIds": ["feat_404"], "value": "x"}
    assert client.post("/features/bulk-assign", json=body, headers=auth_headers(app, role="BILLER")).status_code == 403
    assert client.post("/features/bulk-assign", json=body, headers=auth_headers(app)).status_code == 404


def test_service_price_change_is_audited(client, app, store):
    service = client.get("/services", headers=auth_headers(app)).get_json()[0]
    body = {**service, "basePrice": 5000.0, "priceChangeReason": "Ajuste anual"}
    response = client.put(f"/services/{service['id']}", json=body, headers=auth_headers(app))
    assert response.status_code == 200
    history = client.get(f"/services/{service['id']}/price-history", headers=auth_headers(app)).get_json()
    assert history[0]["oldPrice"] == 4500.0
    assert history[0]["newPrice"] == 5000.0
    assert history[0]["reason"] == "Ajuste anual"
    assert history[0]["changedBy"] == "usr_1"


def test_rates_keep_four_decimals(client, app, store):
    store.taxes[1]["current_rate"] = 0.1067
    taxes = client.get("/taxes", headers=auth_headers(app)).get_json()
    assert taxes[0]["currentRate"] == 0.1067
