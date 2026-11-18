"""Aplica los scripts SQL de /database a los RDS (MySQL y PostgreSQL).

Lee las credenciales de backend/.env (BILLING_DB_* y CATALOG_DB_*). No guarda ni imprime
contraseñas. Conecta siempre con TLS.

Uso (desde la raíz del repo):
    python database/apply.py                 # extensiones + stored procedures (no destructivo)
    python database/apply.py --seed          # además, datos sintéticos (database/*/04_seed*.sql)
    python database/apply.py --fresh         # DESTRUCTIVO: recrea tablas desde 01_schema.sql
    python database/apply.py --only mysql    # solo una de las dos bases

Requiere: pip install pymysql "psycopg[binary]" python-dotenv
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT.parent / "backend" / ".env"

MYSQL_BASE = ["mysql/03_rubrica_ext.sql", "procedures/mysql_procedures.sql"]
POSTGRES_BASE = ["postgres/02_compat.sql", "postgres/03_rubrica_ext.sql", "procedures/postgres_procedures.sql"]
MYSQL_FRESH = ["mysql/01_schema.sql"]
POSTGRES_FRESH = ["postgres/01_schema.sql"]
MYSQL_SEED = sorted(str(p.relative_to(ROOT)).replace("\\", "/") for p in ROOT.glob("mysql/04_seed*.sql"))
POSTGRES_SEED = sorted(str(p.relative_to(ROOT)).replace("\\", "/") for p in ROOT.glob("postgres/04_seed*.sql"))


def load_env() -> dict[str, str]:
    from dotenv import dotenv_values

    if not ENV_FILE.exists():
        sys.exit(f"No existe {ENV_FILE}. Cópialo de backend/.env.example y llena las credenciales.")
    return {k: v for k, v in dotenv_values(ENV_FILE).items() if v is not None}


def split_mysql(script: str) -> list[str]:
    """Divide un script MySQL respetando DELIMITER (como el cliente mysql)."""
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


def _has_sql(text: str) -> bool:
    without_comments = re.sub(r"--[^\n]*", "", text)
    without_comments = re.sub(r"/\*.*?\*/", "", without_comments, flags=re.DOTALL)
    return bool(without_comments.strip())


def apply_mysql(env: dict[str, str], files: list[str]) -> None:
    import pymysql

    conn = pymysql.connect(
        host=env["BILLING_DB_HOST"],
        port=int(env.get("BILLING_DB_PORT", "3306")),
        user=env["BILLING_DB_USER"],
        password=env["BILLING_DB_PASSWORD"],
        database=env["BILLING_DB_NAME"],
        ssl={"ssl": {}},
        autocommit=True,
        connect_timeout=15,
    )
    try:
        with conn.cursor() as cur:
            for rel in files:
                statements = split_mysql((ROOT / rel).read_text(encoding="utf-8"))
                for statement in statements:
                    if re.match(r"^\s*(CREATE\s+DATABASE|USE)\b", statement, re.IGNORECASE):
                        continue  # la base ya viene de BILLING_DB_NAME
                    cur.execute(statement)
                    while cur.nextset():
                        pass
                print(f"  mysql    OK  {rel} ({len(statements)} sentencias)")
    finally:
        conn.close()


def apply_postgres(env: dict[str, str], files: list[str]) -> None:
    import psycopg

    conn = psycopg.connect(
        host=env["CATALOG_DB_HOST"],
        port=int(env.get("CATALOG_DB_PORT", "5432")),
        user=env["CATALOG_DB_USER"],
        password=env["CATALOG_DB_PASSWORD"],
        dbname=env["CATALOG_DB_NAME"],
        sslmode="require",
        connect_timeout=15,
    )
    try:
        for rel in files:
            with conn.transaction():
                conn.execute((ROOT / rel).read_text(encoding="utf-8"))
            print(f"  postgres OK  {rel}")
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fresh", action="store_true", help="recrea las tablas (borra datos de MySQL)")
    parser.add_argument("--seed", action="store_true", help="carga datos sintéticos")
    parser.add_argument("--only", choices=["mysql", "postgres"], help="aplica solo a una base")
    args = parser.parse_args()

    if args.fresh:
        answer = input("--fresh BORRA las tablas de facturación en MySQL. Escribe 'si' para continuar: ")
        if answer.strip().lower() != "si":
            sys.exit("Cancelado.")

    env = load_env()
    mysql_files = (MYSQL_FRESH if args.fresh else []) + MYSQL_BASE + (MYSQL_SEED if args.seed else [])
    pg_files = (POSTGRES_FRESH if args.fresh else []) + POSTGRES_BASE + (POSTGRES_SEED if args.seed else [])

    if args.only != "postgres":
        print(f"MySQL  -> {env['BILLING_DB_NAME']}")
        apply_mysql(env, mysql_files)
    if args.only != "mysql":
        print(f"Postgres -> {env['CATALOG_DB_NAME']}")
        apply_postgres(env, pg_files)
    print("Listo.")


if __name__ == "__main__":
    main()
