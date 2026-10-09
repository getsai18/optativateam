-- =============================================================================
-- sp_cancel_invoice
-- Cancelación atómica: en una sola transacción marca los pagos aprobados como
-- REFUNDED (reembolso simulado) y deja la factura en CANCELLED con su motivo.
-- No se puede cancelar una factura ya cancelada ni una emitida en un mes cerrado.
-- Roles: ADMIN, BILLER
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_cancel_invoice;

DELIMITER $$

CREATE PROCEDURE sp_cancel_invoice(
    IN p_invoice_id INT UNSIGNED,
    IN p_user_id    INT UNSIGNED,
    IN p_reason     VARCHAR(255)
)
BEGIN
    DECLARE v_status    VARCHAR(20) DEFAULT NULL;
    DECLARE v_issued_at DATETIME    DEFAULT NULL;
    DECLARE v_refunded  INT         DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN,BILLER');

    IF p_reason IS NULL OR CHAR_LENGTH(TRIM(p_reason)) < 5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Debe indicar el motivo de cancelacion (minimo 5 caracteres)';
    END IF;

    START TRANSACTION;

    SELECT status, issued_at INTO v_status, v_issued_at
    FROM invoice
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    IF v_status = 'CANCELLED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La factura ya esta cancelada';
    END IF;

    IF v_issued_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM monthly_closing
        WHERE period_year = YEAR(v_issued_at) AND period_month = MONTH(v_issued_at)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede cancelar: el periodo de emision ya esta cerrado';
    END IF;

    UPDATE payment
    SET status = 'REFUNDED'
    WHERE invoice_id = p_invoice_id AND status = 'APPROVED';
    SET v_refunded = ROW_COUNT();

    UPDATE invoice
    SET status              = 'CANCELLED',
        cancelled_at        = NOW(),
        cancellation_reason = TRIM(p_reason)
    WHERE id = p_invoice_id;

    COMMIT;

    SELECT p_invoice_id AS invoice_id, 'CANCELLED' AS status, v_refunded AS payments_refunded;
END$$

DELIMITER ;
