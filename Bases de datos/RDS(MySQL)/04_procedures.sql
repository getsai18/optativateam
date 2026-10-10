-- =============================================================================
-- Sistema de Facturación — Procedimientos almacenados (MySQL)
-- Archivo: 04_procedures.sql
-- Ejecutar después de 01_schema.sql y 02_seed_test_data.sql.
-- Mismo comportamiento que los procedimientos de la carpeta Oracle, adaptados a
-- la sintaxis MySQL 8 (DELIMITER, SIGNAL, funciones almacenadas).
--   - stamp() de invoiceService.ts    -> sp_issue_invoice
--   - registerPayment() del frontend  -> sp_register_payment
--   - cancelInvoice() del frontend    -> sp_cancel_invoice
--   - rateOnDate() de calculateTotals.ts -> fn_tax_rate_on
--   - Db.folioCounters                -> fn_next_folio
-- =============================================================================

USE billing_db;

-- -----------------------------------------------------------------------------
-- fn_tax_rate_on: tasa vigente de un impuesto en una fecha
-- Regla del frontend: validFrom <= fecha < validTo (validTo exclusivo, null abierto)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_tax_rate_on;

DELIMITER $$

CREATE FUNCTION fn_tax_rate_on (p_tax_id SMALLINT UNSIGNED, p_as_of DATE)
RETURNS DECIMAL(6,4)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_rate DECIMAL(6,4);

    SELECT rate INTO v_rate
      FROM tax_history
     WHERE tax_id = p_tax_id
       AND valid_from <= p_as_of
       AND (valid_to IS NULL OR p_as_of < valid_to)
     ORDER BY valid_from DESC
     LIMIT 1;

    IF v_rate IS NULL THEN
        SELECT current_rate INTO v_rate FROM tax WHERE id = p_tax_id;
    END IF;

    RETURN v_rate;
END$$

-- -----------------------------------------------------------------------------
-- fn_next_folio: incrementa el contador del año y devuelve el siguiente número
-- (frontend: Db.folioCounters + folio INV-YYYY-NNNN)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_next_folio;

CREATE FUNCTION fn_next_folio (p_year SMALLINT)
RETURNS INT
MODIFIES SQL DATA
BEGIN
    DECLARE v_next INT;

    UPDATE folio_counter
       SET last_number = last_number + 1
     WHERE year = p_year;

    IF ROW_COUNT() = 0 THEN
        INSERT INTO folio_counter (year, last_number) VALUES (p_year, 1);
        RETURN 1;
    END IF;

    SELECT last_number INTO v_next FROM folio_counter WHERE year = p_year;
    RETURN v_next;
END$$

-- -----------------------------------------------------------------------------
-- sp_issue_invoice: emite una factura en borrador ("timbrado simbólico").
--   1. Valida rol ADMIN/BILLER y estado DRAFT (máquina de estados).
--   2. Recalcula líneas y tasas al momento de emitir (criterio de
--      calculateTotals.ts).
--   3. Asigna folio INV-YYYY-NNNN y UUID, y fija issued_at.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_issue_invoice;

