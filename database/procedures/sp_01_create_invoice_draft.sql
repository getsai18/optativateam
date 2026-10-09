-- =============================================================================
-- sp_create_invoice_draft
-- Crea una factura en estado DRAFT para un cliente y devuelve su id.
-- Roles: ADMIN, BILLER
-- =============================================================================
USE billing_db;

DROP PROCEDURE IF EXISTS sp_create_invoice_draft;

DELIMITER $$

CREATE PROCEDURE sp_create_invoice_draft(
    IN  p_customer_id INT UNSIGNED,
    IN  p_issuer_id   INT UNSIGNED,
    IN  p_user_id     INT UNSIGNED,
    OUT p_invoice_id  INT UNSIGNED
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    CALL sp_assert_user_role(p_user_id, 'ADMIN,BILLER');

    IF NOT EXISTS (SELECT 1 FROM customer WHERE id = p_customer_id AND active = 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cliente no existe o esta inactivo';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM issuer WHERE id = p_issuer_id AND active = 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El emisor no existe o esta inactivo';
    END IF;

    START TRANSACTION;

    INSERT INTO invoice (issuer_id, customer_id, created_by)
    VALUES (p_issuer_id, p_customer_id, p_user_id);

    SET p_invoice_id = LAST_INSERT_ID();

    COMMIT;
END$$

DELIMITER ;
