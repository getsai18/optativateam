import hmac
import time
from functools import wraps

import bcrypt
import jwt
from flask import current_app, g, request

from . import db, repos
from .domain import decode_id
from .errors import forbidden, unauthorized


MAX_EXP_SECONDS = 100_000_000_000
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt())


def build_claims(user: dict) -> dict:
    claims = {
        "sub": user["sub"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "exp": int(time.time()) + int(user["ttl_ms"]) // 1000,  # RFC 7519: segundos
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
    if isinstance(exp, bool) or not isinstance(exp, (int, float)):
        return None
    # exp en segundos; un valor en milisegundos (> año 5138) es un token del formato anterior: no vale.
    if exp > MAX_EXP_SECONDS or exp <= time.time():
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


def burn_password_check(password) -> None:
    """Gasta el mismo tiempo que una verificación real: así un correo inexistente no se distingue por latencia."""
    if isinstance(password, str):
        bcrypt.checkpw(password.encode("utf-8")[:72], _DUMMY_HASH)


def current_claims() -> dict:
    return getattr(g, "claims", None)


def _extract_claims() -> dict | None:
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else ""
    return decode_token(token, current_app.config["JWT_SECRET"])


def _session_valid(claims: dict) -> bool:
    """El token no basta: el usuario debe seguir existiendo y activo, y su rol manda el de la base."""
    try:
        user_id = decode_id("usr", claims.get("sub", ""))
    except ValueError:
        return False
    status = repos.user_status(user_id)
    if status is None or not db.to_bool(status["active"]):
        return False
    if status.get("role"):
        claims["role"] = status["role"]
    return True


def _authenticate() -> dict:
    claims = _extract_claims()
    if claims is None or not _session_valid(claims):
        raise unauthorized()
    g.claims = claims
    return claims


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        _authenticate()
        return fn(*args, **kwargs)

    return wrapper


def require_role(*roles: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            claims = getattr(g, "claims", None) or _authenticate()
            if claims.get("role") not in roles:
                raise forbidden()
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def claims_decoded_sub() -> int:
    claims = getattr(g, "claims", None) or {}
    return decode_id("usr", claims.get("sub", ""))
