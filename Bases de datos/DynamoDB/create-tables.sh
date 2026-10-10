#!/usr/bin/env bash
# =============================================================================
# Sistema de Facturación — Creación de tablas DynamoDB (AWS CLI)
# Archivo: create-tables.sh
# Alternativa manual al CloudFormation (cloudformation/dynamodb-tables.yaml).
# Uso: ./create-tables.sh [region]
# Requiere AWS CLI v2 con credenciales que permitan dynamodb:CreateTable.
# =============================================================================
set -euo pipefail

REGION="${1:-${AWS_REGION:-us-east-1}}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for t in audit_log invoice_event user_session invoice_cart; do
  echo "==> Creando tabla desde cli/$t.json ..."
  aws dynamodb create-table --region "$REGION" \
    --cli-input-json "file://$DIR/cli/$t.json"
done

echo "==> Esperando a que las tablas estén activas ..."
for t in billing_audit_log billing_invoice_event billing_user_session billing_invoice_cart; do
  aws dynamodb wait table-exists --region "$REGION" --table-name "$t"
  echo "    $t ACTIVE"
done

echo "Tablas creadas. (El TTL de user_session e invoice_cart ya viene habilitado en los JSON.)"
