-- =============================================================================
-- Stored Procedures de facturación — RDS MySQL 8 (base Facturacion_Mysql)
--
-- Requisitos de la rúbrica (Proyecto C) cubiertos aquí:
--   1. sp_next_folio                 Generación e iteración atómica de folios
--   2. sp_calculate_invoice_totals   Cálculo de Subtotal, IVA (trasladados) y Retenciones
--   3. sp_apply_discount             Reglas de descuento por cliente o por volumen
--   4. sp_cancel_invoice             Cancelación formal y reversión contable
--   5. sp_fiscal_closing             Cierre y consolidado fiscal diario / mensual
--   6. sp_validate_payment_status    Validación de estados de pago
--   7. sp_aging_report               Reporte de antigüedad de saldos
--   8. sp_build_stamp_payload        Estructura para comprobante / timbrado (JSON CFDI 4.0)
--   +  sp_issue_invoice              Emisión transaccional (usa 1, 2 y 3)
--   +  sp_register_payment           Registro de pago con validación de estado
-- Los requisitos 9 (asignación masiva de características) y 10 (auditoría de tarifas)
-- viven en PostgreSQL: ver postgres_procedures.sql.
--
-- Errores de negocio: SIGNAL SQLSTATE '45000' con el mensaje que muestra el frontend.
-- Requiere database/mysql/03_rubrica_ext.sql. Se puede ejecutar varias veces.
-- =============================================================================

DELIMITER $$

-- -----------------------------------------------------------------------------
-- 1. Folio atómico: INV-AAAA-NNNN, secuencial por año.
--    LAST_INSERT_ID(expr) deja el valor en la sesión; la fila de folio_counter queda
--    bloqueada hasta el COMMIT de la transacción que llama, sin condiciones de carrera.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_next_folio$$
CREATE PROCEDURE sp_next_folio(IN p_year SMALLINT, OUT p_folio VARCHAR(20))
BEGIN
    IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid folio year';
    END IF;

    INSERT INTO folio_counter (year, last_number)
    VALUES (p_year, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1);

    SET p_folio = CONCAT('INV-', p_year, '-', LPAD(LAST_INSERT_ID(), 4, '0'));
END$$

-- -----------------------------------------------------------------------------
-- 3. Descuento: toma la regla activa con mayor porcentaje que aplique a la factura.
--    Regla de cliente: customer_id = cliente (y subtotal >= min_subtotal si lo tiene).
--    Regla de volumen: customer_id NULL y subtotal >= min_subtotal.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_apply_discount$$
CREATE PROCEDURE sp_apply_discount(IN p_invoice_id INT UNSIGNED, OUT p_pct DECIMAL(5,4))
BEGIN
    DECLARE v_customer INT UNSIGNED;
    DECLARE v_subtotal DECIMAL(12,2);

    SELECT customer_id INTO v_customer FROM invoice WHERE id = p_invoice_id;
    IF v_customer IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice not found';
    END IF;

    SELECT COALESCE(SUM(ROUND(quantity * unit_price, 2)), 0) INTO v_subtotal
    FROM invoice_detail WHERE invoice_id = p_invoice_id;

    SELECT COALESCE(MAX(pct), 0) INTO p_pct
    FROM discount_rule
    WHERE active = 1
      AND (customer_id = v_customer OR customer_id IS NULL)
      AND (min_subtotal IS NULL OR min_subtotal <= v_subtotal);

    UPDATE invoice SET discount_pct = p_pct WHERE id = p_invoice_id;
END$$

