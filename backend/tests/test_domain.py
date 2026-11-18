import pytest

from app.domain import (
    calculate_totals,
    can_cancel_invoice,
    can_delete_invoice,
    can_edit_invoice,
    can_issue_invoice,
    can_pay_invoice,
    can_transition,
    decode_id,
    encode_id,
    rate_on_date,
    round2,
    to_date_key,
)


def test_round2_matches_javascript_semantics():
    assert round2(3480.0) == 3480.0
    assert round2(15.9984) == 16.0
    assert round2(99.98999999999999) == 99.99
    assert round2(0.28499999999999998) == 0.29
    assert round2(2.675) == 2.68


def test_to_date_key_accepts_date_and_iso():
    import datetime

    assert to_date_key(datetime.date(2026, 3, 1)) == "2026-03-01"
    assert to_date_key("2026-05-10T12:00:00.000Z") == "2026-05-10"


def test_rate_on_date_picks_covering_entry():
    ieps_tax = {"code": "IEPS", "current_rate": 0.03}
    history = [
        {"rate": 0.025, "valid_from": "2024-01-01", "valid_to": "2026-03-01"},
        {"rate": 0.03, "valid_from": "2026-03-01", "valid_to": None},
    ]
    assert rate_on_date(ieps_tax, history, "2026-02-28") == 0.025
    assert rate_on_date(ieps_tax, history, "2026-03-01") == 0.03


def test_rate_on_date_falls_back_to_current_rate():
    vat = {"code": "VAT16", "current_rate": 0.16}
    assert rate_on_date(vat, [], "2026-05-01") == 0.16


TAXES = {
    "tax_1": {"code": "VAT16", "current_rate": 0.16},
    "tax_2": {"code": "IEPS", "current_rate": 0.03},
}
HISTORY = {
    "tax_1": [{"rate": 0.16, "valid_from": "2020-01-01", "valid_to": None}],
    "tax_2": [
        {"rate": 0.025, "valid_from": "2024-01-01", "valid_to": "2026-03-01"},
        {"rate": 0.03, "valid_from": "2026-03-01", "valid_to": None},
    ],
}


def test_calculate_totals_single_tax():
    result = calculate_totals(
        [{"service_id": 1, "service_name": "Hosting", "quantity": 3, "unit_price": 1000, "tax_ids": ["tax_1"]}],
        TAXES,
        HISTORY,
        "2026-05-10",
    )
    line = result["lines"][0]
    assert line["id"] == "L1"
    assert line["line_subtotal"] == 3000
    assert line["tax_amount"] == 480
    assert line["line_total"] == 3480
    assert line["taxes"][0]["code"] == "VAT16"
    assert result["subtotal"] == 3000
    assert result["tax_total"] == 480
    assert result["total"] == 3480


def test_calculate_totals_sums_several_taxes():
    result = calculate_totals(
        [{"service_id": 1, "service_name": "License", "quantity": 1, "unit_price": 1000, "tax_ids": ["tax_1", "tax_2"]}],
        TAXES,
        HISTORY,
        "2026-05-10",
    )
    assert result["lines"][0]["tax_amount"] == 190
    assert result["total"] == 1190


def test_calculate_totals_uses_rate_valid_on_date():
    lines = [{"service_id": 1, "service_name": "License", "quantity": 1, "unit_price": 1000, "tax_ids": ["tax_2"]}]
    assert calculate_totals(lines, TAXES, HISTORY, "2026-01-15")["tax_total"] == 25
    assert calculate_totals(lines, TAXES, HISTORY, "2026-06-15")["tax_total"] == 30


def test_calculate_totals_rounds_like_frontend():
    result = calculate_totals(
        [{"service_id": 1, "service_name": "Item", "quantity": 3, "unit_price": 33.33, "tax_ids": ["tax_1"]}],
        TAXES,
        HISTORY,
        "2026-05-10",
    )
    line = result["lines"][0]
    assert line["line_subtotal"] == 99.99
    assert line["tax_amount"] == 16
    assert line["line_total"] == 115.99
    assert result["total"] == 115.99


def test_calculate_totals_skips_unknown_tax_ids():
    result = calculate_totals(
        [{"service_id": 1, "service_name": "Item", "quantity": 1, "unit_price": 100, "tax_ids": ["tax_missing"]}],
        TAXES,
        HISTORY,
        "2026-05-10",
    )
    assert result["tax_total"] == 0
    assert result["lines"][0]["taxes"] == []


def test_invoice_state_machine():
    assert can_transition("DRAFT", "ISSUED")
    assert can_transition("DRAFT", "CANCELLED")
    assert can_transition("ISSUED", "PAID")
    assert can_transition("ISSUED", "CANCELLED")
    assert not can_transition("PAID", "CANCELLED")
    assert not can_transition("CANCELLED", "ISSUED")
    assert can_edit_invoice("DRAFT") and not can_edit_invoice("ISSUED")
    assert can_delete_invoice("DRAFT") and not can_delete_invoice("ISSUED")
    assert can_issue_invoice("DRAFT") and not can_issue_invoice("ISSUED")
    assert can_pay_invoice("ISSUED") and not can_pay_invoice("DRAFT")
    assert can_cancel_invoice("ISSUED") and not can_cancel_invoice("PAID")


def test_encode_decode_ids():
    assert encode_id("cus", 15) == "cus_15"
    assert decode_id("cus", "cus_15") == 15
    with pytest.raises(ValueError):
        decode_id("cus", "usr_15")
    with pytest.raises(ValueError):
        decode_id("cus", "not-an-id")
