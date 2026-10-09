-- =============================================================================
-- sp_issue_invoice
-- Emite (timbrado simbólico) una factura en borrador: recalcula una última vez,
-- asigna folio, cambia el estado a ISSUED y fija la fecha de emisión.
-- Después de emitida, la factura ya no se puede modificar.
-- Roles: ADMIN, BILLER
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_issue_invoice;

DELIMITER $$

CREATE PROCEDURE sp_issue_invoice(
    IN p_invoice_id INT UNSIGNED,
    IN p_user_id    INT UNSIGNED
)
BEGIN
    DECLARE v_status VARCHAR(20)   DEFAULT NULL;
    DECLARE v_lines  INT           DEFAULT 0;
    DECLARE v_total  DECIMAL(12,2) DEFAULT 0;

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
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se pueden emitir facturas en borrador';
    END IF;

    SELECT COUNT(*) INTO v_lines FROM invoice_detail WHERE invoice_id = p_invoice_id;
    IF v_lines = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La factura no tiene servicios';
    END IF;

    CALL sp_recalculate_invoice(p_invoice_id);

    SELECT total INTO v_total FROM invoice WHERE id = p_invoice_id;
    IF v_total <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El total de la factura debe ser mayor a cero';
    END IF;

    UPDATE invoice
    SET status    = 'ISSUED',
        issued_at = NOW(),
        folio     = CONCAT('FAC-', YEAR(NOW()), '-', LPAD(p_invoice_id, 6, '0'))
    WHERE id = p_invoice_id;

    COMMIT;

    SELECT id, uuid, folio, status, subtotal, discount_total, tax_total, total, issued_at
    FROM invoice
    WHERE id = p_invoice_id;
END$$

DELIMITER ;
