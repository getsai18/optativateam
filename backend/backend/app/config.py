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


def build_config(overrides: dict | None = None) -> dict:
    config = {
        "DB_ENGINE": os.getenv("DB_ENGINE", "mysql").strip().lower(),
        "DB_HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "DB_PORT": int(os.getenv("DB_PORT", "3306")),
        "DB_NAME": os.getenv("DB_NAME", "billing_db"),
        "DB_USER": os.getenv("DB_USER", "billing"),
        "DB_PASSWORD": os.getenv("DB_PASSWORD", ""),
        "DB_SERVICE_NAME": os.getenv("DB_SERVICE_NAME", ""),
        "JWT_SECRET": os.getenv("JWT_SECRET", "dev-secret-change-me"),
        "SESSION_TTL_MS": int(os.getenv("SESSION_TTL_MS", "1800000")),
        "DEMO_PASSWORD": os.getenv("DEMO_PASSWORD", "demo1234"),
        "AUDIT_BACKEND": os.getenv("AUDIT_BACKEND", "memory").strip().lower(),
        "AUDIT_TABLE": os.getenv("AUDIT_TABLE", "billing_audit_log"),
        "AUDIT_REQUIRED": _bool("AUDIT_REQUIRED"),
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS", "*"),
        "TESTING": False,
    }
    if overrides:
        config.update(overrides)
    return config
