-- =============================================================================
-- sp_get_invoice_detail
-- Devuelve 3 resultados: encabezado, líneas y pagos de una factura
-- (lo que necesita la vista de detalle / descarga de comprobante).
--
-- p_customer_id:
--   NULL  -> personal interno (ADMIN / BILLER), sin restricción.
--   valor -> el CUSTOMER solo puede ver sus propias facturas. Si la factura es
--            de otro cliente responde "no encontrada" (evita IDOR / Broken
--            Access Control y no revela que la factura existe).
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_get_invoice_detail;

DELIMITER $$

CREATE PROCEDURE sp_get_invoice_detail(
    IN p_invoice_id  INT UNSIGNED,
    IN p_customer_id INT UNSIGNED
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM invoice
        WHERE id = p_invoice_id
          AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;

    -- 1) encabezado
    SELECT i.id, i.uuid, i.folio, i.status,
           i.issued_at, i.paid_at, i.cancelled_at, i.cancellation_reason,
           i.subtotal, i.discount_total, i.tax_total, i.total,
           iss.legal_name AS issuer_name, iss.rfc AS issuer_rfc,
           c.name         AS customer_name, c.rfc AS customer_rfc
    FROM invoice i
    JOIN issuer   iss ON iss.id = i.issuer_id
    JOIN customer c   ON c.id   = i.customer_id
    WHERE i.id = p_invoice_id;

    -- 2) líneas
    SELECT d.id, d.service_id, d.service_name, d.quantity, d.unit_price,
           d.line_subtotal, d.discount_amount, d.tax_amount, d.line_total
    FROM invoice_detail d
    WHERE d.invoice_id = p_invoice_id
    ORDER BY d.id;

    -- 3) pagos
    SELECT p.id, pm.name AS payment_method, p.amount, p.reference, p.status, p.paid_at
    FROM payment p
    JOIN payment_method pm ON pm.id = p.payment_method_id
    WHERE p.invoice_id = p_invoice_id
    ORDER BY p.paid_at, p.id;
END$$

DELIMITER ;
