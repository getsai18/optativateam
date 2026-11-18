import datetime

from flask import current_app

from . import db as database


def _conn() -> database.Connection:
    """Base de facturación (MySQL): usuarios, clientes, emisor, facturas, pagos, folios."""
    return database.get_conn(current_app.config, database.BILLING)


def _catalog() -> database.Connection:
    """Base de catálogo (Postgres): impuestos, historial, servicios y características."""
    return database.get_conn(current_app.config, database.CATALOG)


def _flag(value) -> str:
    """Booleano como texto '1'/'0': Postgres lo convierte al tipo de la columna (BOOLEAN o SMALLINT)."""
    return "1" if value else "0"


def _in_clause(prefix: str, values: list[int]) -> tuple[str, dict]:
    params = {f"{prefix}{i}": int(v) for i, v in enumerate(values)}
    placeholders = ",".join(f":{prefix}{i}" for i in range(len(values)))
    return placeholders, params


def find_user_by_login(email: str) -> dict | None:
    return _conn().one("SELECT * FROM app_user WHERE LOWER(email) = LOWER(:email)", {"email": email})


def find_user(user_id: int) -> dict | None:
    return _conn().one("SELECT * FROM app_user WHERE id = :id", {"id": user_id})


def list_users() -> list[dict]:
    return _conn().all("SELECT * FROM app_user ORDER BY id")


def user_email_taken(email: str, exclude_id: int = 0) -> bool:
    row = _conn().one(
        "SELECT COUNT(*) AS c FROM app_user WHERE LOWER(email) = LOWER(:email) AND id <> :exclude_id",
        {"email": email, "exclude_id": exclude_id},
    )
    return bool(row and int(row["c"]) > 0)


def insert_user(email, password_hash, full_name, role, customer_id, active) -> int:
    return _conn().insert(
        "INSERT INTO app_user (email, password_hash, full_name, role, customer_id, active)"
        " VALUES (:email, :password_hash, :full_name, :role, :customer_id, :active)",
        {
            "email": email,
            "password_hash": password_hash,
            "full_name": full_name,
            "role": role,
            "customer_id": customer_id,
            "active": int(active),
        },
    )


def update_user(user_id, email, full_name, role, customer_id, active) -> int:
    return _conn().execute(
        "UPDATE app_user SET email = :email, full_name = :full_name, role = :role,"
        " customer_id = :customer_id, active = :active WHERE id = :id",
        {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": role,
            "customer_id": customer_id,
            "active": int(active),
        },
    )


def list_customers() -> list[dict]:
    return _conn().all("SELECT * FROM customer ORDER BY id")


def find_customer(customer_id: int) -> dict | None:
    return _conn().one("SELECT * FROM customer WHERE id = :id", {"id": customer_id})


def customer_tax_taken(tax_id: str, exclude_id: int = 0) -> bool:
    row = _conn().one(
        "SELECT COUNT(*) AS c FROM customer WHERE tax_id = :tax_id AND id <> :exclude_id",
        {"tax_id": tax_id, "exclude_id": exclude_id},
    )
    return bool(row and int(row["c"]) > 0)


def customer_email_taken(email: str, exclude_id: int = 0) -> bool:
    row = _conn().one(
        "SELECT COUNT(*) AS c FROM customer WHERE LOWER(email) = LOWER(:email) AND id <> :exclude_id",
        {"email": email, "exclude_id": exclude_id},
    )
    return bool(row and int(row["c"]) > 0)


def insert_customer(name, tax_id, email, phone, address, active) -> int:
    return _conn().insert(
        "INSERT INTO customer (name, tax_id, email, phone, address, active)"
        " VALUES (:name, :tax_id, :email, :phone, :address, :active)",
        {"name": name, "tax_id": tax_id, "email": email, "phone": phone, "address": address, "active": int(active)},
    )


