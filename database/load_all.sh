#!/usr/bin/env bash
# Carga el schema, los catálogos base y todos los Stored Procedures en un MySQL/RDS.
# Uso:  ./database/load_all.sh <host> <usuario>
# Pide la contraseña una sola vez. Requiere el cliente `mysql` (MySQL 8).
set -euo pipefail

HOST="${1:?Uso: $0 <host> <usuario>}"
DB_USER="${2:?Uso: $0 <host> <usuario>}"
DIR="$(cd "$(dirname "$0")" && pwd)"

read -rsp "Contraseña de ${DB_USER}@${HOST}: " MYSQL_PWD
echo
export MYSQL_PWD

run() {
  echo ">> $1"
  mysql -h "$HOST" -u "$DB_USER" --default-character-set=utf8mb4 < "$1"
}

run "$DIR/schema/01_schema.sql"
run "$DIR/seeds/00_base_catalogs.sql"
for f in "$DIR"/procedures/sp_*.sql; do
  run "$f"
done

echo "Listo: base billing_db creada con tablas, catálogos y Stored Procedures."
