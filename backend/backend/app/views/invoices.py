from flask import Blueprint, g, jsonify, request

from .. import audit, auth, db, repos
from ..domain import (
    can_cancel_invoice,
    can_delete_invoice,
    can_edit_invoice,
    can_issue_invoice,
    calculate_totals,
    decode_id,
    encode_id,
    new_uuid,
    utcnow,
)
from ..errors import conflict, not_found, validation
from ..serializers import invoices_json
from .common import assert_invoice_access, issuer_row, json_body, tax_universe

bp = Blueprint("invoices", __name__)


def _load_invoice(invoice_id: str, lock: bool = False):
    db_id = repos.decode_or_none("inv", invoice_id)
    finder = repos.find_invoice_for_update if lock else repos.find_invoice
    invoice = finder(db_id) if db_id is not None else None
    if invoice is None:
        raise not_found("Invoice not found")
    return db_id, invoice


def _priced_draft(body: dict) -> tuple[dict, dict]:
    customer_id = repos.decode_or_none("cus", body.get("customerId"))
    customer = repos.find_customer(customer_id) if customer_id is not None else None
    if customer is None or not db.to_bool(customer["active"]):
        raise validation("Choose an active customer")
    raw_lines = body.get("lines")
    if not isinstance(raw_lines, list) or len(raw_lines) == 0:
        raise validation("Add at least one service")
    taxes, history = tax_universe()
    priced = []
    seen: set[int] = set()
    for item in raw_lines:
        if not isinstance(item, dict):
            raise validation("Invalid request body")
        service_id = repos.decode_or_none("svc", item.get("serviceId"))
        service = repos.find_service(service_id) if service_id is not None else None
        if service is None or not db.to_bool(service["active"]):
            raise validation("A selected service is no longer available")
        quantity = item.get("quantity")
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1 or quantity > 9999:
            raise validation("Quantities must be whole numbers between 1 and 9999")
        if service_id in seen:
            raise validation("This service is already in the invoice")
        seen.add(service_id)
        tax_ids = [encode_id("tax", tax_id) for tax_id in repos.list_service_tax_ids(service_id)]
        priced.append(
            {
                "service_id": service_id,
                "service_name": service["name"],
                "quantity": quantity,
                "unit_price": db.to_number(service["base_price"]),
                "tax_ids": tax_ids,
            }
        )
    totals = calculate_totals(priced, taxes, history, utcnow())
    return customer, totals


def _insert_details(invoice_id: int, totals: dict) -> None:
    for line in totals["lines"]:
        detail_id = repos.insert_detail(
            invoice_id,
            line["service_id"],
            line["service_name"],
            line["quantity"],
            line["unit_price"],
            line["line_subtotal"],
            line["tax_amount"],
            line["line_total"],
        )
        for tax in line["taxes"]:
            repos.insert_detail_tax(
                detail_id, decode_id("tax", tax["tax_id"]), tax["rate"], tax["amount"], tax["code"], tax["name"]
            )


def _persist_draft(body: dict) -> tuple[int, str]:
    customer, totals = _priced_draft(body)
    invoice_ref = body.get("id")
    if invoice_ref:
        invoice_id, invoice = _load_invoice(invoice_ref, lock=True)
        if not can_edit_invoice(invoice["status"]):
            raise conflict("Only draft invoices can be edited")
        repos.update_invoice_draft(
            invoice_id,
            customer["id"],
            customer["name"],
            customer["tax_id"],
            customer["address"],
            totals["subtotal"],
            totals["tax_total"],
            totals["total"],
        )
        repos.delete_details(invoice_id)
        _insert_details(invoice_id, totals)
        return invoice_id, "invoice.update"
    issuer = issuer_row()
    invoice_id = repos.insert_invoice(
        issuer["id"],
        customer["id"],
        auth.claims_decoded_sub(),
        customer["name"],
        customer["tax_id"],
        customer["address"],
        totals["subtotal"],
        totals["tax_total"],
        totals["total"],
        utcnow(),
    )
    _insert_details(invoice_id, totals)
    return invoice_id, "invoice.create"


