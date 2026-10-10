-- =============================================================================
-- Sistema de Facturación — Datos de prueba ORACLE
-- Archivo: 02_seed_test_data.sql
-- Ejecutar después de 01_schema.sql. Datos coherentes con el frontend:
-- usuarios/clientes del seed del frontend (mocks/seed/people.ts), impuestos de
-- mocks/seed/taxes.ts (incluye el cambio de IEPS del 2026-03-01), emisor de
-- shared/constants/company.ts y facturas en los 4 estados de la máquina de
-- estados (invoiceStatus.ts).
-- NOTA: password_hash es un MARCADOR; reemplazar por hashes bcrypt/argon2
-- reales antes de cualquier despliegue real.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Clientes (subset del seed del frontend; tax_id con formato alfanumérico)
-- -----------------------------------------------------------------------------
INSERT INTO customer (name, tax_id, email, phone, address) VALUES
  ('Grupo Alameda Logística S.A. de C.V.', 'GAL860415HX3', 'billing@alameda.example', '+52 55 1234 5678',
   'Calzada de las Bombas 120, Coyoacán, 04940 Ciudad de México, CDMX');
INSERT INTO customer (name, tax_id, email, phone, address) VALUES
  ('Constructora Tezontle S.A. de C.V.', 'CTE920922PL7', 'billing@tezontle.example', '+52 55 2345 6789',
   'Av. Insurgentes Sur 1602, Crédito Constructor, 03940 Ciudad de México, CDMX');
INSERT INTO customer (name, tax_id, email, address) VALUES
  ('Farmacias del Valle S.A. de C.V.', 'FVA881110KM2', 'billing@farmaciasdelvalle.example',
   'Av. Constitución 880, Centro, 64000 Monterrey, N.L.');
INSERT INTO customer (name, tax_id, email, phone, address) VALUES
  ('Clínica Santa Lucía S.C.', 'CSL990305QR9', 'billing@santalucia.example', '+52 55 3456 7890',
   'Calle 60 No. 487, Centro, 97000 Mérida, Yuc.');
INSERT INTO customer (name, tax_id, email, address) VALUES
  ('Mariana Ortega Villaseñor', 'OVM850712T4R', 'mortega@mail.example',
   'Calle Durango 210, Roma Norte, 06700 Ciudad de México, CDMX');

-- -----------------------------------------------------------------------------
-- Usuarios (mismos correos del frontend; roles ADMIN/BILLER/CUSTOMER)
-- -----------------------------------------------------------------------------
INSERT INTO app_user (email, password_hash, full_name, role) VALUES
  ('admin@northwind.test', '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Sofía Navarro', 'ADMIN');
INSERT INTO app_user (email, password_hash, full_name, role) VALUES
  ('biller@northwind.test', '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Diego Herrera', 'BILLER');
INSERT INTO app_user (email, password_hash, full_name, role) VALUES
  ('biller2@northwind.test', '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Camila Torres', 'BILLER');
INSERT INTO app_user (email, password_hash, full_name, role, customer_id) VALUES
  ('customer@client.test', '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Ricardo Meza', 'CUSTOMER',
   (SELECT id FROM customer WHERE tax_id = 'GAL860415HX3'));
INSERT INTO app_user (email, password_hash, full_name, role, customer_id) VALUES
  ('customer2@client.test', '$2b$10$REEMPLAZAR_CON_HASH_BCRYPT_DEMO1234', 'Paola Estrada', 'CUSTOMER',
   (SELECT id FROM customer WHERE tax_id = 'CTE920922PL7'));

-- -----------------------------------------------------------------------------
-- Emisor (constante ISSUER del frontend: shared/constants/company.ts)
-- -----------------------------------------------------------------------------
INSERT INTO issuer (legal_name, tax_id, address) VALUES
  ('Northwind Digital Services S.A. de C.V.', 'NDS200115KX7',
   'Av. Paseo de la Reforma 250, Piso 14, Juárez, 06600 Ciudad de México, CDMX');

