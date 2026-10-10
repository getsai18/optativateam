-- =============================================================================
-- Sistema de Facturación — Datos de prueba (MySQL)
-- Archivo: 02_seed_test_data.sql
-- Ejecutar después de 01_schema.sql. Datos coherentes con el frontend:
-- usuarios/clientes del seed del frontend (mocks/seed/people.ts), impuestos de
-- mocks/seed/taxes.ts (incluye el cambio de IEPS del 2026-03-01), emisor de
-- shared/constants/company.ts y facturas en los 4 estados de la máquina de
-- estados (invoiceStatus.ts).
-- NOTA: password_hash es un MARCADOR; reemplazar por hashes bcrypt/argon2
-- reales antes de cualquier despliegue real.
-- =============================================================================

USE billing_db;

-- -----------------------------------------------------------------------------
-- Clientes (subset del seed del frontend)
-- -----------------------------------------------------------------------------
INSERT INTO customer (name, tax_id, email, phone, address) VALUES
  ('Grupo Alameda Logística S.A. de C.V.', 'GAL860415HX3', 'billing@alameda.example', '+52 55 1234 5678',
   'Calzada de las Bombas 120, Coyoacán, 04940 Ciudad de México, CDMX'),
  ('Constructora Tezontle S.A. de C.V.', 'CTE920922PL7', 'billing@tezontle.example', '+52 55 2345 6789',
   'Av. Insurgentes Sur 1602, Crédito Constructor, 03940 Ciudad de México, CDMX'),
  ('Farmacias del Valle S.A. de C.V.', 'FVA881110KM2', 'billing@farmaciasdelvalle.example', NULL,
   'Av. Constitución 880, Centro, 64000 Monterrey, N.L.'),
  ('Clínica Santa Lucía S.C.', 'CSL990305QR9', 'billing@santalucia.example', '+52 55 3456 7890',
   'Calle 60 No. 487, Centro, 97000 Mérida, Yuc.'),
  ('Mariana Ortega Villaseñor', 'OVM850712T4R', 'mortega@mail.example', NULL,
   'Calle Durango 210, Roma Norte, 06700 Ciudad de México, CDMX');

-- -----------------------------------------------------------------------------
-- Usuarios (mismos correos del frontend; roles ADMIN/BILLER/CUSTOMER)
-- -----------------------------------------------------------------------------
INSERT INTO app_user (email, password_hash, full_name, role, customer_id) VALUES
  ('admin@northwind.test',    '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Sofía Navarro', 'ADMIN',    NULL),
  ('biller@northwind.test',   '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Diego Herrera', 'BILLER',   NULL),
  ('biller2@northwind.test',  '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Camila Torres', 'BILLER',   NULL),
  ('customer@client.test',    '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Ricardo Meza',  'CUSTOMER',
   (SELECT id FROM customer WHERE tax_id = 'GAL860415HX3')),
  ('customer2@client.test',   '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Paola Estrada', 'CUSTOMER',
   (SELECT id FROM customer WHERE tax_id = 'CTE920922PL7'));

-- -----------------------------------------------------------------------------
-- Emisor (constante ISSUER del frontend)
-- -----------------------------------------------------------------------------
INSERT INTO issuer (legal_name, tax_id, address) VALUES
  ('Northwind Digital Services S.A. de C.V.', 'NDS200115KX7',
   'Av. Paseo de la Reforma 250, Piso 14, Juárez, 06600 Ciudad de México, CDMX');

-- -----------------------------------------------------------------------------
-- Impuestos e historial (mocks/seed/taxes.ts)
-- -----------------------------------------------------------------------------
INSERT INTO tax (code, name, current_rate) VALUES
  ('VAT16', 'VAT', 0.1600),
  ('VAT0',  'VAT', 0.0000),
  ('IEPS',  'IEPS', 0.0300);

INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.1600, '2020-01-01', NULL, NULL FROM tax WHERE code = 'VAT16';
INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.0000, '2020-01-01', NULL, NULL FROM tax WHERE code = 'VAT0';
INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.0250, '2024-01-01', '2026-03-01', (SELECT id FROM app_user WHERE email = 'admin@northwind.test')
  FROM tax WHERE code = 'IEPS';
INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.0300, '2026-03-01', NULL, (SELECT id FROM app_user WHERE email = 'admin@northwind.test')
  FROM tax WHERE code = 'IEPS';

-- -----------------------------------------------------------------------------
-- Características (Feature { name, description, unit? })
-- -----------------------------------------------------------------------------
INSERT INTO feature (name, description, unit) VALUES
  ('Vigencia', 'Duración del servicio contratado', 'días'),
  ('Límite de consumo', 'Tope de consumo incluido', 'GB'),
  ('Nivel de soporte', 'Categoría del soporte incluido', NULL),
  ('Usuarios incluidos', 'Cantidad de usuarios con licencia', 'usuarios'),
  ('Disponibilidad SLA', 'Porcentaje de disponibilidad comprometido', '%');

-- -----------------------------------------------------------------------------
-- Servicios (categorías del enum del frontend; códigos con prefijo por categoría)
-- -----------------------------------------------------------------------------
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('CLD-0001', 'Managed Kubernetes Cluster', 'Clúster K8s administrado con nodos gestionados y monitoreo.', 4500.00, 'Cloud Infrastructure'),
  ('LIC-0001', 'Collaboration Suite License (per user)', 'Licencia mensual de suite colaborativa por usuario.', 250.00, 'Software Licenses'),
  ('SUP-0001', 'Premium Support Plan (24x7)', 'Soporte operativo 24x7 con SLA de respuesta.', 8000.00, 'Support & Maintenance'),
  ('CON-0001', 'IT Strategy Assessment', 'Evaluación estratégica de TI con informe ejecutivo.', 15000.00, 'Consulting'),
  ('TRN-0001', 'Cloud Fundamentals Workshop', 'Taller introductorio de fundamentos de nube.', 3500.00, 'Training'),
  ('SEC-0001', 'Penetration Test (Web Application)', 'Prueba de penetración a aplicación web con reporte.', 18000.00, 'Security'),
  ('DAT-0001', 'Data Analytics with Python', 'Servicio de análisis de datos en Python.', 9500.00, 'Data & Analytics'),
  ('DEV-0001', 'DevOps Practices Workshop', 'Taller de prácticas DevOps para equipos técnicos.', 4200.00, 'Development'),
  ('CLD-0002', 'Object Storage 1 TB', 'Almacenamiento de objetos 1 TB con réplica regional.', 900.00, 'Cloud Infrastructure'),
  ('LIC-0002', 'Endpoint Antivirus License', 'Licencia mensual de antivirus por endpoint.', 180.00, 'Software Licenses');

-- Impuestos por servicio (frontend: Service.taxIds[])
INSERT INTO service_tax (service_id, tax_id)
SELECT s.id, t.id FROM service s JOIN tax t ON t.code = 'VAT16'
 WHERE s.code IN ('CLD-0001','CLD-0002','LIC-0001','LIC-0002','SUP-0001','CON-0001','SEC-0001','DAT-0001','DEV-0001');
INSERT INTO service_tax (service_id, tax_id)
SELECT s.id, t.id FROM service s JOIN tax t ON t.code = 'IEPS'
 WHERE s.code IN ('LIC-0001','LIC-0002');
INSERT INTO service_tax (service_id, tax_id)
SELECT s.id, t.id FROM service s JOIN tax t ON t.code = 'VAT0'
 WHERE s.code = 'TRN-0001';

