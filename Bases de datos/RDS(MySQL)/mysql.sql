-- =============================================================================
-- Sistema de Facturación - RDS MySQL 8.0: módulo de FACTURACIÓN (8 tablas)
-- Archivo: mysql.sql
-- Fuente de verdad: frontend/src (shared/types/domain.ts y servicios)
--
-- Reparto de datos del proyecto:
--   RDS MySQL   -> clientes, usuarios, emisor, facturas, detalle, pagos, folios (este archivo)
--   RDS Oracle  -> catálogo: servicios, características, impuestos e historial de tasas
--   DynamoDB    -> auditoría, eventos de factura, sesiones, carrito del wizard
--
-- Referencias entre bases (SIN llave foránea, no existen entre motores):
--   invoice_detail.service_id      -> Oracle.service.id      (la valida el backend)
--   invoice_detail_tax.tax_id      -> Oracle.tax.id          (la valida el backend)
-- Por eso invoice_detail / invoice_detail_tax guardan SNAPSHOTS (nombre, código,
-- tasa, importe): la factura emitida no depende del catálogo.
--
-- Requiere MySQL 8.0.16+ (CHECK ejecutados de forma efectiva).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS billing_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE billing_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS invoice_detail_tax;
DROP TABLE IF EXISTS invoice_detail;
DROP TABLE IF EXISTS invoice;
DROP TABLE IF EXISTS folio_counter;
DROP TABLE IF EXISTS issuer;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS customer;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. Clientes (receptores de factura)
--    Frontend: Customer { name, taxId, email, phone?, address, active }
-- -----------------------------------------------------------------------------
CREATE TABLE customer (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150)  NOT NULL,
    tax_id      VARCHAR(20)   NOT NULL,          -- Customer.taxId (RFC u homólogo)
    email       VARCHAR(100)  NOT NULL,
    phone       VARCHAR(30)   NULL,
    address     VARCHAR(255)  NOT NULL,
    active      TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_tax (tax_id),         -- el frontend solo valida unicidad de taxId
    CONSTRAINT ck_customer_active CHECK (active IN (0, 1))
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. Usuarios de la aplicación
--    Frontend: User { email, fullName, role, customerId?, active } + login
--    password_hash lo genera el backend (bcrypt/argon2).
-- -----------------------------------------------------------------------------
CREATE TABLE app_user (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    email          VARCHAR(100)  NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    full_name      VARCHAR(150)  NOT NULL,
    role           VARCHAR(10)   NOT NULL,
    customer_id    INT UNSIGNED  NULL,            -- solo rol CUSTOMER
    active         TINYINT(1)    NOT NULL DEFAULT 1,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_user_email (email),
    KEY ix_app_user_customer (customer_id),
    CONSTRAINT fk_app_user_customer FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT ck_app_user_role    CHECK (role IN ('ADMIN', 'BILLER', 'CUSTOMER')),
    CONSTRAINT ck_app_user_active  CHECK (active IN (0, 1)),
    CONSTRAINT ck_app_user_customer_ck CHECK ((role = 'CUSTOMER' AND customer_id IS NOT NULL)
                                           OR (role <> 'CUSTOMER' AND customer_id IS NULL))
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. Emisor de facturas (constante del frontend: shared/constants/company.ts)
-- -----------------------------------------------------------------------------
CREATE TABLE issuer (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    legal_name  VARCHAR(150)  NOT NULL,
    tax_id      VARCHAR(20)   NOT NULL,
    address     VARCHAR(255)  NOT NULL,
    active      TINYINT(1)    NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_issuer_tax (tax_id),
    CONSTRAINT ck_issuer_active CHECK (active IN (0, 1))
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. Facturas
--    Frontend: Invoice { folio?, uuid?, status, customerId, createdBy, issuer,
--                        receiver, lines, subtotal, taxTotal, total, fechas }
-- -----------------------------------------------------------------------------
CREATE TABLE invoice (
    id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    uuid                CHAR(36)      NULL,       -- asignado al emitir (null en borrador)
    folio               VARCHAR(20)   NULL,       -- INV-YYYY-NNNN; solo al emitir
    issuer_id           INT UNSIGNED  NOT NULL,
    customer_id         INT UNSIGNED  NOT NULL,
    created_by          INT UNSIGNED  NOT NULL,
    status              VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
    receiver_name       VARCHAR(150)  NOT NULL,   -- snapshot del receptor
    receiver_tax_id     VARCHAR(20)   NOT NULL,
    receiver_address    VARCHAR(255)  NOT NULL,
    subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_total           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    issued_at           DATETIME      NULL,
    paid_at             DATETIME      NULL,
    cancelled_at        DATETIME      NULL,
    cancellation_reason VARCHAR(255)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invoice_uuid (uuid),
    UNIQUE KEY uq_invoice_folio (folio),
    KEY ix_invoice_customer (customer_id),
    KEY ix_invoice_created_by (created_by),
    KEY ix_invoice_status_issued (status, issued_at),
    KEY ix_invoice_status_created (status, created_at),
    CONSTRAINT fk_invoice_issuer   FOREIGN KEY (issuer_id)   REFERENCES issuer (id),
    CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT fk_invoice_user     FOREIGN KEY (created_by)  REFERENCES app_user (id),
    CONSTRAINT ck_invoice_status  CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED')),
    CONSTRAINT ck_invoice_amounts CHECK (subtotal >= 0 AND tax_total >= 0 AND total >= 0),
    CONSTRAINT ck_invoice_cancel_ck CHECK ((status = 'CANCELLED' AND cancellation_reason IS NOT NULL)
                                        OR status <> 'CANCELLED')
) ENGINE=InnoDB;

-- Detalle de factura (frontend: InvoiceLine)
-- service_id referencia Oracle.service.id (sin FK: otra base). service_name y
-- unit_price son el snapshot que se muestra en la factura.
CREATE TABLE invoice_detail (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    invoice_id     INT UNSIGNED  NOT NULL,
    service_id     INT UNSIGNED  NOT NULL,        -- -> Oracle.service.id
    service_name   VARCHAR(120)  NOT NULL,        -- snapshot
    quantity       INT UNSIGNED  NOT NULL,        -- 1..9999
    unit_price     DECIMAL(10,2) NOT NULL,        -- snapshot de service.base_price
    line_subtotal  DECIMAL(12,2) NOT NULL,
    tax_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total     DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invoice_detail_line (invoice_id, service_id),  -- un servicio no se repite
    KEY ix_invoice_detail_service (service_id),
    CONSTRAINT fk_idetail_invoice FOREIGN KEY (invoice_id) REFERENCES invoice (id) ON DELETE CASCADE,
    CONSTRAINT ck_idetail_qty CHECK (quantity > 0 AND quantity <= 9999)
) ENGINE=InnoDB;

-- Desglose por impuesto de cada línea (frontend: InvoiceLine.taxes: InvoiceLineTax[])
-- tax_id referencia Oracle.tax.id (sin FK). Código, nombre y tasa quedan congelados.
CREATE TABLE invoice_detail_tax (
    id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    invoice_detail_id INT UNSIGNED      NOT NULL,
    tax_id            SMALLINT UNSIGNED NOT NULL,   -- -> Oracle.tax.id
    tax_code          VARCHAR(20)       NOT NULL,   -- snapshot (InvoiceLineTax.code)
    tax_name          VARCHAR(80)       NOT NULL,   -- snapshot (etiqueta "VAT 16%")
    rate              DECIMAL(6,4)      NOT NULL,   -- tasa vigente al calcular
    amount            DECIMAL(12,2)     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invoice_detail_tax (invoice_detail_id, tax_id),
    KEY ix_invoice_detail_tax_tax (tax_id),
    CONSTRAINT fk_idtax_detail FOREIGN KEY (invoice_detail_id) REFERENCES invoice_detail (id) ON DELETE CASCADE,
    CONSTRAINT ck_idtax_rate   CHECK (rate >= 0 AND rate <= 1),
    CONSTRAINT ck_idtax_amount CHECK (amount >= 0)
) ENGINE=InnoDB;

-- Contador de folios por año (frontend: Db.folioCounters). Vive junto a invoice
-- para incrementarlo en la misma transacción que emite la factura.
CREATE TABLE folio_counter (
    year        SMALLINT     NOT NULL,
    last_number INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (year),
    CONSTRAINT ck_folio_year CHECK (year BETWEEN 2000 AND 2100)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. Pagos (simulados)
--    Frontend: Payment { invoiceId, method, amount, reference, paidAt, registeredBy }
--    Regla del frontend: un solo pago total por factura emitida.
-- -----------------------------------------------------------------------------
CREATE TABLE payment (
    id            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    invoice_id    INT UNSIGNED   NOT NULL,
    method        VARCHAR(10)    NOT NULL,
    amount        DECIMAL(12,2)  NOT NULL,
    reference     VARCHAR(60)    NULL,            -- referencia simulada (SIM-XXXXXX)
    paid_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    registered_by INT UNSIGNED   NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_invoice (invoice_id),   -- un pago por factura
    KEY ix_payment_registered_by (registered_by),
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id)    REFERENCES invoice (id),
    CONSTRAINT fk_payment_user    FOREIGN KEY (registered_by) REFERENCES app_user (id),
    CONSTRAINT ck_payment_method  CHECK (method IN ('CARD', 'TRANSFER', 'CASH')),
    CONSTRAINT ck_payment_amount  CHECK (amount > 0)
) ENGINE=InnoDB;
