-- =============================================================================
-- sp_sales_report_by_category
-- Reporte de ventas por categoría de servicio en un rango de fechas de emisión
-- (solo facturas emitidas o pagadas; las canceladas y borradores no cuentan).
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_sales_report_by_category;

DELIMITER $$

CREATE PROCEDURE sp_sales_report_by_category(
    IN p_from DATE,
    IN p_to   DATE
)
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rango de fechas invalido';
    END IF;

    SELECT sc.name                    AS category,
           COUNT(DISTINCT i.id)       AS invoices,
           SUM(d.quantity)            AS units,
           SUM(d.line_subtotal)       AS subtotal,
           SUM(d.discount_amount)     AS discounts,
           SUM(d.tax_amount)          AS taxes,
           SUM(d.line_total)          AS total_amount
    FROM invoice i
    JOIN invoice_detail   d  ON d.invoice_id = i.id
    JOIN service          s  ON s.id = d.service_id
    JOIN service_category sc ON sc.id = s.category_id
    WHERE i.status IN ('ISSUED', 'PAID')
      AND i.issued_at >= p_from
      AND i.issued_at <  DATE_ADD(p_to, INTERVAL 1 DAY)
    GROUP BY sc.id, sc.name
    ORDER BY total_amount DESC;
END$$

DELIMITER ;