-- -----------------------------------------------------------------------------
-- Impuestos e historial (mocks/seed/taxes.ts; IEPS cambia de 2.5 % a 3 % el
-- 2026-03-01, lo que el frontend demuestra en la línea de tiempo de tasas)
-- -----------------------------------------------------------------------------
INSERT INTO tax (code, name, current_rate) VALUES ('VAT16', 'VAT', 0.1600);
INSERT INTO tax (code, name, current_rate) VALUES ('VAT0',  'VAT', 0.0000);
INSERT INTO tax (code, name, current_rate) VALUES ('IEPS',  'IEPS', 0.0300);

INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.1600, DATE '2020-01-01', NULL, NULL FROM tax WHERE code = 'VAT16';
INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.0000, DATE '2020-01-01', NULL, NULL FROM tax WHERE code = 'VAT0';
INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.0250, DATE '2024-01-01', DATE '2026-03-01', (SELECT id FROM app_user WHERE email = 'admin@northwind.test')
  FROM tax WHERE code = 'IEPS';
INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
SELECT id, 0.0300, DATE '2026-03-01', NULL, (SELECT id FROM app_user WHERE email = 'admin@northwind.test')
  FROM tax WHERE code = 'IEPS';

-- -----------------------------------------------------------------------------
-- Características (Feature { name, description, unit? })
-- -----------------------------------------------------------------------------
INSERT INTO feature (name, description, unit) VALUES
  ('Vigencia', 'Duración del servicio contratado', 'días');
INSERT INTO feature (name, description, unit) VALUES
  ('Límite de consumo', 'Tope de consumo incluido', 'GB');
INSERT INTO feature (name, description) VALUES
  ('Nivel de soporte', 'Categoría del soporte incluido');
INSERT INTO feature (name, description, unit) VALUES
  ('Usuarios incluidos', 'Cantidad de usuarios con licencia', 'usuarios');
INSERT INTO feature (name, description, unit) VALUES
  ('Disponibilidad SLA', 'Porcentaje de disponibilidad comprometido', '%');

-- -----------------------------------------------------------------------------
-- Servicios (categorías del enum del frontend; códigos con prefijo por categoría)
-- -----------------------------------------------------------------------------
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('CLD-0001', 'Managed Kubernetes Cluster', 'Clúster K8s administrado con nodos gestionados y monitoreo.', 4500.00, 'Cloud Infrastructure');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('LIC-0001', 'Collaboration Suite License (per user)', 'Licencia mensual de suite colaborativa por usuario.', 250.00, 'Software Licenses');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('SUP-0001', 'Premium Support Plan (24x7)', 'Soporte operativo 24x7 con SLA de respuesta.', 8000.00, 'Support & Maintenance');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('CON-0001', 'IT Strategy Assessment', 'Evaluación estratégica de TI con informe ejecutivo.', 15000.00, 'Consulting');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('TRN-0001', 'Cloud Fundamentals Workshop', 'Taller introductorio de fundamentos de nube.', 3500.00, 'Training');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('SEC-0001', 'Penetration Test (Web Application)', 'Prueba de penetración a aplicación web con reporte.', 18000.00, 'Security');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('DAT-0001', 'Data Analytics with Python', 'Servicio de análisis de datos en Python.', 9500.00, 'Data & Analytics');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('DEV-0001', 'DevOps Practices Workshop', 'Taller de prácticas DevOps para equipos técnicos.', 4200.00, 'Development');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('CLD-0002', 'Object Storage 1 TB', 'Almacenamiento de objetos 1 TB con réplica regional.', 900.00, 'Cloud Infrastructure');
INSERT INTO service (code, name, description, base_price, category) VALUES
  ('LIC-0002', 'Endpoint Antivirus License', 'Licencia mensual de antivirus por endpoint.', 180.00, 'Software Licenses');

