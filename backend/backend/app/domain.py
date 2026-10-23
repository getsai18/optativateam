import datetime
import math
import random
import re
import uuid

JS_EPSILON = 2.220446049250313e-16
MONTH_LABELS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ID_PATTERN = re.compile(r"^([a-z]+)_(\d+)$")

TRANSITIONS = {
    "DRAFT": ["ISSUED", "CANCELLED"],
    "ISSUED": ["PAID", "CANCELLED"],
    "PAID": [],
    "CANCELLED": [],
}


def round2(value: float) -> float:
    return math.floor((value + JS_EPSILON) * 100 + 0.5) / 100


def to_date_key(value) -> str:
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()[:10]
    return str(value)[:10]


def today_key(now: datetime.datetime | None = None) -> str:
    current = now or utcnow()
    return current.date().isoformat()


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def iso_ms(value: datetime.datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{value.microsecond // 1000:03d}Z"


def new_uuid() -> str:
    return str(uuid.uuid4())


def new_sim_reference() -> str:
    return "SIM-" + "".join(random.choice(REF_ALPHABET) for _ in range(6))


def encode_id(prefix: str, db_id: int) -> str:
    return f"{prefix}_{int(db_id)}"


def decode_id(prefix: str, value: str) -> int:
    match = ID_PATTERN.match(str(value or ""))
    if not match or match.group(1) != prefix:
        raise ValueError(f"invalid id: {value}")
    return int(match.group(2))


def can_transition(frm: str, to: str) -> bool:
    return to in TRANSITIONS.get(frm, [])


def can_edit_invoice(status: str) -> bool:
    return status == "DRAFT"


def can_delete_invoice(status: str) -> bool:
    return status == "DRAFT"


def can_issue_invoice(status: str) -> bool:
    return can_transition(status, "ISSUED")


def can_pay_invoice(status: str) -> bool:
    return can_transition(status, "PAID")


def can_cancel_invoice(status: str) -> bool:
    return can_transition(status, "CANCELLED")


def rate_on_date(tax: dict, history: list[dict], as_of) -> float:
    day = to_date_key(as_of)
    for entry in history:
        valid_from = to_date_key(entry["valid_from"])
        valid_to = entry.get("valid_to")
        if valid_from <= day and (valid_to is None or day < to_date_key(valid_to)):
            return float(entry["rate"])
    return float(tax["current_rate"])


def calculate_totals(lines: list[dict], taxes: dict, history: dict, as_of) -> dict:
    breakdown: dict[str, dict] = {}
    computed = []
    for index, item in enumerate(lines):
        line_subtotal = round2(item["quantity"] * item["unit_price"])
        line_taxes = []
        for tax_id in item["tax_ids"]:
            tax = taxes.get(tax_id)
            if tax is None:
                continue
            rate = rate_on_date(tax, history.get(tax_id, []), as_of)
            amount = round2(line_subtotal * rate)
            entry = breakdown.get(tax_id)
            if entry is None:
                entry = {"tax_id": tax_id, "code": tax["code"], "rate": rate, "base": 0.0, "amount": 0.0}
                breakdown[tax_id] = entry
            entry["base"] = round2(entry["base"] + line_subtotal)
            entry["amount"] = round2(entry["amount"] + amount)
            line_taxes.append(
                {"tax_id": tax_id, "code": tax["code"], "name": tax.get("name", tax["code"]), "rate": rate, "amount": amount}
            )
        tax_amount = round2(sum(t["amount"] for t in line_taxes))
        computed.append(
            {
                "id": f"L{index + 1}",
                "service_id": item["service_id"],
                "service_name": item["service_name"],
                "quantity": item["quantity"],
                "unit_price": item["unit_price"],
                "line_subtotal": line_subtotal,
                "taxes": line_taxes,
                "tax_amount": tax_amount,
                "line_total": round2(line_subtotal + tax_amount),
            }
        )
    subtotal = round2(sum(line["line_subtotal"] for line in computed))
    tax_total = round2(sum(line["tax_amount"] for line in computed))
    return {
        "lines": computed,
        "subtotal": subtotal,
        "tax_total": tax_total,
        "total": round2(subtotal + tax_total),
    }
