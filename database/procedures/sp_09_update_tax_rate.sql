-- =============================================================================
-- sp_update_tax_rate
-- Cambia la tasa de un impuesto conservando el histórico: cierra la vigencia
-- de la tasa actual (un día antes) y abre una nueva con la fecha indicada.
-- Si la nueva vigencia ya empezó, también actualiza tax.current_rate.
-- Las facturas ya emitidas no se afectan (guardan su propio impuesto).
-- Roles: ADMIN
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_update_tax_rate;

DELIMITER $$

CREATE PROCEDURE sp_update_tax_rate(
    IN p_tax_id     SMALLINT UNSIGNED,
    IN p_new_rate   DECIMAL(6,4),           -- 0.1600 = 16 %
    IN p_valid_from DATE,
    IN p_user_id    INT UNSIGNED
)
BEGIN
    DECLARE v_hist_id   INT UNSIGNED DEFAULT NULL;
    DECLARE v_hist_from DATE         DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN');

    IF NOT EXISTS (SELECT 1 FROM tax WHERE id = p_tax_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El impuesto no existe';
    END IF;
    IF p_new_rate IS NULL OR p_new_rate < 0 OR p_new_rate > 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La tasa debe estar entre 0 y 1 (ej. 0.16 = 16%)';
    END IF;
    IF p_valid_from IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha de vigencia es obligatoria';
    END IF;

    START TRANSACTION;

    SELECT id, valid_from INTO v_hist_id, v_hist_from
    FROM tax_history
    WHERE tax_id = p_tax_id AND valid_to IS NULL
    ORDER BY valid_from DESC
    LIMIT 1
    FOR UPDATE;

    IF v_hist_id IS NOT NULL THEN
        IF p_valid_from <= v_hist_from THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La nueva vigencia debe ser posterior a la vigencia actual';
        END IF;

        UPDATE tax_history
        SET valid_to = DATE_SUB(p_valid_from, INTERVAL 1 DAY)
        WHERE id = v_hist_id;
    END IF;

    INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
    VALUES (p_tax_id, p_new_rate, p_valid_from, NULL, p_user_id);

    IF p_valid_from <= CURDATE() THEN
        UPDATE tax SET current_rate = p_new_rate WHERE id = p_tax_id;
    END IF;

    COMMIT;

    SELECT t.id AS tax_id, t.code, t.current_rate, p_new_rate AS new_rate, p_valid_from AS valid_from
    FROM tax t
    WHERE t.id = p_tax_id;
END$$

DELIMITER ;
