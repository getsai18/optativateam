from flask import Blueprint, jsonify

from .. import audit, auth, db, repos
from ..domain import encode_id
from ..errors import conflict, not_found, validation
from ..serializers import feature_json, services_json
from .common import bool_field, json_body, opt_str_field, str_field

bp = Blueprint("catalog", __name__)

_CATEGORIES = (
    "Cloud Infrastructure",
    "Software Licenses",
    "Support & Maintenance",
    "Consulting",
    "Training",
    "Security",
    "Data & Analytics",
    "Development",
)

_SERVICE_CODE_CONFLICT = "A service with this code already exists"
_FEATURE_NAME_CONFLICT = "A feature with this name already exists"


def _service_fields(body: dict) -> dict:
    category = str_field(body, "category")
    if category not in _CATEGORIES:
        raise validation("Invalid request body")
    base_price = body.get("basePrice")
    if not isinstance(base_price, (int, float)) or isinstance(base_price, bool) or base_price < 0:
        raise validation("Invalid request body")
    description = body.get("description")
    if description is not None and not isinstance(description, str):
        raise validation("Invalid request body")
    return {
        "code": str_field(body, "code"),
        "name": str_field(body, "name"),
        "description": description,
        "base_price": float(base_price),
        "category": category,
        "active": bool_field(body, "active", True),
    }


def _tax_ids(body: dict) -> list[int]:
    raw = body.get("taxIds", [])
    if not isinstance(raw, list):
        raise validation("Invalid request body")
    tax_ids = []
    for item in raw:
        tax_id = repos.decode_or_none("tax", item)
        if tax_id is None or repos.find_tax(tax_id) is None:
            raise not_found("Tax not found")
        tax_ids.append(tax_id)
    return tax_ids


def _features(body: dict) -> list[tuple[int, str]]:
    raw = body.get("features", [])
    if not isinstance(raw, list):
        raise validation("Invalid request body")
    features = []
    seen = set()
    for item in raw:
        if not isinstance(item, dict):
            raise validation("Invalid request body")
        feature_id = repos.decode_or_none("feat", item.get("featureId"))
        value = item.get("value")
        if feature_id is None or repos.find_feature(feature_id) is None:
            raise not_found("Feature not found")
        if not isinstance(value, str) or not value:
            raise validation("Invalid request body")
        if feature_id in seen:
            raise validation("Invalid request body")
        seen.add(feature_id)
        features.append((feature_id, value))
    return features


@bp.get("/services")
@auth.require_role("ADMIN", "BILLER")
def list_services():
    return jsonify(services_json(repos.list_services()))


@bp.post("/services")
@auth.require_role("ADMIN")
def create_service():
    claims = auth.current_claims()
    body = json_body()
    fields = _service_fields(body)
    tax_ids = _tax_ids(body)
    features = _features(body)
    if repos.service_code_taken(fields["code"]):
        raise conflict(_SERVICE_CODE_CONFLICT)
    try:
        service_id = repos.insert_service(**fields)
    except db.DuplicateKeyError:
        raise conflict(_SERVICE_CODE_CONFLICT)
    repos.replace_service_taxes(service_id, tax_ids)
    repos.replace_service_features(service_id, features)
    db.commit()
    audit.write_entry(claims, "service.create", "service", encode_id("svc", service_id))
    return jsonify(services_json([repos.find_service(service_id)])[0])


@bp.put("/services/<service_id>")
@auth.require_role("ADMIN")
def update_service(service_id: str):
    claims = auth.current_claims()
    body = json_body()
    db_id = repos.decode_or_none("svc", service_id)
    service = repos.find_service(db_id) if db_id is not None else None
    if service is None:
        raise not_found("Service not found")
    fields = _service_fields(body)
    tax_ids = _tax_ids(body)
    features = _features(body)
    if repos.service_code_taken(fields["code"], exclude_id=db_id):
        raise conflict(_SERVICE_CODE_CONFLICT)
    try:
        repos.update_service(db_id, **fields)
    except db.DuplicateKeyError:
        raise conflict(_SERVICE_CODE_CONFLICT)
    repos.replace_service_taxes(db_id, tax_ids)
    repos.replace_service_features(db_id, features)
    db.commit()
    audit.write_entry(claims, "service.update", "service", service_id)
    return jsonify(services_json([repos.find_service(db_id)])[0])


@bp.get("/features")
@auth.require_role("ADMIN", "BILLER", "CUSTOMER")
def list_features():
    return jsonify([feature_json(row) for row in repos.list_features()])


def _feature_fields(body: dict) -> dict:
    description = body.get("description")
    if description is not None and not isinstance(description, str):
        raise validation("Invalid request body")
    unit = opt_str_field(body, "unit") or None
    return {"name": str_field(body, "name"), "description": description, "unit": unit}


@bp.post("/features")
@auth.require_role("ADMIN")
def create_feature():
    claims = auth.current_claims()
    fields = _feature_fields(json_body())
    if repos.feature_name_taken(fields["name"]):
        raise conflict(_FEATURE_NAME_CONFLICT)
    try:
        feature_id = repos.insert_feature(**fields)
    except db.DuplicateKeyError:
        raise conflict(_FEATURE_NAME_CONFLICT)
    db.commit()
    audit.write_entry(claims, "feature.create", "feature", encode_id("feat", feature_id))
    return jsonify(feature_json(repos.find_feature(feature_id)))


@bp.put("/features/<feature_id>")
@auth.require_role("ADMIN")
def update_feature(feature_id: str):
    claims = auth.current_claims()
    body = json_body()
    db_id = repos.decode_or_none("feat", feature_id)
    feature = repos.find_feature(db_id) if db_id is not None else None
    if feature is None:
        raise not_found("Feature not found")
    fields = _feature_fields(body)
    if repos.feature_name_taken(fields["name"], exclude_id=db_id):
        raise conflict(_FEATURE_NAME_CONFLICT)
    try:
        repos.update_feature(db_id, **fields)
    except db.DuplicateKeyError:
        raise conflict(_FEATURE_NAME_CONFLICT)
    db.commit()
    audit.write_entry(claims, "feature.update", "feature", feature_id)
    return jsonify(feature_json(repos.find_feature(db_id)))


@bp.delete("/features/<feature_id>")
@auth.require_role("ADMIN")
def delete_feature(feature_id: str):
    claims = auth.current_claims()
    db_id = repos.decode_or_none("feat", feature_id)
    if db_id is None:
        raise not_found("Feature not found")
    used_by = repos.feature_usage_count(db_id)
    if used_by > 0:
        plural = "s" if used_by != 1 else ""
        raise conflict(f"This feature is assigned to {used_by} service{plural} and cannot be deleted")
    repos.delete_feature(db_id)
    db.commit()
    audit.write_entry(claims, "feature.delete", "feature", feature_id)
    return jsonify({"ok": True})
