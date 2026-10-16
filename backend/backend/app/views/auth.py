import time

from flask import Blueprint, current_app, jsonify, request

from .. import auth, repos
from ..domain import encode_id
from ..errors import ApiError, rate_limited

bp = Blueprint("auth", __name__)

# Anti fuerza bruta: MAX_FAILS fallos por (IP, email) dentro de WINDOW_S segundos bloquean el login.
MAX_FAILS = 5
WINDOW_S = 15 * 60
_FAILS: dict[tuple[str, str], list[float]] = {}


def _attempts(key: tuple[str, str]) -> list[float]:
    cutoff = time.time() - WINDOW_S
    recent = [t for t in _FAILS.get(key, []) if t > cutoff]
    if recent:
        _FAILS[key] = recent
    else:
        _FAILS.pop(key, None)
    return recent


def reset_rate_limit() -> None:
    _FAILS.clear()


@bp.post("/auth/login")
def login():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    email = body.get("email")
    password = body.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    if len(email) > 100 or len(password) > 200:
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    key = (request.remote_addr or "?", email.strip().lower())
    if len(_attempts(key)) >= MAX_FAILS:
        raise rate_limited()
    user = repos.find_user_by_login(email.strip().lower())
    demo = current_app.config["DEMO_PASSWORD"] if current_app.config["ALLOW_DEMO_LOGIN"] else ""
    if user is None:
        auth.burn_password_check(password)
    if user is None or not auth.verify_password(user["password_hash"], password, demo):
        _FAILS.setdefault(key, []).append(time.time())
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    _FAILS.pop(key, None)
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
