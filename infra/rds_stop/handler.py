"""Apaga únicamente las instancias RDS listadas en DB_IDS (cuenta de datos del Learner Lab).

Esta Lambda se despliega en la **cuenta de datos**, porque ahí viven los RDS; la plantilla
`infra/template.yaml` corresponde a la cuenta de aplicación. EventBridge la dispara cada día a
las 04:00 UTC (22:00 en CDMX): un RDS detenido manualmente vuelve a encenderse solo a los 7 días.

El evento de EventBridge NO decide qué instancias apagar: la única fuente de identificadores es
`DB_IDS` (CSV). Así nunca se detiene una instancia que no esté explícitamente en la lista.

Variables de entorno: DB_IDS (CSV de identificadores, sin secretos), p. ej.
`Facturacion_Mysql,postgres`.
"""

import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

rds = boto3.client("rds")


def handler(event=None, _context=None):
    """Detiene los RDS de DB_IDS y devuelve un resumen por instancia.

    Cada instancia se intenta por separado: un fallo parcial no aborta las demás. Las
    instancias ya detenidas (InvalidDBInstanceStateFault) se cuentan aparte, no como error.
    """
    raw = os.environ.get("DB_IDS", "")
    # CSV: se recortan espacios, se ignoran entradas vacías y se eliminan duplicados.
    db_ids = list(dict.fromkeys(item.strip() for item in raw.split(",") if item.strip()))

    stopped = []
    already_stopped = []
    failed = []

    if not db_ids:
        logger.warning("DB_IDS vacío o no definido: no se apaga ninguna instancia")
        return {
            "requested": db_ids,
            "stopped": stopped,
            "already_stopped": already_stopped,
            "failed": failed,
        }

    logger.info("Instancias solicitadas en DB_IDS: %s", ", ".join(db_ids))
    for db_id in db_ids:
        # Los comodines no son identificadores válidos: nunca se convierten en "apagar todas".
        if "*" in db_id:
            logger.warning("Identificador con comodín ignorado: %r", db_id)
            failed.append(db_id)
            continue
        try:
            rds.stop_db_instance(DBInstanceIdentifier=db_id)
        except rds.exceptions.InvalidDBInstanceStateFault:
            logger.info("%s ya estaba detenida", db_id)
            already_stopped.append(db_id)
        except Exception as exc:  # noqa: BLE001 - tolerancia a fallos parciales
            logger.exception("No se pudo apagar %s: %s", db_id, exc)
            failed.append(db_id)
        else:
            logger.info("Apagado solicitado para %s", db_id)
            stopped.append(db_id)

    logger.info("Resumen: stopped=%s already_stopped=%s failed=%s", stopped, already_stopped, failed)
    return {
        "requested": db_ids,
        "stopped": stopped,
        "already_stopped": already_stopped,
        "failed": failed,
    }