-- Impuestos por servicio (frontend: Service.taxIds[])
-- CLD-0001: VAT16 | CLD-0002: VAT16 | LIC-0001: VAT16 + IEPS | LIC-0002: VAT16 + IEPS
-- SUP-0001: VAT16 | CON-0001: VAT16 | TRN-0001: VAT0 | SEC-0001: VAT16
-- DAT-0001: VAT16 | DEV-0001: VAT16
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
SELECT s.id, f.id, '30' FROM service s JOIN feature f ON f.name = 'Vigencia'        WHERE s.code = 'CLD-0001';
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
-- Facturas de prueba en los 4 estados (uno por estado, para que las subconsultas
-- por status sean inequívocas). Cálculos a mano con las tasas vigentes:
--   Borrador (sin folio/uuid): CLD-0002 x3  = 2700.00 + VAT16 432.00 = 3132.00
--   Emitida  INV-2026-0001:    CLD-0001 x2  = 9000.00 + VAT16 1440.00 = 10440.00
--   Pagada   INV-2026-0002:    LIC-0001 x10 = 2500.00 + VAT16 400.00 + IEPS(3%) 75.00
--                              + SUP-0001 x1 = 8000.00 + VAT16 1280.00
--                              => subtotal 10500.00, impuestos 1755.00, total 12255.00
--   Cancelada:                 CON-0001 x1  = 15000.00 + VAT16 2400.00 = 17400.00
-- -----------------------------------------------------------------------------
DECLARE
  v_draft     NUMBER;
  v_issued    NUMBER;
  v_paid      NUMBER;
  v_cancelled NUMBER;
  v_issuer    NUMBER;
  v_admin     NUMBER;
  v_biller    NUMBER;
