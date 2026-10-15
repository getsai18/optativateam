import json
import os
import time

from flask import current_app

_memory: dict[str, dict] = {}

EMPTY = {"invoiceId": None, "customerId": None, "lines": [], "step": 0}


def _backend() -> str:
    return current_app.config.get("CART_BACKEND", "memory")


def _ttl_seconds() -> int:
    return int(current_app.config.get("CART_TTL_DAYS", 7)) * 86400


def _table():
    import boto3

    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
    return boto3.resource("dynamodb", region_name=region).Table(current_app.config["CART_TABLE"])


def get(user_id: str) -> dict:
    now = int(time.time())
    if _backend() == "dynamodb":
        item = _table().get_item(Key={"user_id": user_id}).get("Item")
        if not item or int(item.get("ttl", 0)) < now:
            return dict(EMPTY, lines=[])
        return json.loads(item["cart"])
    item = _memory.get(user_id)
    if not item or item["ttl"] < now:
        return dict(EMPTY, lines=[])
    return item["cart"]


def put(user_id: str, cart: dict) -> None:
    now = int(time.time())
    ttl = now + _ttl_seconds()
    if _backend() == "dynamodb":
        _table().put_item(
            Item={"user_id": user_id, "cart": json.dumps(cart), "ttl": ttl, "updated_at": now}
        )
        return
    _memory[user_id] = {"cart": cart, "ttl": ttl}


def delete(user_id: str) -> None:
    if _backend() == "dynamodb":
        _table().delete_item(Key={"user_id": user_id})
        return
    _memory.pop(user_id, None)


def reset_memory() -> None:
    _memory.clear()