-- -----------------------------------------------------------------------------
-- 2. Totales: recalcula líneas e impuestos y deja en la factura
--    subtotal, descuento, IVA/IEPS trasladados, retenciones y total.
--    El descuento reduce la base, por eso escala también impuestos y retenciones.
--    Solo opera sobre borradores (una factura emitida es inmutable).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_calculate_invoice_totals$$
CREATE PROCEDURE sp_calculate_invoice_totals(IN p_invoice_id INT UNSIGNED)
BEGIN
    DECLARE v_status      VARCHAR(10);
    DECLARE v_pct         DECIMAL(5,4);
    DECLARE v_subtotal    DECIMAL(12,2);
    DECLARE v_transferred DECIMAL(12,2);
    DECLARE v_withheld    DECIMAL(12,2);
    DECLARE v_discount    DECIMAL(12,2);
    DECLARE v_tax         DECIMAL(12,2);
    DECLARE v_withholding DECIMAL(12,2);

    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice not found';
    END IF;
    IF v_status <> 'DRAFT' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only draft invoices can be recalculated';
    END IF;

    UPDATE invoice_detail
       SET line_subtotal = ROUND(quantity * unit_price, 2)
     WHERE invoice_id = p_invoice_id;

    UPDATE invoice_detail_tax t
      JOIN invoice_detail d ON d.id = t.invoice_detail_id
       SET t.amount = ROUND(d.line_subtotal * t.rate, 2)
     WHERE d.invoice_id = p_invoice_id;

    UPDATE invoice_detail d
       SET d.tax_amount = (SELECT COALESCE(SUM(t.amount), 0) FROM invoice_detail_tax t
                            WHERE t.invoice_detail_id = d.id AND t.kind = 'TRANSFER'),
           d.line_total = d.line_subtotal + d.tax_amount
                          - (SELECT COALESCE(SUM(t.amount), 0) FROM invoice_detail_tax t
                              WHERE t.invoice_detail_id = d.id AND t.kind = 'WITHHELD')
     WHERE d.invoice_id = p_invoice_id;

    CALL sp_apply_discount(p_invoice_id, v_pct);

    SELECT COALESCE(SUM(line_subtotal), 0) INTO v_subtotal
      FROM invoice_detail WHERE invoice_id = p_invoice_id;

    SELECT COALESCE(SUM(CASE WHEN t.kind = 'TRANSFER' THEN t.amount ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN t.kind = 'WITHHELD' THEN t.amount ELSE 0 END), 0)
      INTO v_transferred, v_withheld
      FROM invoice_detail_tax t
      JOIN invoice_detail d ON d.id = t.invoice_detail_id
     WHERE d.invoice_id = p_invoice_id;

    SET v_discount    = ROUND(v_subtotal * v_pct, 2);
    SET v_tax         = ROUND(v_transferred * (1 - v_pct), 2);
    SET v_withholding = ROUND(v_withheld * (1 - v_pct), 2);

    UPDATE invoice
       SET subtotal          = v_subtotal,
           discount_pct      = v_pct,
           discount_total    = v_discount,
           tax_total         = v_tax,
           withholding_total = v_withholding,
           total             = v_subtotal - v_discount + v_tax - v_withholding
     WHERE id = p_invoice_id;
END$$

-- -----------------------------------------------------------------------------
-- Emisión: bloquea la factura, recalcula, asigna folio + UUID y registra el asiento.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_issue_invoice$$
CREATE PROCEDURE sp_issue_invoice(IN p_invoice_id INT UNSIGNED, IN p_user_id INT UNSIGNED)
BEGIN
    DECLARE v_status VARCHAR(10);
    DECLARE v_lines  INT;
    DECLARE v_folio  VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice not found';
    END IF;
    IF v_status <> 'DRAFT' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only draft invoices can be issued';
    END IF;

    SELECT COUNT(*) INTO v_lines FROM invoice_detail WHERE invoice_id = p_invoice_id;
    IF v_lines = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice must have at least one line';
    END IF;

    CALL sp_calculate_invoice_totals(p_invoice_id);
    CALL sp_next_folio(YEAR(UTC_TIMESTAMP()), v_folio);

    UPDATE invoice
       SET status = 'ISSUED', folio = v_folio, uuid = UUID(), issued_at = UTC_TIMESTAMP()
     WHERE id = p_invoice_id;

    -- Partida doble: Clientes + Retenciones por acreditar = Ingresos + Impuestos por pagar
    INSERT INTO accounting_entry (invoice_id, entry_type, account, debit, credit, created_by)
    SELECT p_invoice_id, 'ISSUE', x.account, x.debit, x.credit, p_user_id
      FROM invoice i
      JOIN LATERAL (
            SELECT 'ACCOUNTS_RECEIVABLE' AS account, i.total AS debit, 0.00 AS credit
            UNION ALL SELECT 'WITHHOLDING_RECEIVABLE', i.withholding_total, 0.00
            UNION ALL SELECT 'REVENUE', 0.00, i.subtotal - i.discount_total
            UNION ALL SELECT 'TAX_PAYABLE', 0.00, i.tax_total
      ) x
     WHERE i.id = p_invoice_id AND (x.debit > 0 OR x.credit > 0);

    COMMIT;

    SELECT id, folio, uuid, status, subtotal, discount_pct, discount_total,
           tax_total, withholding_total, total, issued_at
      FROM invoice WHERE id = p_invoice_id;
