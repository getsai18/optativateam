"""Lambda authorizer: valida el JWT HS256 que emite POST /auth/login (exp en epoch ms).

Soporta los tres formatos que puede recibir API Gateway:
  - REST API, tipo TOKEN       -> event["authorizationToken"], devuelve policy IAM
  - REST/HTTP API, tipo REQUEST (payload 1.0) -> event["headers"], devuelve policy IAM
  - HTTP API payload 2.0 (simple response)    -> event["headers"], devuelve {"isAuthorized": bool}

Con policy IAM un token inválido se responde con `raise Exception("Unauthorized")`, que API Gateway
traduce a HTTP 401 (lo que espera el frontend para "Session expired"). Con simple response solo
existe 403. Por eso se recomienda REST API o HTTP API con payload format 1.0.

Variables de entorno:
  JWT_SECRET   obligatorio, el mismo que usa el backend Flask.
"""

import os
import time

import jwt

_SECRET = os.environ.get("JWT_SECRET", "")
_ROLES = ("ADMIN", "BILLER", "CUSTOMER")


def _verify(token: str) -> dict | None:
    if not token or not _SECRET:
        return None
    try:
        claims = jwt.decode(token, _SECRET, algorithms=["HS256"], options={"verify_exp": False})
    except jwt.InvalidTokenError:
        return None
    exp = claims.get("exp")
    if isinstance(exp, bool) or not isinstance(exp, (int, float)):
        return None
    # El backend emite milisegundos; si llegara en segundos (< año 5138 en s) se normaliza.
    exp_ms = exp * 1000 if exp < 100_000_000_000 else exp
    if exp_ms <= time.time() * 1000:
        return None
    if not isinstance(claims.get("sub"), str) or claims.get("role") not in _ROLES:
        return None
    if claims["role"] == "CUSTOMER" and not claims.get("customerId"):
        return None
    return claims


def _bearer(value: str | None) -> str:
    value = (value or "").strip()
    return value[7:].strip() if value.lower().startswith("bearer ") else ""


def _header(headers: dict | None, name: str) -> str | None:
    for key, value in (headers or {}).items():
        if key.lower() == name:
            return value
    return None


def _context(claims: dict) -> dict:
    # Los valores del contexto deben ser string/number/bool (no objetos).
    ctx = {"sub": claims["sub"], "role": claims["role"], "email": str(claims.get("email", ""))}
    if claims.get("customerId"):
        ctx["customerId"] = str(claims["customerId"])
    return ctx


def _wildcard_arn(arn: str) -> str:
    """arn:aws:execute-api:region:acct:apiId/stage/GET/path -> .../stage/*/*  (permite cachear)."""
    base, _, rest = arn.partition("/")
    stage = rest.split("/", 1)[0] if rest else "*"
    return f"{base}/{stage}/*/*"


def _policy(principal: str, effect: str, arn: str, context: dict | None = None) -> dict:
    response = {
        "principalId": principal,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [{"Action": "execute-api:Invoke", "Effect": effect, "Resource": _wildcard_arn(arn)}],
        },
    }
    if context:
        response["context"] = context
    return response


def handler(event, _context_obj=None):
    is_v2 = str(event.get("version", "")) == "2.0" and "routeArn" in event
    if is_v2:
        token = _bearer(_header(event.get("headers"), "authorization"))
        claims = _verify(token)
        if claims is None:
            return {"isAuthorized": False}
        return {"isAuthorized": True, "context": _context(claims)}

    arn = event.get("methodArn", "")
    raw = event.get("authorizationToken") or _header(event.get("headers"), "authorization")
    claims = _verify(_bearer(raw))
    if claims is None:
        raise Exception("Unauthorized")  # noqa: TRY002 - API Gateway lo exige literal => HTTP 401
    return _policy(claims["sub"], "Allow", arn, _context(claims))
