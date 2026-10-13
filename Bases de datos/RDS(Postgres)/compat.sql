-- =============================================================================
-- Ajustes para que el backend funcione con el catálogo en RDS Postgres.
-- Es idempotente: se puede ejecutar varias veces. Ejecutar en la base del catálogo.
-- Si tus tablas tienen otro nombre/esquema, ajusta antes de correrlo.
-- =============================================================================

-- 1. Quién cambió la tasa (el backend lo escribe en POST /taxes/{id}/rates).
ALTER TABLE tax_history ADD COLUMN IF NOT EXISTS changed_by INTEGER NULL;

-- 2. A lo más UN periodo abierto (valid_to IS NULL) por impuesto.
--    En Postgres UNIQUE (tax_id, valid_to) NO detecta duplicados con NULL; este índice parcial sí.
--    Falla si ya hay un impuesto con dos periodos abiertos: revisa con
--      SELECT tax_id, COUNT(*) FROM tax_history WHERE valid_to IS NULL GROUP BY tax_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_history_open
    ON tax_history (tax_id) WHERE valid_to IS NULL;
