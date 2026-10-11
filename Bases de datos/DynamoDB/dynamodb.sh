#!/usr/bin/env bash
# =============================================================================
# Sistema de Facturación — Tablas DynamoDB (AWS CLI v2)
# Archivo: dynamodb.sh
# Uso: ./dynamodb.sh [region]      (por defecto us-east-1)
# Requiere credenciales con dynamodb:CreateTable y dynamodb:UpdateTimeToLive.
#
# Tablas (todas PAY_PER_REQUEST):
#   billing_audit_log     auditoria de cada mutacion (writeAudit del frontend)
#   billing_invoice_event historial de estados por factura
#   billing_user_session  sesiones con TTL (login)
#   billing_invoice_cart  carrito del wizard de factura con TTL (builderStore)
#
# Notas de diseño:
#   - audit_log.event_ts e invoice_event.event_ts guardan "<ISO-8601>#<uuid>"
#     para que dos eventos en el mismo milisegundo NO se sobrescriban.
#   - feed_pk es constante "AUDIT": alimenta el GSI del feed global de AuditPage
#     (Query + ScanIndexForward=false, sin Scan).
#   - El TTL NO se declara en create-table: se activa con update-time-to-live.
# =============================================================================
set -euo pipefail

REGION="${1:-${AWS_REGION:-us-east-1}}"

create() {
  echo "==> Creando $1 ..."
  aws dynamodb create-table --region "$REGION" --cli-input-json "$2" >/dev/null
}

create billing_audit_log '{
  "TableName": "billing_audit_log",
  "BillingMode": "PAY_PER_REQUEST",
  "AttributeDefinitions": [
    { "AttributeName": "entity_key", "AttributeType": "S" },
    { "AttributeName": "event_ts",   "AttributeType": "S" },
    { "AttributeName": "user_id",    "AttributeType": "S" },
    { "AttributeName": "feed_pk",    "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "entity_key", "KeyType": "HASH" },
    { "AttributeName": "event_ts",   "KeyType": "RANGE" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "user_id-event_ts-index",
      "KeySchema": [
        { "AttributeName": "user_id",  "KeyType": "HASH" },
        { "AttributeName": "event_ts", "KeyType": "RANGE" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    },
    {
      "IndexName": "feed_pk-event_ts-index",
      "KeySchema": [
        { "AttributeName": "feed_pk",  "KeyType": "HASH" },
        { "AttributeName": "event_ts", "KeyType": "RANGE" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "Tags": [
    { "Key": "project", "Value": "billing-system" },
    { "Key": "component", "Value": "audit" }
  ]
}'

create billing_invoice_event '{
  "TableName": "billing_invoice_event",
  "BillingMode": "PAY_PER_REQUEST",
  "AttributeDefinitions": [
    { "AttributeName": "invoice_id", "AttributeType": "S" },
    { "AttributeName": "event_ts",   "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "invoice_id", "KeyType": "HASH" },
    { "AttributeName": "event_ts",   "KeyType": "RANGE" }
  ],
  "Tags": [
    { "Key": "project", "Value": "billing-system" },
    { "Key": "component", "Value": "invoice-lifecycle" }
  ]
}'

create billing_user_session '{
  "TableName": "billing_user_session",
  "BillingMode": "PAY_PER_REQUEST",
  "AttributeDefinitions": [
    { "AttributeName": "session_id", "AttributeType": "S" },
    { "AttributeName": "user_id",    "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "session_id", "KeyType": "HASH" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "user_id-index",
      "KeySchema": [
        { "AttributeName": "user_id", "KeyType": "HASH" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "Tags": [
    { "Key": "project", "Value": "billing-system" },
    { "Key": "component", "Value": "auth" }
  ]
}'

create billing_invoice_cart '{
  "TableName": "billing_invoice_cart",
  "BillingMode": "PAY_PER_REQUEST",
  "AttributeDefinitions": [
    { "AttributeName": "user_id", "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "user_id", "KeyType": "HASH" }
  ],
  "Tags": [
    { "Key": "project", "Value": "billing-system" },
    { "Key": "component", "Value": "invoice-builder" }
  ]
}'

echo "==> Esperando a que las tablas esten activas ..."
for t in billing_audit_log billing_invoice_event billing_user_session billing_invoice_cart; do
  aws dynamodb wait table-exists --region "$REGION" --table-name "$t"
  echo "    $t ACTIVE"
done

echo "==> Activando TTL (atributo 'ttl', epoch en segundos) ..."
for t in billing_user_session billing_invoice_cart; do
  aws dynamodb update-time-to-live --region "$REGION" --table-name "$t" \
    --time-to-live-specification "Enabled=true,AttributeName=ttl" >/dev/null
  echo "    $t TTL habilitado"
done

echo "Listo: 4 tablas creadas."
