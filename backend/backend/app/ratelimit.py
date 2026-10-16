import threading
import time

from flask import Flask, jsonify, request

WINDOW_S = 60
_hits: dict[str, list[float]] = {}
_lock = threading.Lock()
_last_purge = 0.0


def reset() -> None:
    _hits.clear()


def _allow(key: str, limit: int, now: float) -> bool:
    global _last_purge
    with _lock:
        if now - _last_purge > WINDOW_S:  # evita que el diccionario crezca con IPs que ya no vuelven
            cutoff = now - WINDOW_S
            for k in [k for k, v in _hits.items() if not v or v[-1] < cutoff]:
                del _hits[k]
            _last_purge = now
        recent = [t for t in _hits.get(key, []) if t > now - WINDOW_S]
        if len(recent) >= limit:
            _hits[key] = recent
            return False
        recent.append(now)
        _hits[key] = recent
        return True


def init_app(app: Flask) -> None:
    """Límite general por IP (ventana de 60 s). Vive en memoria de cada worker: frena ráfagas, no es un WAF."""
    limit = int(app.config.get("RATE_LIMIT_PER_MIN", 0))
    if limit <= 0:
        return

    @app.before_request
    def _throttle():
        if request.method == "OPTIONS" or request.path == "/health":
            return None
        if not _allow(request.remote_addr or "?", limit, time.time()):
            response = jsonify({"code": "RATE_LIMITED", "message": "Too many requests"})
            response.status_code = 429
            response.headers["Retry-After"] = str(WINDOW_S)
            return response
        return None
