-- =============================================================================
-- sp_add_invoice_item
-- Agrega un servicio a una factura en borrador (o suma cantidad si ya estaba)
-- y recalcula subtotal, descuento, impuestos y total.
-- Roles: ADMIN, BILLER
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_add_invoice_item;

DELIMITER $$

CREATE PROCEDURE sp_add_invoice_item(
    IN p_invoice_id INT UNSIGNED,
    IN p_service_id INT UNSIGNED,
    IN p_quantity   INT UNSIGNED,
    IN p_user_id    INT UNSIGNED
)
BEGIN
    DECLARE v_status    VARCHAR(20)   DEFAULT NULL;
    DECLARE v_name      VARCHAR(100)  DEFAULT NULL;
    DECLARE v_price     DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_detail_id INT UNSIGNED  DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN,BILLER');

    IF p_quantity IS NULL OR p_quantity < 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cantidad debe ser mayor a cero';
    END IF;

    START TRANSACTION;

    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    IF v_status <> 'DRAFT' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se pueden modificar facturas en borrador';
    END IF;

    SELECT name, base_price INTO v_name, v_price
    FROM service
    WHERE id = p_service_id AND active = 1;

    IF v_name IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El servicio no existe o esta inactivo';
    END IF;

    SELECT id INTO v_detail_id
    FROM invoice_detail
    WHERE invoice_id = p_invoice_id AND service_id = p_service_id
    LIMIT 1;

    IF v_detail_id IS NULL THEN
        INSERT INTO invoice_detail
            (invoice_id, service_id, service_name, quantity, unit_price, line_subtotal, line_total)
        VALUES
            (p_invoice_id, p_service_id, v_name, p_quantity, v_price,
             ROUND(p_quantity * v_price, 2), ROUND(p_quantity * v_price, 2));
    ELSE
        UPDATE invoice_detail
        SET quantity = quantity + p_quantity
        WHERE id = v_detail_id;
    END IF;

    CALL sp_recalculate_invoice(p_invoice_id);

    COMMIT;
END$$

DELIMITER ;
