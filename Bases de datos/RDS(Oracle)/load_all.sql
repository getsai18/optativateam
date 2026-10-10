-- =============================================================================
-- Sistema de Facturación — Carga completa ORACLE
-- Archivo: load_all.sql
-- Ejecuta en orden: esquema -> datos de prueba -> procedimientos.
-- NO incluye 03_example_queries.sql (es un archivo de demostración manual).
--
-- Uso con SQLcl (recomendado) o SQL*Plus desde esta carpeta:
--   sql <usuario>/<password>@<host>:<puerto>/<servicio> @load_all.sql
--   sql <usuario>/<password>@<endpoint-rds>:1521/<service_name> @load_all.sql
-- =============================================================================

WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

@@01_schema.sql
@@02_seed_test_data.sql
@@04_procedures.sql

PROMPT ============================================================
PROMPT Carga completa finalizada (esquema + datos + procedimientos).
PROMPT Verificar con: SELECT COUNT(*) FROM invoice;
PROMPT ============================================================
