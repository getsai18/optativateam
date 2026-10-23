import datetime
import decimal
import re

from flask import g, has_app_context

_PARAM_PATTERN = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")

_ENGINES = ("mysql", "postgres", "oracle")
# Roles de conexión: "billing" (MySQL) y "catalog" (Postgres). Si no hay CATALOG_DB_HOST,
# "catalog" comparte la conexión de "billing".
BILLING = "billing"
CATALOG = "catalog"


class DuplicateKeyError(Exception):
    pass


def _filter_params(sql: str, params: dict | None) -> dict:
    if not params:
        return {}
    names = set(_PARAM_PATTERN.findall(sql))
    return {k: v for k, v in params.items() if k in names}


def _to_mysql_sql(sql: str) -> str:
    """:name -> %(name)s. Es el paramstyle `pyformat`, igual en PyMySQL y psycopg."""
    return _PARAM_PATTERN.sub(lambda m: f"%({m.group(1)})s", sql)


class Connection:
    def __init__(self, engine: str, raw):
        self.engine = engine
        self.raw = raw
        self.committed = False

    def _cursor(self):
        return self.raw.cursor()

    def _run(self, sql: str, params: dict | None, many: bool = False):
        bound = _filter_params(sql, params)
        cursor = self._cursor()
        try:
            if self.engine in ("mysql", "postgres"):
                cursor.execute(_to_mysql_sql(sql), bound)
            else:
                cursor.execute(sql, bound)
        except Exception as exc:
            cursor.close()
            if _is_duplicate(exc):
                raise DuplicateKeyError(str(exc)) from exc
            raise
        return cursor

    def all(self, sql: str, params: dict | None = None) -> list[dict]:
        cursor = self._run(sql, params)
        try:
            rows = cursor.fetchall()
            description = cursor.description
        finally:
            cursor.close()
        if description is None:
            return []
        columns = [col[0].lower() for col in description]
        return [dict(zip(columns, row)) for row in rows]

    def one(self, sql: str, params: dict | None = None) -> dict | None:
        rows = self.all(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql: str, params: dict | None = None):
        row = self.one(sql, params)
        if not row:
            return None
        return next(iter(row.values()))

    def execute(self, sql: str, params: dict | None = None) -> int:
        cursor = self._run(sql, params)
        try:
            return cursor.rowcount
        finally:
            cursor.close()

    def insert(self, sql: str, params: dict | None = None) -> int:
        """INSERT sobre una tabla con columna `id` autogenerada; devuelve ese id."""
        bound = dict(_filter_params(sql, params))
        cursor = self._cursor()
        try:
            if self.engine == "oracle":
                out_id = cursor.var(int)
                bound["__rid"] = out_id
                cursor.execute(sql + " RETURNING id INTO :__rid", bound)
                value = out_id.getvalue()
                if isinstance(value, list):
                    value = value[0]
                return int(value)
            if self.engine == "postgres":
                cursor.execute(_to_mysql_sql(sql) + " RETURNING id", bound)
                return int(cursor.fetchone()[0])
            cursor.execute(_to_mysql_sql(sql), bound)
            return int(cursor.lastrowid)
        except Exception as exc:
            if _is_duplicate(exc):
                raise DuplicateKeyError(str(exc)) from exc
            raise
        finally:
            cursor.close()

    def commit(self):
        self.raw.commit()
        self.committed = True

    def rollback(self):
        try:
            self.raw.rollback()
        finally:
            self.committed = False

    def close(self):
        try:
            self.raw.close()
        except Exception:
            pass


def _is_duplicate(exc: Exception) -> bool:
    text = str(exc)
    if "Duplicate entry" in text or "ORA-00001" in text:
        return True
    if getattr(exc, "sqlstate", None) == "23505":  # Postgres unique_violation (psycopg)
        return True
    args = getattr(exc, "args", ())
    if args and isinstance(args[0], int) and args[0] in (1062, 1):
        return True
    cause = getattr(exc, "orig", None)
    if cause is not None and _is_duplicate(cause):
        return True
    return False


def _mysql_ssl(cfg: dict):
    mode = cfg.get("ssl", "disable")
    if mode == "disable":
        return None
    import ssl

    if mode == "verify":
        if not cfg.get("ssl_ca"):
            raise RuntimeError("DB ssl=verify requires *_DB_SSL_CA (bundle global-bundle.pem de RDS)")
        return ssl.create_default_context(cafile=cfg["ssl_ca"])
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def _postgres_ssl(cfg: dict) -> dict:
    mode = cfg.get("ssl", "disable")
    if mode == "disable":
        return {"sslmode": "prefer"}
    if mode == "verify":
        if not cfg.get("ssl_ca"):
            raise RuntimeError("DB ssl=verify requires *_DB_SSL_CA (bundle global-bundle.pem de RDS)")
        return {"sslmode": "verify-full", "sslrootcert": cfg["ssl_ca"]}
    return {"sslmode": "require"}


def _connect(cfg: dict) -> Connection:
    engine = cfg.get("engine", "mysql")
    if engine not in _ENGINES:
        raise RuntimeError(f"unsupported DB engine: {engine!r} (use one of {', '.join(_ENGINES)})")

    if engine == "oracle":
        import oracledb

        dsn = f"{cfg['host']}:{cfg['port']}/{cfg.get('service_name') or cfg['name']}"
        raw = oracledb.connect(user=cfg["user"], password=cfg["password"], dsn=dsn)
        return Connection("oracle", raw)

    if engine == "postgres":
        import psycopg

        raw = psycopg.connect(
            host=cfg["host"],
            port=cfg["port"],
            user=cfg["user"],
            password=cfg["password"],
            dbname=cfg["name"],
            autocommit=False,
            connect_timeout=5,
            **_postgres_ssl(cfg),
        )
        return Connection("postgres", raw)

    import pymysql

    raw = pymysql.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        database=cfg["name"],
        charset="utf8mb4",
        autocommit=False,
        connect_timeout=5,
        ssl=_mysql_ssl(cfg),
    )
    return Connection("mysql", raw)


def get_conn(config: dict, role: str = BILLING) -> Connection:
    if not has_app_context():
        raise RuntimeError("database access requires an application context")
    if role == CATALOG and config["DB_CATALOG"] == config["DB_BILLING"]:
        role = BILLING
    conns = g.get("db_conns")
    if conns is None:
        conns = g.db_conns = {}
    conn = conns.get(role)
    if conn is None:
        conn = conns[role] = _connect(config["DB_CATALOG" if role == CATALOG else "DB_BILLING"])
    return conn


def commit():
    """Confirma las conexiones abiertas. Cada petición escribe en una sola base, así que no
    se necesita atomicidad entre MySQL y Postgres."""
    if not has_app_context():
        return
    for conn in (g.get("db_conns") or {}).values():
        conn.commit()


def teardown():
    if not has_app_context():
        return
    conns = g.pop("db_conns", None) or {}
    for conn in conns.values():
        if not conn.committed:
            conn.rollback()
        conn.close()


def to_number(value) -> float:
    if isinstance(value, decimal.Decimal):
        return float(value)
    if value is None:
        return 0.0
    return float(value)


def to_int(value) -> int:
    if isinstance(value, decimal.Decimal):
        return int(value)
    return int(value)


def to_bool(value) -> bool:
    return bool(int(value)) if not isinstance(value, bool) else value


def to_date(value) -> datetime.date | None:
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    return datetime.datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def date_str(value) -> str | None:
    parsed = to_date(value)
    return parsed.isoformat() if parsed else None
