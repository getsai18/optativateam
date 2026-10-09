-- =============================================================================
-- sp_assert_user_role  (helper)
-- Valida que el usuario exista, esté activo y tenga uno de los roles permitidos.
-- Si no cumple, lanza un error (SQLSTATE 45000) y el SP que lo llamó se cancela.
-- Defensa en profundidad: la API también valida el rol con el JWT.
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_assert_user_role;

DELIMITER $$

CREATE PROCEDURE sp_assert_user_role(
    IN p_user_id       INT UNSIGNED,
    IN p_allowed_roles VARCHAR(100)      -- lista separada por comas, sin espacios: 'ADMIN,BILLER'
)
BEGIN
    DECLARE v_role VARCHAR(30) DEFAULT NULL;

    SELECT r.name INTO v_role
    FROM app_user u
    JOIN role r ON r.id = u.role_id
    WHERE u.id = p_user_id
      AND u.active = 1;

    IF v_role IS NULL OR FIND_IN_SET(v_role, p_allowed_roles) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Usuario inexistente, inactivo o sin permiso para esta operacion';
    END IF;
END$$

DELIMITER ;
