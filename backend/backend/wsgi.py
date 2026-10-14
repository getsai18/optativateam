from app import create_app

application = create_app()
app = application

if __name__ == "__main__":
    import os

    # El debugger de Werkzeug permite ejecutar codigo: solo local y solo si se pide explicitamente.
    application.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").strip().lower() in ("1", "true", "yes"),
    )
