from .audit import bp as audit_bp
from .auth import bp as auth_bp
from .catalog import bp as catalog_bp
from .customers import bp as customers_bp
from .dashboard import bp as dashboard_bp
from .invoices import bp as invoices_bp
from .payments import bp as payments_bp
from .taxes import bp as taxs_bp
from .users import bp as users_bp

ALL_BLUEPRINTS = (
    auth_bp,
    customers_bp,
    users_bp,
    catalog_bp,
    taxs_bp,
    invoices_bp,
    payments_bp,
    dashboard_bp,
    audit_bp,
)


def register_blueprints(app) -> None:
    for blueprint in ALL_BLUEPRINTS:
        app.register_blueprint(blueprint)
