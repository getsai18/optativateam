"""Activa las tasas de impuesto programadas (EventBridge, una vez al día).

POST /taxes/{id}/rates con validFrom futuro deja la tasa "programada" en tax_history.
Esta Lambda llama al Stored Procedure sp_sync_tax_rates (PostgreSQL), que pone en
tax.current_rate la tasa vigente a la fecha (valid_from <= hoy < valid_to, UTC).

Variables de entorno: CATALOG_DB_HOST, CATALOG_DB_PORT, CATALOG_DB_NAME,
CATALOG_DB_USER, CATALOG_DB_PASSWORD. Conexión con TLS (sslmode=require).
Prueba manual: evento {"today": "2026-12-01"}.
"""

import datetime
import json
import os


def _connect():
    import psycopg

    return psycopg.connect(
        host=os.environ["CATALOG_DB_HOST"],
        port=int(os.environ.get("CATALOG_DB_PORT", "5432")),
        dbname=os.environ.get("CATALOG_DB_NAME", "postgres"),
        user=os.environ["CATALOG_DB_USER"],
        password=os.environ["CATALOG_DB_PASSWORD"],
        sslmode=os.environ.get("CATALOG_DB_SSLMODE", "require"),
        connect_timeout=10,
    )


def handler(event=None, _context=None):
    raw = (event or {}).get("today")
    today = datetime.date.fromisoformat(raw) if raw else datetime.datetime.now(datetime.timezone.utc).date()
    with _connect() as conn:
        row = conn.execute("CALL sp_sync_tax_rates(%s, NULL)", (today,)).fetchone()
        rates = conn.execute("SELECT code, current_rate FROM tax ORDER BY id").fetchall()
    result = {
        "today": today.isoformat(),
        "updated": int(row[0]) if row else 0,
        "rates": {code: float(rate) for code, rate in rates},
    }
    print(json.dumps(result))
    return result
