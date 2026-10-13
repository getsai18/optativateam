import time
import uuid

import bcrypt
import jwt

from app.auth import build_claims, decode_token, encode_token, verify_password

SECRET = "test-secret-0123456789-0123456789-ab"


def _claims(exp_ms=None):
    return {
        "sub": "usr_1",
        "email": "admin@northwind.test",
        "name": "Sofía Navarro",
        "role": "ADMIN",
        "exp": exp_ms if exp_ms is not None else int(time.time() * 1000) + 1800000,
    }


def test_token_roundtrip_uses_epoch_milliseconds():
    claims = build_claims(
        {
            "sub": "usr_1",
            "email": "a@b.test",
            "name": "A",
            "role": "BILLER",
            "customer_id": None,
            "ttl_ms": 1800000,
        }
    )
    assert claims["exp"] > int(time.time() * 1000)
    token = encode_token(claims, SECRET)
    decoded = decode_token(token, SECRET)
    assert decoded is not None
    assert decoded["sub"] == "usr_1"
    assert decoded["exp"] == claims["exp"]


def test_token_with_customer_id_claim():
    claims = build_claims(
        {
            "sub": "usr_9",
            "email": "c@x.test",
            "name": "C",
            "role": "CUSTOMER",
            "customer_id": "cus_1",
            "ttl_ms": 1800000,
        }
    )
    assert claims["customerId"] == "cus_1"


def test_expired_token_is_rejected():
    token = encode_token(_claims(exp_ms=int(time.time() * 1000) - 1000), SECRET)
    assert decode_token(token, SECRET) is None


def test_tampered_signature_is_rejected():
    token = encode_token(_claims(), SECRET)
    parts = token.split(".")
    forged = jwt.encode(_claims(), "other-secret-0123456789-01234567-zz", algorithm="HS256")
    assert decode_token(".".join([parts[0], parts[1], forged.split(".")[2]]), SECRET) is None


def test_garbage_token_is_rejected():
    assert decode_token("", SECRET) is None
    assert decode_token("abc.def.ghi", SECRET) is None


def test_missing_sub_or_role_is_rejected():
    claims = _claims()
    del claims["sub"]
    token = jwt.encode(claims, SECRET, algorithm="HS256")
    assert decode_token(token, SECRET) is None


def test_verify_password_with_seed_marker_fallback():
    marker = "$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234"
    assert verify_password(marker, "demo1234", demo_password="demo1234") is True
    assert verify_password(marker, "wrong", demo_password="demo1234") is False


def test_verify_password_with_real_bcrypt_hash():
    hashed = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode("utf-8")
    assert verify_password(hashed, "secret123") is True
    assert verify_password(hashed, "secret124") is False


def test_uuid_generation_shape():
    value = str(uuid.uuid4())
    assert len(value) == 36
