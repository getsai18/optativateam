"""Genera historial de facturas usando los Stored Procedures (semilla fija).

    python database/seed/seed_invoices.py            # crea facturas si hay menos de 100
    python database/seed/seed_invoices.py --count 200

Por cada factura: inserta el borrador con líneas e impuestos copiados del catálogo
(PostgreSQL), y luego llama a sp_issue_invoice, sp_register_payment o sp_cancel_invoice
según el estado elegido. Después ajusta las fechas para repartirlas en los últimos
6 meses y ejecuta sp_fiscal_closing para cada mes y para los últimos 7 días.
Requiere haber aplicado: python database/apply.py --seed
"""

from __future__ import annotations

import argparse
import datetime as dt
import random
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from apply import load_env  # noqa: E402

rng = random.Random(42)
REASONS = ["Error en datos del receptor", "Servicio no prestado", "Duplicada por error", "Cambio de RFC del cliente"]


def connect(env):
    import psycopg
    import pymysql

    my = pymysql.connect(
        host=env["BILLING_DB_HOST"], port=int(env.get("BILLING_DB_PORT", "3306")),
        user=env["BILLING_DB_USER"], password=env["BILLING_DB_PASSWORD"], database=env["BILLING_DB_NAME"],
        ssl={"ssl": {}}, autocommit=True, cursorclass=pymysql.cursors.DictCursor,
    )
    pg = psycopg.connect(
        host=env["CATALOG_DB_HOST"], port=int(env.get("CATALOG_DB_PORT", "5432")),
        user=env["CATALOG_DB_USER"], password=env["CATALOG_DB_PASSWORD"], dbname=env["CATALOG_DB_NAME"],
        sslmode="require",
    )
    return my, pg


def call(cur, sql, args=()):
    cur.execute(sql, args)
    rows = cur.fetchall()
    while cur.nextset():
        pass
    return rows