def update_customer(customer_id, name, tax_id, email, phone, address, active) -> int:
    return _conn().execute(
        "UPDATE customer SET name = :name, tax_id = :tax_id, email = :email, phone = :phone,"
        " address = :address, active = :active WHERE id = :id",
        {
            "id": customer_id,
            "name": name,
            "tax_id": tax_id,
            "email": email,
            "phone": phone,
            "address": address,
            "active": int(active),
        },
    )


def get_issuer() -> dict | None:
    rows = _conn().all("SELECT * FROM issuer WHERE active = 1 ORDER BY id")
    return rows[0] if rows else None


def ensure_issuer(legal_name, tax_id, address) -> dict:
    existing = get_issuer()
    if existing:
        return existing
    issuer_id = _conn().insert(
        "INSERT INTO issuer (legal_name, tax_id, address, active) VALUES (:legal_name, :tax_id, :address, 1)",
        {"legal_name": legal_name, "tax_id": tax_id, "address": address},
    )
    return {"id": issuer_id, "legal_name": legal_name, "tax_id": tax_id, "address": address, "active": 1}


def list_taxes() -> list[dict]:
    return _catalog().all("SELECT * FROM tax ORDER BY id")


def find_tax(tax_id: int) -> dict | None:
    return _catalog().one("SELECT * FROM tax WHERE id = :id", {"id": tax_id})


def list_tax_history() -> list[dict]:
    return _catalog().all("SELECT * FROM tax_history ORDER BY tax_id, valid_from, id")


def tax_history_for(tax_id: int) -> list[dict]:
    return _catalog().all(
        "SELECT * FROM tax_history WHERE tax_id = :tax_id ORDER BY valid_from, id",
        {"tax_id": tax_id},
    )










def list_services() -> list[dict]:
    return _catalog().all("SELECT * FROM service ORDER BY id")


def find_service(service_id: int) -> dict | None:
    return _catalog().one("SELECT * FROM service WHERE id = :id", {"id": service_id})


def service_code_taken(code: str, exclude_id: int = 0) -> bool:
    row = _catalog().one(
        "SELECT COUNT(*) AS c FROM service WHERE LOWER(code) = LOWER(:code) AND id <> :exclude_id",
        {"code": code, "exclude_id": exclude_id},
    )
    return bool(row and int(row["c"]) > 0)


def insert_service(code, name, description, base_price, category, active) -> int:
    return _catalog().insert(
        "INSERT INTO service (code, name, description, base_price, category, active)"
        " VALUES (:code, :name, :description, :base_price, :category, :active)",
        {
            "code": code,
            "name": name,
            "description": description,
            "base_price": base_price,
            "category": category,
            "active": _flag(active),
        },
    )


def update_service(service_id, code, name, description, base_price, category, active) -> int:
    return _catalog().execute(
        "UPDATE service SET code = :code, name = :name, description = :description,"
        " base_price = :base_price, category = :category, active = :active WHERE id = :id",
        {
            "id": service_id,
            "code": code,
            "name": name,
            "description": description,
            "base_price": base_price,
            "category": category,
            "active": _flag(active),
        },
    )


def replace_service_taxes(service_id: int, tax_ids: list[int]) -> None:
    conn = _catalog()
    conn.execute("DELETE FROM service_tax WHERE service_id = :service_id", {"service_id": service_id})
    for tax_id in tax_ids:
        conn.execute(
            "INSERT INTO service_tax (service_id, tax_id) VALUES (:service_id, :tax_id)",
            {"service_id": service_id, "tax_id": tax_id},
        )


def list_service_tax_ids(service_id: int) -> list[int]:
    rows = _catalog().all("SELECT tax_id FROM service_tax WHERE service_id = :service_id ORDER BY tax_id", {"service_id": service_id})
    return [int(r["tax_id"]) for r in rows]


