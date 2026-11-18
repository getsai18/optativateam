from flask import Blueprint, jsonify

from .. import audit, auth

bp = Blueprint("audit", __name__)


@bp.get("/audit")
@auth.require_role("ADMIN")
def list_audit():
    return jsonify(audit.enrich(audit.list_entries()))