def load_catalog(pg):
    with pg.cursor() as cur:
        cur.execute("SELECT id, name, base_price, category FROM service WHERE active = 1 AND base_price > 100")
        services = [dict(zip(("id", "name", "price", "category"), r)) for r in cur.fetchall()]
        cur.execute("""SELECT st.service_id, t.id, t.code, t.name, t.kind, t.current_rate
                         FROM service_tax st JOIN tax t ON t.id = st.tax_id WHERE t.active = 1""")
        taxes: dict[int, list[dict]] = {}
        for sid, tid, code, name, kind, rate in cur.fetchall():
            taxes.setdefault(sid, []).append({"id": tid, "code": code, "name": name, "kind": kind, "rate": rate})
    pg.rollback()
    return services, taxes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=150)
    args = parser.parse_args()

    my, pg = connect(load_env())
    cur = my.cursor()
    cur.execute("SELECT COUNT(*) AS n FROM invoice")
    if cur.fetchone()["n"] >= 100:
        print("Ya hay 100 o más facturas; no se genera historial.")
        return

    services, taxes = load_catalog(pg)
    cur.execute("SELECT id, name, tax_id, address FROM customer WHERE active = 1")
    customers = cur.fetchall()
    cur.execute("SELECT id FROM app_user WHERE active = 1 AND role IN ('ADMIN', 'BILLER')")
    users = [r["id"] for r in cur.fetchall()]
    cur.execute("SELECT id FROM issuer WHERE active = 1 ORDER BY id LIMIT 1")
    issuer = cur.fetchone()
    if not (services and customers and users and issuer):
        sys.exit("Faltan servicios, clientes, usuarios o emisor. Corre primero: python database/apply.py --seed")

    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None, microsecond=0)
    dates = sorted(now - dt.timedelta(days=rng.uniform(0, 180)) for _ in range(args.count))
    stats = {"DRAFT": 0, "ISSUED": 0, "PAID": 0, "CANCELLED": 0}

    for when in dates:
        customer = rng.choice(customers)
        user = rng.choice(users)
        cur.execute(
            "INSERT INTO invoice (issuer_id, customer_id, created_by, receiver_name, receiver_tax_id,"
            " receiver_address, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (issuer["id"], customer["id"], user, customer["name"], customer["tax_id"], customer["address"], when),
        )
        invoice_id = cur.lastrowid
        for service in rng.sample(services, k=rng.randint(1, 4)):
            qty = rng.randint(1, 2) if service["price"] > 10000 else rng.randint(1, 12)
            cur.execute(
                "INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price,"
                " line_subtotal, line_total) VALUES (%s, %s, %s, %s, %s, 0, 0)",
                (invoice_id, service["id"], service["name"], qty, service["price"]),
            )
            detail_id = cur.lastrowid
            for tax in taxes.get(service["id"], []):
                cur.execute(
                    "INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, tax_code, tax_name, kind, rate, amount)"
                    " VALUES (%s, %s, %s, %s, %s, %s, 0)",
                    (detail_id, tax["id"], tax["code"], tax["name"], tax["kind"], tax["rate"]),
                )

        age_days = (now - when).days
        roll = rng.random()
        if roll < 0.05:
            call(cur, "CALL sp_calculate_invoice_totals(%s)", (invoice_id,))
            stats["DRAFT"] += 1
            continue

        call(cur, "CALL sp_issue_invoice(%s, %s)", (invoice_id, user))
        cur.execute("UPDATE invoice SET issued_at = %s WHERE id = %s", (when, invoice_id))
        cur.execute("UPDATE accounting_entry SET created_at = %s WHERE invoice_id = %s", (when, invoice_id))

        if roll < 0.13:
            cancelled_at = min(now, when + dt.timedelta(days=rng.randint(0, 5), hours=rng.randint(1, 8)))
            call(cur, "CALL sp_cancel_invoice(%s, %s, %s)", (invoice_id, rng.choice(REASONS), user))
            cur.execute("UPDATE invoice SET cancelled_at = %s WHERE id = %s", (cancelled_at, invoice_id))
            cur.execute("UPDATE accounting_entry SET created_at = %s WHERE invoice_id = %s AND entry_type = 'REVERSAL'",
                        (cancelled_at, invoice_id))
            stats["CANCELLED"] += 1
            continue

        # Mientras más vieja la factura, más probable que ya esté pagada
        if rng.random() < min(0.92, 0.25 + age_days / 120):
            paid_at = min(now, when + dt.timedelta(days=rng.randint(1, 45), hours=rng.randint(0, 12)))
            cur.execute("SELECT total FROM invoice WHERE id = %s", (invoice_id,))
            total = cur.fetchone()["total"]
            call(cur, "CALL sp_register_payment(%s, %s, %s, NULL, %s)",
                 (invoice_id, rng.choice(["CARD", "TRANSFER", "TRANSFER", "CASH"]), Decimal(total), user))
            cur.execute("UPDATE invoice SET paid_at = %s WHERE id = %s", (paid_at, invoice_id))
            cur.execute("UPDATE payment SET paid_at = %s WHERE invoice_id = %s", (paid_at, invoice_id))
            cur.execute("UPDATE accounting_entry SET created_at = %s WHERE invoice_id = %s AND entry_type = 'PAYMENT'",
                        (paid_at, invoice_id))
            stats["PAID"] += 1
        else:
            stats["ISSUED"] += 1

    closer = users[0]
    month = dt.date(dates[0].year, dates[0].month, 1)
    while month <= now.date():
        call(cur, "CALL sp_fiscal_closing('MONTH', %s, %s)", (month, closer))
        month = (month + dt.timedelta(days=32)).replace(day=1)
    for back in range(1, 8):
        call(cur, "CALL sp_fiscal_closing('DAY', %s, %s)", (now.date() - dt.timedelta(days=back), closer))

    my.close()
    pg.close()
    print(f"OK: {sum(stats.values())} facturas {stats}; cierres mensuales y de los últimos 7 días generados.")


if __name__ == "__main__":
    main()
