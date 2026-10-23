from flask import Flask, jsonify
from flask_cors import CORS

from . import db as database
from .config import build_config
from .errors import ApiError
from .views import register_blueprints


def create_app(overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.update(build_config(overrides))
    origins = [origin.strip() for origin in app.config["CORS_ORIGINS"].split(",") if origin.strip()]
    CORS(app, resources={r"/*": {"origins": origins}})
    _register_error_handlers(app)
    register_blueprints(app)
    app.teardown_appcontext(lambda _exc: database.teardown())

    @app.after_request
    def _security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        return response

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def _handle_api_error(error: ApiError):
        return jsonify({"code": error.code, "message": error.message}), error.status

    @app.errorhandler(404)
    def _handle_not_found(_error):
        return jsonify({"code": "NOT_FOUND", "message": "Not found"}), 404

    @app.errorhandler(413)
    def _handle_too_large(_error):
        return jsonify({"code": "VALIDATION", "message": "Request body too large"}), 413

    @app.errorhandler(405)
    def _handle_method_not_allowed(_error):
        return jsonify({"code": "NOT_FOUND", "message": "Not found"}), 405

    @app.errorhandler(database.DuplicateKeyError)
    def _handle_duplicate(_error):
        return jsonify({"code": "CONFLICT", "message": "Conflict"}), 409

    if not app.testing:

        @app.errorhandler(Exception)
        def _handle_unexpected(error):
            app.logger.exception("unhandled error: %s", error)
            return jsonify({"code": "INTERNAL", "message": "Unexpected error"}), 500
