"""Reportes y operaciones fiscales respaldados por Stored Procedures (MySQL).

| Ruta                                   | SP                         | Roles          |
|----------------------------------------|----------------------------|----------------|
| GET  /reports/aging                    | sp_aging_report            | ADMIN, BILLER  |
| GET  /reports/fiscal-closings          | (tabla fiscal_closing)     | ADMIN, BILLER  |
| POST /reports/fiscal-closings          | sp_fiscal_closing          | ADMIN          |
| GET  /reports/payment-validation       | sp_validate_payment_status | ADMIN          |
| GET  /invoices/{id}/stamp              | sp_build_stamp_payload     | autenticado    |
| GET  /invoices/{id}/accounting         | (tabla accounting_entry)   | ADMIN, BILLER  |
"""

import datetime
import json
import re

from flask import Blueprint, g, jsonify, request

from .. import audit, auth, db, repos
from ..domain import encode_id
from ..errors import not_found, validation
from ..serializers import accounting_entry_json, aging_json, fiscal_closing_json, payment_validation_json
from .common import assert_invoice_access, json_body

bp = Blueprint("reports", __name__)

_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parse_date(value, field: str) -> datetime.date:
    if not isinstance(value, str) or not _DATE_PATTERN.match(value):
        raise validation(f"Invalid {field}")
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise validation(f"Invalid {field}")


def _invoice(invoice_id: str) -> tuple[int, dict]:
    db_id = repos.decode_or_none("inv", invoice_id)
    invoice = repos.find_invoice(db_id) if db_id is not None else None
    if invoice is None:
        raise not_found("Invoice not found")
    return db_id, invoice


@bp.get("/reports/aging")
@auth.require_role("ADMIN", "BILLER")
def aging_report():
    raw = request.args.get("asOf")
    as_of = _parse_date(raw, "asOf") if raw else None
    rows = repos.aging_report(as_of)
    return jsonify([aging_json(row) for row in rows])


@bp.get("/reports/fiscal-closings")
@auth.require_role("ADMIN", "BILLER")
def list_fiscal_closings():
    return jsonify([fiscal_closing_json(row) for row in repos.list_fiscal_closings()])


@bp.post("/reports/fiscal-closings")
@auth.require_role("ADMIN")
def run_fiscal_closing():
    body = json_body()
    period_type = body.get("periodType")
    if period_type not in ("DAY", "MONTH"):
        raise validation("Period type must be DAY or MONTH")
    day = _parse_date(body.get("date"), "date")
    row = repos.run_fiscal_closing(period_type, day, auth.claims_decoded_sub())
    db.commit()
    audit.write_entry(g.claims, "fiscal.closing", "fiscal_closing", encode_id("fcl", row["id"]))
    return jsonify(fiscal_closing_json(row))


@bp.get("/reports/payment-validation")
@auth.require_role("ADMIN")
def payment_validation():
    only_issues = request.args.get("onlyIssues", "true") != "false"
    rows = [payment_validation_json(row) for row in repos.validate_payment_status(None)]
    if only_issues:
        rows = [row for row in rows if row["validation"] != "OK"]
    return jsonify(rows)


@bp.get("/invoices/<invoice_id>/stamp")
@auth.login_required
def stamp_payload(invoice_id: str):
    db_id, invoice = _invoice(invoice_id)
    assert_invoice_access(invoice)
    return jsonify(json.loads(repos.stamp_payload(db_id)))


@bp.get("/invoices/<invoice_id>/accounting")
@auth.require_role("ADMIN", "BILLER")
def accounting_entries(invoice_id: str):
    db_id, _ = _invoice(invoice_id)
    return jsonify([accounting_entry_json(row) for row in repos.list_accounting_entries(db_id)])