END$$

-- -----------------------------------------------------------------------------
-- Pago: un pago total por factura ISSUED. Marca PAID y registra el asiento de cobro.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_register_payment$$
CREATE PROCEDURE sp_register_payment(
    IN p_invoice_id INT UNSIGNED,
    IN p_method     VARCHAR(10),
    IN p_amount     DECIMAL(12,2),
    IN p_reference  VARCHAR(60),
    IN p_user_id    INT UNSIGNED
)
BEGIN
    DECLARE v_status VARCHAR(10);
    DECLARE v_total  DECIMAL(12,2);
    DECLARE v_ref    VARCHAR(60);
    DECLARE v_payment_id INT UNSIGNED;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT status, total INTO v_status, v_total FROM invoice WHERE id = p_invoice_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice not found';
    END IF;
    IF v_status = 'PAID' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice is already paid';
    END IF;
    IF v_status <> 'ISSUED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only issued invoices can receive payments';
    END IF;
    IF p_method IS NULL OR p_method NOT IN ('CARD', 'TRANSFER', 'CASH') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid payment method';
    END IF;
    IF p_amount IS NULL OR ABS(p_amount - v_total) >= 0.005 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment amount must match the invoice total';
    END IF;

    SET v_ref = COALESCE(NULLIF(TRIM(p_reference), ''),
                         CONCAT('SIM-', UPPER(LEFT(REPLACE(UUID(), '-', ''), 6))));

    INSERT INTO payment (invoice_id, method, amount, reference, paid_at, registered_by)
    VALUES (p_invoice_id, p_method, v_total, v_ref, UTC_TIMESTAMP(), p_user_id);
    SET v_payment_id = LAST_INSERT_ID();

    UPDATE invoice SET status = 'PAID', paid_at = UTC_TIMESTAMP() WHERE id = p_invoice_id;

    INSERT INTO accounting_entry (invoice_id, entry_type, account, debit, credit, created_by)
    VALUES (p_invoice_id, 'PAYMENT', 'BANK', v_total, 0.00, p_user_id),
           (p_invoice_id, 'PAYMENT', 'ACCOUNTS_RECEIVABLE', 0.00, v_total, p_user_id);

    COMMIT;

    SELECT id, invoice_id, method, amount, reference, paid_at, registered_by
      FROM payment WHERE id = v_payment_id;
END$$

-- -----------------------------------------------------------------------------
-- 4. Cancelación formal: DRAFT o ISSUED -> CANCELLED con motivo.
--    Si la factura estaba emitida, invierte sus asientos (reversión contable).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_cancel_invoice$$
CREATE PROCEDURE sp_cancel_invoice(
    IN p_invoice_id INT UNSIGNED,
    IN p_reason     VARCHAR(255),
    IN p_user_id    INT UNSIGNED
)
BEGIN
    DECLARE v_status VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_reason IS NULL OR CHAR_LENGTH(TRIM(p_reason)) < 3 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A cancellation reason is required';
    END IF;

    START TRANSACTION;

    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice not found';
    END IF;
    IF v_status = 'PAID' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paid invoices cannot be cancelled';
    END IF;
    IF v_status = 'CANCELLED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice is already cancelled';
    END IF;

    UPDATE invoice
       SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(), cancellation_reason = TRIM(p_reason)
     WHERE id = p_invoice_id;

    IF v_status = 'ISSUED' THEN
        INSERT INTO accounting_entry (invoice_id, entry_type, account, debit, credit, created_by)
        SELECT invoice_id, 'REVERSAL', account, credit, debit, p_user_id
          FROM accounting_entry
         WHERE invoice_id = p_invoice_id AND entry_type = 'ISSUE';
    END IF;

    COMMIT;

    SELECT id, folio, status, cancelled_at, cancellation_reason, total
      FROM invoice WHERE id = p_invoice_id;
END$$

