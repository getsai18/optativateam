from . import db, repos
from .domain import encode_id, iso_ms, round2


def _num(value) -> float:
    return round2(db.to_number(value))


def customer_json(row: dict) -> dict:
    data = {
        "id": encode_id("cus", row["id"]),
        "name": row["name"],
        "taxId": row["tax_id"],
        "email": row["email"],
        "address": row["address"],
        "active": db.to_bool(row["active"]),
    }
    if row.get("phone"):
        data["phone"] = row["phone"]
    return data


def user_json(row: dict) -> dict:
    data = {
        "id": encode_id("usr", row["id"]),
        "email": row["email"],
        "fullName": row["full_name"],
        "role": row["role"],
        "active": db.to_bool(row["active"]),
    }
    if row.get("customer_id") and row["role"] == "CUSTOMER":
        data["customerId"] = encode_id("cus", row["customer_id"])
    return data


def tax_json(row: dict) -> dict:
    return {
        "id": encode_id("tax", row["id"]),
        "code": row["code"],
        "name": row["name"],
        "currentRate": _num(row["current_rate"]),
    }


def tax_history_json(row: dict) -> dict:
    return {
        "id": encode_id("txh", row["id"]),
        "taxId": encode_id("tax", row["tax_id"]),
        "rate": _num(row["rate"]),
        "validFrom": db.date_str(row["valid_from"]),
        "validTo": db.date_str(row["valid_to"]),
    }


def feature_json(row: dict) -> dict:
    data = {
        "id": encode_id("feat", row["id"]),
        "name": row["name"],
        "description": row.get("description") or "",
    }
    if row.get("unit"):
        data["unit"] = row["unit"]
    return data


def service_json(row: dict, tax_ids: list[int], features: list[dict]) -> dict:
    return {
        "id": encode_id("svc", row["id"]),
        "code": row["code"],
        "name": row["name"],
        "description": row.get("description") or "",
        "basePrice": _num(row["base_price"]),
        "category": row["category"],
        "taxIds": [encode_id("tax", tax_id) for tax_id in tax_ids],
        "features": [
            {"featureId": encode_id("feat", item["feature_id"]), "value": item["value"]}
            for item in features
        ],
        "active": db.to_bool(row["active"]),
    }


def services_json(rows: list[dict]) -> list[dict]:
    ids = [row["id"] for row in rows]
    taxes = repos.service_tax_map(ids)
    features = repos.service_feature_map(ids)
    return [service_json(row, taxes.get(row["id"], []), features.get(row["id"], [])) for row in rows]


def issuer_party(issuer: dict) -> dict:
    return {"name": issuer["legal_name"], "taxId": issuer["tax_id"], "address": issuer["address"]}


def _group_details(invoice_ids: list[int]) -> tuple[dict[int, list[dict]], dict[int, list[dict]]]:
    details = repos.details_for(invoice_ids)
    detail_ids = [row["id"] for row in details]
    taxes = repos.detail_taxes_for(detail_ids)
    by_invoice: dict[int, list[dict]] = {}
    for row in details:
        by_invoice.setdefault(int(row["invoice_id"]), []).append(row)
    taxes_by_detail: dict[int, list[dict]] = {}
    for row in taxes:
        taxes_by_detail.setdefault(int(row["invoice_detail_id"]), []).append(row)
    return by_invoice, taxes_by_detail


def invoice_json(row: dict, details: list[dict], taxes_by_detail: dict[int, list[dict]], issuer: dict) -> dict:
    lines = []
    for index, detail in enumerate(details):
        line_taxes = [
            {
                "taxId": encode_id("tax", tax["tax_id"]),
                "code": tax["code"],
                "rate": _num(tax["rate"]),
                "amount": _num(tax["amount"]),
            }
            for tax in taxes_by_detail.get(int(detail["id"]), [])
        ]
        lines.append(
            {
                "id": f"L{index + 1}",
                "serviceId": encode_id("svc", detail["service_id"]),
                "serviceName": detail["service_name"],
                "quantity": int(detail["quantity"]),
                "unitPrice": _num(detail["unit_price"]),
                "lineSubtotal": _num(detail["line_subtotal"]),
                "taxes": line_taxes,
                "taxAmount": _num(detail["tax_amount"]),
                "lineTotal": _num(detail["line_total"]),
            }
        )
    return {
        "id": encode_id("inv", row["id"]),
        "folio": row["folio"],
        "uuid": row["uuid"],
        "status": row["status"],
        "customerId": encode_id("cus", row["customer_id"]),
        "createdBy": encode_id("usr", row["created_by"]),
        "issuer": issuer_party(issuer),
        "receiver": {
            "name": row["receiver_name"],
            "taxId": row["receiver_tax_id"],
            "address": row["receiver_address"],
        },
        "lines": lines,
        "subtotal": _num(row["subtotal"]),
        "taxTotal": _num(row["tax_total"]),
        "total": _num(row["total"]),
        "createdAt": iso_ms(row["created_at"]),
        "issuedAt": iso_ms(row["issued_at"]),
        "paidAt": iso_ms(row["paid_at"]),
        "cancelledAt": iso_ms(row["cancelled_at"]),
        "cancellationReason": row["cancellation_reason"],
    }


def invoices_json(rows: list[dict], issuer: dict) -> list[dict]:
    by_invoice, taxes_by_detail = _group_details([row["id"] for row in rows])
    return [invoice_json(row, by_invoice.get(row["id"], []), taxes_by_detail, issuer) for row in rows]


def payment_json(row: dict) -> dict:
    return {
        "id": encode_id("pay", row["id"]),
        "invoiceId": encode_id("inv", row["invoice_id"]),
        "method": row["method"],
        "amount": _num(row["amount"]),
        "reference": row["reference"],
        "paidAt": iso_ms(row["paid_at"]),
        "registeredBy": encode_id("usr", row["registered_by"]),
    }
