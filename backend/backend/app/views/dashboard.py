from flask import Blueprint, jsonify

from .. import auth, db, repos
from ..domain import MONTH_LABELS, iso_ms, round2, utcnow
from ..serializers import invoices_json
from .common import issuer_row

bp = Blueprint("dashboard", __name__)

_STATUS_ORDER = ("DRAFT", "ISSUED", "PAID", "CANCELLED")


@bp.get("/dashboard")
@auth.require_role("ADMIN", "BILLER")
def dashboard():
    rows = repos.list_invoices()

    def of(status: str) -> list[dict]:
        return [row for row in rows if row["status"] == status]

    def amount(subset: list[dict]) -> float:
        return round2(sum(db.to_number(row["total"]) for row in subset))

    by_status = [
        {"status": status, "count": len(of(status)), "amount": amount(of(status))}
        for status in _STATUS_ORDER
    ]

    now = utcnow()
    months = []
    for i in range(6):
        month_index = now.month - (5 - i)
        year = now.year + (month_index - 1) // 12
        month = (month_index - 1) % 12 + 1
        months.append({"key": f"{year:04d}-{month:02d}", "label": MONTH_LABELS[month - 1]})

    monthly = []
    for month in months:
        invoiced_rows = [
            row
            for row in rows
            if row["issued_at"] and row["status"] != "CANCELLED" and iso_ms(row["issued_at"])[:7] == month["key"]
        ]
        collected_rows = [
            row for row in rows if row["paid_at"] and iso_ms(row["paid_at"])[:7] == month["key"]
        ]
        monthly.append(
            {
                "key": month["key"],
                "label": month["label"],
                "invoiced": amount(invoiced_rows),
                "collected": amount(collected_rows),
            }
        )

    recent_rows = sorted(
        rows,
        key=lambda row: iso_ms(row["issued_at"] or row["created_at"]),
        reverse=True,
    )[:8]

    return jsonify(
        {
            "totalInvoiced": round2(amount(of("ISSUED")) + amount(of("PAID"))),
            "paid": amount(of("PAID")),
            "pending": amount(of("ISSUED")),
            "cancelled": amount(of("CANCELLED")),
            "drafts": len(of("DRAFT")),
            "byStatus": by_status,
            "monthly": monthly,
            "recent": invoices_json(recent_rows, issuer_row()),
        }
    )
