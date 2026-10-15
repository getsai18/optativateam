from flask import Blueprint, g, jsonify

from .. import auth, cart
from ..errors import validation
from .common import json_body

bp = Blueprint("cart", __name__)

MAX_LINES = 200


def _normalize(body: dict) -> dict:
    invoice_id = body.get("invoiceId")
    customer_id = body.get("customerId")
    for value in (invoice_id, customer_id):
        if value is not None and not isinstance(value, str):
            raise validation("Invalid request body")
    lines = body.get("lines")
    if not isinstance(lines, list) or len(lines) > MAX_LINES:
        raise validation("Invalid request body")
    clean, seen = [], set()
    for item in lines:
        if not isinstance(item, dict):
            raise validation("Invalid request body")
        service_id, qty = item.get("serviceId"), item.get("quantity")
        if not isinstance(service_id, str) or not service_id or service_id in seen:
            raise validation("Invalid request body")
        if isinstance(qty, bool) or not isinstance(qty, int) or qty < 1 or qty > 9999:
            raise validation("Invalid request body")
        seen.add(service_id)
        clean.append({"serviceId": service_id, "quantity": qty})
    step = body.get("step", 0)
    if isinstance(step, bool) or not isinstance(step, int):
        raise validation("Invalid request body")
    return {
        "invoiceId": invoice_id,
        "customerId": customer_id,
        "lines": clean,
        "step": min(max(step, 0), 3),
    }


@bp.get("/cart")
@auth.require_role("ADMIN", "BILLER")
def get_cart():
    return jsonify(cart.get(g.claims["sub"]))


@bp.put("/cart")
@auth.require_role("ADMIN", "BILLER")
def put_cart():
    data = _normalize(json_body())
    cart.put(g.claims["sub"], data)
    return jsonify(data)


@bp.delete("/cart")
@auth.require_role("ADMIN", "BILLER")
def delete_cart():
    cart.delete(g.claims["sub"])
    return jsonify({"ok": True})
