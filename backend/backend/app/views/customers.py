from flask import Blueprint, jsonify

from .. import audit, auth, db, repos
from ..domain import encode_id
from ..errors import conflict, not_found, validation
from ..serializers import customer_json
from .common import bool_field, json_body, opt_str_field, str_field

bp = Blueprint("customers", __name__)

_TAX_CONFLICT = "A customer with this tax ID already exists"
_EMAIL_CONFLICT = "A customer with this email already exists"


def _fields(body: dict) -> dict:
    return {
        "name": str_field(body, "name"),
        "tax_id": str_field(body, "taxId"),
        "email": str_field(body, "email"),
        "phone": opt_str_field(body, "phone") or None,
        "address": str_field(body, "address"),
        "active": bool_field(body, "active", True),
    }


@bp.get("/customers")
@auth.require_role("ADMIN", "BILLER")
def list_customers():
    return jsonify([customer_json(row) for row in repos.list_customers()])


@bp.post("/customers")
@auth.require_role("ADMIN", "BILLER")
def create_customer():
    claims = auth.current_claims()
    fields = _fields(json_body())
    if repos.customer_tax_taken(fields["tax_id"]):
        raise conflict(_TAX_CONFLICT)
    try:
        customer_id = repos.insert_customer(**fields)
    except db.DuplicateKeyError:
        if repos.customer_tax_taken(fields["tax_id"]):
            raise conflict(_TAX_CONFLICT)
        raise conflict(_EMAIL_CONFLICT)
    db.commit()
    audit.write_entry(claims, "customer.create", "customer", encode_id("cus", customer_id))
    return jsonify(customer_json(repos.find_customer(customer_id)))


@bp.put("/customers/<customer_id>")
@auth.require_role("ADMIN")
def update_customer(customer_id: str):
    claims = auth.current_claims()
    body = json_body()
    db_id = repos.decode_or_none("cus", customer_id)
    customer = repos.find_customer(db_id) if db_id is not None else None
    if customer is None:
        raise not_found("Customer not found")
    fields = _fields(body)
    fields["active"] = bool_field(body, "active", bool(customer["active"]))
    if repos.customer_tax_taken(fields["tax_id"], exclude_id=db_id):
        raise conflict(_TAX_CONFLICT)
    if repos.customer_email_taken(fields["email"], exclude_id=db_id):
        raise conflict(_EMAIL_CONFLICT)
    try:
        repos.update_customer(db_id, **fields)
    except db.DuplicateKeyError:
        if repos.customer_tax_taken(fields["tax_id"], exclude_id=db_id):
            raise conflict(_TAX_CONFLICT)
        raise conflict(_EMAIL_CONFLICT)
    db.commit()
    audit.write_entry(claims, "customer.update", "customer", customer_id)
    return jsonify(customer_json(repos.find_customer(db_id)))