-- -----------------------------------------------------------------------------
-- 5. Cierre fiscal: consolida las facturas emitidas en el día o mes de p_date.
--    Volver a ejecutarlo recalcula el mismo periodo (ON DUPLICATE KEY UPDATE).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_fiscal_closing$$
CREATE PROCEDURE sp_fiscal_closing(
    IN p_period_type VARCHAR(5),
    IN p_date        DATE,
    IN p_user_id     INT UNSIGNED
)
BEGIN
    DECLARE v_start DATE;
    DECLARE v_end   DATE;

    IF p_period_type NOT IN ('DAY', 'MONTH') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Period type must be DAY or MONTH';
    END IF;
    IF p_date IS NULL OR p_date > UTC_DATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Closing date cannot be in the future';
    END IF;

    IF p_period_type = 'DAY' THEN
        SET v_start = p_date;
        SET v_end   = p_date + INTERVAL 1 DAY;
    ELSE
        SET v_start = DATE_FORMAT(p_date, '%Y-%m-01');
        SET v_end   = v_start + INTERVAL 1 MONTH;
    END IF;

    INSERT INTO fiscal_closing (period_type, period_start, period_end, invoice_count, cancelled_count,
                                subtotal, discount_total, tax_total, withholding_total, total,
                                collected_total, closed_by, closed_at)
    SELECT p_period_type, v_start, v_end,
           (SELECT COUNT(*) FROM invoice
             WHERE status IN ('ISSUED', 'PAID') AND issued_at >= v_start AND issued_at < v_end),
           (SELECT COUNT(*) FROM invoice
             WHERE status = 'CANCELLED' AND cancelled_at >= v_start AND cancelled_at < v_end),
           COALESCE(SUM(subtotal), 0), COALESCE(SUM(discount_total), 0), COALESCE(SUM(tax_total), 0),
           COALESCE(SUM(withholding_total), 0), COALESCE(SUM(total), 0),
           (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE paid_at >= v_start AND paid_at < v_end),
           p_user_id, UTC_TIMESTAMP()
      FROM invoice
     WHERE status IN ('ISSUED', 'PAID') AND issued_at >= v_start AND issued_at < v_end
    ON DUPLICATE KEY UPDATE
           period_end        = VALUES(period_end),
           invoice_count     = VALUES(invoice_count),
           cancelled_count   = VALUES(cancelled_count),
           subtotal          = VALUES(subtotal),
           discount_total    = VALUES(discount_total),
           tax_total         = VALUES(tax_total),
           withholding_total = VALUES(withholding_total),
           total             = VALUES(total),
           collected_total   = VALUES(collected_total),
           closed_by         = VALUES(closed_by),
           closed_at         = VALUES(closed_at);

    SELECT * FROM fiscal_closing WHERE period_type = p_period_type AND period_start = v_start;
END$$

-- -----------------------------------------------------------------------------
-- 6. Validación de estados de pago: detecta inconsistencias entre invoice y payment.
--    p_invoice_id NULL revisa todas las facturas emitidas, pagadas o canceladas.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_validate_payment_status$$
CREATE PROCEDURE sp_validate_payment_status(IN p_invoice_id INT UNSIGNED)
BEGIN
    SELECT i.id AS invoice_id,
           i.folio,
           i.status,
           i.total,
           COALESCE(p.amount, 0) AS paid_amount,
           CASE
               WHEN i.status = 'PAID' AND p.id IS NULL              THEN 'PAID_WITHOUT_PAYMENT'
               WHEN i.status = 'PAID' AND i.paid_at IS NULL         THEN 'PAID_WITHOUT_DATE'
               WHEN i.status = 'PAID' AND ABS(p.amount - i.total) >= 0.005 THEN 'AMOUNT_MISMATCH'
               WHEN i.status <> 'PAID' AND p.id IS NOT NULL         THEN 'PAYMENT_ON_UNPAID_STATUS'
               ELSE 'OK'
           END AS validation
      FROM invoice i
      LEFT JOIN payment p ON p.invoice_id = i.id
     WHERE (p_invoice_id IS NULL AND i.status <> 'DRAFT') OR i.id = p_invoice_id
     ORDER BY (CASE WHEN i.status = 'PAID' AND p.id IS NULL THEN 0 ELSE 1 END), i.id;
END$$

