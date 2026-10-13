import datetime
import re

from flask import Blueprint, jsonify, request

from .. import audit, auth, db, repos
from ..domain import today_key
from ..errors import not_found, validation
from ..serializers import tax_history_json, tax_json

bp = Blueprint("taxs", __name__)

_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@bp.get("/taxes")
@auth.require_role("ADMIN", "BILLER", "CUSTOMER")
def list_taxes():
    return jsonify([tax_json(row) for row in repos.list_taxes()])


@bp.get("/taxes/history")
@auth.require_role("ADMIN", "BILLER", "CUSTOMER")
def list_tax_history():
    return jsonify([tax_history_json(row) for row in repos.list_tax_history()])


@bp.post("/taxes/<tax_id>/rates")
@auth.require_role("ADMIN")
def change_tax_rate(tax_id: str):
    claims = auth.current_claims()
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise validation("Invalid request body")
    rate = body.get("rate")
    if not isinstance(rate, (int, float)) or isinstance(rate, bool):
        raise validation("Invalid request body")
    valid_from = body.get("validFrom")
    if not isinstance(valid_from, str) or not _DATE_PATTERN.match(valid_from):
        raise validation("Invalid request body")
    db_id = repos.decode_or_none("tax", tax_id)
    tax = repos.find_tax(db_id) if db_id is not None else None
    if tax is None:
        raise not_found("Tax not found")
    if rate < 0 or rate > 1:
        raise validation("Rate must be between 0% and 100%")
    today = today_key()
    if valid_from < today:
        raise validation("The new rate cannot start in the past")
    open_period = repos.open_tax_period(db_id)
    if open_period is not None:
        open_day = db.date_str(open_period["valid_from"])
        if valid_from <= open_day:
            raise validation(f"The new rate must start after {open_day}")
        repos.close_tax_period(db_id, datetime.date.fromisoformat(valid_from))
    user_id = auth.claims_decoded_sub()
    repos.insert_tax_history(db_id, float(rate), datetime.date.fromisoformat(valid_from), user_id)
    covering = None
    for entry in repos.tax_history_for(db_id):
        valid_from_day = db.date_str(entry["valid_from"])
        valid_to_day = db.date_str(entry["valid_to"])
        if valid_from_day <= today and (valid_to_day is None or today < valid_to_day):
            covering = entry
            break
    if covering is not None:
        repos.update_tax_current_rate(db_id, db.to_number(covering["rate"]))
    db.commit()
    audit.write_entry(claims, "tax.rate_change", "tax", tax_id)
    return jsonify(tax_json(repos.find_tax(db_id)))
