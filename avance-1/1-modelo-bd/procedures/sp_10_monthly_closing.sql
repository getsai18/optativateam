-- =============================================================================
-- sp_monthly_closing
-- Cierre mensual de facturación: suma las facturas emitidas/pagadas del mes
-- (las canceladas no cuentan) y guarda el resultado en monthly_closing.
-- Un mes solo se puede cerrar una vez y no se puede cerrar un mes futuro.
-- Después del cierre, sp_cancel_invoice ya no deja cancelar facturas de ese mes.
-- Roles: ADMIN
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_monthly_closing;

DELIMITER $$

CREATE PROCEDURE sp_monthly_closing(
    IN p_year    SMALLINT,
    IN p_month   TINYINT,
    IN p_user_id INT UNSIGNED
)
BEGIN
    DECLARE v_start  DATE;
    DECLARE v_end    DATE;
    DECLARE v_count  INT           DEFAULT 0;
    DECLARE v_amount DECIMAL(14,2) DEFAULT 0;
    DECLARE v_tax    DECIMAL(14,2) DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN');

    IF p_year IS NULL OR p_month IS NULL
       OR p_year < 2000 OR p_year > 2100 OR p_month < 1 OR p_month > 12 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Periodo invalido';
    END IF;

    SET v_start = STR_TO_DATE(CONCAT(LPAD(p_year, 4, '0'), '-', LPAD(p_month, 2, '0'), '-01'), '%Y-%m-%d');
    SET v_end   = DATE_ADD(v_start, INTERVAL 1 MONTH);

    IF v_start > CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede cerrar un periodo futuro';
    END IF;
    IF EXISTS (SELECT 1 FROM monthly_closing WHERE period_year = p_year AND period_month = p_month) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El periodo ya fue cerrado';
    END IF;

    START TRANSACTION;

    SELECT COUNT(*), COALESCE(SUM(total), 0), COALESCE(SUM(tax_total), 0)
    INTO v_count, v_amount, v_tax
    FROM invoice
    WHERE status IN ('ISSUED', 'PAID')
      AND issued_at >= v_start
      AND issued_at <  v_end;

    INSERT INTO monthly_closing (period_year, period_month, invoice_count, total_amount, total_tax, closed_by)
    VALUES (p_year, p_month, v_count, v_amount, v_tax, p_user_id);

    COMMIT;

    SELECT p_year AS period_year, p_month AS period_month,
           v_count AS invoice_count, v_amount AS total_amount, v_tax AS total_tax;
END$$

DELIMITER ;