-- -----------------------------------------------------------------------------
-- 7. Antigüedad de saldos: saldo pendiente (facturas ISSUED) por cliente en tramos
--    de días desde la emisión, a la fecha de corte p_as_of (NULL = hoy UTC).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_aging_report$$
CREATE PROCEDURE sp_aging_report(IN p_as_of DATE)
BEGIN
    DECLARE v_as_of DATE DEFAULT COALESCE(p_as_of, UTC_DATE());

    SELECT c.id   AS customer_id,
           c.name AS customer_name,
           c.tax_id,
           COUNT(*) AS open_invoices,
           SUM(CASE WHEN DATEDIFF(v_as_of, i.issued_at) <= 30              THEN i.total ELSE 0 END) AS days_0_30,
           SUM(CASE WHEN DATEDIFF(v_as_of, i.issued_at) BETWEEN 31 AND 60  THEN i.total ELSE 0 END) AS days_31_60,
           SUM(CASE WHEN DATEDIFF(v_as_of, i.issued_at) BETWEEN 61 AND 90  THEN i.total ELSE 0 END) AS days_61_90,
           SUM(CASE WHEN DATEDIFF(v_as_of, i.issued_at) > 90               THEN i.total ELSE 0 END) AS days_over_90,
           SUM(i.total) AS balance,
           MAX(DATEDIFF(v_as_of, i.issued_at)) AS oldest_days
      FROM invoice i
      JOIN customer c ON c.id = i.customer_id
     WHERE i.status = 'ISSUED' AND DATE(i.issued_at) <= v_as_of
     GROUP BY c.id, c.name, c.tax_id
     ORDER BY balance DESC;
END$$

-- -----------------------------------------------------------------------------
-- 8. Estructura para comprobante / timbrado: JSON con la forma de un CFDI 4.0
--    (emisor, receptor, conceptos con impuestos trasladados y retenidos, totales).
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_build_stamp_payload$$
CREATE PROCEDURE sp_build_stamp_payload(IN p_invoice_id INT UNSIGNED)
BEGIN
    DECLARE v_status VARCHAR(10);

    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice not found';
    END IF;
    IF v_status NOT IN ('ISSUED', 'PAID') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only issued or paid invoices can be stamped';
    END IF;

    SELECT JSON_OBJECT(
        'Version', '4.0',
        'Serie', 'INV',
        'Folio', i.folio,
        'UUID', i.uuid,
        'Fecha', DATE_FORMAT(i.issued_at, '%Y-%m-%dT%H:%i:%s'),
        'Moneda', 'MXN',
        'TipoDeComprobante', 'I',
        'Emisor', JSON_OBJECT('Rfc', s.tax_id, 'Nombre', s.legal_name, 'Domicilio', s.address),
        'Receptor', JSON_OBJECT('Rfc', i.receiver_tax_id, 'Nombre', i.receiver_name,
                                'Domicilio', i.receiver_address),
        'Conceptos', (
            SELECT JSON_ARRAYAGG(JSON_OBJECT(
                       'ClaveProdServ', d.service_id,
                       'Descripcion', d.service_name,
                       'Cantidad', d.quantity,
                       'ValorUnitario', d.unit_price,
                       'Importe', d.line_subtotal,
                       'Traslados', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
                                         'Impuesto', t.tax_code, 'TasaOCuota', t.rate,
                                         'Base', d.line_subtotal, 'Importe', t.amount)), JSON_ARRAY())
                                       FROM invoice_detail_tax t
                                      WHERE t.invoice_detail_id = d.id AND t.kind = 'TRANSFER'),
                       'Retenciones', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
                                         'Impuesto', t.tax_code, 'TasaOCuota', t.rate,
                                         'Base', d.line_subtotal, 'Importe', t.amount)), JSON_ARRAY())
                                       FROM invoice_detail_tax t
                                      WHERE t.invoice_detail_id = d.id AND t.kind = 'WITHHELD')))
              FROM invoice_detail d WHERE d.invoice_id = i.id),
        'SubTotal', i.subtotal,
        'Descuento', i.discount_total,
        'TotalImpuestosTrasladados', i.tax_total,
        'TotalImpuestosRetenidos', i.withholding_total,
        'Total', i.total
    ) AS payload
      FROM invoice i
      JOIN issuer s ON s.id = i.issuer_id
     WHERE i.id = p_invoice_id;
END$$

DELIMITER ;
