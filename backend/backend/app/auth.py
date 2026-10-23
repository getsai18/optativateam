import hmac
import time
from functools import wraps

import bcrypt
import jwt
from flask import current_app, g, request

from .domain import decode_id
from .errors import forbidden, unauthorized


def build_claims(user: dict) -> dict:
    claims = {
        "sub": user["sub"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "exp": int(time.time() * 1000) + user["ttl_ms"],
    }
    if user.get("customer_id"):
        claims["customerId"] = user["customer_id"]
    return claims


def encode_token(claims: dict, secret: str) -> str:
    return jwt.encode(claims, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> dict | None:
    if not token:
        return None
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_exp": False})
    except jwt.InvalidTokenError:
        return None
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)) or exp <= time.time() * 1000:
        return None
    if not claims.get("sub") or not claims.get("role"):
        return None
    return claims


def verify_password(stored_hash: str, password: str, demo_password: str = "") -> bool:
    """bcrypt estricto. `demo_password` solo se acepta cuando el hash guardado NO es bcrypt
    (marcador del seed) y el llamador lo pasa explícitamente (ALLOW_DEMO_LOGIN)."""
    if not stored_hash or not isinstance(password, str):
        return False
    valid_bcrypt = stored_hash.startswith("$2") and len(stored_hash) == 60
    if valid_bcrypt:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
        except ValueError:
            return False
    if not demo_password:
        return False
    return hmac.compare_digest(demo_password, password)


def current_claims() -> dict:
    return getattr(g, "claims", None)


def _extract_claims() -> dict | None:
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else ""
    return decode_token(token, current_app.config["JWT_SECRET"])


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = _extract_claims()
        if claims is None:
            raise unauthorized()
        g.claims = claims
        return fn(*args, **kwargs)

    return wrapper


def require_role(*roles: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            claims = getattr(g, "claims", None)
            if claims is None:
                claims = _extract_claims()
                if claims is None:
                    raise unauthorized()
                g.claims = claims
            if claims.get("role") not in roles:
                raise forbidden()
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def claims_decoded_sub() -> int:
    claims = getattr(g, "claims", None) or {}
    return decode_id("usr", claims.get("sub", ""))
