-- =============================================================================
-- Migración idempotente de roles (RDS MySQL 8) para una base YA EXISTENTE.
--   * Crea el catálogo app_role y siembra ADMIN/BILLER/CUSTOMER (INSERT IGNORE).
--   * Agrega app_user.role_id (NOT NULL, FK a app_role.id) si aún no existe.
--   * Sincroniza role_id con role y (re)crea los triggers que lo mantienen.
-- No borra datos: se puede ejecutar varias veces. En una base reconstruida con
-- 01_schema.sql no cambia nada (catálogo, columna, FK y triggers ya existen).
-- Aplicar con `python database/apply.py` (incluido en MYSQL_BASE) o con el
-- cliente mysql: `mysql < database/mysql/05_roles_migration.sql`.
-- =============================================================================

-- 1. Catálogo de roles. IDs fijos para que el backfill sea determinista.
CREATE TABLE IF NOT EXISTS app_role (
    id           TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code         VARCHAR(10)      NOT NULL,
    description  VARCHAR(100)     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_role_code (code)
) ENGINE=InnoDB;

INSERT IGNORE INTO app_role (id, code, description) VALUES
    (1, 'ADMIN',    'Administrador: acceso completo'),
    (2, 'BILLER',   'Facturador: crea y gestiona facturas'),
    (3, 'CUSTOMER', 'Cliente: solo consulta sus facturas');

DELIMITER $$

-- Helpers condicionales (MySQL 8 no soporta ADD COLUMN IF NOT EXISTS).
DROP PROCEDURE IF EXISTS _roles_add_column_if_missing$$
CREATE PROCEDURE _roles_add_column_if_missing()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = DATABASE() AND table_name = 'app_user'
                     AND column_name = 'role_id') THEN
        ALTER TABLE app_user ADD COLUMN role_id TINYINT UNSIGNED NULL AFTER `role`;
    END IF;
END$$

DROP PROCEDURE IF EXISTS _roles_make_not_null$$
CREATE PROCEDURE _roles_make_not_null()
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'app_user'
                 AND column_name = 'role_id' AND is_nullable = 'YES') THEN
        ALTER TABLE app_user MODIFY COLUMN role_id TINYINT UNSIGNED NOT NULL;
    END IF;
END$$

DROP PROCEDURE IF EXISTS _roles_add_index_and_fk$$
CREATE PROCEDURE _roles_add_index_and_fk()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
                   WHERE table_schema = DATABASE() AND table_name = 'app_user'
                     AND index_name = 'ix_app_user_role') THEN
        ALTER TABLE app_user ADD KEY ix_app_user_role (role_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_schema = DATABASE() AND table_name = 'app_user'
                     AND constraint_name = 'fk_app_user_role'
                     AND constraint_type = 'FOREIGN KEY') THEN
        ALTER TABLE app_user ADD CONSTRAINT fk_app_user_role
            FOREIGN KEY (role_id) REFERENCES app_role (id);
    END IF;
END$$

DELIMITER ;

-- 2. Columna, backfill de filas existentes y restricciones.
CALL _roles_add_column_if_missing();

UPDATE app_user u JOIN app_role r ON r.code = u.role
   SET u.role_id = r.id
 WHERE u.role_id IS NULL OR u.role_id <> r.id;

CALL _roles_make_not_null();
CALL _roles_add_index_and_fk();

-- 3. La API sigue escribiendo solo `role`; los triggers derivan `role_id`.
DROP TRIGGER IF EXISTS trg_app_user_bi;
DELIMITER //
CREATE TRIGGER trg_app_user_bi BEFORE INSERT ON app_user
FOR EACH ROW
BEGIN
    SET NEW.role_id = (SELECT id FROM app_role WHERE code = NEW.role);
END//
DELIMITER ;

DROP TRIGGER IF EXISTS trg_app_user_bu;
DELIMITER //
CREATE TRIGGER trg_app_user_bu BEFORE UPDATE ON app_user
FOR EACH ROW
BEGIN
    SET NEW.role_id = (SELECT id FROM app_role WHERE code = NEW.role);
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS _roles_add_column_if_missing;
DROP PROCEDURE IF EXISTS _roles_make_not_null;
DROP PROCEDURE IF EXISTS _roles_add_index_and_fk;
