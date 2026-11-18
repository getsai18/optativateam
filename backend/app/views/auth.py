import os
import time

import boto3
from botocore.exceptions import ClientError
from flask import Blueprint, current_app, jsonify, request

from .. import auth, repos
from ..domain import encode_id
from ..errors import ApiError, rate_limited

bp = Blueprint("auth", __name__)

# Anti fuerza bruta: MAX_FAILS fallos por (IP, email) dentro de WINDOW_S segundos bloquean el login.
# El contador vive en DynamoDB (tabla billing_user_session, PK session_id, TTL ttl) para que varias
# Lambdas compartan el mismo límite. Si no hay endpoint (desarrollo local) o DynamoDB falla, se usa
# el dict en memoria de este proceso como respaldo.
MAX_FAILS = 5
WINDOW_S = 15 * 60
_FAILS: dict[tuple[str, str], list[float]] = {}
_session_table = None
_dynamo_broken = False
_REMOTE_KEYS: set[str] = set()


def _endpoint() -> str:
    return (os.getenv("DYNAMODB_ENDPOINT") or os.getenv("DYNAMODB_ENDPOINT_URL") or "").strip()


def _region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"


def _table_name() -> str:
    return (os.getenv("USER_SESSION_TABLE") or os.getenv("SESSION_TABLE") or "billing_user_session").strip()


def _remote_enabled() -> bool:
    """DYNAMODB_RATE_LIMIT fuerza el modo; por defecto se activa con endpoint o en Lambda."""
    flag = os.getenv("DYNAMODB_RATE_LIMIT", "").strip().lower()
    if flag in ("1", "true", "yes", "on"):
        return True
    if flag in ("0", "false", "no", "off"):
        return False
    return bool(_endpoint() or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))


def _table():
    """Tabla de DynamoDB, o None si no está configurada o no se puede usar."""
    global _session_table, _dynamo_broken
    if not _remote_enabled() or _dynamo_broken:
        return None
    if _session_table is None:
        try:
            kwargs = {"region_name": _region()}
            endpoint = _endpoint()
            if endpoint:
                kwargs["endpoint_url"] = endpoint
            _session_table = boto3.resource("dynamodb", **kwargs).Table(_table_name())
        except Exception:
            _dynamo_broken = True
            return None
    return _session_table


def _remote_key(key: tuple[str, str]) -> str:
    return f"login:{key[0]}:{key[1]}"


def _remote_count(key: str) -> int | None:
    """Fallos vigentes en DynamoDB; None significa 'no disponible, usa el respaldo local'."""
    global _dynamo_broken
    table = _table()
    if table is None:
        return None
    try:
        item = table.get_item(Key={"session_id": key}, ConsistentRead=True).get("Item")
        if not item:
            return 0
        if int(item.get("ttl", 0)) <= int(time.time()):
            # La expiración por TTL puede tardar en borrar la fila: la quitamos aquí mismo
            # para que el siguiente fallo empiece un contador nuevo y no herede `attempts`.
            try:
                table.delete_item(Key={"session_id": key})
            except Exception:
                pass
            return 0
        return int(item.get("attempts", 0))
    except Exception:
        _dynamo_broken = True
        return None


def _remote_fail(key: str) -> int | None:
    """Cuenta un fallo de forma atómica. None significa 'no disponible'."""
    global _dynamo_broken
    table = _table()
    if table is None:
        return None
    ttl = int(time.time()) + WINDOW_S
    try:
        # Primer fallo: attribute_not_exists evita que dos Lambdas se pisen al crear el contador.
        table.put_item(
            Item={"session_id": key, "attempts": 1, "ttl": ttl},
            ConditionExpression="attribute_not_exists(session_id)",
        )
        return 1
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            _dynamo_broken = True
            return None
    except Exception:
        _dynamo_broken = True
        return None

    # Ya existe: ADD es atómico en DynamoDB, así que dos intentos simultáneos suman los dos.
    try:
        result = table.update_item(
            Key={"session_id": key},
            UpdateExpression="SET ttl = :ttl ADD attempts :one",
            ExpressionAttributeValues={":one": 1, ":ttl": ttl},
            ReturnValues="UPDATED_NEW",
        )
        return int(result.get("Attributes", {}).get("attempts", 1))
    except Exception:
        _dynamo_broken = True
        return None


def _remote_clear(key: str) -> bool:
    """Borra el contador remoto. False cuando no se pudo (o no hay DynamoDB)."""
    global _dynamo_broken
    table = _table()
    if table is None:
        return False
    try:
        table.delete_item(Key={"session_id": key})
        return True
    except Exception:
        _dynamo_broken = True
        return False


def _attempts(key: tuple[str, str]) -> list[float]:
    """Ventana local (respaldo): deja solo los fallos de los últimos WINDOW_S segundos."""
    cutoff = time.time() - WINDOW_S
    recent = [t for t in _FAILS.get(key, []) if t > cutoff]
    if recent:
        _FAILS[key] = recent
    else:
        _FAILS.pop(key, None)
    return recent


def _count_failures(key: tuple[str, str]) -> int:
    count = _remote_count(_remote_key(key))
    return len(_attempts(key)) if count is None else count


def _record_failure(key: tuple[str, str]) -> None:
    remote_key = _remote_key(key)
    if _remote_fail(remote_key) is None:
        _FAILS.setdefault(key, []).append(time.time())
    else:
        _REMOTE_KEYS.add(remote_key)


def _clear_failures(key: tuple[str, str]) -> None:
    _FAILS.pop(key, None)
    remote_key = _remote_key(key)
    if _remote_clear(remote_key):
        _REMOTE_KEYS.discard(remote_key)


def reset_rate_limit() -> None:
    """Limpia los contadores conocidos (se usa en pruebas y en arranques controlados)."""
    global _session_table, _dynamo_broken
    for remote_key in list(_REMOTE_KEYS):
        _remote_clear(remote_key)
    _REMOTE_KEYS.clear()
    _FAILS.clear()
    _dynamo_broken = False
    _session_table = None


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
    if _count_failures(key) >= MAX_FAILS:
        raise rate_limited()
    user = repos.find_user_by_login(email.strip().lower())
    demo = current_app.config["DEMO_PASSWORD"] if current_app.config["ALLOW_DEMO_LOGIN"] else ""
    if user is None or not auth.verify_password(user["password_hash"], password, demo):
        _record_failure(key)
        raise ApiError("UNAUTHORIZED", "Invalid email or password")
    _clear_failures(key)
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