def service_tax_map(service_ids: list[int]) -> dict[int, list[int]]:
    if not service_ids:
        return {}
    placeholders, params = _in_clause("s", service_ids)
    rows = _catalog().all(
        f"SELECT service_id, tax_id FROM service_tax WHERE service_id IN ({placeholders}) ORDER BY service_id, tax_id",
        params,
    )
    mapping: dict[int, list[int]] = {}
    for row in rows:
        mapping.setdefault(int(row["service_id"]), []).append(int(row["tax_id"]))
    return mapping


def replace_service_features(service_id: int, features: list[tuple[int, str]]) -> None:
    conn = _catalog()
    conn.execute("DELETE FROM service_feature WHERE service_id = :service_id", {"service_id": service_id})
    for feature_id, value in features:
        conn.execute(
            "INSERT INTO service_feature (service_id, feature_id, value) VALUES (:service_id, :feature_id, :value)",
            {"service_id": service_id, "feature_id": feature_id, "value": value},
        )


def service_feature_map(service_ids: list[int]) -> dict[int, list[dict]]:
    if not service_ids:
        return {}
    placeholders, params = _in_clause("s", service_ids)
    rows = _catalog().all(
        f"SELECT service_id, feature_id, value FROM service_feature WHERE service_id IN ({placeholders})"
        " ORDER BY service_id, id",
        params,
    )
    mapping: dict[int, list[dict]] = {}
    for row in rows:
        mapping.setdefault(int(row["service_id"]), []).append(
            {"feature_id": int(row["feature_id"]), "value": row["value"]}
        )
    return mapping


def list_features() -> list[dict]:
    return _catalog().all("SELECT * FROM feature ORDER BY id")


def find_feature(feature_id: int) -> dict | None:
    return _catalog().one("SELECT * FROM feature WHERE id = :id", {"id": feature_id})


def feature_name_taken(name: str, exclude_id: int = 0) -> bool:
    row = _catalog().one(
        "SELECT COUNT(*) AS c FROM feature WHERE LOWER(name) = LOWER(:name) AND id <> :exclude_id",
        {"name": name, "exclude_id": exclude_id},
    )
    return bool(row and int(row["c"]) > 0)


def insert_feature(name, description, unit) -> int:
    return _catalog().insert(
        "INSERT INTO feature (name, description, unit) VALUES (:name, :description, :unit)",
        {"name": name, "description": description, "unit": unit},
    )


def update_feature(feature_id, name, description, unit) -> int:
    return _catalog().execute(
        "UPDATE feature SET name = :name, description = :description, unit = :unit WHERE id = :id",
        {"id": feature_id, "name": name, "description": description, "unit": unit},
    )


def feature_usage_count(feature_id: int) -> int:
    row = _catalog().one(
        "SELECT COUNT(*) AS c FROM service_feature WHERE feature_id = :feature_id",
        {"feature_id": feature_id},
    )
    return int(row["c"]) if row else 0


def delete_feature(feature_id: int) -> int:
    return _catalog().execute("DELETE FROM feature WHERE id = :id", {"id": feature_id})


def list_invoices() -> list[dict]:
    return _conn().all("SELECT * FROM invoice ORDER BY created_at DESC, id DESC")


def list_invoices_for_customer(customer_id: int) -> list[dict]:
    return _conn().all(
        "SELECT * FROM invoice WHERE customer_id = :customer_id AND status <> 'DRAFT'"
        " ORDER BY created_at DESC, id DESC",
        {"customer_id": customer_id},
    )


def find_invoice(invoice_id: int) -> dict | None:
    return _conn().one("SELECT * FROM invoice WHERE id = :id", {"id": invoice_id})


def find_invoice_for_update(invoice_id: int) -> dict | None:
    """Bloquea la fila hasta el commit: serializa emitir/pagar/cancelar/editar la misma factura."""
    return _conn().one("SELECT * FROM invoice WHERE id = :id FOR UPDATE", {"id": invoice_id})


