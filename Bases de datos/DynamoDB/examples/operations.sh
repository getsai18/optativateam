#!/usr/bin/env bash
# =============================================================================
# Sistema de Facturación — Ejemplos de operaciones DynamoDB (AWS CLI v2)
# Archivo: examples/operations.sh
#
# Demuestra GetItem, PutItem, UpdateItem, DeleteItem, Query y Scan sobre las
# 4 tablas, con los patrones de acceso reales del frontend:
#   - writeAudit() en cada mutación       -> PutItem en audit_log
#   - AuditPage (lista global desc)       -> Query al GSI feed_pk-event_ts-index
#   - actividad por usuario               -> Query al GSI user_id-event_ts-index
#   - historial de estados de una factura -> Query a invoice_event por invoice_id
#   - login/validación de sesión          -> PutItem/GetItem en user_session
#   - builderStore (wizard de factura)    -> PutItem/UpdateItem/DeleteItem en cart
#
# Requiere: AWS CLI v2 configurado (aws configure) y permisos sobre las tablas.
# NO ejecuta nada destructivo fuera de las tablas de prueba.
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
AUDIT="billing_audit_log"
EVENTS="billing_invoice_event"
SESSIONS="billing_user_session"
CARTS="billing_invoice_cart"

ddb() { aws dynamodb "$@" --region "$REGION"; }

echo "== 1) PutItem: auditoría tras crear un cliente (writeAudit) =="
ddb put-item --table-name "$AUDIT" --item '{
  "entity_key": {"S": "CUSTOMER#99"},
  "event_ts":   {"S": "2026-10-10T16:00:00.000Z"},
  "feed_pk":    {"S": "AUDIT"},
  "user_id":    {"S": "1"},
  "action":     {"S": "customer.create"},
  "entity_type":{"S": "customer"},
  "entity_id":  {"S": "99"}
}'

echo "== 2) Query: feed global de auditoría (AuditPage, más recientes primero) =="
ddb query --table-name "$AUDIT" \
  --index-name feed_pk-event_ts-index \
  --key-condition-expression "feed_pk = :pk" \
  --expression-attribute-values '{":pk": {"S": "AUDIT"}}' \
  --scan-index-forward false --limit 10

echo "== 3) Query: historial de auditoría de UNA factura (por entidad) =="
ddb query --table-name "$AUDIT" \
  --key-condition-expression "entity_key = :ek" \
  --expression-attribute-values '{":ek": {"S": "INVOICE#2"}}'

echo "== 4) Query: actividad de un usuario (GSI user_id-event_ts-index) =="
ddb query --table-name "$AUDIT" \
  --index-name user_id-event_ts-index \
  --key-condition-expression "user_id = :u" \
  --expression-attribute-values '{":u": {"S": "2"}}' \
  --scan-index-forward false --limit 20

echo "== 5) PutItem: evento de ciclo de vida al emitir una factura =="
ddb put-item --table-name "$EVENTS" --item '{
  "invoice_id": {"S": "5"},
  "event_ts":   {"S": "2026-10-10T16:05:00.000Z"},
  "event_type": { "S": "ISSUED" },
  "from_status":{ "S": "DRAFT" },
  "to_status":  { "S": "ISSUED" },
  "user_id":    {"S": "2"},
  "details":    {"M": {"folio": {"S": "INV-2026-0004"}, "total": {"N": "3132.00"}}}
}'

echo "== 6) Query: historial completo de estados de una factura =="
ddb query --table-name "$EVENTS" \
  --key-condition-expression "invoice_id = :i" \
  --expression-attribute-values '{":i": {"S": "3"}}'

echo "== 7) PutItem: crear sesión al hacer login (TTL = expiración epoch seg) =="
ddb put-item --table-name "$SESSIONS" --item '{
  "session_id": {"S": "11111111-2222-4333-8444-555555555555"},
  "user_id":    {"S": "2"},
  "role":       {"S": "BILLER"},
  "created_at": {"S": "2026-10-10T16:10:00.000Z"},
  "expires_at": {"S": "2026-10-10T16:40:00.000Z"},
  "ttl":        {"N": "1791647400"}
}'

echo "== 8) GetItem: validar sesión en cada request (por session_id del JWT) =="
ddb get-item --table-name "$SESSIONS" \
  --key '{"session_id": {"S": "11111111-2222-4333-8444-555555555555"}}'

echo "== 9) Query: todas las sesiones de un usuario (logout global) =="
ddb query --table-name "$SESSIONS" \
  --index-name user_id-index \
  --key-condition-expression "user_id = :u" \
  --expression-attribute-values '{":u": {"S": "2"}}'

echo "== 10) DeleteItem: revocar (logout) una sesión =="
ddb delete-item --table-name "$SESSIONS" \
  --key '{"session_id": {"S": "11111111-2222-4333-8444-555555555555"}}'

echo "== 11) PutItem: guardar/actualizar carrito del builder (un carrito por usuario) =="
ddb put-item --table-name "$CARTS" --item '{
  "user_id":     {"S": "2"},
  "customer_id": {"S": "2"},
  "items": {"L": [
    {"M": {"service_id": {"S": "1"}, "quantity": {"N": "2"}}},
    {"M": {"service_id": {"S": "9"}, "quantity": {"N": "1"}}}
  ]},
  "step":       {"N": "2"},
  "updated_at": {"S": "2026-10-10T16:15:00.000Z"},
  "ttl":        {"N": "1792248000"}
}'

echo "== 12) GetItem: reanudar el builder al volver a la página =="
ddb get-item --table-name "$CARTS" --key '{"user_id": {"S": "2"}}'

echo "== 13) UpdateItem: cambiar cantidad del primer servicio del carrito =="
ddb update-item --table-name "$CARTS" \
  --key '{"user_id": {"S": "2"}}' \
  --update-expression "SET #i[0].quantity = :q, updated_at = :ts" \
  --expression-attribute-names '{"#i": "items"}' \
  --expression-attribute-values '{":q": {"N": "4"}, ":ts": {"S": "2026-10-10T16:20:00.000Z"}}'

echo "== 14) DeleteItem: limpiar carrito al guardar la factura =="
ddb delete-item --table-name "$CARTS" --key '{"user_id": {"S": "2"}}'

echo "== 15) Scan (uso ocasional): volcado de auditoría para exportación =="
ddb scan --table-name "$AUDIT" --max-items 5

echo "== 16) PutItem: cancelación de factura deja evento + auditoría =="
ddb put-item --table-name "$EVENTS" --item '{
  "invoice_id": {"S": "4"},
  "event_ts":   {"S": "2026-10-10T16:30:00.000Z"},
  "event_type": { "S": "CANCELLED" },
  "from_status":{ "S": "ISSUED" },
  "to_status":  { "S": "CANCELLED" },
  "user_id":    {"S": "1"},
  "details":    {"M": {"reason": {"S": "Cancelación a solicitud del cliente"}}}
}'
ddb put-item --table-name "$AUDIT" --item '{
  "entity_key": {"S": "INVOICE#4"},
  "event_ts":   {"S": "2026-10-10T16:30:00.000Z"},
  "feed_pk":    {"S": "AUDIT"},
  "user_id":    {"S": "1"},
  "action":     {"S": "invoice.cancel"},
  "entity_type":{"S": "invoice"},
  "entity_id":  {"S": "4"}
}'

echo "Operaciones de ejemplo completadas."
