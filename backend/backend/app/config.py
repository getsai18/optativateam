import os

from dotenv import load_dotenv

load_dotenv()

API_CODE_STATUS = {
    "UNAUTHORIZED": 401,
    "FORBIDDEN": 403,
    "NOT_FOUND": 404,
    "VALIDATION": 400,
    "CONFLICT": 409,
}


def _bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value not in (None, ""):
            return value.strip()
    return default


def _ssl_mode(prefix: str, host: str) -> str:
    """disable | require (cifra sin verificar el certificado) | verify (exige *_DB_SSL_CA).
    Por defecto cifra todo lo que no sea local: con RDS público las credenciales viajan por internet."""
    explicit = _env(f"{prefix}_DB_SSL").lower()
    if explicit:
        return explicit
    return "disable" if host in ("", "127.0.0.1", "localhost") else "require"


def _billing_db() -> dict:
    """Base de facturación (RDS MySQL). Acepta BILLING_DB_* y, por compatibilidad, DB_*."""
    host = _env("BILLING_DB_HOST", "DB_HOST", default="127.0.0.1")
    return {
        "engine": _env("BILLING_DB_ENGINE", "DB_ENGINE", default="mysql").lower(),
        "host": host,
        "ssl": _ssl_mode("BILLING", host),
        "ssl_ca": _env("BILLING_DB_SSL_CA"),
        "port": int(_env("BILLING_DB_PORT", "DB_PORT", default="3306")),
        "name": _env("BILLING_DB_NAME", "DB_NAME", default="billing_db"),
        "user": _env("BILLING_DB_USER", "DB_USER", default="billing"),
        "password": os.getenv("BILLING_DB_PASSWORD") or os.getenv("DB_PASSWORD", ""),
        "service_name": _env("BILLING_DB_SERVICE_NAME", "DB_SERVICE_NAME"),
    }


def _catalog_db(billing: dict) -> dict:
    """Base de catálogo (RDS Postgres). Sin CATALOG_DB_HOST usa la misma base que facturación."""
    if not _env("CATALOG_DB_HOST"):
        return dict(billing)
    engine = _env("CATALOG_DB_ENGINE", default="postgres").lower()
    host = _env("CATALOG_DB_HOST")
    return {
        "engine": engine,
        "host": host,
        "ssl": _ssl_mode("CATALOG", host),
        "ssl_ca": _env("CATALOG_DB_SSL_CA"),
        "port": int(_env("CATALOG_DB_PORT", default="5432" if engine == "postgres" else "3306")),
        "name": _env("CATALOG_DB_NAME", default="catalog_db"),
        "user": _env("CATALOG_DB_USER"),
        "password": os.getenv("CATALOG_DB_PASSWORD", ""),
        "service_name": _env("CATALOG_DB_SERVICE_NAME"),
    }


def build_config(overrides: dict | None = None) -> dict:
    billing = _billing_db()
    config = {
        "DB_BILLING": billing,
        "DB_CATALOG": _catalog_db(billing),
        "JWT_SECRET": os.getenv("JWT_SECRET", "dev-secret-change-me"),
        "SESSION_TTL_MS": int(os.getenv("SESSION_TTL_MS", "1800000")),
        "DEMO_PASSWORD": os.getenv("DEMO_PASSWORD", "demo1234"),
        # Solo desarrollo local: acepta DEMO_PASSWORD para hashes que no son bcrypt (marcador del seed).
        "ALLOW_DEMO_LOGIN": _bool("ALLOW_DEMO_LOGIN"),
        "AUDIT_BACKEND": os.getenv("AUDIT_BACKEND", "memory").strip().lower(),
        "AUDIT_TABLE": os.getenv("AUDIT_TABLE", "billing_audit_log"),
        "AUDIT_REQUIRED": _bool("AUDIT_REQUIRED"),
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS", "*"),
        "TESTING": False,
    }
    if overrides:
        config.update(overrides)
    return config