def _stamp(invoice_id: int) -> None:
    invoice = repos.find_invoice_for_update(invoice_id)
    if invoice is None:
        raise not_found("Invoice not found")
    if not can_issue_invoice(invoice["status"]):
        raise conflict("Only draft invoices can be issued")
    now = utcnow()
    details = repos.details_for([invoice_id])
    stored_taxes: dict[int, list[int]] = {}
    for row in repos.detail_taxes_for([int(detail["id"]) for detail in details]):
        stored_taxes.setdefault(int(row["invoice_detail_id"]), []).append(int(row["tax_id"]))
    taxes, history = tax_universe()
    lines_input = []
    for detail in details:
        service_id = int(detail["service_id"])
        service = repos.find_service(service_id)
        if service is not None:
            tax_ids = [encode_id("tax", tax_id) for tax_id in repos.list_service_tax_ids(service_id)]
        else:
            tax_ids = [encode_id("tax", tax_id) for tax_id in stored_taxes.get(int(detail["id"]), [])]
        lines_input.append(
            {
                "service_id": service_id,
                "service_name": detail["service_name"],
                "quantity": int(detail["quantity"]),
                "unit_price": db.to_number(detail["unit_price"]),
                "tax_ids": tax_ids,
            }
        )
    totals = calculate_totals(lines_input, taxes, history, now)
    for detail, line in zip(details, totals["lines"]):
        detail_id = int(detail["id"])
        repos.update_detail_amounts(detail_id, line["line_subtotal"], line["tax_amount"], line["line_total"])
        repos.delete_detail_taxes(detail_id)
        for tax in line["taxes"]:
            repos.insert_detail_tax(
                detail_id, decode_id("tax", tax["tax_id"]), tax["rate"], tax["amount"], tax["code"], tax["name"]
            )
    repos.set_invoice_totals(invoice_id, totals["subtotal"], totals["tax_total"], totals["total"])
    year = now.year
    folio_number = repos.next_folio(year)
    repos.set_invoice_issued(invoice_id, f"INV-{year}-{folio_number:04d}", new_uuid(), now)


@bp.get("/invoices")
@auth.login_required
def list_invoices():
    claims = g.claims
    if claims.get("role") == "CUSTOMER":
        customer_id = repos.decode_or_none("cus", claims.get("customerId"))
        rows = repos.list_invoices_for_customer(customer_id) if customer_id is not None else []
    else:
        rows = repos.list_invoices()
    return jsonify(invoices_json(rows, issuer_row()))


@bp.get("/invoices/<invoice_id>")
@auth.login_required
def get_invoice(invoice_id: str):
    _, invoice = _load_invoice(invoice_id)
    assert_invoice_access(invoice)
    return jsonify(invoices_json([invoice], issuer_row())[0])


@bp.post("/invoices")
@auth.require_role("ADMIN", "BILLER")
def save_invoice():
    body = json_body()
    issue_now = request.args.get("issue") == "true"
    invoice_id, action = _persist_draft(body)
    if issue_now:
        _stamp(invoice_id)
    db.commit()
    audit.write_entry(g.claims, action, "invoice", encode_id("inv", invoice_id))
    if issue_now:
        audit.write_entry(g.claims, "invoice.issue", "invoice", encode_id("inv", invoice_id))
    return jsonify(invoices_json([repos.find_invoice(invoice_id)], issuer_row())[0])


@bp.put("/invoices/<invoice_id>")
@auth.require_role("ADMIN", "BILLER")
def update_invoice(invoice_id: str):
    body = json_body()
    body["id"] = invoice_id
    db_id, action = _persist_draft(body)
    db.commit()
    audit.write_entry(g.claims, action, "invoice", encode_id("inv", db_id))
    return jsonify(invoices_json([repos.find_invoice(db_id)], issuer_row())[0])


@bp.post("/invoices/<invoice_id>/issue")
@auth.require_role("ADMIN", "BILLER")
def issue_invoice(invoice_id: str):
    db_id, _ = _load_invoice(invoice_id, lock=True)
    _stamp(db_id)
    db.commit()
    audit.write_entry(g.claims, "invoice.issue", "invoice", encode_id("inv", db_id))
    return jsonify(invoices_json([repos.find_invoice(db_id)], issuer_row())[0])


@bp.post("/invoices/<invoice_id>/cancel")
@auth.require_role("ADMIN", "BILLER")
def cancel_invoice(invoice_id: str):
    body = json_body()
    reason = body.get("reason")
    if not isinstance(reason, str) or len(reason.strip()) < 5:
        raise validation("A cancellation reason is required")
    if len(reason.strip()) > 255:
        raise validation("The cancellation reason is too long")
    db_id, invoice = _load_invoice(invoice_id, lock=True)
    if not can_cancel_invoice(invoice["status"]):
        raise conflict("Paid or already cancelled invoices cannot be cancelled")
    repos.set_invoice_cancelled(db_id, utcnow(), reason.strip())
    db.commit()
    audit.write_entry(g.claims, "invoice.cancel", "invoice", encode_id("inv", db_id))
    return jsonify(invoices_json([repos.find_invoice(db_id)], issuer_row())[0])


@bp.delete("/invoices/<invoice_id>")
@auth.require_role("ADMIN", "BILLER")
def delete_invoice(invoice_id: str):
    db_id, invoice = _load_invoice(invoice_id, lock=True)
    if not can_delete_invoice(invoice["status"]):
        raise conflict("Only draft invoices can be deleted")
    repos.delete_invoice(db_id)
    db.commit()
    audit.write_entry(g.claims, "invoice.delete", "invoice", encode_id("inv", db_id))
    return jsonify({"ok": True})