-- Valores de características por servicio (frontend: Service.features[])
INSERT INTO service_feature (service_id, feature_id, value)
SELECT s.id, f.id, '30' FROM service s JOIN feature f ON f.name = 'Vigencia'           WHERE s.code = 'CLD-0001';
INSERT INTO service_feature (service_id, feature_id, value)
SELECT s.id, f.id, '500' FROM service s JOIN feature f ON f.name = 'Límite de consumo' WHERE s.code = 'CLD-0001';
INSERT INTO service_feature (service_id, feature_id, value)
SELECT s.id, f.id, 'Premium' FROM service s JOIN feature f ON f.name = 'Nivel de soporte' WHERE s.code = 'SUP-0001';
INSERT INTO service_feature (service_id, feature_id, value)
SELECT s.id, f.id, '25' FROM service s JOIN feature f ON f.name = 'Usuarios incluidos' WHERE s.code = 'LIC-0001';
INSERT INTO service_feature (service_id, feature_id, value)
SELECT s.id, f.id, '99.9' FROM service s JOIN feature f ON f.name = 'Disponibilidad SLA' WHERE s.code = 'CLD-0001';

-- -----------------------------------------------------------------------------
-- Contador de folios (frontend: Db.folioCounters)
-- -----------------------------------------------------------------------------
-- Contador de folios (frontend: Db.folioCounters); los folios INV-2026-0001,
-- INV-2026-0002 e INV-2026-0003 ya están usados por las facturas del seed
INSERT INTO folio_counter (year, last_number) VALUES (2026, 3);

-- -----------------------------------------------------------------------------
-- Facturas de prueba en los 4 estados. Cálculos a mano con las tasas vigentes:
--   Borrador (sin folio/uuid): CLD-0002 x3  = 2700.00 + VAT16 432.00 = 3132.00
--   Emitida  INV-2026-0001:    CLD-0001 x2  = 9000.00 + VAT16 1440.00 = 10440.00
--   Pagada   INV-2026-0002:    LIC-0001 x10 = 2500.00 + VAT16 400.00 + IEPS(3%) 75.00
--                              + SUP-0001 x1 = 8000.00 + VAT16 1280.00
--                              => subtotal 10500.00, impuestos 1755.00, total 12255.00
--   Cancelada INV-2026-0003:   CON-0001 x1  = 15000.00 + VAT16 2400.00 = 17400.00
-- -----------------------------------------------------------------------------
SET @c_alameda  = (SELECT id FROM customer WHERE tax_id = 'GAL860415HX3');
SET @c_tezontle = (SELECT id FROM customer WHERE tax_id = 'CTE920922PL7');
SET @c_valle    = (SELECT id FROM customer WHERE tax_id = 'FVA881110KM2');
SET @c_lucia    = (SELECT id FROM customer WHERE tax_id = 'CSL990305QR9');
SET @u_admin    = (SELECT id FROM app_user WHERE email = 'admin@northwind.test');
SET @u_biller   = (SELECT id FROM app_user WHERE email = 'biller@northwind.test');
SET @i_issuer   = (SELECT id FROM issuer WHERE tax_id = 'NDS200115KX7');

-- Borrador (uuid y folio NULL, como en el frontend)
INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                     receiver_name, receiver_tax_id, receiver_address,
                     subtotal, tax_total, total, created_at)
VALUES (NULL, NULL, @i_issuer, @c_alameda, @u_biller, 'DRAFT',
        'Grupo Alameda Logística S.A. de C.V.', 'GAL860415HX3',
        'Calzada de las Bombas 120, Coyoacán, 04940 Ciudad de México, CDMX',
        2700.00, 432.00, 3132.00, NOW() - INTERVAL 1 DAY);

SET @inv_draft = LAST_INSERT_ID();

INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price, line_subtotal, tax_amount, line_total)
SELECT @inv_draft, s.id, s.name, 3, s.base_price, 2700.00, 432.00, 3132.00
  FROM service s WHERE s.code = 'CLD-0002';
SET @det_draft = LAST_INSERT_ID();
INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
SELECT @det_draft, t.id, 0.1600, 432.00 FROM tax t WHERE t.code = 'VAT16';

-- Factura emitida
INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                     receiver_name, receiver_tax_id, receiver_address,
                     subtotal, tax_total, total, created_at, issued_at)