def insert_invoice(issuer_id, customer_id, created_by, receiver_name, receiver_tax_id, receiver_address,
                   subtotal, tax_total, total, created_at: datetime.datetime) -> int:
    return _conn().insert(
        "INSERT INTO invoice (issuer_id, customer_id, created_by, status, receiver_name, receiver_tax_id,"
        " receiver_address, subtotal, tax_total, total, created_at) VALUES"
        " (:issuer_id, :customer_id, :created_by, 'DRAFT', :receiver_name, :receiver_tax_id,"
        " :receiver_address, :subtotal, :tax_total, :total, :created_at)",
        {
            "issuer_id": issuer_id,
            "customer_id": customer_id,
            "created_by": created_by,
            "receiver_name": receiver_name,
            "receiver_tax_id": receiver_tax_id,
            "receiver_address": receiver_address,
            "subtotal": subtotal,
            "tax_total": tax_total,
            "total": total,
            "created_at": created_at,
        },
    )


def update_invoice_draft(invoice_id, customer_id, receiver_name, receiver_tax_id, receiver_address,
                         subtotal, tax_total, total) -> int:
    return _conn().execute(
        "UPDATE invoice SET customer_id = :customer_id, receiver_name = :receiver_name,"
        " receiver_tax_id = :receiver_tax_id, receiver_address = :receiver_address,"
        " subtotal = :subtotal, tax_total = :tax_total, total = :total WHERE id = :id",
        {
            "id": invoice_id,
            "customer_id": customer_id,
            "receiver_name": receiver_name,
            "receiver_tax_id": receiver_tax_id,
            "receiver_address": receiver_address,
            "subtotal": subtotal,
            "tax_total": tax_total,
            "total": total,
        },
    )










def delete_invoice(invoice_id: int) -> int:
    conn = _conn()
    conn.execute("DELETE FROM invoice_detail_tax WHERE invoice_detail_id IN"
                 " (SELECT id FROM invoice_detail WHERE invoice_id = :invoice_id)", {"invoice_id": invoice_id})
    conn.execute("DELETE FROM invoice_detail WHERE invoice_id = :invoice_id", {"invoice_id": invoice_id})
    return conn.execute("DELETE FROM invoice WHERE id = :id", {"id": invoice_id})


def details_for(invoice_ids: list[int]) -> list[dict]:
    if not invoice_ids:
        return []
    placeholders, params = _in_clause("i", invoice_ids)
    return _conn().all(
        f"SELECT * FROM invoice_detail WHERE invoice_id IN ({placeholders}) ORDER BY invoice_id, id",
        params,
    )


def detail_taxes_for(detail_ids: list[int]) -> list[dict]:
    if not detail_ids:
        return []
    placeholders, params = _in_clause("d", detail_ids)
    # `tax` vive en otra base: el código sale del snapshot guardado en la propia línea.
    return _conn().all(
        f"SELECT d.invoice_detail_id, d.tax_id, d.rate, d.amount, d.tax_code AS code, d.kind"
        f" FROM invoice_detail_tax d WHERE d.invoice_detail_id IN ({placeholders}) ORDER BY d.id",
        params,
    )


def delete_details(invoice_id: int) -> None:
    conn = _conn()
    conn.execute(
        "DELETE FROM invoice_detail_tax WHERE invoice_detail_id IN"
        " (SELECT id FROM invoice_detail WHERE invoice_id = :invoice_id)",
        {"invoice_id": invoice_id},
    )
    conn.execute("DELETE FROM invoice_detail WHERE invoice_id = :invoice_id", {"invoice_id": invoice_id})


def insert_detail(invoice_id, service_id, service_name, quantity, unit_price,
                  line_subtotal, tax_amount, line_total) -> int:
    return _conn().insert(
        "INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price,"
        " line_subtotal, tax_amount, line_total) VALUES (:invoice_id, :service_id, :service_name,"
        " :quantity, :unit_price, :line_subtotal, :tax_amount, :line_total)",
        {
            "invoice_id": invoice_id,
            "service_id": service_id,
            "service_name": service_name,
            "quantity": quantity,
            "unit_price": unit_price,
            "line_subtotal": line_subtotal,
            "tax_amount": tax_amount,
            "line_total": line_total,
        },
    )


