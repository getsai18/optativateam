"""Emulación en memoria de los Stored Procedures para las pruebas de API.

Replica las reglas de database/procedures/*.sql sobre el FakeStore de conftest.py:
mismos estados, mismos mensajes de error (BusinessRuleError) y mismos cálculos.
"""

import datetime
import json

from app import repos
from app.db import BusinessRuleError
from app.domain import round2, utcnow


def install(store, monkeypatch) -> None:
    def _invoice_or_fail(invoice_id):
        invoice = store.invoices.get(invoice_id)
        if invoice is None:
            raise BusinessRuleError("Invoice not found")
        return invoice

    # --- sp_calculate_invoice_totals + sp_apply_discount ---------------------------
    def calculate_invoice_totals(invoice_id):
        invoice = _invoice_or_fail(invoice_id)
        if invoice["status"] != "DRAFT":
            raise BusinessRuleError("Only draft invoices can be recalculated")
        subtotal = transferred = withheld = 0.0
        for detail in [d for d in store.details.values() if d["invoice_id"] == invoice_id]:
            line_subtotal = round2(detail["quantity"] * detail["unit_price"])
            line_tr = line_wh = 0.0
            for tax in store.detail_taxes.values():
                if tax["invoice_detail_id"] != detail["id"]:
                    continue
                tax["amount"] = round2(line_subtotal * tax["rate"])
                if tax.get("kind", "TRANSFER") == "WITHHELD":
                    line_wh += tax["amount"]
                else:
                    line_tr += tax["amount"]
            detail.update(
                {
                    "line_subtotal": line_subtotal,
                    "tax_amount": round2(line_tr),
                    "line_total": round2(line_subtotal + line_tr - line_wh),
                }
            )
            subtotal += line_subtotal
            transferred += line_tr
            withheld += line_wh
        pct = store.discounts.get(invoice["customer_id"], 0.0)
        discount = round2(subtotal * pct)
        tax_total = round2(transferred * (1 - pct))
        withholding = round2(withheld * (1 - pct))
        invoice.update(
            {
                "subtotal": round2(subtotal),
                "discount_pct": pct,
                "discount_total": discount,
                "tax_total": tax_total,
                "withholding_total": withholding,
                "total": round2(subtotal - discount + tax_total - withholding),
            }
        )

    # --- sp_issue_invoice + sp_next_folio ---------------------------------------
    def issue_invoice(invoice_id, user_id):
        invoice = _invoice_or_fail(invoice_id)
        if invoice["status"] != "DRAFT":
            raise BusinessRuleError("Only draft invoices can be issued")
        if not any(d["invoice_id"] == invoice_id for d in store.details.values()):
            raise BusinessRuleError("Invoice must have at least one line")
        calculate_invoice_totals(invoice_id)
        now = utcnow()
        number = store.folios.get(now.year, 0) + 1
        store.folios[now.year] = number
        invoice.update(
            {
                "status": "ISSUED",
                "folio": f"INV-{now.year}-{number:04d}",
                "uuid": f"00000000-0000-4000-8000-{invoice_id:012d}",
                "issued_at": now,
            }
        )
        store.ledger.append({"invoice_id": invoice_id, "entry_type": "ISSUE"})
        return dict(invoice)

    # --- sp_cancel_invoice -------------------------------------------------------
    def cancel_invoice(invoice_id, reason, user_id):
        invoice = _invoice_or_fail(invoice_id)
        if invoice["status"] == "PAID":
            raise BusinessRuleError("Paid invoices cannot be cancelled")
        if invoice["status"] == "CANCELLED":
            raise BusinessRuleError("Invoice is already cancelled")
        was_issued = invoice["status"] == "ISSUED"
        invoice.update({"status": "CANCELLED", "cancelled_at": utcnow(), "cancellation_reason": reason})
        if was_issued:
            store.ledger.append({"invoice_id": invoice_id, "entry_type": "REVERSAL"})
        return dict(invoice)

    # --- sp_register_payment -----------------------------------------------------
    def register_payment(invoice_id, method, amount, reference, user_id):
        invoice = _invoice_or_fail(invoice_id)
        if invoice["status"] == "PAID":
            raise BusinessRuleError("Invoice is already paid")
        if invoice["status"] != "ISSUED":
            raise BusinessRuleError("Only issued invoices can receive payments")
        if abs(float(amount) - float(invoice["total"])) >= 0.005:
            raise BusinessRuleError("Payment amount must match the invoice total")
        now = utcnow()
        payment_id = store._next("pay")
        store.payments[payment_id] = {
            "id": payment_id,
            "invoice_id": invoice_id,
            "method": method,
            "amount": invoice["total"],
            "reference": reference,
            "paid_at": now,
            "registered_by": user_id,
        }
        invoice.update({"status": "PAID", "paid_at": now})
        store.ledger.append({"invoice_id": invoice_id, "entry_type": "PAYMENT"})
        return dict(store.payments[payment_id])

    # --- sp_validate_payment_status ----------------------------------------------
    def validate_payment_status(invoice_id=None):
        rows = []
        for invoice in store.invoices.values():
            if invoice_id is None and invoice["status"] == "DRAFT":
                continue
            if invoice_id is not None and invoice["id"] != invoice_id:
                continue
            payment = next((p for p in store.payments.values() if p["invoice_id"] == invoice["id"]), None)
            if invoice["status"] == "PAID" and payment is None:
                check = "PAID_WITHOUT_PAYMENT"
            elif invoice["status"] != "PAID" and payment is not None:
                check = "PAYMENT_ON_UNPAID_STATUS"
            else:
                check = "OK"
            rows.append(
                {
                    "invoice_id": invoice["id"],
                    "folio": invoice["folio"],
                    "status": invoice["status"],
                    "total": invoice["total"],
                    "paid_amount": payment["amount"] if payment else 0,
                    "validation": check,
                }
            )
        return rows

    # --- sp_aging_report ---------------------------------------------------------
    def aging_report(as_of):
        day = as_of or utcnow().date()
        groups: dict[int, dict] = {}
        for invoice in store.invoices.values():
            if invoice["status"] != "ISSUED" or invoice["issued_at"] is None:
                continue
            age = (day - invoice["issued_at"].date()).days
            customer = store.customers[invoice["customer_id"]]
            row = groups.setdefault(
                customer["id"],
                {
                    "customer_id": customer["id"],
                    "customer_name": customer["name"],
                    "tax_id": customer["tax_id"],
                    "open_invoices": 0,
                    "days_0_30": 0.0,
                    "days_31_60": 0.0,
                    "days_61_90": 0.0,
                    "days_over_90": 0.0,
                    "balance": 0.0,
                    "oldest_days": 0,
                },
            )
            if age <= 30:
                bucket = "days_0_30"
            elif age <= 60:
                bucket = "days_31_60"
            elif age <= 90:
                bucket = "days_61_90"
            else:
                bucket = "days_over_90"
            row[bucket] += invoice["total"]
            row["balance"] += invoice["total"]
            row["open_invoices"] += 1
            row["oldest_days"] = max(row["oldest_days"], age)
        return sorted(groups.values(), key=lambda r: -r["balance"])

    # --- sp_fiscal_closing -------------------------------------------------------
    def run_fiscal_closing(period_type, day, user_id):
        if day > utcnow().date():
            raise BusinessRuleError("Closing date cannot be in the future")
        start = day if period_type == "DAY" else day.replace(day=1)
        if period_type == "DAY":
            end = start + datetime.timedelta(days=1)
        else:
            end = (start + datetime.timedelta(days=32)).replace(day=1)

        def in_period(value):
            return value is not None and start <= value.date() < end

        issued = [i for i in store.invoices.values() if i["status"] in ("ISSUED", "PAID") and in_period(i["issued_at"])]
        key = (period_type, start)
        previous = store.closings.get(key)
        row = {
            "id": previous["id"] if previous else len(store.closings) + 1,
            "period_type": period_type,
            "period_start": start,
            "period_end": end,
            "invoice_count": len(issued),
            "cancelled_count": sum(
                1 for i in store.invoices.values() if i["status"] == "CANCELLED" and in_period(i["cancelled_at"])
            ),
            "subtotal": round2(sum(i["subtotal"] for i in issued)),
            "discount_total": round2(sum(i.get("discount_total", 0) for i in issued)),
            "tax_total": round2(sum(i["tax_total"] for i in issued)),
            "withholding_total": round2(sum(i.get("withholding_total", 0) for i in issued)),
            "total": round2(sum(i["total"] for i in issued)),
            "collected_total": round2(sum(p["amount"] for p in store.payments.values() if in_period(p["paid_at"]))),
            "closed_by": user_id,
            "closed_at": utcnow(),
        }
        store.closings[key] = row
        return dict(row)

    def list_fiscal_closings():
        return sorted((dict(r) for r in store.closings.values()), key=lambda r: r["period_start"], reverse=True)

    # --- sp_build_stamp_payload --------------------------------------------------
    def stamp_payload(invoice_id):
        invoice = _invoice_or_fail(invoice_id)
        if invoice["status"] not in ("ISSUED", "PAID"):
            raise BusinessRuleError("Only issued or paid invoices can be stamped")
        return json.dumps(
            {
                "Version": "4.0",
                "Folio": invoice["folio"],
                "UUID": invoice["uuid"],
                "Receptor": {"Rfc": invoice["receiver_tax_id"], "Nombre": invoice["receiver_name"]},
                "SubTotal": invoice["subtotal"],
                "Total": invoice["total"],
            }
        )

    def list_accounting_entries(invoice_id):
        return [
            {
                "id": index + 1,
                "entry_type": entry["entry_type"],
                "account": "ACCOUNTS_RECEIVABLE",
                "debit": 0,
                "credit": 0,
                "created_at": utcnow(),
            }
            for index, entry in enumerate(store.ledger)
            if entry["invoice_id"] == invoice_id
        ]

    # --- sp_change_tax_rate (PostgreSQL) -----------------------------------------
    def change_tax_rate(tax_id, rate, valid_from, user_id):
        if tax_id not in store.taxes:
            raise BusinessRuleError("Tax not found")
        open_rows = [r for r in store.tax_history if r["tax_id"] == tax_id and r["valid_to"] is None]
        if open_rows:
            open_from = open_rows[0]["valid_from"]
            if valid_from <= open_from:
                raise BusinessRuleError(f"The new rate must start after {open_from.isoformat()}")
            for row in open_rows:
                row["valid_to"] = valid_from
        store.tax_history.append(
            {
                "id": store._next("txh"),
                "tax_id": tax_id,
                "rate": rate,
                "valid_from": valid_from,
                "valid_to": None,
                "changed_by": user_id,
            }
        )
        today = utcnow().date()
        for row in store.tax_history:
            if row["tax_id"] == tax_id and row["valid_from"] <= today and (
                row["valid_to"] is None or today < row["valid_to"]
            ):
                store.taxes[tax_id]["current_rate"] = row["rate"]

    # --- sp_update_service_price (PostgreSQL) ------------------------------------
    def update_service_price(service_id, price, user_id, reason):
        service = store.services.get(service_id)
        if service is None:
            raise BusinessRuleError("Service not found")
        store.price_history.append(
            {
                "id": len(store.price_history) + 1,
                "service_id": service_id,
                "old_price": service["base_price"],
                "new_price": price,
                "change_pct": None,
                "reason": reason,
                "changed_by": user_id,
                "changed_at": utcnow(),
            }
        )
        service["base_price"] = price

    def service_price_history(service_id):
        rows = [dict(r) for r in store.price_history if r["service_id"] == service_id]
        return sorted(rows, key=lambda r: r["id"], reverse=True)

    # --- sp_bulk_assign_features (PostgreSQL) ------------------------------------
    def bulk_assign_features(service_ids, feature_ids, value):
        if any(sid not in store.services for sid in service_ids):
            raise BusinessRuleError("Service not found")
        if any(fid not in store.features for fid in feature_ids):
            raise BusinessRuleError("Feature not found")
        affected = 0
        for sid in set(service_ids):
            items = store.service_features.setdefault(sid, [])
            current = {item["feature_id"]: item for item in items}
            for fid in set(feature_ids):
                if fid in current:
                    current[fid]["value"] = value
                else:
                    items.append({"feature_id": fid, "value": value})
                affected += 1
        return affected

    for function in (
        calculate_invoice_totals,
        issue_invoice,
        cancel_invoice,
        register_payment,
        validate_payment_status,
        aging_report,
        run_fiscal_closing,
        list_fiscal_closings,
        stamp_payload,
        list_accounting_entries,
        change_tax_rate,
        update_service_price,
        service_price_history,
        bulk_assign_features,
    ):
        monkeypatch.setattr(repos, function.__name__, function)
