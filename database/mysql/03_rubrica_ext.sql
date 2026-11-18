-- =============================================================================
-- Extensión del esquema de facturación (RDS MySQL 8) para la rúbrica del Proyecto C.
--   * Descuentos por cliente o por volumen            -> discount_rule, invoice.discount_*
--   * Retenciones (ISR / IVA retenido)                -> invoice.withholding_total,
--                                                        invoice_detail_tax.kind
--   * Cancelación con reversión contable              -> accounting_entry
--   * Cierre y consolidado fiscal diario / mensual    -> fiscal_closing
--
-- Idempotente: se puede ejecutar varias veces sobre una base existente.
-- Ejecutar DESPUÉS de 01_schema.sql y ANTES de database/procedures/mysql_procedures.sql.
-- =============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS _add_column_if_missing$$
CREATE PROCEDURE _add_column_if_missing(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_ddl VARCHAR(500))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = DATABASE() AND table_name = p_table AND column_name = p_column) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_ddl);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS _add_check_if_missing$$
CREATE PROCEDURE _add_check_if_missing(IN p_table VARCHAR(64), IN p_name VARCHAR(64), IN p_expr VARCHAR(500))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_schema = DATABASE() AND table_name = p_table AND constraint_name = p_name) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_name, '` CHECK (', p_expr, ')');
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------------------------------
-- invoice: descuento y retenciones
-- total = subtotal - discount_total + tax_total - withholding_total
-- -----------------------------------------------------------------------------
CALL _add_column_if_missing('invoice', 'discount_pct',
     '`discount_pct` DECIMAL(5,4) NOT NULL DEFAULT 0.0000 AFTER `subtotal`');
CALL _add_column_if_missing('invoice', 'discount_total',
     '`discount_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `discount_pct`');
CALL _add_column_if_missing('invoice', 'withholding_total',
     '`withholding_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `tax_total`');
CALL _add_check_if_missing('invoice', 'ck_invoice_discount',
     '`discount_pct` BETWEEN 0 AND 1 AND `discount_total` >= 0 AND `withholding_total` >= 0');

-- -----------------------------------------------------------------------------
-- invoice_detail_tax: tipo de impuesto (copia del catálogo al momento de facturar)
--   TRANSFER = trasladado (IVA, IEPS): se suma al total
--   WITHHELD = retenido (ISR, IVA retenido): se resta del total
-- -----------------------------------------------------------------------------
CALL _add_column_if_missing('invoice_detail_tax', 'kind',
     '`kind` VARCHAR(10) NOT NULL DEFAULT ''TRANSFER'' AFTER `tax_name`');
CALL _add_check_if_missing('invoice_detail_tax', 'ck_idtax_kind',
     '`kind` IN (''TRANSFER'', ''WITHHELD'')');

