import re

from flask import g, request

from .. import db, repos
from ..domain import decode_id, encode_id
from ..errors import not_found, validation

DEFAULT_ISSUER = {
    "legal_name": "Northwind Digital Services S.A. de C.V.",
    "tax_id": "NDS200115KX7",
    "address": "Av. Paseo de la Reforma 250, Piso 14, Juárez, 06600 Ciudad de México, CDMX",
}


_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
# Caracteres de control (incluye NUL) nunca son validos en estos campos.
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def json_body() -> dict:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise validation("Invalid request body")
    return body


def str_field(body: dict, name: str, max_len: int = 255) -> str:
    value = body.get(name)
    if not isinstance(value, str) or not value.strip():
        raise validation("Invalid request body")
    if len(value) > max_len or _CONTROL.search(value):
        raise validation("Invalid request body")
    return value


def opt_str_field(body: dict, name: str, max_len: int = 255) -> str | None:
    value = body.get(name)
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > max_len or _CONTROL.search(value):
        raise validation("Invalid request body")
    return value


def email_field(body: dict, name: str = "email") -> str:
    value = str_field(body, name, 100).strip()
    if not _EMAIL.match(value):
        raise validation("Invalid request body")
    return value


def checked_text(value, max_len: int) -> str | None:
    """Texto opcional ya extraido del body: tipo, largo y caracteres de control."""
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > max_len or _CONTROL.search(value):
        raise validation("Invalid request body")
    return value


def bool_field(body: dict, name: str, default: bool | None = None) -> bool:
    value = body.get(name, default)
    if value is None:
        return False
    if not isinstance(value, bool):
        raise validation("Invalid request body")
    return value


def decode_or_404(prefix: str, value, message: str) -> int:
    try:
        return decode_id(prefix, value)
    except (ValueError, TypeError):
        raise not_found(message)


def issuer_row() -> dict:
    row = repos.get_issuer()
    if row:
        return row
    return repos.ensure_issuer(
        DEFAULT_ISSUER["legal_name"], DEFAULT_ISSUER["tax_id"], DEFAULT_ISSUER["address"]
    )


def tax_universe() -> tuple[dict, dict]:
    taxes = {}
    for row in repos.list_taxes():
        taxes[encode_id("tax", row["id"])] = {
            "code": row["code"],
            "name": row["name"],
            "current_rate": db.to_number(row["current_rate"]),
        }
    history: dict[str, list[dict]] = {}
    for row in repos.list_tax_history():
        history.setdefault(encode_id("tax", row["tax_id"]), []).append(
            {
                "rate": db.to_number(row["rate"]),
                "valid_from": db.date_str(row["valid_from"]),
                "valid_to": db.date_str(row["valid_to"]),
            }
        )
    return taxes, history


def assert_invoice_access(row: dict) -> None:
    claims = g.claims
    if claims.get("role") == "CUSTOMER":
        if encode_id("cus", row["customer_id"]) != claims.get("customerId") or row["status"] == "DRAFT":
            raise not_found("Invoice not found")