def insert_detail_tax(detail_id, tax_id, rate, amount, tax_code, tax_name, kind="TRANSFER") -> int:
    return _conn().insert(
        "INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, tax_code, tax_name, kind, rate, amount)"
        " VALUES (:detail_id, :tax_id, :tax_code, :tax_name, :kind, :rate, :amount)",
        {
            "detail_id": detail_id,
            "tax_id": tax_id,
            "tax_code": tax_code,
            "tax_name": tax_name,
            "kind": kind,
            "rate": rate,
            "amount": amount,
        },
    )




def delete_detail_taxes(detail_id: int) -> None:
    _conn().execute("DELETE FROM invoice_detail_tax WHERE invoice_detail_id = :detail_id", {"detail_id": detail_id})




def list_payments(invoice_id: int) -> list[dict]:
    return _conn().all("SELECT * FROM payment WHERE invoice_id = :invoice_id ORDER BY id", {"invoice_id": invoice_id})


def count_payments(invoice_id: int) -> int:
    row = _conn().one("SELECT COUNT(*) AS c FROM payment WHERE invoice_id = :invoice_id", {"invoice_id": invoice_id})
    return int(row["c"]) if row else 0




# -----------------------------------------------------------------------------
# Stored Procedures de facturación (MySQL). Los SPs manejan su propia transacción,
# bloquean la factura (SELECT ... FOR UPDATE) y señalan reglas de negocio con SIGNAL,
# que llega aquí como db.BusinessRuleError.
# -----------------------------------------------------------------------------


def calculate_invoice_totals(invoice_id: int) -> None:
    """sp_calculate_invoice_totals: subtotal, descuento, IVA trasladado, retenciones y total."""
    _conn().call("CALL sp_calculate_invoice_totals(:id)", {"id": invoice_id})


def issue_invoice(invoice_id: int, user_id: int) -> dict:
    """sp_issue_invoice: recalcula, asigna folio atómico + UUID y registra el asiento contable."""
    rows = _conn().call("CALL sp_issue_invoice(:id, :user_id)", {"id": invoice_id, "user_id": user_id})
    return rows[0]


def cancel_invoice(invoice_id: int, reason: str, user_id: int) -> dict:
    """sp_cancel_invoice: cancelación formal con reversión contable si estaba emitida."""
    rows = _conn().call(
        "CALL sp_cancel_invoice(:id, :reason, :user_id)", {"id": invoice_id, "reason": reason, "user_id": user_id}
    )
    return rows[0]


def register_payment(invoice_id: int, method: str, amount, reference: str | None, user_id: int) -> dict:
    """sp_register_payment: valida estado y monto, registra el pago y marca la factura PAID."""
    rows = _conn().call(
        "CALL sp_register_payment(:id, :method, :amount, :reference, :user_id)",
        {"id": invoice_id, "method": method, "amount": amount, "reference": reference, "user_id": user_id},
    )
    return rows[0]


def validate_payment_status(invoice_id: int | None = None) -> list[dict]:
    """sp_validate_payment_status: inconsistencias entre invoice y payment."""
    return _conn().call("CALL sp_validate_payment_status(:id)", {"id": invoice_id})


def aging_report(as_of: datetime.date | None) -> list[dict]:
    """sp_aging_report: saldo pendiente por cliente en tramos de 0-30, 31-60, 61-90 y +90 días."""
    return _conn().call("CALL sp_aging_report(:as_of)", {"as_of": as_of})


def run_fiscal_closing(period_type: str, day: datetime.date, user_id: int) -> dict:
    """sp_fiscal_closing: cierre y consolidado fiscal del día o mes de `day`."""
    rows = _conn().call(
        "CALL sp_fiscal_closing(:period_type, :day, :user_id)",
        {"period_type": period_type, "day": day, "user_id": user_id},
    )
    return rows[0]


