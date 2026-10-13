from flask import Blueprint, current_app, jsonify, request

from .. import auth, repos
from ..domain import encode_id
from ..errors import ApiError

bp = Blueprint("auth", __name__)


@bp.post("/auth/login")
def login():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    email = body.get("email")
    password = body.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    user = repos.find_user_by_login(email.strip().lower())
    demo = current_app.config["DEMO_PASSWORD"] if current_app.config["ALLOW_DEMO_LOGIN"] else ""
    if user is None or not auth.verify_password(user["password_hash"], password, demo):
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    if not user["active"]:
        raise ApiError("FORBIDDEN", "This account has been deactivated")
    claims_user = {
        "sub": encode_id("usr", user["id"]),
        "email": user["email"],
        "name": user["full_name"],
        "role": user["role"],
        "customer_id": encode_id("cus", user["customer_id"]) if user.get("customer_id") else None,
        "ttl_ms": current_app.config["SESSION_TTL_MS"],
    }
    claims = auth.build_claims(claims_user)
    token = auth.encode_token(claims, current_app.config["JWT_SECRET"])
    return jsonify(token=token, claims=claims)
