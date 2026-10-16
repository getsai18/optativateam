import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent.parent

INSECURE_JWT_SECRETS = ("", "dev-secret-change-me", "cambia-esto-por-32-bytes-aleatorios-minimo")

API_CODE_STATUS = {
    "RATE_LIMITED": 429,
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
    if _env(f"{prefix}_DB_SSL_CA") and host not in ("", "127.0.0.1", "localhost"):
        return "verify"
    return "disable" if host in ("", "127.0.0.1", "localhost") else "require"


def _ca_path(name: str) -> str:
    """Ruta del bundle de CA; relativa => se resuelve contra backend/ (cwd en Lambda varía)."""
    value = _env(name)
    if not value:
        return ""
    path = Path(value)
    return str(path if path.is_absolute() else BACKEND_DIR / path)


def _billing_db() -> dict:
    """Base de facturación (RDS MySQL). Acepta BILLING_DB_* y, por compatibilidad, DB_*."""
    host = _env("BILLING_DB_HOST", "DB_HOST", default="127.0.0.1")
    return {
        "engine": _env("BILLING_DB_ENGINE", "DB_ENGINE", default="mysql").lower(),
        "host": host,
        "ssl": _ssl_mode("BILLING", host),
        "ssl_ca": _ca_path("BILLING_DB_SSL_CA"),
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
        "ssl_ca": _ca_path("CATALOG_DB_SSL_CA"),
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
        "JWT_SECRET": os.getenv("JWT_SECRET", ""),
        "SESSION_TTL_MS": int(os.getenv("SESSION_TTL_MS", "1800000")),
        "DEMO_PASSWORD": os.getenv("DEMO_PASSWORD", ""),
        # Solo desarrollo local: acepta DEMO_PASSWORD para hashes que no son bcrypt (marcador del seed).
        "ALLOW_DEMO_LOGIN": _bool("ALLOW_DEMO_LOGIN"),
        "AUDIT_BACKEND": os.getenv("AUDIT_BACKEND", "memory").strip().lower(),
        "AUDIT_TABLE": os.getenv("AUDIT_TABLE", "billing_audit_log"),
        "AUDIT_REQUIRED": _bool("AUDIT_REQUIRED"),
        "CART_BACKEND": os.getenv("CART_BACKEND", "memory").strip().lower(),
        "CART_TABLE": os.getenv("CART_TABLE", "billing_invoice_cart"),
        "CART_TTL_DAYS": int(os.getenv("CART_TTL_DAYS", "7")),
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS", "*"),
        "RATE_LIMIT_PER_MIN": int(os.getenv("RATE_LIMIT_PER_MIN", "300")),  # 0 = sin límite general
        "MAX_CONTENT_LENGTH": 256 * 1024,  # cuerpos JSON > 256 KB -> 413
        "TESTING": False,
    }
    if overrides:
        config.update(overrides)
    production = bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME")) or _env("APP_ENV").lower() == "production"
    config["PRODUCTION"] = production
    config["TRUSTED_PROXIES"] = int(os.getenv("TRUSTED_PROXIES", "0") or 0)
    if production and not config.get("TESTING"):
        origins = [o.strip() for o in str(config["CORS_ORIGINS"]).split(",") if o.strip()]
        if not origins or "*" in origins:
            raise RuntimeError("CORS_ORIGINS no puede ser vacío ni '*' en producción: define el origen del frontend")
    if not config.get("TESTING"):
        secret = str(config["JWT_SECRET"])
        if secret in INSECURE_JWT_SECRETS or len(secret) < 32:
            raise RuntimeError(
                "JWT_SECRET inseguro: define un valor aleatorio de >= 32 caracteres "
                "(python -c \"import secrets;print(secrets.token_urlsafe(48))\")"
            )
    return config