def list_fiscal_closings() -> list[dict]:
    return _conn().all("SELECT * FROM fiscal_closing ORDER BY period_start DESC, period_type")


def stamp_payload(invoice_id: int) -> str:
    """sp_build_stamp_payload: JSON con la estructura del comprobante (CFDI 4.0)."""
    rows = _conn().call("CALL sp_build_stamp_payload(:id)", {"id": invoice_id})
    return rows[0]["payload"]


def list_accounting_entries(invoice_id: int) -> list[dict]:
    return _conn().all(
        "SELECT * FROM accounting_entry WHERE invoice_id = :id ORDER BY id", {"id": invoice_id}
    )


# -----------------------------------------------------------------------------
# Stored Procedures del catálogo (PostgreSQL). No hacen COMMIT: lo hace la vista.
# -----------------------------------------------------------------------------


def change_tax_rate(tax_id: int, rate: float, valid_from: datetime.date, user_id: int) -> None:
    """sp_change_tax_rate: cierra el periodo abierto, abre el nuevo y ajusta la tasa vigente."""
    _catalog().call(
        "CALL sp_change_tax_rate(CAST(:tax_id AS INTEGER), CAST(:rate AS NUMERIC), CAST(:valid_from AS DATE),"
        " CAST(:user_id AS INTEGER), NULL)",
        {"tax_id": tax_id, "rate": rate, "valid_from": valid_from, "user_id": user_id},
    )


def update_service_price(service_id: int, price: float, user_id: int, reason: str | None) -> None:
    """sp_update_service_price: cambio de tarifa auditado en service_price_history."""
    _catalog().call(
        "CALL sp_update_service_price(CAST(:service_id AS INTEGER), CAST(:price AS NUMERIC),"
        " CAST(:user_id AS INTEGER), CAST(:reason AS VARCHAR), NULL)",
        {"service_id": service_id, "price": price, "user_id": user_id, "reason": reason},
    )


def bulk_assign_features(service_ids: list[int], feature_ids: list[int], value: str) -> int:
    """sp_bulk_assign_features: asigna cada característica a cada servicio (upsert)."""
    rows = _catalog().call(
        "CALL sp_bulk_assign_features(CAST(:service_ids AS INTEGER[]), CAST(:feature_ids AS INTEGER[]),"
        " CAST(:value AS VARCHAR), NULL)",
        {"service_ids": service_ids, "feature_ids": feature_ids, "value": value},
    )
    return int(rows[0]["p_affected"]) if rows else 0


def service_price_history(service_id: int) -> list[dict]:
    return _catalog().all(
        "SELECT * FROM service_price_history WHERE service_id = :id ORDER BY changed_at DESC, id DESC",
        {"id": service_id},
    )


_LABEL_SOURCES = {
    "invoice": ("invoice", "COALESCE(folio, 'Draft invoice')"),
    "customer": ("customer", "name"),
    "service": ("service", "name"),
    "feature": ("feature", "name"),
    "user": ("app_user", "full_name"),
    "tax": ("tax", "code"),
}


_CATALOG_KINDS = ("service", "feature", "tax")


def fetch_labels(kind: str, db_ids: list[int]) -> dict[int, str]:
    if not db_ids or kind not in _LABEL_SOURCES:
        return {}
    table, expression = _LABEL_SOURCES[kind]
    placeholders, params = _in_clause("l", db_ids)
    conn = _catalog() if kind in _CATALOG_KINDS else _conn()
    rows = conn.all(
        f"SELECT id, {expression} AS label FROM {table} WHERE id IN ({placeholders})",
        params,
    )
    return {int(row["id"]): row["label"] for row in rows}


def decode_or_none(prefix: str, value: str) -> int | None:
    from .domain import decode_id

    try:
        return decode_id(prefix, value)
    except ValueError:
        return None
