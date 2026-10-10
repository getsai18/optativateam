-- =============================================================================
-- Sistema de Facturación — Procedimientos almacenados ORACLE (PL/SQL)
-- Archivo: 04_procedures.sql
-- Ejecutar después de 01_schema.sql y 02_seed_test_data.sql.
-- Implementan operaciones críticas del frontend con validación transaccional:
--   - stamp() de invoiceService.ts   -> sp_issue_invoice
--   - registerPayment() del frontend -> sp_register_payment
--   - cancelInvoice() del frontend   -> sp_cancel_invoice
--   - rateOnDate() de calculateTotals.ts -> fn_tax_rate_on
--   - Db.folioCounters               -> fn_next_folio
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fn_tax_rate_on: tasa vigente de un impuesto en una fecha
-- Regla del frontend: validFrom <= fecha < validTo (validTo exclusivo, null abierto)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tax_rate_on (p_tax_id NUMBER, p_as_of DATE)
RETURN NUMBER
IS
    v_rate tax_history.rate%TYPE;
BEGIN
    SELECT rate INTO v_rate
      FROM (
            SELECT rate
              FROM tax_history
             WHERE tax_id = p_tax_id
               AND valid_from <= p_as_of
               AND (valid_to IS NULL OR p_as_of < valid_to)
             ORDER BY valid_from DESC
           )
     WHERE ROWNUM = 1;
    RETURN v_rate;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        SELECT current_rate INTO v_rate FROM tax WHERE id = p_tax_id;
        RETURN v_rate;
END;
/

-- -----------------------------------------------------------------------------
-- fn_next_folio: incrementa de forma atómica el contador del año y devuelve el
-- siguiente número (frontend: Db.folioCounters + 1, folio INV-YYYY-NNNN)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_next_folio (p_year NUMBER)
RETURN NUMBER
IS
    v_next NUMBER;
BEGIN
    UPDATE folio_counter
       SET last_number = last_number + 1
     WHERE year = p_year
    RETURNING last_number INTO v_next;

    IF v_next IS NULL THEN
        INSERT INTO folio_counter (year, last_number)
        VALUES (p_year, 1)
        RETURNING last_number INTO v_next;
    END IF;
    RETURN v_next;
END;
/

-- -----------------------------------------------------------------------------
-- sp_issue_invoice: emite una factura en borrador ("timbrado simbólico").
--   1. Valida rol ADMIN/BILLER del usuario y estado DRAFT (máquina de estados).
--   2. Recalcula líneas y tasas al momento de emitir (mismo criterio que
--      calculateTotals.ts: subtotal = qty x precio de catálogo; impuestos por
--      tasa vigente en la fecha de emisión).
--   3. Asigna folio INV-YYYY-NNNN y UUID v4, y fija issued_at.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_issue_invoice (
    p_invoice_id IN  NUMBER,
    p_user_id    IN  NUMBER,
    p_result     OUT SYS_REFCURSOR
)
IS
    v_role      VARCHAR2(10);
    v_status    invoice.status%TYPE;
    v_year      NUMBER(4);
    v_next      NUMBER;
    v_sub       NUMBER(12,2);
    v_tax       NUMBER(12,2);
    v_rate      NUMBER(6,4);
    v_amt       NUMBER(12,2);
    v_uuid      VARCHAR2(36);
    v_lines     NUMBER;
BEGIN
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id;
    IF v_role NOT IN ('ADMIN', 'BILLER') THEN
        RAISE_APPLICATION_ERROR(-20001, 'Rol no autorizado para emitir facturas');
    END IF;

    BEGIN
        SELECT status INTO v_status
          FROM invoice
         WHERE id = p_invoice_id
           FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20002, 'Factura no encontrada');
    END;

    IF v_status <> 'DRAFT' THEN
        RAISE_APPLICATION_ERROR(-20003, 'Solo se pueden emitir facturas en borrador');
    END IF;

    SELECT COUNT(*) INTO v_lines FROM invoice_detail WHERE invoice_id = p_invoice_id;
    IF v_lines = 0 THEN
        RAISE_APPLICATION_ERROR(-20004, 'La factura no tiene servicios');
    END IF;

    -- Recalcula cada línea con los precios e impuestos vigentes a la fecha de emisión
    FOR r IN (
        SELECT d.id AS detail_id, d.service_id, d.quantity, s.base_price
          FROM invoice_detail d
          JOIN service s ON s.id = d.service_id
         WHERE d.invoice_id = p_invoice_id
    ) LOOP
        v_sub := ROUND(r.quantity * r.base_price, 2);
        v_tax := 0;

        DELETE FROM invoice_detail_tax WHERE invoice_detail_id = r.detail_id;

        FOR t IN (SELECT tax_id FROM service_tax WHERE service_id = r.service_id) LOOP
            v_rate := fn_tax_rate_on(t.tax_id, TRUNC(SYSDATE));
            v_amt  := ROUND(v_sub * v_rate, 2);
            INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
            VALUES (r.detail_id, t.tax_id, v_rate, v_amt);
            v_tax := v_tax + v_amt;
        END LOOP;

        UPDATE invoice_detail
           SET unit_price    = r.base_price,
               line_subtotal = v_sub,
               tax_amount    = ROUND(v_tax, 2),
               line_total    = ROUND(v_sub + v_tax, 2)
         WHERE id = r.detail_id;
    END LOOP;

    -- Totales de cabecera
    UPDATE invoice inv
       SET subtotal  = (SELECT NVL(SUM(line_subtotal), 0) FROM invoice_detail WHERE invoice_id = inv.id),
           tax_total = (SELECT NVL(SUM(tax_amount), 0)    FROM invoice_detail WHERE invoice_id = inv.id),
           total     = (SELECT NVL(SUM(line_total), 0)    FROM invoice_detail WHERE invoice_id = inv.id)
     WHERE id = p_invoice_id;

    SELECT total INTO v_tax FROM invoice WHERE id = p_invoice_id;  -- reutilizo v_tax
    IF v_tax <= 0 THEN
        RAISE_APPLICATION_ERROR(-20005, 'El total de la factura debe ser mayor a cero');
    END IF;

    -- Folio por año (INV-YYYY-NNNN) y UUID v4 con guiones
    v_year := EXTRACT(YEAR FROM SYSTIMESTAMP);
    v_next := fn_next_folio(v_year);

    v_uuid := LOWER(SYS_GUID());
    v_uuid := SUBSTR(v_uuid, 1, 8) || '-' || SUBSTR(v_uuid, 9, 4) || '-' ||
              SUBSTR(v_uuid, 13, 4) || '-' || SUBSTR(v_uuid, 17, 4) || '-' ||
              SUBSTR(v_uuid, 21, 12);

    UPDATE invoice
       SET status     = 'ISSUED',
           folio      = 'INV-' || v_year || '-' || LPAD(v_next, 4, '0'),
           uuid       = v_uuid,
           issued_at  = SYSTIMESTAMP,
           paid_at    = NULL,
           cancelled_at = NULL,
           cancellation_reason = NULL
     WHERE id = p_invoice_id;

    OPEN p_result FOR
        SELECT id, uuid, folio, status, subtotal, tax_total, total, issued_at
          FROM invoice
         WHERE id = p_invoice_id;