-- -----------------------------------------------------------------------------
-- discount_rule: reglas de descuento
--   * customer_id NOT NULL              -> descuento del cliente (opcionalmente desde un monto)
--   * customer_id NULL + min_subtotal   -> descuento por volumen para todos los clientes
-- Se aplica la regla con mayor porcentaje.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discount_rule (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name          VARCHAR(80)   NOT NULL,
    customer_id   INT UNSIGNED  NULL,
    min_subtotal  DECIMAL(12,2) NULL,
    pct           DECIMAL(5,4)  NOT NULL,
    active        TINYINT(1)    NOT NULL DEFAULT 1,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_discount_rule_customer (customer_id, active),
    KEY ix_discount_rule_volume (active, min_subtotal),
    CONSTRAINT fk_discount_rule_customer FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT ck_discount_rule_pct    CHECK (pct > 0 AND pct <= 0.5),
    CONSTRAINT ck_discount_rule_min    CHECK (min_subtotal IS NULL OR min_subtotal >= 0),
    CONSTRAINT ck_discount_rule_target CHECK (customer_id IS NOT NULL OR min_subtotal IS NOT NULL),
    CONSTRAINT ck_discount_rule_active CHECK (active IN (0, 1))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- accounting_entry: asientos contables de partida doble por factura
--   ISSUE    : Clientes (D) + Retenciones por acreditar (D) = Ingresos (H) + Impuestos por pagar (H)
--   PAYMENT  : Bancos (D) = Clientes (H)
--   REVERSAL : inverso exacto de los asientos ISSUE al cancelar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_entry (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    invoice_id  INT UNSIGNED  NOT NULL,
    entry_type  VARCHAR(10)   NOT NULL,
    account     VARCHAR(30)   NOT NULL,
    debit       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    credit      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_by  INT UNSIGNED  NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_accounting_entry_invoice (invoice_id, entry_type),
    KEY ix_accounting_entry_created (created_at),
    CONSTRAINT fk_accounting_entry_invoice FOREIGN KEY (invoice_id) REFERENCES invoice (id),
    CONSTRAINT fk_accounting_entry_user    FOREIGN KEY (created_by) REFERENCES app_user (id),
    CONSTRAINT ck_accounting_entry_type    CHECK (entry_type IN ('ISSUE', 'PAYMENT', 'REVERSAL')),
    CONSTRAINT ck_accounting_entry_account CHECK (account IN ('ACCOUNTS_RECEIVABLE', 'REVENUE', 'TAX_PAYABLE',
                                                              'WITHHOLDING_RECEIVABLE', 'BANK')),
    CONSTRAINT ck_accounting_entry_amounts CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- fiscal_closing: cierre y consolidado fiscal por día o por mes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal_closing (
    id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    period_type        VARCHAR(5)    NOT NULL,
    period_start       DATE          NOT NULL,
    period_end         DATE          NOT NULL,
    invoice_count      INT UNSIGNED  NOT NULL DEFAULT 0,
    cancelled_count    INT UNSIGNED  NOT NULL DEFAULT 0,
    subtotal           DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    discount_total     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    tax_total          DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    withholding_total  DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    total              DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    collected_total    DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    closed_by          INT UNSIGNED  NULL,
    closed_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_fiscal_closing_period (period_type, period_start),
    CONSTRAINT fk_fiscal_closing_user FOREIGN KEY (closed_by) REFERENCES app_user (id),
    CONSTRAINT ck_fiscal_closing_type  CHECK (period_type IN ('DAY', 'MONTH')),
    CONSTRAINT ck_fiscal_closing_dates CHECK (period_end > period_start)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- Índices para reportes (antigüedad de saldos y cierres)
-- -----------------------------------------------------------------------------
DELIMITER $$
DROP PROCEDURE IF EXISTS _add_index_if_missing$$
CREATE PROCEDURE _add_index_if_missing(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_cols VARCHAR(200))
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
                   WHERE table_schema = DATABASE() AND table_name = p_table AND index_name = p_index) THEN
        SET @ddl = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_cols, ')');
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL _add_index_if_missing('invoice', 'ix_invoice_status_cancelled', '`status`, `cancelled_at`');
CALL _add_index_if_missing('invoice', 'ix_invoice_customer_status', '`customer_id`, `status`, `issued_at`');

-- -----------------------------------------------------------------------------
-- Backfill: asientos contables de las facturas que ya estaban emitidas o pagadas
-- -----------------------------------------------------------------------------
INSERT INTO accounting_entry (invoice_id, entry_type, account, debit, credit, created_by, created_at)
SELECT i.id, 'ISSUE', x.account, x.debit, x.credit, i.created_by, i.issued_at
FROM invoice i
JOIN LATERAL (
    SELECT 'ACCOUNTS_RECEIVABLE' AS account, i.total AS debit, 0.00 AS credit
    UNION ALL SELECT 'WITHHOLDING_RECEIVABLE', i.withholding_total, 0.00
    UNION ALL SELECT 'REVENUE', 0.00, i.subtotal - i.discount_total
    UNION ALL SELECT 'TAX_PAYABLE', 0.00, i.tax_total
) x
WHERE i.status IN ('ISSUED', 'PAID', 'CANCELLED') AND i.issued_at IS NOT NULL
  AND (x.debit > 0 OR x.credit > 0)
  AND NOT EXISTS (SELECT 1 FROM accounting_entry a WHERE a.invoice_id = i.id AND a.entry_type = 'ISSUE');

INSERT INTO accounting_entry (invoice_id, entry_type, account, debit, credit, created_by, created_at)
SELECT p.invoice_id, 'PAYMENT', x.account, x.debit, x.credit, p.registered_by, p.paid_at
FROM payment p
JOIN LATERAL (
    SELECT 'BANK' AS account, p.amount AS debit, 0.00 AS credit
    UNION ALL SELECT 'ACCOUNTS_RECEIVABLE', 0.00, p.amount
) x
WHERE NOT EXISTS (SELECT 1 FROM accounting_entry a WHERE a.invoice_id = p.invoice_id AND a.entry_type = 'PAYMENT');

INSERT INTO accounting_entry (invoice_id, entry_type, account, debit, credit, created_by, created_at)
SELECT a.invoice_id, 'REVERSAL', a.account, a.credit, a.debit, a.created_by, i.cancelled_at
FROM accounting_entry a
JOIN invoice i ON i.id = a.invoice_id
WHERE a.entry_type = 'ISSUE' AND i.status = 'CANCELLED'
  AND NOT EXISTS (SELECT 1 FROM accounting_entry r WHERE r.invoice_id = a.invoice_id AND r.entry_type = 'REVERSAL');

-- -----------------------------------------------------------------------------
-- Reglas de descuento de ejemplo (solo si la tabla está vacía)
-- -----------------------------------------------------------------------------
INSERT INTO discount_rule (name, customer_id, min_subtotal, pct)
SELECT * FROM (
    SELECT 'Volumen >= 50,000'  AS name, NULL AS customer_id, 50000.00  AS min_subtotal, 0.0300 AS pct
    UNION ALL SELECT 'Volumen >= 150,000', NULL, 150000.00, 0.0500
    UNION ALL SELECT 'Cliente preferente', (SELECT MIN(id) FROM customer), NULL, 0.0400
) seed
WHERE NOT EXISTS (SELECT 1 FROM discount_rule)
  -- Sin clientes cargados (por ejemplo en CI con --fresh sin --seed), la regla de
  -- cliente tendría customer_id NULL y violaría ck_discount_rule_target.
  AND (customer_id IS NOT NULL OR min_subtotal IS NOT NULL);

DROP PROCEDURE IF EXISTS _add_column_if_missing;
DROP PROCEDURE IF EXISTS _add_check_if_missing;
DROP PROCEDURE IF EXISTS _add_index_if_missing;
