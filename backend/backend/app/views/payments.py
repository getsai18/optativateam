from flask import Blueprint, g, jsonify

from .. import audit, auth, db, repos
from ..domain import can_pay_invoice, encode_id, new_sim_reference, utcnow
from ..errors import conflict, not_found, validation
from ..serializers import payment_json
from .common import assert_invoice_access, json_body

bp = Blueprint("payments", __name__)

_METHODS = ("CARD", "TRANSFER", "CASH")


def _load_invoice(invoice_id: str):
    db_id = repos.decode_or_none("inv", invoice_id)
    invoice = repos.find_invoice(db_id) if db_id is not None else None
    if invoice is None:
        raise not_found("Invoice not found")
    return db_id, invoice


@bp.get("/invoices/<invoice_id>/payments")
@auth.login_required
def list_payments(invoice_id: str):
    db_id, invoice = _load_invoice(invoice_id)
    assert_invoice_access(invoice)
    return jsonify([payment_json(row) for row in repos.list_payments(db_id)])


@bp.post("/invoices/<invoice_id>/payments")
@auth.require_role("ADMIN", "BILLER")
def register_payment(invoice_id: str):
    body = json_body()
    method = body.get("method")
    if method not in _METHODS:
        raise validation("Invalid payment method")
    db_id, invoice = _load_invoice(invoice_id)
    if not can_pay_invoice(invoice["status"]):
        raise conflict("Only issued invoices can be paid")
    if repos.count_payments(db_id) > 0:
        raise conflict("This invoice already has a payment")
    now = utcnow()
    payment_id = repos.insert_payment(
        db_id,
        method,
        db.to_number(invoice["total"]),
        new_sim_reference(),
        now,
        auth.claims_decoded_sub(),
    )
    repos.set_invoice_paid(db_id, now)
    db.commit()
    audit.write_entry(g.claims, "invoice.pay", "invoice", encode_id("inv", db_id))
    payment = next(row for row in repos.list_payments(db_id) if int(row["id"]) == payment_id)
    return jsonify(payment_json(payment))