BEGIN
  SELECT id INTO v_issuer FROM issuer WHERE tax_id = 'NDS200115KX7';
  SELECT id INTO v_admin  FROM app_user WHERE email = 'admin@northwind.test';
  SELECT id INTO v_biller FROM app_user WHERE email = 'biller@northwind.test';

  -- Borrador para Grupo Alameda (cliente 1 del frontend)
  INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                       receiver_name, receiver_tax_id, receiver_address,
                       subtotal, tax_total, total, created_at)
  SELECT NULL, NULL, v_issuer, c.id, v_biller, 'DRAFT',
         c.name, c.tax_id, c.address, 2700.00, 432.00, 3132.00, SYSTIMESTAMP
    FROM customer c WHERE c.tax_id = 'GAL860415HX3'
  RETURNING id INTO v_draft;

  INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price,
                              line_subtotal, tax_amount, line_total)
  SELECT v_draft, s.id, s.name, 3, s.base_price, 2700.00, 432.00, 3132.00
    FROM service s WHERE s.code = 'CLD-0002';
  INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
  SELECT d.id, t.id, 0.1600, 432.00
    FROM invoice_detail d, tax t
   WHERE d.invoice_id = v_draft AND t.code = 'VAT16';

  -- Factura emitida para Constructora Tezontle
  INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                       receiver_name, receiver_tax_id, receiver_address,
                       subtotal, tax_total, total, created_at, issued_at)
  SELECT 'a1b2c3d4-1111-4a2b-9c3d-ee0000000001', 'INV-2026-0001', v_issuer, c.id, v_biller, 'ISSUED',
         c.name, c.tax_id, c.address, 9000.00, 1440.00, 10440.00,
         SYSTIMESTAMP - INTERVAL '5' DAY, SYSTIMESTAMP - INTERVAL '5' DAY
    FROM customer c WHERE c.tax_id = 'CTE920922PL7'
  RETURNING id INTO v_issued;

  INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price,
                              line_subtotal, tax_amount, line_total)
  SELECT v_issued, s.id, s.name, 2, s.base_price, 9000.00, 1440.00, 10440.00
    FROM service s WHERE s.code = 'CLD-0001';
  INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
  SELECT d.id, t.id, 0.1600, 1440.00
    FROM invoice_detail d, tax t
   WHERE d.invoice_id = v_issued AND t.code = 'VAT16';

  -- Factura pagada para Farmacias del Valle (2 líneas)
  INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                       receiver_name, receiver_tax_id, receiver_address,
                       subtotal, tax_total, total, created_at, issued_at, paid_at)
  SELECT 'a1b2c3d4-2222-4a2b-9c3d-ee0000000002', 'INV-2026-0002', v_issuer, c.id, v_admin, 'PAID',
         c.name, c.tax_id, c.address, 10500.00, 1755.00, 12255.00,
         SYSTIMESTAMP - INTERVAL '10' DAY, SYSTIMESTAMP - INTERVAL '10' DAY, SYSTIMESTAMP - INTERVAL '8' DAY
    FROM customer c WHERE c.tax_id = 'FVA881110KM2'
  RETURNING id INTO v_paid;

  INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price,
                              line_subtotal, tax_amount, line_total)
  SELECT v_paid, s.id, s.name, 10, s.base_price, 2500.00, 475.00, 2975.00
    FROM service s WHERE s.code = 'LIC-0001';
  INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
  SELECT d.id, t.id, 0.1600, 400.00
    FROM invoice_detail d, tax t WHERE d.invoice_id = v_paid AND d.service_name LIKE 'Collaboration%' AND t.code = 'VAT16';
  INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
  SELECT d.id, t.id, 0.0300, 75.00
    FROM invoice_detail d, tax t WHERE d.invoice_id = v_paid AND d.service_name LIKE 'Collaboration%' AND t.code = 'IEPS';

  INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price,
                              line_subtotal, tax_amount, line_total)
  SELECT v_paid, s.id, s.name, 1, s.base_price, 8000.00, 1280.00, 9280.00
    FROM service s WHERE s.code = 'SUP-0001';
  INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
  SELECT d.id, t.id, 0.1600, 1280.00
    FROM invoice_detail d, tax t WHERE d.invoice_id = v_paid AND d.service_name LIKE 'Premium%' AND t.code = 'VAT16';

  INSERT INTO payment (invoice_id, method, amount, reference, paid_at, registered_by)
  VALUES (v_paid, 'TRANSFER', 12255.00, 'SIM-K3P9X2', SYSTIMESTAMP - INTERVAL '8' DAY, v_admin);

  -- Factura cancelada para Clínica Santa Lucía (con motivo, como exige el frontend)
  INSERT INTO invoice (uuid, folio, issuer_id, customer_id, created_by, status,
                       receiver_name, receiver_tax_id, receiver_address,
                       subtotal, tax_total, total, created_at, issued_at, cancelled_at, cancellation_reason)
  SELECT 'a1b2c3d4-3333-4a2b-9c3d-ee0000000003', 'INV-2026-0003', v_issuer, c.id, v_biller, 'CANCELLED',
         c.name, c.tax_id, c.address, 15000.00, 2400.00, 17400.00,
         SYSTIMESTAMP - INTERVAL '3' DAY, SYSTIMESTAMP - INTERVAL '3' DAY, SYSTIMESTAMP - INTERVAL '1' DAY,
         'Cancelación a solicitud del cliente'
    FROM customer c WHERE c.tax_id = 'CSL990305QR9'
  RETURNING id INTO v_cancelled;

  INSERT INTO invoice_detail (invoice_id, service_id, service_name, quantity, unit_price,
                              line_subtotal, tax_amount, line_total)
  SELECT v_cancelled, s.id, s.name, 1, s.base_price, 15000.00, 2400.00, 17400.00
    FROM service s WHERE s.code = 'CON-0001';
  INSERT INTO invoice_detail_tax (invoice_detail_id, tax_id, rate, amount)
  SELECT d.id, t.id, 0.1600, 2400.00
    FROM invoice_detail d, tax t
   WHERE d.invoice_id = v_cancelled AND t.code = 'VAT16';

  COMMIT;
END;
/

PROMPT Datos de prueba cargados (5 clientes, 5 usuarios, 10 servicios, 4 facturas).
