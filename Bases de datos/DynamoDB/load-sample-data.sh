#!/usr/bin/env bash
# =============================================================================
# Sistema de Facturación — Carga de datos de ejemplo en DynamoDB
# Archivo: load-sample-data.sh
# Usa batch-write-item con los JSON de data/. Uso: ./load-sample-data.sh [region]
# Cada JSON de data/ ya tiene el formato {"tabla": [ {"PutRequest": ...}, ... ]}
# que espera batch-write-item.
# NOTA: los `ttl` de los JSON son valores fijos de ejemplo; en un entorno real
# se calculan en la aplicación como epoch segundos (ahora + TTL del recurso).
# =============================================================================
set -euo pipefail

REGION="${1:-${AWS_REGION:-us-east-1}}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for pair in \
  "audit_log_items.json" \
  "invoice_event_items.json" \
  "user_session_items.json" \
  "invoice_cart_items.json"
do
  echo "==> Cargando data/$pair ..."
  aws dynamodb batch-write-item \
    --region "$REGION" \
    --request-items "file://$DIR/data/$pair"
done

echo "Datos de ejemplo cargados (verificar que no haya UnprocessedItems en la salida)."
