import pytest

from app import create_app
from app import db as database


class FakeCursor:
    def __init__(self, raw):
        self.raw = raw
        self.lastrowid = 7
        self.description = None

    def execute(self, sql, params=None):
        self.raw.statements.append((sql, params))

    def fetchone(self):
        return (42,)

    def close(self):
        pass


class FakeRaw:
    def __init__(self):
        self.statements = []
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


def _app(monkeypatch, catalog_host=""):
    monkeypatch.setenv("BILLING_DB_HOST", "mysql.internal")
    monkeypatch.setenv("CATALOG_DB_HOST", catalog_host)
    created = []

    def fake_connect(cfg):
        raw = FakeRaw()
        created.append((cfg, raw))
        return database.Connection(cfg["engine"], raw)

    monkeypatch.setattr(database, "_connect", fake_connect)
    return create_app({"TESTING": True}), created


def test_catalog_uses_separate_postgres_connection(monkeypatch):
    app, created = _app(monkeypatch, catalog_host="pg.internal")
    with app.app_context():
        billing = database.get_conn(app.config, database.BILLING)
        catalog = database.get_conn(app.config, database.CATALOG)
        assert billing is not catalog
        assert [c[0]["engine"] for c in created] == ["mysql", "postgres"]
        assert created[1][0]["host"] == "pg.internal" and created[1][0]["port"] == 5432
        database.commit()
        assert all(raw.commits == 1 for _, raw in created)


def test_catalog_shares_billing_connection_without_catalog_host(monkeypatch):
    app, created = _app(monkeypatch, catalog_host="")
    with app.app_context():
        assert database.get_conn(app.config, database.CATALOG) is database.get_conn(app.config, database.BILLING)
        assert len(created) == 1


def test_teardown_rolls_back_uncommitted_and_closes_all(monkeypatch):
    app, created = _app(monkeypatch, catalog_host="pg.internal")
    with app.app_context():
        database.get_conn(app.config, database.BILLING)
        database.get_conn(app.config, database.CATALOG)
    for _, raw in created:
        assert raw.rollbacks == 1 and raw.closed


def test_postgres_insert_uses_returning_id():
    raw = FakeRaw()
    conn = database.Connection("postgres", raw)
    new_id = conn.insert("INSERT INTO feature (name) VALUES (:name)", {"name": "GB"})
    assert new_id == 42
    assert raw.statements[0][0] == "INSERT INTO feature (name) VALUES (%(name)s) RETURNING id"


def test_mysql_insert_uses_lastrowid():
    conn = database.Connection("mysql", FakeRaw())
    assert conn.insert("INSERT INTO customer (name) VALUES (:name)", {"name": "x"}) == 7


def test_postgres_unique_violation_maps_to_duplicate():
    class UniqueViolation(Exception):
        sqlstate = "23505"

    assert database._is_duplicate(UniqueViolation("duplicate key value"))


def test_unknown_engine_is_rejected_not_silently_mysql():
    with pytest.raises(RuntimeError):
        database._connect({"engine": "postgress"})


def test_public_hosts_default_to_tls_and_local_does_not(monkeypatch):
    monkeypatch.setenv("BILLING_DB_HOST", "billing.abc.us-east-1.rds.amazonaws.com")
    monkeypatch.setenv("CATALOG_DB_HOST", "127.0.0.1")
    app = create_app({"TESTING": True})
    assert app.config["DB_BILLING"]["ssl"] == "require"
    assert app.config["DB_CATALOG"]["ssl"] == "disable"


def test_postgres_connect_passes_sslmode(monkeypatch):
    import sys
    import types

    seen = {}
    fake = types.SimpleNamespace(connect=lambda **kw: seen.update(kw) or FakeRaw())
    monkeypatch.setitem(sys.modules, "psycopg", fake)
    cfg = {"engine": "postgres", "host": "h", "port": 5432, "user": "u", "password": "p", "name": "d", "ssl": "require"}
    database._connect(cfg)
    assert seen["sslmode"] == "require" and seen["dbname"] == "d"


def test_ssl_verify_requires_ca():
    with pytest.raises(RuntimeError):
        database._postgres_ssl({"ssl": "verify", "ssl_ca": ""})
