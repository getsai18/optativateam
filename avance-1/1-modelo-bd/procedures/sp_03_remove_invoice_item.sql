-- =============================================================================
-- sp_remove_invoice_item
-- Quita una línea de una factura en borrador y recalcula los totales.
-- Roles: ADMIN, BILLER
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_remove_invoice_item;

DELIMITER $$

CREATE PROCEDURE sp_remove_invoice_item(
    IN p_invoice_id INT UNSIGNED,
    IN p_detail_id  INT UNSIGNED,
    IN p_user_id    INT UNSIGNED
)
BEGIN
    DECLARE v_status VARCHAR(20) DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN,BILLER');

    START TRANSACTION;

    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    IF v_status <> 'DRAFT' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se pueden modificar facturas en borrador';
    END IF;

    DELETE FROM invoice_detail
    WHERE id = p_detail_id AND invoice_id = p_invoice_id;

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La linea no existe en esta factura';
    END IF;

    CALL sp_recalculate_invoice(p_invoice_id);

    COMMIT;
END$$

DELIMITER ;
