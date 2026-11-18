"""Punto de entrada de la API.

- AWS Lambda (detrás de API Gateway HTTP API, payload 2.0): handler = "wsgi.handler".
- Local: python wsgi.py  (Flask en 127.0.0.1:5000)
"""

from app import create_app

application = create_app()
app = application


def handler(event, context):
    """Adaptador Lambda -> WSGI (apig-wsgi). Se importa al primer uso para no afectar las pruebas."""
    global _lambda_handler
    if _lambda_handler is None:
        from apig_wsgi import make_lambda_handler

        _lambda_handler = make_lambda_handler(application, binary_support=False)
    return _lambda_handler(event, context)


_lambda_handler = None


if __name__ == "__main__":
    import os

    # El debugger de Werkzeug permite ejecutar codigo: solo local y solo si se pide explicitamente.
    application.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").strip().lower() in ("1", "true", "yes"),
    )
