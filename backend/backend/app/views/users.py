import bcrypt
from flask import Blueprint, current_app, jsonify

from .. import audit, auth, db, repos
from ..domain import decode_id, encode_id
from ..errors import conflict, not_found, validation
from ..serializers import user_json
from .common import bool_field, json_body, str_field

bp = Blueprint("users", __name__)

_EMAIL_CONFLICT = "A user with this email already exists"
_ROLES = ("ADMIN", "BILLER", "CUSTOMER")


def _fields(body: dict) -> dict:
    email = str_field(body, "email")
    full_name = str_field(body, "fullName")
    role = str_field(body, "role")
    if role not in _ROLES:
        raise validation("Invalid request body")
    customer_id = None
    if role == "CUSTOMER":
        customer_ref = body.get("customerId")
        if not customer_ref:
            raise validation("Customer users must be linked to a customer")
        customer_id = repos.decode_or_none("cus", customer_ref)
        if customer_id is None or repos.find_customer(customer_id) is None:
            raise not_found("Customer not found")
    return {
        "email": email,
        "full_name": full_name,
        "role": role,
        "customer_id": customer_id,
        "active": bool_field(body, "active", True),
    }


def _password_hash(body: dict) -> str:
    password = body.get("password")
    if not isinstance(password, str) or not password:
        password = current_app.config["DEMO_PASSWORD"]
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@bp.get("/users")
@auth.require_role("ADMIN")
def list_users():
    return jsonify([user_json(row) for row in repos.list_users()])


@bp.post("/users")
@auth.require_role("ADMIN")
def create_user():
    claims = auth.current_claims()
    body = json_body()
    fields = _fields(body)
    if repos.user_email_taken(fields["email"]):
        raise conflict(_EMAIL_CONFLICT)
    try:
        user_id = repos.insert_user(password_hash=_password_hash(body), **fields)
    except db.DuplicateKeyError:
        raise conflict(_EMAIL_CONFLICT)
    db.commit()
    audit.write_entry(claims, "user.create", "user", encode_id("usr", user_id))
    return jsonify(user_json(repos.find_user(user_id)))


@bp.put("/users/<user_id>")
@auth.require_role("ADMIN")
def update_user(user_id: str):
    claims = auth.current_claims()
    body = json_body()
    db_id = repos.decode_or_none("usr", user_id)
    fields = _fields(body)
    if db_id is not None and db_id == decode_id("usr", claims["sub"]):
        if fields["role"] != "ADMIN" or not fields["active"]:
            raise validation("You cannot remove your own administrator access")
    user = repos.find_user(db_id) if db_id is not None else None
    if user is None:
        raise not_found("User not found")
    if repos.user_email_taken(fields["email"], exclude_id=db_id):
        raise conflict(_EMAIL_CONFLICT)
    try:
        repos.update_user(db_id, **fields)
    except db.DuplicateKeyError:
        raise conflict(_EMAIL_CONFLICT)
    db.commit()
    audit.write_entry(claims, "user.update", "user", user_id)
    return jsonify(user_json(repos.find_user(db_id)))
