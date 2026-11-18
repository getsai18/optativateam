"""Pruebas de integración reales de los Stored Procedures (MySQL 8 y PostgreSQL 16).

NO se ejecutan en la suite local: requieren RUN_DB_INTEGRATION=1 y dos bases descartables
configuradas con BILLING_DB_* / CATALOG_DB_*. En CI (.github/workflows/tests.yml) se levantan
servicios mysql:8.4 y postgres:16, se aplica database/apply.py (MySQL) y este módulo carga
los scripts de procedures/ en ambos motores antes de correr las pruebas.

El esquema de MySQL se aplica con `python database/apply.py --fresh --only mysql` (01_schema.sql
es destructivo). El esquema de Postgres se aplica aquí porque es idempotente (CREATE ... IF
NOT EXISTS) y porque apply.py exige TLS mientras el servicio local de CI no lo ofrece.
"""

import os
import re
import threading
import uuid
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_DB_INTEGRATION") != "1",
    reason="Requiere RUN_DB_INTEGRATION=1 y MySQL/Postgres disponibles (ver .github/workflows/tests.yml)",
)

ROOT = Path(__file__).resolve().parents[2] / "database"


def _mysql_config() -> dict:
    return {
        "host": os.getenv("BILLING_DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("BILLING_DB_PORT", "3306")),
        "user": os.getenv("BILLING_DB_USER", "billing"),
        "password": os.getenv("BILLING_DB_PASSWORD", ""),
        "database": os.getenv("BILLING_DB_NAME", "Facturacion_Mysql"),
    }


def _postgres_config() -> dict:
    return {
        "host": os.getenv("CATALOG_DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("CATALOG_DB_PORT", "5432")),
        "user": os.getenv("CATALOG_DB_USER", "catalog"),
        "password": os.getenv("CATALOG_DB_PASSWORD", ""),
        "dbname": os.getenv("CATALOG_DB_NAME", "catalog_db"),
    }


def _connect_mysql():
    import pymysql

    return pymysql.connect(charset="utf8mb4", autocommit=True, connect_timeout=5, **_mysql_config())


def _has_sql(text: str) -> bool:
    without_comments = re.sub(r"--[^\n]*", "", text)
    without_comments = re.sub(r"/\*.*?\*/", "", without_comments, flags=re.DOTALL)
    return bool(without_comments.strip())


def _mysql_statements(script: str) -> list[str]:
    """Divide respetando DELIMITER (igual que database/apply.py)."""
    statements: list[str] = []
    delimiter = ";"
    buffer: list[str] = []
    for line in script.splitlines():
        match = re.match(r"^\s*DELIMITER\s+(\S+)\s*$", line, re.IGNORECASE)
        if match:
            delimiter = match.group(1)
            continue
        buffer.append(line)
        joined = "\n".join(buffer).rstrip()
        if joined.endswith(delimiter):
            statement = joined[: -len(delimiter)].strip()
            if _has_sql(statement):
                statements.append(statement)
            buffer = []
    tail = "\n".join(buffer).strip()
    if _has_sql(tail):
        statements.append(tail)
    return statements


def _call(cursor, sql: str, params=()) -> list[tuple]:
    """Ejecuta un CALL y devuelve todas las filas de todos sus conjuntos de resultados."""
    cursor.execute(sql, params)
    rows: list[tuple] = []
    while True:
        if cursor.description is not None:
            rows.extend(cursor.fetchall())
        if not cursor.nextset():
            break
    return rows


@pytest.fixture(scope="module")
def mysql_conn():
    conn = _connect_mysql()
    yield conn
    conn.close()


@pytest.fixture(scope="module")
def postgres_conn():
    import psycopg

    conn = psycopg.connect(
        sslmode=os.getenv("CATALOG_DB_SSLMODE", "prefer"), connect_timeout=5, **_postgres_config()
    )
    yield conn
    conn.close()


@pytest.fixture(scope="module", autouse=True)
def _load_scripts(mysql_conn, postgres_conn):
    """Carga los SPs de ambos motores (y el esquema idempotente de Postgres)."""
    for rel in ("mysql/03_rubrica_ext.sql", "procedures/mysql_procedures.sql"):
        with mysql_conn.cursor() as cur:
            for statement in _mysql_statements((ROOT / rel).read_text(encoding="utf-8")):
                if re.match(r"^\s*(CREATE\s+DATABASE|USE)\b", statement, re.IGNORECASE):
                    continue
                cur.execute(statement)
                while cur.nextset():
                    pass
    for rel in (
        "postgres/01_schema.sql",
        "postgres/02_compat.sql",
        "postgres/03_rubrica_ext.sql",
        "procedures/postgres_procedures.sql",
    ):
        postgres_conn.execute((ROOT / rel).read_text(encoding="utf-8"))


@pytest.fixture()
def issued_invoice(mysql_conn):
    """Mínima factura ISSUED con sus FKs, para pagos y cancelaciones."""
    suffix = uuid.uuid4().hex[:10]
    with mysql_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO issuer (legal_name, tax_id, address) VALUES (%s, %s, %s)",
            (f"Issuer {suffix}", f"IS{suffix}", "Calle 1"),
        )
        issuer_id = cur.lastrowid
        cur.execute(
            "INSERT INTO app_user (email, password_hash, full_name, role) VALUES (%s, %s, %s, %s)",
            (f"sp-{suffix}@test.local", "x", "SP User", "ADMIN"),
        )
        user_id = cur.lastrowid
        cur.execute(
            "INSERT INTO customer (name, tax_id, email, address) VALUES (%s, %s, %s, %s)",
            (f"Customer {suffix}", f"CUS{suffix}", f"c-{suffix}@test.local", "Calle 2"),
        )
        customer_id = cur.lastrowid
        cur.execute(
            """INSERT INTO invoice
               (issuer_id, customer_id, created_by, status, receiver_name, receiver_tax_id,
                receiver_address, subtotal, tax_total, total, issued_at)
               VALUES (%s, %s, %s, 'ISSUED', %s, %s, %s, 100.00, 0.00, 100.00, UTC_TIMESTAMP())""",
            (issuer_id, customer_id, user_id, f"Receiver {suffix}", f"R{suffix}", "Calle 3"),
        )
        invoice_id = cur.lastrowid
    yield invoice_id, user_id
    with mysql_conn.cursor() as cur:
        cur.execute("DELETE FROM accounting_entry WHERE invoice_id = %s", (invoice_id,))
        cur.execute("DELETE FROM payment WHERE invoice_id = %s", (invoice_id,))
        cur.execute("DELETE FROM invoice WHERE id = %s", (invoice_id,))
        cur.execute("DELETE FROM customer WHERE id = %s", (customer_id,))
        cur.execute("DELETE FROM app_user WHERE id = %s", (user_id,))
        cur.execute("DELETE FROM issuer WHERE id = %s", (issuer_id,))


def test_mysql_procedures_loaded(mysql_conn):
    with mysql_conn.cursor() as cur:
        cur.execute(
            """SELECT COUNT(*) FROM information_schema.routines
               WHERE routine_schema = DATABASE()
                 AND routine_name IN ('sp_next_folio', 'sp_register_payment', 'sp_cancel_invoice')"""
        )
        assert cur.fetchone()[0] == 3


def test_postgres_procedures_loaded(postgres_conn):
    rows = postgres_conn.execute(
        """SELECT proname FROM pg_proc
           WHERE proname IN ('sp_sync_tax_rates', 'sp_change_tax_rate', 'sp_bulk_assign_features')"""
    ).fetchall()
    assert {row[0] for row in rows} == {"sp_sync_tax_rates", "sp_change_tax_rate", "sp_bulk_assign_features"}


def test_sp_next_folio_is_sequential(mysql_conn):
    year = 2098
    with mysql_conn.cursor() as cur:
        cur.execute("DELETE FROM folio_counter WHERE year = %s", (year,))
        for number in (1, 2, 3):
            _call(cur, "CALL sp_next_folio(%s, @folio)", (year,))
            cur.execute("SELECT @folio")
            assert cur.fetchone()[0] == f"INV-{year}-{number:04d}"
        cur.execute("SELECT last_number FROM folio_counter WHERE year = %s", (year,))
        assert cur.fetchone()[0] == 3
        cur.execute("DELETE FROM folio_counter WHERE year = %s", (year,))


def test_sp_next_folio_with_two_concurrent_connections():
    """Dos hilos pidiendo folio no pueden obtener el mismo número."""
    year = 2099
    conn = _connect_mysql()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM folio_counter WHERE year = %s", (year,))
    conn.close()

    barrier = threading.Barrier(2)
    results: list[str] = []
    errors: list[Exception] = []

    def worker():
        current = _connect_mysql()
        try:
            with current.cursor() as cur:
                barrier.wait(timeout=10)
                _call(cur, "CALL sp_next_folio(%s, @folio)", (year,))
                cur.execute("SELECT @folio")
                results.append(cur.fetchone()[0])
        except Exception as exc:  # se reporta al hilo principal
            errors.append(exc)
        finally:
            current.close()

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)

    assert not errors, errors
    assert sorted(results) == [f"INV-{year}-0001", f"INV-{year}-0002"]

    conn = _connect_mysql()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM folio_counter WHERE year = %s", (year,))
    conn.close()


