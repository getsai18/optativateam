USE billing_db;

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
    UPDATE invoice inv
       SET inv.subtotal  = (SELECT COALESCE(SUM(d.line_subtotal), 0) FROM invoice_detail d WHERE d.invoice_id = inv.id),
           inv.tax_total = (SELECT COALESCE(SUM(d.tax_amount), 0)    FROM invoice_detail d WHERE d.invoice_id = inv.id),
           inv.total     = (SELECT COALESCE(SUM(d.line_total), 0)    FROM invoice_detail d WHERE d.invoice_id = inv.id)
     WHERE inv.id = p_invoice_id;
    IF (SELECT total FROM invoice WHERE id = p_invoice_id) <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El total de la factura debe ser mayor a cero';
    END IF;
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

DROP PROCEDURE IF EXISTS sp_save_invoice_draft$$
CREATE PROCEDURE sp_save_invoice_draft (
    IN p_invoice_id  INT UNSIGNED,
    IN p_customer_id INT UNSIGNED,
    IN p_lines       JSON,
    IN p_user_id     INT UNSIGNED
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_role      VARCHAR(10);
    DECLARE v_status    VARCHAR(10);
    DECLARE v_issuer_id INT UNSIGNED;
    DECLARE v_cus_name  VARCHAR(150);
    DECLARE v_cus_tax   VARCHAR(20);
    DECLARE v_cus_addr  VARCHAR(255);
    DECLARE v_cus_act   TINYINT;
    DECLARE v_id        INT UNSIGNED;
    DECLARE v_bad       INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    START TRANSACTION;
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id AND active = 1 FOR UPDATE;
    IF v_role IS NULL OR v_role NOT IN ('ADMIN', 'BILLER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rol no autorizado para guardar facturas';
    END IF;
    SELECT name, tax_id, address, active
      INTO v_cus_name, v_cus_tax, v_cus_addr, v_cus_act
      FROM customer
     WHERE id = p_customer_id;
    IF v_cus_name IS NULL OR v_cus_act <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Elige un cliente activo';
    END IF;
    IF p_lines IS NULL OR JSON_TYPE(p_lines) <> 'ARRAY' OR JSON_LENGTH(p_lines) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Agrega al menos un servicio';
    END IF;
    SELECT COUNT(*) INTO v_bad
      FROM JSON_TABLE(p_lines, '$[*]' COLUMNS (
               service_id BIGINT UNSIGNED PATH '$.serviceId',
               quantity   DECIMAL(12,2)   PATH '$.quantity')) j
     WHERE j.service_id IS NULL OR j.quantity IS NULL
        OR j.quantity < 1 OR j.quantity > 9999 OR j.quantity <> FLOOR(j.quantity);
    IF v_bad > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las cantidades deben ser enteros entre 1 y 9999';
    END IF;
    SELECT COUNT(*) INTO v_bad
      FROM (SELECT j.service_id
              FROM JSON_TABLE(p_lines, '$[*]' COLUMNS (
                       service_id BIGINT UNSIGNED PATH '$.serviceId')) j
             GROUP BY j.service_id
            HAVING COUNT(*) > 1) d;
    IF v_bad > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un servicio aparece repetido; ajusta su cantidad';
    END IF;
    SELECT COUNT(*) INTO v_bad
      FROM JSON_TABLE(p_lines, '$[*]' COLUMNS (
               service_id BIGINT UNSIGNED PATH '$.serviceId')) j
      LEFT JOIN service s ON s.id = j.service_id AND s.active = 1
     WHERE s.id IS NULL;
    IF v_bad > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un servicio seleccionado ya no está disponible';
    END IF;
    SELECT id INTO v_issuer_id FROM issuer WHERE active = 1 ORDER BY id LIMIT 1;
    IF v_issuer_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No hay un emisor activo configurado';
    END IF;
    IF p_invoice_id IS NULL THEN
        INSERT INTO invoice (issuer_id, customer_id, created_by, status,
                             receiver_name, receiver_tax_id, receiver_address)
        VALUES (v_issuer_id, p_customer_id, p_user_id, 'DRAFT',
                v_cus_name, v_cus_tax, v_cus_addr);
        SET v_id = LAST_INSERT_ID();
    ELSE
        SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id FOR UPDATE;
        IF v_status IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
        END IF;
        IF v_status <> 'DRAFT' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se pueden editar facturas en borrador';
        END IF;
        UPDATE invoice
           SET customer_id      = p_customer_id,
               receiver_name    = v_cus_name,
               receiver_tax_id  = v_cus_tax,
               receiver_address = v_cus_addr
         WHERE id = p_invoice_id;
        DELETE FROM invoice_detail WHERE invoice_id = p_invoice_id;
        SET v_id = p_invoice_id;
    END IF;
    INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity,
                                unit_price, line_subtotal, tax_amount, line_total)
    SELECT v_id, s.id, s.name, j.quantity, s.base_price,
           ROUND(j.quantity * s.base_price, 2), 0.00, ROUND(j.quantity * s.base_price, 2)
      FROM JSON_TABLE(p_lines, '$[*]' COLUMNS (
               ord        FOR ORDINALITY,
               service_id BIGINT UNSIGNED PATH '$.serviceId',
               quantity   INT UNSIGNED    PATH '$.quantity')) j
      JOIN service s ON s.id = j.service_id
     ORDER BY j.ord;
    INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
    SELECT x.detail_id, x.tax_id, x.rate, ROUND(x.sub * x.rate, 2)
      FROM (SELECT d.id AS detail_id, st.tax_id, d.line_subtotal AS sub,
                   fn_tax_rate_on(st.tax_id, CURDATE()) AS rate
              FROM invoice_detail d
              JOIN service_tax st ON st.service_id = d.service_id
             WHERE d.invoice_id = v_id) x;
    UPDATE invoice_detail d
      LEFT JOIN (SELECT invoice_detail_id, SUM(amount) AS amt
                   FROM invoice_detail_tax
                  GROUP BY invoice_detail_id) t ON t.invoice_detail_id = d.id
       SET d.tax_amount = COALESCE(t.amt, 0),
           d.line_total = d.line_subtotal + COALESCE(t.amt, 0)
     WHERE d.invoice_id = v_id;
    UPDATE invoice inv
       SET inv.subtotal  = (SELECT COALESCE(SUM(d.line_subtotal), 0) FROM invoice_detail d WHERE d.invoice_id = inv.id),
           inv.tax_total = (SELECT COALESCE(SUM(d.tax_amount), 0)    FROM invoice_detail d WHERE d.invoice_id = inv.id),
           inv.total     = (SELECT COALESCE(SUM(d.line_total), 0)    FROM invoice_detail d WHERE d.invoice_id = inv.id)
     WHERE inv.id = v_id;
    COMMIT;
    SELECT id, status, customer_id, subtotal, tax_total, total, created_at
      FROM invoice
     WHERE id = v_id;
END$$
DROP PROCEDURE IF EXISTS sp_delete_draft$$
CREATE PROCEDURE sp_delete_draft (
    IN p_invoice_id INT UNSIGNED,
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
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id AND active = 1 FOR UPDATE;
    IF v_role IS NULL OR v_role NOT IN ('ADMIN', 'BILLER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rol no autorizado para eliminar borradores';
    END IF;
    SELECT status INTO v_status FROM invoice WHERE id = p_invoice_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    IF v_status <> 'DRAFT' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se pueden eliminar facturas en borrador';
    END IF;
    DELETE FROM invoice WHERE id = p_invoice_id;
    COMMIT;
    SELECT p_invoice_id AS deleted_invoice_id;
END$$
DROP PROCEDURE IF EXISTS sp_get_invoice_detail$$
CREATE PROCEDURE sp_get_invoice_detail (
    IN p_invoice_id INT UNSIGNED,
    IN p_user_id    INT UNSIGNED
)
READS SQL DATA
BEGIN
    DECLARE v_role        VARCHAR(10);
    DECLARE v_customer_id INT UNSIGNED;
    SELECT role, customer_id INTO v_role, v_customer_id
      FROM app_user
     WHERE id = p_user_id AND active = 1;
    IF v_role IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario no autorizado';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM invoice i
         WHERE i.id = p_invoice_id
           AND (v_role IN ('ADMIN', 'BILLER')
                OR (v_role = 'CUSTOMER' AND i.customer_id = v_customer_id AND i.status <> 'DRAFT'))
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Factura no encontrada';
    END IF;
    SELECT i.id, i.uuid, i.folio, i.status, i.customer_id, i.created_by,
           iss.legal_name AS issuer_name, iss.tax_id AS issuer_tax_id, iss.address AS issuer_address,
           i.receiver_name, i.receiver_tax_id, i.receiver_address,
           i.subtotal, i.tax_total, i.total,
           i.created_at, i.issued_at, i.paid_at, i.cancelled_at, i.cancellation_reason
      FROM invoice i
      JOIN issuer iss ON iss.id = i.issuer_id
     WHERE i.id = p_invoice_id;
    SELECT d.id, d.service_id, d.service_name, d.quantity, d.unit_price,
           d.line_subtotal, d.tax_amount, d.line_total
      FROM invoice_detail d
     WHERE d.invoice_id = p_invoice_id
     ORDER BY d.id;
    SELECT dt.invoice_detail_id, dt.tax_id, t.code, dt.rate, dt.amount
      FROM invoice_detail_tax dt
      JOIN invoice_detail d ON d.id = dt.invoice_detail_id
      JOIN tax t            ON t.id = dt.tax_id
     WHERE d.invoice_id = p_invoice_id
     ORDER BY d.id, t.code;
    SELECT p.id, p.invoice_id, p.method, p.amount, p.reference, p.paid_at, p.registered_by
      FROM payment p
     WHERE p.invoice_id = p_invoice_id;
END$$
DROP PROCEDURE IF EXISTS sp_list_invoices$$
CREATE PROCEDURE sp_list_invoices (
    IN p_user_id INT UNSIGNED,
    IN p_status  VARCHAR(10),
    IN p_from    DATE,
    IN p_to      DATE,
    IN p_search  VARCHAR(100)
)
READS SQL DATA
BEGIN
    DECLARE v_role        VARCHAR(10);
    DECLARE v_customer_id INT UNSIGNED;
    DECLARE v_like        VARCHAR(220) DEFAULT NULL;
    SELECT role, customer_id INTO v_role, v_customer_id
      FROM app_user
     WHERE id = p_user_id AND active = 1;
    IF v_role IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario no autorizado';
    END IF;
    IF p_status IS NOT NULL AND p_status NOT IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Estado de factura no válido';
    END IF;
    IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to < p_from THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rango de fechas inválido';
    END IF;
    IF p_search IS NOT NULL AND LENGTH(TRIM(p_search)) > 0 THEN
        SET v_like = CONCAT('%',
                            REPLACE(REPLACE(REPLACE(TRIM(p_search), '\\', '\\\\'), '%', '\\%'), '_', '\\_'),
                            '%');
    END IF;
    SELECT i.id, i.folio, i.uuid, i.status, i.customer_id, i.receiver_name,
           i.subtotal, i.tax_total, i.total,
           i.created_at, i.issued_at, i.paid_at, i.cancelled_at
      FROM invoice i
     WHERE (v_role IN ('ADMIN', 'BILLER')
            OR (v_role = 'CUSTOMER' AND i.customer_id = v_customer_id AND i.status <> 'DRAFT'))
       AND (p_status IS NULL OR i.status = p_status)
       AND (p_from   IS NULL OR DATE(COALESCE(i.issued_at, i.created_at)) >= p_from)
       AND (p_to     IS NULL OR DATE(COALESCE(i.issued_at, i.created_at)) <= p_to)
       AND (v_like   IS NULL OR i.folio LIKE v_like
                             OR i.receiver_name LIKE v_like
                             OR i.uuid LIKE v_like)
     ORDER BY i.created_at DESC, i.id DESC;
END$$
DROP PROCEDURE IF EXISTS sp_change_tax_rate$$
CREATE PROCEDURE sp_change_tax_rate (
    IN p_tax_id     SMALLINT UNSIGNED,
    IN p_rate       DECIMAL(6,4),
    IN p_valid_from DATE,
    IN p_user_id    INT UNSIGNED
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_role      VARCHAR(10);
    DECLARE v_tax_id    SMALLINT UNSIGNED DEFAULT NULL;
    DECLARE v_open_id   INT UNSIGNED      DEFAULT NULL;
    DECLARE v_open_from DATE              DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    START TRANSACTION;
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id AND active = 1 FOR UPDATE;
    IF v_role IS NULL OR v_role <> 'ADMIN' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un administrador puede cambiar tasas de impuestos';
    END IF;
    IF p_rate IS NULL OR p_rate < 0 OR p_rate > 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La tasa debe estar entre 0% y 100%';
    END IF;
    IF p_valid_from IS NULL OR p_valid_from < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La nueva tasa no puede iniciar en el pasado';
    END IF;
    SELECT id INTO v_tax_id FROM tax WHERE id = p_tax_id FOR UPDATE;
    IF v_tax_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Impuesto no encontrado';
    END IF;
    SELECT id, valid_from INTO v_open_id, v_open_from
      FROM tax_history
     WHERE tax_id = p_tax_id AND valid_to IS NULL
     ORDER BY valid_from DESC
     LIMIT 1
       FOR UPDATE;
    IF v_open_id IS NOT NULL THEN
        IF p_valid_from <= v_open_from THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La nueva tasa debe iniciar después de la fecha de inicio de la tasa vigente';
        END IF;
        UPDATE tax_history SET valid_to = p_valid_from WHERE id = v_open_id;
    END IF;
    INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
    VALUES (p_tax_id, p_rate, p_valid_from, NULL, p_user_id);
    UPDATE tax SET current_rate = fn_tax_rate_on(p_tax_id, CURDATE()) WHERE id = p_tax_id;
    COMMIT;
    SELECT id, code, name, current_rate FROM tax WHERE id = p_tax_id;
END$$
DROP PROCEDURE IF EXISTS sp_dashboard_summary$$
CREATE PROCEDURE sp_dashboard_summary (
    IN p_user_id INT UNSIGNED
)
READS SQL DATA
BEGIN
    DECLARE v_role VARCHAR(10);
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id AND active = 1;
    IF v_role IS NULL OR v_role NOT IN ('ADMIN', 'BILLER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rol no autorizado para ver el dashboard';
    END IF;
    SELECT s.status,
           COUNT(i.id)               AS invoices,
           COALESCE(SUM(i.total), 0) AS amount
      FROM (SELECT 'DRAFT' AS status, 1 AS pos
            UNION ALL SELECT 'ISSUED', 2
            UNION ALL SELECT 'PAID', 3
            UNION ALL SELECT 'CANCELLED', 4) s
      LEFT JOIN invoice i ON i.status = s.status
     GROUP BY s.status, s.pos
     ORDER BY s.pos;
    WITH RECURSIVE m (n, month_start) AS (
        SELECT 0, CAST(DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01') AS DATE)
        UNION ALL
        SELECT n + 1, DATE_ADD(month_start, INTERVAL 1 MONTH) FROM m WHERE n < 5
    )
    SELECT DATE_FORMAT(m.month_start, '%Y-%m') AS month_key,
           COALESCE((SELECT SUM(i.total) FROM invoice i
                      WHERE i.status <> 'CANCELLED'
                        AND i.issued_at >= m.month_start
                        AND i.issued_at <  DATE_ADD(m.month_start, INTERVAL 1 MONTH)), 0) AS invoiced,
           COALESCE((SELECT SUM(i.total) FROM invoice i
                      WHERE i.paid_at >= m.month_start
                        AND i.paid_at <  DATE_ADD(m.month_start, INTERVAL 1 MONTH)), 0)   AS collected
      FROM m
     ORDER BY m.month_start;
    SELECT i.id, i.folio, i.status, i.receiver_name, i.total,
           COALESCE(i.issued_at, i.created_at) AS activity_date
      FROM invoice i
     ORDER BY activity_date DESC, i.id DESC
     LIMIT 8;
END$$
DROP PROCEDURE IF EXISTS sp_save_service$$
CREATE PROCEDURE sp_save_service (
    IN p_service_id  INT UNSIGNED,
    IN p_code        VARCHAR(20),
    IN p_name        VARCHAR(120),
    IN p_description TEXT,
    IN p_base_price  DECIMAL(10,2),
    IN p_category    VARCHAR(40),
    IN p_active      TINYINT,
    IN p_tax_ids     JSON,
    IN p_features    JSON,
    IN p_user_id     INT UNSIGNED
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_role VARCHAR(10);
    DECLARE v_id   INT UNSIGNED DEFAULT NULL;
    DECLARE v_bad  INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    START TRANSACTION;
    SELECT role INTO v_role FROM app_user WHERE id = p_user_id AND active = 1 FOR UPDATE;
    IF v_role IS NULL OR v_role <> 'ADMIN' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un administrador puede guardar servicios';
    END IF;
    IF p_code IS NULL OR LENGTH(TRIM(p_code)) = 0 OR p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Código y nombre son obligatorios';
    END IF;
    IF p_base_price IS NULL OR p_base_price < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El precio base debe ser mayor o igual a cero';
    END IF;
    IF p_category IS NULL OR p_category NOT IN (
           'Cloud Infrastructure', 'Software Licenses', 'Support & Maintenance',
           'Consulting', 'Training', 'Security', 'Data & Analytics', 'Development') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Categoría no válida';
    END IF;
    SELECT COUNT(*) INTO v_bad
      FROM service
     WHERE code = TRIM(p_code) AND (p_service_id IS NULL OR id <> p_service_id);
    IF v_bad > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un servicio con este código';
    END IF;
    IF p_tax_ids IS NOT NULL THEN
        IF JSON_TYPE(p_tax_ids) <> 'ARRAY' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Formato de impuestos no válido';
        END IF;
        SELECT COUNT(*) INTO v_bad
          FROM JSON_TABLE(p_tax_ids, '$[*]' COLUMNS (tax_id BIGINT UNSIGNED PATH '$')) j
          LEFT JOIN tax t ON t.id = j.tax_id
         WHERE t.id IS NULL;
        IF v_bad > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un impuesto seleccionado no existe';
        END IF;
    END IF;
    IF p_features IS NOT NULL THEN
        IF JSON_TYPE(p_features) <> 'ARRAY' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Formato de características no válido';
        END IF;
        SELECT COUNT(*) INTO v_bad
          FROM JSON_TABLE(p_features, '$[*]' COLUMNS (
                   feature_id BIGINT UNSIGNED PATH '$.featureId',
                   value      VARCHAR(100)    PATH '$.value')) j
          LEFT JOIN feature f ON f.id = j.feature_id
         WHERE f.id IS NULL OR j.value IS NULL OR LENGTH(TRIM(j.value)) = 0;
        IF v_bad > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una característica no existe o no tiene valor';
        END IF;
        SELECT COUNT(*) INTO v_bad
          FROM (SELECT j.feature_id
                  FROM JSON_TABLE(p_features, '$[*]' COLUMNS (
                           feature_id BIGINT UNSIGNED PATH '$.featureId')) j
                 GROUP BY j.feature_id
                HAVING COUNT(*) > 1) d;
        IF v_bad > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una característica está repetida';
        END IF;
    END IF;
    IF p_service_id IS NULL THEN
        INSERT INTO service (code, name, description, base_price, category, active)
        VALUES (TRIM(p_code), TRIM(p_name), p_description, p_base_price, p_category,
                COALESCE(p_active, 1));
        SET v_id = LAST_INSERT_ID();
    ELSE
        SELECT id INTO v_id FROM service WHERE id = p_service_id FOR UPDATE;
        IF v_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Servicio no encontrado';
        END IF;
        UPDATE service
           SET code        = TRIM(p_code),
               name        = TRIM(p_name),
               description = p_description,
               base_price  = p_base_price,
               category    = p_category,
               active      = COALESCE(p_active, active)
         WHERE id = v_id;
        DELETE FROM service_tax     WHERE service_id = v_id;
        DELETE FROM service_feature WHERE service_id = v_id;
    END IF;
    IF p_tax_ids IS NOT NULL THEN
        INSERT INTO service_tax (service_id, tax_id)
        SELECT DISTINCT v_id, j.tax_id
          FROM JSON_TABLE(p_tax_ids, '$[*]' COLUMNS (tax_id BIGINT UNSIGNED PATH '$')) j;
    END IF;
    IF p_features IS NOT NULL THEN
        INSERT INTO service_feature (service_id, feature_id, value)
        SELECT v_id, j.feature_id, TRIM(j.value)
          FROM JSON_TABLE(p_features, '$[*]' COLUMNS (
                   feature_id BIGINT UNSIGNED PATH '$.featureId',
                   value      VARCHAR(100)    PATH '$.value')) j;
    END IF;
    COMMIT;
    SELECT id, code, name, description, base_price, category, active FROM service WHERE id = v_id;
    SELECT tax_id FROM service_tax WHERE service_id = v_id ORDER BY tax_id;
    SELECT feature_id, value FROM service_feature WHERE service_id = v_id ORDER BY feature_id;
END$$
DELIMITER ;
