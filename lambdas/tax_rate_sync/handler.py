"""Sincroniza tax.current_rate con tax_history (EventBridge, 1 vez al día).

Problema que resuelve: POST /taxes/{id}/rates con validFrom futuro deja la tasa "programada",
pero nada actualiza tax.current_rate cuando esa fecha llega. Esta Lambda aplica la regla del
frontend (validFrom <= hoy < validTo, UTC) y corrige las tasas vigentes.

Variables de entorno:
  DB_ENGINE    mysql | postgres           (default mysql)
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  DB_SSL       require (default) | disable
  DB_SECRET_ARN  (opcional) secreto de Secrets Manager con {username,password,host,port,dbname}
Sin VPC: la Lambda llega al endpoint público del RDS; el SG del RDS debe permitir su puerto.
"""

import datetime
import json
import os


def _secret() -> dict:
    arn = os.environ.get("DB_SECRET_ARN")
    if not arn:
        return {}
    import boto3

    value = boto3.client("secretsmanager").get_secret_value(SecretId=arn)["SecretString"]
    return json.loads(value)


def _connect():
    secret = _secret()
    engine = os.environ.get("DB_ENGINE", "mysql").strip().lower()
    host = secret.get("host") or os.environ["DB_HOST"]
    user = secret.get("username") or os.environ["DB_USER"]
    password = secret.get("password") or os.environ["DB_PASSWORD"]
    name = secret.get("dbname") or os.environ.get("DB_NAME", "billing_db")
    port = int(secret.get("port") or os.environ.get("DB_PORT") or (5432 if engine == "postgres" else 3306))
    # RDS público: se cifra la conexión (sin verificar certificado; usa DB_SSL=disable solo en local).
    use_tls = os.environ.get("DB_SSL", "require").strip().lower() != "disable"
    if engine == "postgres":
        import ssl

        import pg8000.dbapi

        context = None
        if use_tls:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        return pg8000.dbapi.connect(
            host=host, port=port, user=user, password=password, database=name, ssl_context=context
        )
    import pymysql

    ssl_arg = None
    if use_tls:
        import ssl

        ssl_arg = ssl.create_default_context()
        ssl_arg.check_hostname = False
        ssl_arg.verify_mode = ssl.CERT_NONE
    return pymysql.connect(
        host=host, port=port, user=user, password=password, database=name, autocommit=False, ssl=ssl_arg
    )


def _day(value) -> str:
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()[:10]
    return str(value)[:10]


def covering_rate(history: list[tuple], today: str) -> float | None:
    """history: [(valid_from, valid_to, rate)]. Misma regla que calculateTotals.rateOnDate."""
    for valid_from, valid_to, rate in history:
        if _day(valid_from) <= today and (valid_to is None or today < _day(valid_to)):
            return float(rate)
    return None


def handler(event=None, _context=None):
    today = (event or {}).get("today") or datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    conn = _connect()
    updated = []
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, code, current_rate FROM tax")
        taxes = cur.fetchall()
        cur.execute("SELECT tax_id, valid_from, valid_to, rate FROM tax_history ORDER BY tax_id, valid_from, id")
        by_tax: dict[int, list[tuple]] = {}
        for tax_id, valid_from, valid_to, rate in cur.fetchall():
            by_tax.setdefault(int(tax_id), []).append((valid_from, valid_to, rate))
        for tax_id, code, current in taxes:
            covering = covering_rate(by_tax.get(int(tax_id), []), today)
            if covering is None or abs(covering - float(current)) < 1e-9:
                continue
            cur.execute("UPDATE tax SET current_rate = %s WHERE id = %s", (covering, int(tax_id)))
            updated.append({"taxId": int(tax_id), "code": code, "from": float(current), "to": covering})
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    result = {"today": today, "updated": updated}
    print(json.dumps(result))
    return result