def test_sp_register_payment_marks_invoice_paid(mysql_conn, issued_invoice):
    invoice_id, user_id = issued_invoice
    with mysql_conn.cursor() as cur:
        rows = _call(
            cur,
            "CALL sp_register_payment(%s, %s, %s, %s, %s)",
            (invoice_id, "TRANSFER", 100.00, "SIM-SP-TEST", user_id),
        )
        assert rows and rows[0][0] > 0
        cur.execute("SELECT status FROM invoice WHERE id = %s", (invoice_id,))
        assert cur.fetchone()[0] == "PAID"
        cur.execute("SELECT COUNT(*) FROM accounting_entry WHERE invoice_id = %s", (invoice_id,))
        assert cur.fetchone()[0] == 2

        with pytest.raises(Exception, match="already paid"):
            _call(cur, "CALL sp_register_payment(%s, %s, %s, %s, %s)", (invoice_id, "CASH", 100.00, "", user_id))


def test_sp_cancel_invoice_marks_cancelled(mysql_conn, issued_invoice):
    invoice_id, user_id = issued_invoice
    with mysql_conn.cursor() as cur:
        rows = _call(cur, "CALL sp_cancel_invoice(%s, %s, %s)", (invoice_id, "Motivo de prueba SP", user_id))
        assert rows and rows[0][2] == "CANCELLED"
        cur.execute("SELECT status, cancellation_reason FROM invoice WHERE id = %s", (invoice_id,))
        assert cur.fetchone() == ("CANCELLED", "Motivo de prueba SP")


def test_sp_sync_tax_rates_runs(postgres_conn):
    """El SP de Postgres se ejecuta sobre el catálogo cargado (sin datos aún)."""
    postgres_conn.execute("CALL sp_sync_tax_rates()")
