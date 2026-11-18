from . import db, repos
from .domain import encode_id, iso_ms, round2


def _num(value) -> float:
    """Importes en dinero: 2 decimales."""
    return round2(db.to_number(value))


def _rate(value) -> float:
    """Tasas y porcentajes (0.1067 = 10.67 %): no se redondean a 2 decimales."""
    return round(db.to_number(value), 6)


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
        "currentRate": _rate(row["current_rate"]),
        "kind": row.get("kind") or "TRANSFER",
    }


def tax_history_json(row: dict) -> dict:
    return {
        "id": encode_id("txh", row["id"]),
        "taxId": encode_id("tax", row["tax_id"]),
        "rate": _rate(row["rate"]),
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
                "kind": tax.get("kind") or "TRANSFER",
                "rate": _rate(tax["rate"]),
                "amount": _num(tax["amount"]),
            }
            for tax in taxes_by_detail.get(int(detail["id"]), [])
        ]
        withholding = round(sum(t["amount"] for t in line_taxes if t["kind"] == "WITHHELD"), 2)
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
                "withholdingAmount": withholding,
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
        "discountPct": _rate(row.get("discount_pct") or 0),
        "discountTotal": _num(row.get("discount_total") or 0),
        "taxTotal": _num(row["tax_total"]),
        "withholdingTotal": _num(row.get("withholding_total") or 0),
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


def aging_json(row: dict) -> dict:
    return {
        "customerId": encode_id("cus", row["customer_id"]),
        "customerName": row["customer_name"],
        "taxId": row["tax_id"],
        "openInvoices": int(row["open_invoices"]),
        "days0To30": _num(row["days_0_30"]),
        "days31To60": _num(row["days_31_60"]),
        "days61To90": _num(row["days_61_90"]),
        "daysOver90": _num(row["days_over_90"]),
        "balance": _num(row["balance"]),
        "oldestDays": int(row["oldest_days"] or 0),
    }


def fiscal_closing_json(row: dict) -> dict:
    return {
        "id": encode_id("fcl", row["id"]),
        "periodType": row["period_type"],
        "periodStart": db.date_str(row["period_start"]),
        "periodEnd": db.date_str(row["period_end"]),
        "invoiceCount": int(row["invoice_count"]),
        "cancelledCount": int(row["cancelled_count"]),
        "subtotal": _num(row["subtotal"]),
        "discountTotal": _num(row["discount_total"]),
        "taxTotal": _num(row["tax_total"]),
        "withholdingTotal": _num(row["withholding_total"]),
        "total": _num(row["total"]),
        "collectedTotal": _num(row["collected_total"]),
        "closedBy": encode_id("usr", row["closed_by"]) if row.get("closed_by") is not None else None,
        "closedAt": iso_ms(row["closed_at"]),
    }


def payment_validation_json(row: dict) -> dict:
    return {
        "invoiceId": encode_id("inv", row["invoice_id"]),
        "folio": row["folio"],
        "status": row["status"],
        "total": _num(row["total"]),
        "paidAmount": _num(row["paid_amount"]),
        "validation": row["validation"],
    }


def price_history_json(row: dict) -> dict:
    return {
        "id": encode_id("sph", row["id"]),
        "serviceId": encode_id("svc", row["service_id"]),
        "oldPrice": _num(row["old_price"]) if row.get("old_price") is not None else None,
        "newPrice": _num(row["new_price"]),
        "changePct": _num(row["change_pct"]) if row.get("change_pct") is not None else None,
        "reason": row.get("reason"),
        "changedBy": encode_id("usr", row["changed_by"]) if row.get("changed_by") is not None else None,
        "changedAt": iso_ms(row["changed_at"]),
    }


def accounting_entry_json(row: dict) -> dict:
    return {
        "id": encode_id("acc", row["id"]),
        "entryType": row["entry_type"],
        "account": row["account"],
        "debit": _num(row["debit"]),
        "credit": _num(row["credit"]),
        "createdAt": iso_ms(row["created_at"]),
    }
