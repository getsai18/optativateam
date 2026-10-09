-- =============================================================================
-- sp_register_payment
-- Registra un pago SIMULADO sobre una factura emitida. Permite pagos parciales:
-- cuando la suma de pagos aprobados iguala el total, la factura pasa a PAID.
-- Roles: ADMIN, BILLER
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_register_payment;

DELIMITER $$

CREATE PROCEDURE sp_register_payment(
    IN p_invoice_id        INT UNSIGNED,
    IN p_payment_method_id TINYINT UNSIGNED,
    IN p_amount            DECIMAL(12,2),
    IN p_reference         VARCHAR(60),
    IN p_user_id           INT UNSIGNED
)
BEGIN
    DECLARE v_status  VARCHAR(20)   DEFAULT NULL;
    DECLARE v_total   DECIMAL(12,2) DEFAULT 0;
    DECLARE v_paid    DECIMAL(12,2) DEFAULT 0;
    DECLARE v_pending DECIMAL(12,2) DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN,BILLER');

    IF p_amount IS NULL OR p_amount <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser mayor a cero';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM payment_method WHERE id = p_payment_method_id AND active = 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Metodo de pago invalido';
    END IF;

    START TRANSACTION;

    SELECT status, total INTO v_status, v_total
    FROM invoice
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    IF v_status <> 'ISSUED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se pueden pagar facturas emitidas';
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM payment
    WHERE invoice_id = p_invoice_id AND status = 'APPROVED';

    SET v_pending = v_total - v_paid;

    IF p_amount > v_pending THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto excede el saldo pendiente de la factura';
    END IF;

    INSERT INTO payment (invoice_id, payment_method_id, amount, reference, status)
    VALUES (p_invoice_id, p_payment_method_id, p_amount,
            COALESCE(NULLIF(TRIM(p_reference), ''), CONCAT('SIM-', REPLACE(UUID(), '-', ''))),
            'APPROVED');

    IF p_amount = v_pending THEN
        UPDATE invoice SET status = 'PAID', paid_at = NOW() WHERE id = p_invoice_id;
    END IF;

    COMMIT;

    SELECT p_invoice_id                          AS invoice_id,
           v_total                               AS total,
           v_paid + p_amount                     AS paid_amount,
           v_pending - p_amount                  AS pending_amount,
           IF(p_amount = v_pending, 'PAID', 'ISSUED') AS invoice_status;
END$$

DELIMITER ;
