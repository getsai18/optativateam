from app import audit
from app.domain import today_key, utcnow
from tests.conftest import auth_headers


def test_list_taxes_and_history(client, app, store):
    headers = auth_headers(app, role="CUSTOMER", customer_id="cus_1")
    taxes = client.get("/taxes", headers=headers).get_json()
    assert taxes == [{"id": "tax_1", "code": "VAT16", "name": "VAT", "currentRate": 0.16}]
    history = client.get("/taxes/history", headers=headers).get_json()
    assert history[0]["taxId"] == "tax_1"
    assert history[0]["validTo"] is None


def test_change_rate_requires_admin(client, app, store):
    payload = {"rate": 0.19, "validFrom": today_key()}
    response = client.post("/taxes/tax_1/rates", json=payload, headers=auth_headers(app, role="BILLER"))
    assert response.status_code == 403


def test_change_rate_in_future_extends_history(client, app, store):
    audit.reset_memory()
    payload = {"rate": 0.19, "validFrom": today_key()}
    response = client.post("/taxes/tax_1/rates", json=payload, headers=auth_headers(app, sub="usr_1"))
    assert response.status_code == 200
    assert response.get_json()["currentRate"] == 0.19
    open_rows = [row for row in store.tax_history if row["tax_id"] == 1 and row["valid_to"] is None]
    assert len(open_rows) == 1
    assert float(open_rows[0]["rate"]) == 0.19
    closed = [row for row in store.tax_history if row["tax_id"] == 1 and row["valid_to"] is not None]
    assert len(closed) == 1
    assert audit._memory[-1]["action"] == "tax.rate_change"


def test_change_rate_keeps_current_when_future_dated(client, app, store):
    from datetime import date, timedelta

    future = (utcnow().date() + timedelta(days=45)).isoformat()
    payload = {"rate": 0.21, "validFrom": future}
    response = client.post("/taxes/tax_1/rates", json=payload, headers=auth_headers(app))
    assert response.status_code == 200
    assert response.get_json()["currentRate"] == 0.16


def test_change_rate_rejects_past_start(client, app, store):
    payload = {"rate": 0.19, "validFrom": "2020-01-01"}
    response = client.post("/taxes/tax_1/rates", json=payload, headers=auth_headers(app))
    assert response.status_code == 400
    assert response.get_json()["message"] == "The new rate cannot start in the past"


def test_change_rate_rejects_rate_above_one(client, app, store):
    payload = {"rate": 1.5, "validFrom": today_key()}
    response = client.post("/taxes/tax_1/rates", json=payload, headers=auth_headers(app))
    assert response.status_code == 400
    assert response.get_json()["message"] == "Rate must be between 0% and 100%"


def test_change_rate_must_start_after_open_period(client, app, store):
    import datetime

    today = datetime.date.fromisoformat(today_key())
    open_period = next(row for row in store.tax_history if row["tax_id"] == 1 and row["valid_to"] is None)
    open_period["valid_from"] = today
    payload = {"rate": 0.19, "validFrom": today_key()}
    response = client.post("/taxes/tax_1/rates", json=payload, headers=auth_headers(app))
    assert response.status_code == 400
    assert response.get_json()["message"] == f"The new rate must start after {today_key()}"


def test_change_rate_tax_not_found(client, app, store):
    payload = {"rate": 0.19, "validFrom": today_key()}
    response = client.post("/taxes/tax_9/rates", json=payload, headers=auth_headers(app))
    assert response.status_code == 404
    assert response.get_json()["message"] == "Tax not found"