VALUES ('a1b2c3d4-1111-4a2b-9c3d-ee0000000001', 'INV-2026-0001', @i_issuer, @c_tezontle, @u_biller, 'ISSUED',
        'Constructora Tezontle S.A. de C.V.', 'CTE920922PL7',
        'Av. Insurgentes Sur 1602, Crédito Constructor, 03940 Ciudad de México, CDMX',
        9000.00, 1440.00, 10440.00, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY);

SET @inv_issued = LAST_INSERT_ID();

INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price, line_subtotal, tax_amount, line_total)
SELECT @inv_issued, s.id, s.name, 2, s.base_price, 9000.00, 1440.00, 10440.00
  FROM service s WHERE s.code = 'CLD-0001';
SET @det_issued = LAST_INSERT_ID();
INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
SELECT @det_issued, t.id, 0.1600, 1440.00 FROM tax t WHERE t.code = 'VAT16';

-- Factura pagada (2 líneas)
INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                     receiver_name, receiver_tax_id, receiver_address,
                     subtotal, tax_total, total, created_at, issued_at, paid_at)
VALUES ('a1b2c3d4-2222-4a2b-9c3d-ee0000000002', 'INV-2026-0002', @i_issuer, @c_valle, @u_admin, 'PAID',
        'Farmacias del Valle S.A. de C.V.', 'FVA881110KM2',
        'Av. Constitución 880, Centro, 64000 Monterrey, N.L.',
        10500.00, 1755.00, 12255.00, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 8 DAY);

SET @inv_paid = LAST_INSERT_ID();

INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price, line_subtotal, tax_amount, line_total)
SELECT @inv_paid, s.id, s.name, 10, s.base_price, 2500.00, 475.00, 2975.00
  FROM service s WHERE s.code = 'LIC-0001';
SET @det_lic = LAST_INSERT_ID();
INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
SELECT @det_lic, t.id, 0.1600, 400.00 FROM tax t WHERE t.code = 'VAT16';
INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
SELECT @det_lic, t.id, 0.0300, 75.00  FROM tax t WHERE t.code = 'IEPS';

INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price, line_subtotal, tax_amount, line_total)
SELECT @inv_paid, s.id, s.name, 1, s.base_price, 8000.00, 1280.00, 9280.00
  FROM service s WHERE s.code = 'SUP-0001';
SET @det_sup = LAST_INSERT_ID();
INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
SELECT @det_sup, t.id, 0.1600, 1280.00 FROM tax t WHERE t.code = 'VAT16';

INSERT INTO payment (invoice_id, method, amount, reference, paid_at, registered_by)
VALUES (@inv_paid, 'TRANSFER', 12255.00, 'SIM-K3P9X2', NOW() - INTERVAL 8 DAY, @u_admin);

-- Factura cancelada (con motivo, como exige el frontend)
INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                     receiver_name, receiver_tax_id, receiver_address,
                     subtotal, tax_total, total, created_at, issued_at, cancelled_at, cancellation_reason)
VALUES ('a1b2c3d4-3333-4a2b-9c3d-ee0000000003', 'INV-2026-0003', @i_issuer, @c_lucia, @u_biller, 'CANCELLED',
        'Clínica Santa Lucía S.C.', 'CSL990305QR9',
        'Calle 60 No. 487, Centro, 97000 Mérida, Yuc.',
        15000.00, 2400.00, 17400.00, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 1 DAY,
        'Cancelación a solicitud del cliente');

SET @inv_cancelled = LAST_INSERT_ID();

INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price, line_subtotal, tax_amount, line_total)
SELECT @inv_cancelled, s.id, s.name, 1, s.base_price, 15000.00, 2400.00, 17400.00
  FROM service s WHERE s.code = 'CON-0001';
SET @det_con = LAST_INSERT_ID();
INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
SELECT @det_con, t.id, 0.1600, 2400.00 FROM tax t WHERE t.code = 'VAT16';
