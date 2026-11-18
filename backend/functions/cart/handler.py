"""Carrito del wizard de factura en DynamoDB (tabla billing_invoice_cart, TTL).

Sustituye el localStorage `billing.invoiceBuilder.v1` del frontend (builderStore.ts) para que el
borrador del carrito siga al usuario entre dispositivos. No toca RDS: la Lambda puede ir FUERA de
la VPC (arranque en frío más rápido, sin VPC endpoint).

Rutas (detrás del Lambda authorizer; el usuario sale del contexto del authorizer, nunca del body):
  GET    /cart   -> 200 {invoiceId, customerId, lines, step}  (carrito vacío si no existe)
  PUT    /cart   -> 200 mismo objeto normalizado
  DELETE /cart   -> 200 {"ok": true}

Variables de entorno:
  CART_TABLE      default billing_invoice_cart
  CART_TTL_DAYS   default 7
  CORS_ORIGIN     default *   (pon el dominio del frontend en producción)
"""

import json
import os
import time

import boto3

TABLE_NAME = os.environ.get("CART_TABLE", "billing_invoice_cart")
TTL_DAYS = int(os.environ.get("CART_TTL_DAYS", "7"))
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")
MAX_LINES = 200

_table = None


def _tbl():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb").Table(TABLE_NAME)
    return _table


def _resp(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": CORS_ORIGIN,
        },
        "body": json.dumps(body),
    }


def _error(status: int, code: str, message: str) -> dict:
    return _resp(status, {"code": code, "message": message})


def _user_id(event: dict) -> str | None:
    auth = (event.get("requestContext") or {}).get("authorizer") or {}
    ctx = auth.get("lambda") if isinstance(auth.get("lambda"), dict) else auth  # HTTP API v2 / REST
    sub = ctx.get("sub")
    return sub if isinstance(sub, str) and sub else None


def _normalize(body) -> dict | None:
    """Valida la forma BuilderData del frontend. None => inválido."""
    if not isinstance(body, dict):
        return None
    invoice_id = body.get("invoiceId")
    customer_id = body.get("customerId")
    for value in (invoice_id, customer_id):
        if value is not None and not isinstance(value, str):
            return None
    lines = body.get("lines")
    if not isinstance(lines, list) or len(lines) > MAX_LINES:
        return None
    clean, seen = [], set()
    for item in lines:
        if not isinstance(item, dict):
            return None
        service_id, qty = item.get("serviceId"), item.get("quantity")
        if not isinstance(service_id, str) or not service_id or service_id in seen:
            return None
        if isinstance(qty, bool) or not isinstance(qty, int) or qty < 1 or qty > 9999:
            return None
        seen.add(service_id)
        clean.append({"serviceId": service_id, "quantity": qty})
    step = body.get("step", 0)
    if isinstance(step, bool) or not isinstance(step, int):
        return None
    return {
        "invoiceId": invoice_id,
        "customerId": customer_id,
        "lines": clean,
        "step": min(max(step, 0), 3),
    }


EMPTY = {"invoiceId": None, "customerId": None, "lines": [], "step": 0}


def handler(event, _context=None):
    method = (
        (event.get("requestContext") or {}).get("http", {}).get("method") or event.get("httpMethod") or ""
    ).upper()
    if method == "OPTIONS":
        return _resp(204, "")
    user_id = _user_id(event)
    if user_id is None:
        return _error(401, "UNAUTHORIZED", "Session expired")

    if method == "GET":
        item = _tbl().get_item(Key={"user_id": user_id}).get("Item")
        if not item or int(item.get("ttl", 0)) < int(time.time()):
            return _resp(200, EMPTY)
        return _resp(200, json.loads(item["cart"]))

    if method == "PUT":
        try:
            body = json.loads(event.get("body") or "null")
        except ValueError:
            body = None
        cart = _normalize(body)
        if cart is None:
            return _error(400, "VALIDATION", "Invalid request body")
        _tbl().put_item(
            Item={
                "user_id": user_id,
                "cart": json.dumps(cart),
                "ttl": int(time.time()) + TTL_DAYS * 86400,
                "updated_at": int(time.time()),
            }
        )
        return _resp(200, cart)

    if method == "DELETE":
        _tbl().delete_item(Key={"user_id": user_id})
        return _resp(200, {"ok": True})

    return _error(404, "NOT_FOUND", "Not found")