END;
/

-- -----------------------------------------------------------------------------
-- sp_register_payment: registra UN pago total por factura emitida y la pasa a
-- PAID (frontend registerPayment(): un solo pago, monto = total de la factura).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_register_payment (
    p_invoice_id IN NUMBER,
    p_method     IN VARCHAR2,
    p_reference  IN VARCHAR2,
    p_user_id    IN NUMBER,
    p_result     OUT SYS_REFCURSOR
)
IS
    v_role   VARCHAR2(10);
    v_status invoice.status%TYPE;
    v_total  NUMBER(12,2);
    v_exists NUMBER;
BEGIN
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id;
    IF v_role NOT IN ('ADMIN', 'BILLER') THEN
        RAISE_APPLICATION_ERROR(-20001, 'Rol no autorizado para registrar pagos');
    END IF;
    IF p_method NOT IN ('CARD', 'TRANSFER', 'CASH') THEN
        RAISE_APPLICATION_ERROR(-20006, 'Método de pago no válido');
    END IF;

    BEGIN
        SELECT status, total INTO v_status, v_total
          FROM invoice
         WHERE id = p_invoice_id
           FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20002, 'Factura no encontrada');
    END;

    IF v_status <> 'ISSUED' THEN
        RAISE_APPLICATION_ERROR(-20007, 'Solo se pueden pagar facturas emitidas');
    END IF;

    SELECT COUNT(*) INTO v_exists FROM payment WHERE invoice_id = p_invoice_id;
    IF v_exists > 0 THEN
        RAISE_APPLICATION_ERROR(-20008, 'La factura ya tiene un pago registrado');
    END IF;

    INSERT INTO payment (invoice_id, method, amount, reference, paid_at, registered_by)
    VALUES (p_invoice_id, p_method, v_total, p_reference, SYSTIMESTAMP, p_user_id);

    UPDATE invoice
       SET status  = 'PAID',
           paid_at = SYSTIMESTAMP
     WHERE id = p_invoice_id;

    OPEN p_result FOR
        SELECT p.id, p.invoice_id, p.method, p.amount, p.reference, p.paid_at, p.registered_by
          FROM payment p
         WHERE p.invoice_id = p_invoice_id;
END;
/

-- -----------------------------------------------------------------------------
-- sp_cancel_invoice: cancela una factura DRAFT o ISSUED con motivo obligatorio
-- (frontend cancelInvoice(): motivo >= 5 caracteres; PAID/CANCELLED no se pueden
-- cancelar).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_cancel_invoice (
    p_invoice_id IN NUMBER,
    p_reason     IN VARCHAR2,
    p_user_id    IN NUMBER,
    p_result     OUT SYS_REFCURSOR
)
IS
    v_role   VARCHAR2(10);
    v_status invoice.status%TYPE;
BEGIN
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id;
    IF v_role NOT IN ('ADMIN', 'BILLER') THEN
        RAISE_APPLICATION_ERROR(-20001, 'Rol no autorizado para cancelar facturas');
    END IF;
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
        RAISE_APPLICATION_ERROR(-20009, 'Se requiere un motivo de cancelación (mínimo 5 caracteres)');
    END IF;

    BEGIN
        SELECT status INTO v_status
          FROM invoice
         WHERE id = p_invoice_id
           FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20002, 'Factura no encontrada');
    END;

    IF v_status NOT IN ('DRAFT', 'ISSUED') THEN
        RAISE_APPLICATION_ERROR(-20010, 'Facturas pagadas o ya canceladas no se pueden cancelar');
    END IF;

    UPDATE invoice
       SET status              = 'CANCELLED',
           cancelled_at        = SYSTIMESTAMP,
           cancellation_reason = TRIM(p_reason)
     WHERE id = p_invoice_id;

    OPEN p_result FOR
        SELECT id, uuid, folio, status, cancelled_at, cancellation_reason
          FROM invoice
         WHERE id = p_invoice_id;
END;
/

PROMPT Procedimientos PL/SQL creados: fn_tax_rate_on, fn_next_folio,
PROMPT sp_issue_invoice, sp_register_payment, sp_cancel_invoice.
