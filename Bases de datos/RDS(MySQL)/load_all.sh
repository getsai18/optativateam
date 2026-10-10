#!/usr/bin/env bash
# =============================================================================
# Sistema de Facturación — Carga completa (MySQL)
# Archivo: load_all.sh
# Ejecuta en orden: esquema -> datos de prueba -> procedimientos.
# NO incluye 03_example_queries.sql (archivo de demostración manual).
#
# Uso:
#   ./load_all.sh <host> <usuario> [puerto] [base]
#   ./load_all.sh <endpoint-rds> billing_app 3306 billing_db
#
# Requiere el cliente `mysql` (MySQL 8.0.16+) y pide la contraseña por stdin.
# =============================================================================
set -euo pipefail

HOST="${1:?Uso: ./load_all.sh <host> <usuario> [puerto] [base]}"
USER="${2:?Falta el usuario}"
PORT="${3:-3306}"
DB="${4:-billing_db}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Host: $HOST  Puerto: $PORT  Usuario: $USER  Base: $DB"
read -r -s -p "Contraseña: " PASSWORD
echo

MYSQL_ARGS=(-h "$HOST" -P "$PORT" -u "$USER" -p"$PASSWORD" --default-character-set=utf8mb4)

echo "==> 01_schema.sql"
mysql "${MYSQL_ARGS[@]}" < "$SCRIPT_DIR/01_schema.sql"

echo "==> 02_seed_test_data.sql"
mysql "${MYSQL_ARGS[@]}" < "$SCRIPT_DIR/02_seed_test_data.sql"

echo "==> 04_procedures.sql"
mysql "${MYSQL_ARGS[@]}" < "$SCRIPT_DIR/04_procedures.sql"

echo "==> Verificación"
mysql "${MYSQL_ARGS[@]}" -e "USE $DB;
  SELECT (SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = '$DB') AS tablas;
  SELECT id, folio, status, total FROM invoice ORDER BY id;
  SELECT COUNT(*) AS sps FROM information_schema.routines
   WHERE routine_schema = '$DB' AND routine_type IN ('PROCEDURE','FUNCTION');"

echo "Carga completa finalizada."
