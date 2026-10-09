-- =============================================================================
-- sp_set_customer_discount
-- Aplica un descuento a un cliente (a una categoría o general si p_category_id
-- es NULL). Desactiva el descuento activo anterior del mismo alcance y
-- recalcula las facturas en borrador del cliente.
-- Roles: ADMIN
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_set_customer_discount;

DELIMITER $$

CREATE PROCEDURE sp_set_customer_discount(
    IN p_customer_id INT UNSIGNED,
    IN p_category_id SMALLINT UNSIGNED,     -- NULL = todas las categorías
    IN p_percentage  DECIMAL(5,2),          -- 10.00 = 10 %
    IN p_valid_from  DATE,
    IN p_valid_to    DATE,                  -- NULL = sin fecha de fin
    IN p_user_id     INT UNSIGNED
)
BEGIN
    DECLARE v_done        TINYINT      DEFAULT 0;
    DECLARE v_invoice_id  INT UNSIGNED DEFAULT NULL;
    DECLARE v_discount_id INT UNSIGNED DEFAULT NULL;
    DECLARE v_recalc      INT          DEFAULT 0;

    DECLARE cur_drafts CURSOR FOR
        SELECT id FROM invoice WHERE customer_id = p_customer_id AND status = 'DRAFT';

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN');

    IF NOT EXISTS (SELECT 1 FROM customer WHERE id = p_customer_id AND active = 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no existe o esta inactivo';
    END IF;
    IF p_category_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM service_category WHERE id = p_category_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La categoria no existe';
    END IF;
    IF p_percentage IS NULL OR p_percentage <= 0 OR p_percentage > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El porcentaje debe ser mayor a 0 y maximo 100';
    END IF;
    IF p_valid_from IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha de inicio es obligatoria';
    END IF;
    IF p_valid_to IS NOT NULL AND p_valid_to < p_valid_from THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha final no puede ser menor a la inicial';
    END IF;

    START TRANSACTION;

    -- Solo un descuento activo por cliente y alcance (categoría o general)
    UPDATE customer_discount
    SET active = 0
    WHERE customer_id = p_customer_id
      AND active = 1
      AND category_id <=> p_category_id;

    INSERT INTO customer_discount (customer_id, category_id, percentage, valid_from, valid_to)
    VALUES (p_customer_id, p_category_id, p_percentage, p_valid_from, p_valid_to);

    SET v_discount_id = LAST_INSERT_ID();

    -- Recalcula las facturas en borrador del cliente
    OPEN cur_drafts;
    drafts_loop: LOOP
        FETCH cur_drafts INTO v_invoice_id;
        IF v_done = 1 THEN
            LEAVE drafts_loop;
        END IF;
        CALL sp_recalculate_invoice(v_invoice_id);
        SET v_recalc = v_recalc + 1;
    END LOOP;
    CLOSE cur_drafts;

    COMMIT;

    SELECT v_discount_id AS discount_id, v_recalc AS draft_invoices_recalculated;
END$$

DELIMITER ;