CREATE PROCEDURE sp_issue_invoice (
    IN p_invoice_id INT UNSIGNED,
    IN p_user_id    INT UNSIGNED
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_role   VARCHAR(10);
    DECLARE v_status VARCHAR(10);
    DECLARE v_year   SMALLINT;
    DECLARE v_next   INT;
    DECLARE v_lines  INT DEFAULT 0;
    DECLARE v_sub    DECIMAL(12,2);
    DECLARE v_tax    DECIMAL(12,2);
    DECLARE v_amt    DECIMAL(12,2);
    DECLARE v_rate   DECIMAL(6,4);
    DECLARE v_det_id INT UNSIGNED;
    DECLARE v_srv_id INT UNSIGNED;
    DECLARE v_qty    INT UNSIGNED;
    DECLARE v_price  DECIMAL(10,2);
    DECLARE v_done   INT DEFAULT 0;

    DECLARE cur_lines CURSOR FOR
        SELECT d.id, d.service_id, d.quantity, s.base_price
          FROM invoice_detail d
          JOIN service s ON s.id = d.service_id
         WHERE d.invoice_id = p_invoice_id;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT role INTO v_role FROM app_user WHERE id = p_user_id FOR UPDATE;
    IF v_role IS NULL OR v_role NOT IN ('ADMIN', 'BILLER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rol no autorizado para emitir facturas';
    END IF;

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

    -- Recalcula cada línea con los precios e impuestos vigentes a la fecha de emisión
    OPEN cur_lines;
    lines_loop: LOOP
        FETCH cur_lines INTO v_det_id, v_srv_id, v_qty, v_price;
        IF v_done = 1 THEN
            LEAVE lines_loop;
        END IF;

        SET v_sub = ROUND(v_qty * v_price, 2);
        SET v_tax = 0;

        DELETE FROM invoice_detail_tax WHERE invoice_detail_id = v_det_id;

        tax_loop: BEGIN
            DECLARE t_done INT DEFAULT 0;
            DECLARE v_tax_id SMALLINT UNSIGNED;
            DECLARE cur_taxes CURSOR FOR
                SELECT tax_id FROM service_tax WHERE service_id = v_srv_id;
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET t_done = 1;

            OPEN cur_taxes;
            taxes_iter: LOOP
                FETCH cur_taxes INTO v_tax_id;
                IF t_done = 1 THEN
                    LEAVE taxes_iter;
                END IF;
                SET v_rate = fn_tax_rate_on(v_tax_id, CURDATE());
                SET v_amt = ROUND(v_sub * v_rate, 2);
                INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
                VALUES (v_det_id, v_tax_id, v_rate, v_amt);
                SET v_tax = v_tax + v_amt;
            END LOOP;
            CLOSE cur_taxes;
        END;

        UPDATE invoice_detail
           SET unit_price    = v_price,
               line_subtotal = v_sub,
               tax_amount    = ROUND(v_tax, 2),
               line_total    = ROUND(v_sub + v_tax, 2)
         WHERE id = v_det_id;
    END LOOP;
    CLOSE cur_lines;

    -- Totales de cabecera
    UPDATE invoice inv
       SET inv.subtotal  = (SELECT COALESCE(SUM(d.line_subtotal), 0) FROM invoice_detail d WHERE d.invoice_id = inv.id),
           inv.tax_total = (SELECT COALESCE(SUM(d.tax_amount), 0)    FROM invoice_detail d WHERE d.invoice_id = inv.id),
           inv.total     = (SELECT COALESCE(SUM(d.line_total), 0)    FROM invoice_detail d WHERE d.invoice_id = inv.id)
     WHERE inv.id = p_invoice_id;

    IF (SELECT total FROM invoice WHERE id = p_invoice_id) <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El total de la factura debe ser mayor a cero';
    END IF;

    -- Folio por año y UUID
    SET v_year = YEAR(NOW());
    SET v_next = fn_next_folio(v_year);

    UPDATE invoice
       SET status     = 'ISSUED',
           folio      = CONCAT('INV-', v_year, '-', LPAD(v_next, 4, '0')),
           uuid       = UUID(),
           issued_at  = NOW(),
           paid_at    = NULL,
           cancelled_at = NULL,
           cancellation_reason = NULL
     WHERE id = p_invoice_id;

    COMMIT;

    SELECT id, uuid, folio, status, subtotal, tax_total, total, issued_at
      FROM invoice
     WHERE id = p_invoice_id;
END$$

-- -----------------------------------------------------------------------------
-- sp_register_payment: UN pago total por factura emitida -> estado PAID
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_register_payment;

CREATE PROCEDURE sp_register_payment (
    IN p_invoice_id INT UNSIGNED,
    IN p_method     VARCHAR(10),
    IN p_reference  VARCHAR(60),
    IN p_user_id    INT UNSIGNED
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_role   VARCHAR(10);
    DECLARE v_status VARCHAR(10);
    DECLARE v_total  DECIMAL(12,2);
    DECLARE v_exists INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT role INTO v_role FROM app_user WHERE id = p_user_id FOR UPDATE;
    IF v_role IS NULL OR v_role NOT IN ('ADMIN', 'BILLER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rol no autorizado para registrar pagos';
    END IF;
    IF p_method NOT IN ('CARD', 'TRANSFER', 'CASH') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Método de pago no válido';
    END IF;

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

    SELECT COUNT(*) INTO v_exists FROM payment WHERE invoice_id = p_invoice_id;
    IF v_exists > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La factura ya tiene un pago registrado';
    END IF;

    INSERT INTO payment (invoice_id, method, amount, reference, paid_at, registered_by)
    VALUES (p_invoice_id, p_method, v_total, p_reference, NOW(), p_user_id);

    UPDATE invoice SET status = 'PAID', paid_at = NOW() WHERE id = p_invoice_id;

    COMMIT;

    SELECT id, invoice_id, method, amount, reference, paid_at, registered_by
      FROM payment
     WHERE invoice_id = p_invoice_id;
END$$

-- -----------------------------------------------------------------------------
-- sp_cancel_invoice: cancela una factura DRAFT o ISSUED con motivo obligatorio
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_cancel_invoice;

CREATE PROCEDURE sp_cancel_invoice (
    IN p_invoice_id INT UNSIGNED,
    IN p_reason     VARCHAR(255),
    IN p_user_id    INT UNSIGNED
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_role   VARCHAR(10);
    DECLARE v_status VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT role INTO v_role FROM app_user WHERE id = p_user_id FOR UPDATE;
    IF v_role IS NULL OR v_role NOT IN ('ADMIN', 'BILLER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rol no autorizado para cancelar facturas';
    END IF;
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Se requiere un motivo de cancelación (mínimo 5 caracteres)';
    END IF;

    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    IF v_status NOT IN ('DRAFT', 'ISSUED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Facturas pagadas o ya canceladas no se pueden cancelar';
    END IF;

    UPDATE invoice
       SET status              = 'CANCELLED',
           cancelled_at        = NOW(),
           cancellation_reason = TRIM(p_reason)
     WHERE id = p_invoice_id;

    COMMIT;

    SELECT id, uuid, folio, status, cancelled_at, cancellation_reason
      FROM invoice
     WHERE id = p_invoice_id;
END$$

DELIMITER ;

SELECT 'Objetos creados: fn_tax_rate_on, fn_next_folio, sp_issue_invoice, sp_register_payment, sp_cancel_invoice' AS resultado;
