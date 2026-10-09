-- =============================================================================
-- Catálogos base (roles, métodos de pago, impuestos, emisor)
-- Archivo: database/seeds/00_base_catalogs.sql
-- Ejecutar después de 01_schema.sql
-- =============================================================================
USE billing_db;

INSERT INTO role (name, description) VALUES
    ('ADMIN',    'Control total del sistema y catálogos'),
    ('BILLER',   'Genera, consulta y cancela facturas'),
    ('CUSTOMER', 'Solo lectura de sus propias facturas y descarga de comprobantes');

INSERT INTO payment_method (name) VALUES
    ('CARD'),
    ('TRANSFER'),
    ('CASH');

INSERT INTO tax (code, name, current_rate) VALUES
    ('IVA16', 'IVA 16%',                      0.1600),
    ('IVA0',  'IVA tasa 0%',                  0.0000),
    ('IEPS',  'IEPS servicios de telecom 3%', 0.0300);

INSERT INTO tax_history (tax_id, rate, valid_from, valid_to)
SELECT id, current_rate, '2020-01-01', NULL FROM tax;

-- Emisor de ejemplo (datos ficticios)
INSERT INTO issuer (legal_name, rfc, tax_regime, address, postal_code) VALUES
    ('Servicios Digitales Demo SA de CV', 'SDD200101AB1', 'General de Ley Personas Morales',
     'Av. Universidad 100, Cuernavaca, Morelos', '62000');
