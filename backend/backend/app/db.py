import datetime
import decimal
import re

from flask import g, has_app_context

_PARAM_PATTERN = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")


class DuplicateKeyError(Exception):
    pass


def _filter_params(sql: str, params: dict | None) -> dict:
    if not params:
        return {}
    names = set(_PARAM_PATTERN.findall(sql))
    return {k: v for k, v in params.items() if k in names}


def _to_mysql_sql(sql: str) -> str:
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
            if self.engine == "mysql":
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
        bound = dict(_filter_params(sql, params))
        cursor = self._cursor()
        try:
            if self.engine == "mysql":
                cursor.execute(_to_mysql_sql(sql), bound)
            else:
                out_id = cursor.var(int)
                bound["__rid"] = out_id
                cursor.execute(sql + " RETURNING id INTO :__rid", bound)
                value = out_id.getvalue()
                if isinstance(value, list):
                    value = value[0]
                return int(value)
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
    args = getattr(exc, "args", ())
    if args and isinstance(args[0], int) and args[0] in (1062, 1):
        return True
    cause = getattr(exc, "orig", None)
    if cause is not None and _is_duplicate(cause):
        return True
    return False


def _connect(config: dict) -> Connection:
    engine = config.get("DB_ENGINE", "mysql")
    if engine == "oracle":
        import oracledb

        dsn = f"{config['DB_HOST']}:{config['DB_PORT']}/{config.get('DB_SERVICE_NAME') or config['DB_NAME']}"
        raw = oracledb.connect(
            user=config["DB_USER"],
            password=config["DB_PASSWORD"],
            dsn=dsn,
        )
        return Connection("oracle", raw)

    import pymysql

    raw = pymysql.connect(
        host=config["DB_HOST"],
        port=config["DB_PORT"],
        user=config["DB_USER"],
        password=config["DB_PASSWORD"],
        database=config["DB_NAME"],
        charset="utf8mb4",
        autocommit=False,
    )
    return Connection("mysql", raw)


def get_conn(config: dict) -> Connection:
    if not has_app_context():
        raise RuntimeError("database access requires an application context")
    conn = g.get("db_conn")
    if conn is None:
        conn = _connect(config)
        g.db_conn = conn
    return conn


def commit():
    if not has_app_context():
        return
    conn = g.get("db_conn")
    if conn is not None:
        conn.commit()


def teardown():
    if not has_app_context():
        return
    conn = g.pop("db_conn", None)
    if conn is None:
        return
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
