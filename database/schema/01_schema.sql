-- =============================================================================
-- Sistema de Facturación - Esquema relacional (Amazon RDS for MySQL 8.0)
-- Archivo: database/schema/01_schema.sql
-- Convención: nombres de tablas y columnas en inglés, snake_case.
-- Orden de ejecución: 01_schema.sql -> seeds/00_base_catalogs.sql -> procedures/*.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS billing_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE billing_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS monthly_closing;
DROP TABLE IF EXISTS customer_discount;
DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS payment_method;
DROP TABLE IF EXISTS invoice_detail;
DROP TABLE IF EXISTS invoice;
DROP TABLE IF EXISTS service_tax;
DROP TABLE IF EXISTS tax_history;
DROP TABLE IF EXISTS tax;
DROP TABLE IF EXISTS service_feature;
DROP TABLE IF EXISTS feature;
DROP TABLE IF EXISTS service;
DROP TABLE IF EXISTS service_category;
DROP TABLE IF EXISTS issuer;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS customer;
DROP TABLE IF EXISTS role;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. Seguridad: roles y usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE role (
    id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(30)      NOT NULL,   -- ADMIN, BILLER, CUSTOMER
    description VARCHAR(150)     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_role_name (name)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. Clientes (receptores) y emisor
-- -----------------------------------------------------------------------------
CREATE TABLE customer (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150) NOT NULL,
    rfc         VARCHAR(13)  NOT NULL,       -- 12 (moral) o 13 (física)
    email       VARCHAR(100) NOT NULL,
    tax_regime  VARCHAR(100) NULL,
    address     VARCHAR(255) NULL,
    postal_code CHAR(5)      NULL,
    active      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_rfc (rfc),
    UNIQUE KEY uq_customer_email (email),
    CONSTRAINT ck_customer_rfc_len CHECK (CHAR_LENGTH(rfc) IN (12, 13))
) ENGINE=InnoDB;

CREATE TABLE app_user (
    id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    email           VARCHAR(100)     NOT NULL,
    password_hash   VARCHAR(255)     NOT NULL,   -- bcrypt/argon2, nunca texto plano
    role_id         TINYINT UNSIGNED NOT NULL,
    customer_id     INT UNSIGNED     NULL,       -- solo para rol CUSTOMER
    active          TINYINT(1)       NOT NULL DEFAULT 1,
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until    DATETIME         NULL,
    last_login_at   DATETIME         NULL,
    created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_user_email (email),
    KEY ix_app_user_role (role_id),
    KEY ix_app_user_customer (customer_id),
    CONSTRAINT fk_app_user_role     FOREIGN KEY (role_id)     REFERENCES role (id),
    CONSTRAINT fk_app_user_customer FOREIGN KEY (customer_id) REFERENCES customer (id)
) ENGINE=InnoDB;

CREATE TABLE issuer (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    legal_name  VARCHAR(150) NOT NULL,
    rfc         VARCHAR(13)  NOT NULL,
    tax_regime  VARCHAR(100) NULL,
    address     VARCHAR(255) NULL,
    postal_code CHAR(5)      NULL,
    active      TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_issuer_rfc (rfc)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. Catálogo de servicios y características
-- -----------------------------------------------------------------------------
CREATE TABLE service_category (
    id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(80)       NOT NULL,
    description VARCHAR(255)      NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_category_name (name)
) ENGINE=InnoDB;

CREATE TABLE service (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    code        VARCHAR(20)       NOT NULL,      -- SKU legible, ej. SRV-0001
    name        VARCHAR(100)      NOT NULL,
    description TEXT              NULL,
    base_price  DECIMAL(10,2)     NOT NULL,
    category_id SMALLINT UNSIGNED NOT NULL,
    active      TINYINT(1)        NOT NULL DEFAULT 1,
    created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_code (code),
    KEY ix_service_category (category_id),
    KEY ix_service_active_name (active, name),
    CONSTRAINT fk_service_category FOREIGN KEY (category_id) REFERENCES service_category (id),
    CONSTRAINT ck_service_price CHECK (base_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE feature (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,           -- ej. Vigencia, Límite de consumo
    description TEXT         NULL,
    unit        VARCHAR(30)  NULL,               -- ej. días, GB, horas
    PRIMARY KEY (id),
    UNIQUE KEY uq_feature_name (name)
) ENGINE=InnoDB;

CREATE TABLE service_feature (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id  INT UNSIGNED NOT NULL,
    feature_id  INT UNSIGNED NOT NULL,
    value       VARCHAR(100) NOT NULL,           -- ej. '30', 'Premium', '500'
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_feature (service_id, feature_id),
    KEY ix_service_feature_feature (feature_id),
    CONSTRAINT fk_sf_service FOREIGN KEY (service_id) REFERENCES service (id) ON DELETE CASCADE,
    CONSTRAINT fk_sf_feature FOREIGN KEY (feature_id) REFERENCES feature (id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. Impuestos
-- -----------------------------------------------------------------------------
CREATE TABLE tax (
    id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code         VARCHAR(20)       NOT NULL,     -- IVA, IEPS, ...
    name         VARCHAR(80)       NOT NULL,
    current_rate DECIMAL(6,4)      NOT NULL,     -- 0.1600 = 16 %
    active       TINYINT(1)        NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tax_code (code),
    CONSTRAINT ck_tax_rate CHECK (current_rate >= 0 AND current_rate <= 1)
) ENGINE=InnoDB;

CREATE TABLE tax_history (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    tax_id      SMALLINT UNSIGNED NOT NULL,
    rate        DECIMAL(6,4)      NOT NULL,
    valid_from  DATE              NOT NULL,
    valid_to    DATE              NULL,          -- NULL = vigente
    changed_by  INT UNSIGNED      NULL,
    created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_tax_history_tax_dates (tax_id, valid_from, valid_to),
    CONSTRAINT fk_tax_history_tax  FOREIGN KEY (tax_id)     REFERENCES tax (id),
    CONSTRAINT fk_tax_history_user FOREIGN KEY (changed_by) REFERENCES app_user (id),
    CONSTRAINT ck_tax_history_rate  CHECK (rate >= 0 AND rate <= 1),
    CONSTRAINT ck_tax_history_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB;

CREATE TABLE service_tax (
    service_id INT UNSIGNED      NOT NULL,
    tax_id     SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (service_id, tax_id),
    KEY ix_service_tax_tax (tax_id),
    CONSTRAINT fk_service_tax_service FOREIGN KEY (service_id) REFERENCES service (id) ON DELETE CASCADE,
    CONSTRAINT fk_service_tax_tax     FOREIGN KEY (tax_id)     REFERENCES tax (id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. Facturación
-- -----------------------------------------------------------------------------
CREATE TABLE invoice (
    id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    uuid                CHAR(36)      NOT NULL DEFAULT (UUID()),
    folio               VARCHAR(20)   NULL,      -- se asigna al emitir
    issuer_id           INT UNSIGNED  NOT NULL,
    customer_id         INT UNSIGNED  NOT NULL,
    created_by          INT UNSIGNED  NOT NULL,  -- app_user que la generó
    status              ENUM('DRAFT','ISSUED','PAID','CANCELLED') NOT NULL DEFAULT 'DRAFT',
    subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_total      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
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
    KEY ix_invoice_issuer (issuer_id),
    KEY ix_invoice_created_by (created_by),
    KEY ix_invoice_status_issued (status, issued_at),
    CONSTRAINT fk_invoice_issuer   FOREIGN KEY (issuer_id)   REFERENCES issuer (id),
    CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT fk_invoice_user     FOREIGN KEY (created_by)  REFERENCES app_user (id),
    CONSTRAINT ck_invoice_amounts  CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND total >= 0)
) ENGINE=InnoDB;

-- Los montos de cada línea son un "snapshot": si cambia el precio o el impuesto
-- del catálogo, las facturas ya emitidas no se modifican.
CREATE TABLE invoice_detail (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    invoice_id      INT UNSIGNED  NOT NULL,
    service_id      INT UNSIGNED  NOT NULL,
    service_name    VARCHAR(100)  NOT NULL,
    quantity        INT UNSIGNED  NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL,
    line_subtotal   DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total      DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (id),
    KEY ix_invoice_detail_invoice (invoice_id),
    KEY ix_invoice_detail_service (service_id),
    CONSTRAINT fk_idetail_invoice FOREIGN KEY (invoice_id) REFERENCES invoice (id) ON DELETE CASCADE,
    CONSTRAINT fk_idetail_service FOREIGN KEY (service_id) REFERENCES service (id),
    CONSTRAINT ck_idetail_qty CHECK (quantity > 0)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. Pagos (simulados)
-- -----------------------------------------------------------------------------
CREATE TABLE payment_method (
    id     TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name   VARCHAR(50)      NOT NULL,            -- CARD, TRANSFER, CASH
    active TINYINT(1)       NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_method_name (name)
) ENGINE=InnoDB;

CREATE TABLE payment (
    id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    invoice_id        INT UNSIGNED     NOT NULL,
    payment_method_id TINYINT UNSIGNED NOT NULL,
    amount            DECIMAL(12,2)    NOT NULL,
    reference         VARCHAR(60)      NULL,     -- referencia simulada
    status            ENUM('PENDING','APPROVED','REJECTED','REFUNDED') NOT NULL DEFAULT 'APPROVED',
    paid_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_payment_invoice (invoice_id),
    KEY ix_payment_method (payment_method_id),
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id)        REFERENCES invoice (id),
    CONSTRAINT fk_payment_method  FOREIGN KEY (payment_method_id) REFERENCES payment_method (id),
    CONSTRAINT ck_payment_amount  CHECK (amount > 0)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. Soporte para SPs de descuentos y cierre mensual
-- -----------------------------------------------------------------------------
CREATE TABLE customer_discount (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    customer_id INT UNSIGNED      NOT NULL,
    category_id SMALLINT UNSIGNED NULL,          -- NULL = aplica a todas las categorías
    percentage  DECIMAL(5,2)      NOT NULL,      -- 10.00 = 10 %
    valid_from  DATE              NOT NULL,
    valid_to    DATE              NULL,
    active      TINYINT(1)        NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY ix_cdiscount_customer (customer_id, active),
    KEY ix_cdiscount_category (category_id),
    CONSTRAINT fk_cdiscount_customer FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT fk_cdiscount_category FOREIGN KEY (category_id) REFERENCES service_category (id),
    CONSTRAINT ck_cdiscount_pct CHECK (percentage > 0 AND percentage <= 100)
) ENGINE=InnoDB;

CREATE TABLE monthly_closing (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    period_year    SMALLINT      NOT NULL,
    period_month   TINYINT       NOT NULL,
    invoice_count  INT UNSIGNED  NOT NULL DEFAULT 0,
    total_amount   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    total_tax      DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    closed_by      INT UNSIGNED  NOT NULL,
    closed_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_monthly_closing_period (period_year, period_month),
    CONSTRAINT fk_mclosing_user FOREIGN KEY (closed_by) REFERENCES app_user (id),
    CONSTRAINT ck_mclosing_month CHECK (period_month BETWEEN 1 AND 12)
) ENGINE=InnoDB;
