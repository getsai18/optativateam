import json
import logging
import uuid

from flask import current_app

from . import repos
from .domain import iso_ms, utcnow

logger = logging.getLogger(__name__)

_memory: list[dict] = []


def _entry(claims: dict, action: str, entity_type: str, entity_id: str) -> dict:
    return {
        "id": "aud_" + uuid.uuid4().hex[:8],
        "userId": claims["sub"],
        "action": action,
        "entityType": entity_type,
        "entityId": entity_id,
        "timestamp": iso_ms(utcnow()),
    }


def write_entry(claims: dict, action: str, entity_type: str, entity_id: str) -> None:
    entry = _entry(claims, action, entity_type, entity_id)
    backend = current_app.config.get("AUDIT_BACKEND", "memory")
    if backend == "dynamodb":
        try:
            _put_dynamodb(entry, entity_type, entity_id)
            return
        except Exception as exc:
            if current_app.config.get("AUDIT_REQUIRED"):
                raise
            # La memoria de una Lambda se pierde: se deja el evento completo en CloudWatch Logs
            # para poder reconstruirlo, en vez de guardarlo en un buffer que nadie leerá.
            logger.error("AUDIT_WRITE_FAILED %s", json.dumps({"entry": entry, "error": str(exc)}))
            return
    _memory.append(entry)


def list_entries() -> list[dict]:
    backend = current_app.config.get("AUDIT_BACKEND", "memory")
    if backend == "dynamodb":
        return _query_dynamodb()  # si falla, error 500: mejor que mostrar una auditoría vacía
    return sorted(_memory, key=lambda e: e["timestamp"], reverse=True)


def enrich(entries: list[dict]) -> list[dict]:
    user_labels: dict[int, str] = {}
    entity_ids: dict[str, list[int]] = {}
    for entry in entries:
        user_id = repos.decode_or_none("usr", entry.get("userId", ""))
        if user_id is not None and user_id not in user_labels:
            user_labels[user_id] = None
        entity_type = entry.get("entityType", "")
        entity_id = repos.decode_or_none(_PREFIXES.get(entity_type, ""), entry.get("entityId", ""))
        if entity_id is not None:
            entity_ids.setdefault(entity_type, [])
            if entity_id not in entity_ids[entity_type]:
                entity_ids[entity_type].append(entity_id)
    if user_labels:
        user_labels.update(repos.fetch_labels("user", list(user_labels)))
    label_maps = {kind: repos.fetch_labels(kind, ids) for kind, ids in entity_ids.items()}
    rows = []
    for entry in entries:
        user_id = repos.decode_or_none("usr", entry.get("userId", ""))
        entity_type = entry.get("entityType", "")
        entity_pk = repos.decode_or_none(_PREFIXES.get(entity_type, ""), entry.get("entityId", ""))
        entity_label = label_maps.get(entity_type, {}).get(entity_pk) if entity_pk is not None else None
        rows.append(
            {
                "id": entry.get("id"),
                "userId": entry.get("userId"),
                "action": entry.get("action"),
                "entityType": entity_type,
                "entityId": entry.get("entityId"),
                "timestamp": entry.get("timestamp"),
                "userName": user_labels.get(user_id) if user_id is not None else None,
                "entityLabel": entity_label if entity_label is not None else entry.get("entityId"),
            }
        )
        if rows[-1]["userName"] is None:
            rows[-1]["userName"] = entry.get("userId")
    return rows


_PREFIXES = {
    "invoice": "inv",
    "customer": "cus",
    "user": "usr",
    "service": "svc",
    "feature": "feat",
    "tax": "tax",
}


def _table():
    import boto3

    return boto3.resource("dynamodb", region_name=_region()).Table(current_app.config["AUDIT_TABLE"])


def _region() -> str:
    import os

    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"


def _put_dynamodb(entry: dict, entity_type: str, entity_id: str) -> None:
    _table().put_item(
        Item={
            "entity_key": f"{entity_type.upper()}#{entity_id}",
            # "<ISO>#<id>": dos eventos del mismo milisegundo sobre la misma entidad no se pisan.
            "event_ts": f"{entry['timestamp']}#{entry['id']}",
            "feed_pk": "AUDIT",
            "entry_id": entry["id"],
            "user_id": entry["userId"],
            "action": entry["action"],
            "entity_type": entity_type,
            "entity_id": entry["entityId"],
            "timestamp": entry["timestamp"],
        }
    )


def _query_dynamodb() -> list[dict]:
    from boto3.dynamodb.conditions import Key

    table = _table()
    items = []
    kwargs = {
        "IndexName": "feed_pk-event_ts-index",
        "KeyConditionExpression": Key("feed_pk").eq("AUDIT"),
        "ScanIndexForward": False,
    }
    while True:
        response = table.query(**kwargs)
        items.extend(response.get("Items", []))
        if "LastEvaluatedKey" not in response:
            break
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
    entries = [
        {
            "id": item.get("entry_id"),
            "userId": item.get("user_id"),
            "action": item.get("action"),
            "entityType": item.get("entity_type"),
            "entityId": item.get("entity_id"),
            "timestamp": item.get("timestamp"),
        }
        for item in items
    ]
    entries.sort(key=lambda e: e["timestamp"] or "", reverse=True)
    return entries


def reset_memory() -> None:
    _memory.clear()
