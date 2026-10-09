-- =============================================================================
-- sp_recalculate_invoice
-- Cálculo de totales e impuestos de una factura en borrador:
--   1) subtotal por línea = cantidad * precio unitario
--   2) descuento por línea = mayor descuento activo y vigente del cliente
--      (aplica el de la categoría del servicio o el general, sin categoría)
--   3) impuesto por línea = (subtotal - descuento) * suma de tasas vigentes hoy
--      (se toman de tax_history, de los impuestos asignados en service_tax)
--   4) totales de la factura = suma de las líneas
--
-- NOTA: no abre su propia transacción porque la usan otros SPs dentro de la
-- suya (add/remove item, issue, set_customer_discount). Si se llama directo
-- desde la API, hacerlo dentro de un START TRANSACTION ... COMMIT.
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_recalculate_invoice;

DELIMITER $$

CREATE PROCEDURE sp_recalculate_invoice(
    IN p_invoice_id INT UNSIGNED
)
BEGIN
    DECLARE v_status      VARCHAR(20)   DEFAULT NULL;
    DECLARE v_customer_id INT UNSIGNED  DEFAULT NULL;
    DECLARE v_today       DATE          DEFAULT CURDATE();
    DECLARE v_subtotal    DECIMAL(12,2) DEFAULT 0;
    DECLARE v_discount    DECIMAL(12,2) DEFAULT 0;
    DECLARE v_tax         DECIMAL(12,2) DEFAULT 0;
    DECLARE v_total       DECIMAL(12,2) DEFAULT 0;

    SELECT status, customer_id INTO v_status, v_customer_id
    FROM invoice
    WHERE id = p_invoice_id;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    IF v_status <> 'DRAFT' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se pueden recalcular facturas en borrador';
    END IF;

    -- 1) subtotal y descuento por línea
    UPDATE invoice_detail d
    JOIN service s ON s.id = d.service_id
    SET d.line_subtotal   = ROUND(d.quantity * d.unit_price, 2),
        d.discount_amount = ROUND(d.quantity * d.unit_price * COALESCE((
                SELECT MAX(cd.percentage)
                FROM customer_discount cd
                WHERE cd.customer_id = v_customer_id
                  AND cd.active = 1
                  AND v_today >= cd.valid_from
                  AND (cd.valid_to IS NULL OR v_today <= cd.valid_to)
                  AND (cd.category_id IS NULL OR cd.category_id = s.category_id)
            ), 0) / 100, 2)
    WHERE d.invoice_id = p_invoice_id;

    -- 2) impuesto por línea (tasas vigentes hoy)
    UPDATE invoice_detail d
    SET d.tax_amount = ROUND((d.line_subtotal - d.discount_amount) * COALESCE((
            SELECT SUM(th.rate)
            FROM service_tax st
            JOIN tax t          ON t.id = st.tax_id AND t.active = 1
            JOIN tax_history th ON th.tax_id = st.tax_id
            WHERE st.service_id = d.service_id
              AND v_today >= th.valid_from
              AND (th.valid_to IS NULL OR v_today <= th.valid_to)
        ), 0), 2)
    WHERE d.invoice_id = p_invoice_id;

    -- 3) total por línea
    UPDATE invoice_detail
    SET line_total = line_subtotal - discount_amount + tax_amount
    WHERE invoice_id = p_invoice_id;

    -- 4) totales de la factura
    SELECT COALESCE(SUM(line_subtotal), 0), COALESCE(SUM(discount_amount), 0),
           COALESCE(SUM(tax_amount), 0),    COALESCE(SUM(line_total), 0)
    INTO v_subtotal, v_discount, v_tax, v_total
    FROM invoice_detail
    WHERE invoice_id = p_invoice_id;

    UPDATE invoice
    SET subtotal       = v_subtotal,
        discount_total = v_discount,
        tax_total      = v_tax,
        total          = v_total
    WHERE id = p_invoice_id;
END$$

DELIMITER ;
