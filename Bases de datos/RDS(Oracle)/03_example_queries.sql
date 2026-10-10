-- =============================================================================
-- Sistema de Facturación — Consultas de ejemplo ORACLE
-- Archivo: 03_example_queries.sql
-- Cubren las operaciones principales del frontend. Ejecutar después del seed
-- (y después de 04_procedures.sql para las llamadas a SP al final).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Login (authService.login)
--    Busca el usuario por email; el backend compara password_hash con bcrypt.
-- -----------------------------------------------------------------------------
SELECT id, email, password_hash, full_name, role, customer_id, active
  FROM app_user
 WHERE LOWER(email) = LOWER('admin@northwind.test');

-- -----------------------------------------------------------------------------
-- 2. listUsers (solo ADMIN)
-- -----------------------------------------------------------------------------
SELECT u.id, u.email, u.full_name, u.role, u.customer_id, c.name AS customer_name, u.active
  FROM app_user u
  LEFT JOIN customer c ON c.id = u.customer_id
 ORDER BY u.id;

-- -----------------------------------------------------------------------------
-- 3. listCustomers (ADMIN, BILLER) — el portal de clientes filtra por nombre
-- -----------------------------------------------------------------------------
SELECT id, name, tax_id, email, phone, address, active
  FROM customer
 WHERE active = 1
 ORDER BY name;

-- -----------------------------------------------------------------------------
-- 4. listServices (ADMIN, BILLER) — con impuestos y características agregados
--    (Service.taxIds[] y Service.features[] del frontend)
-- -----------------------------------------------------------------------------
SELECT s.id, s.code, s.name, s.description, s.base_price, s.category, s.active,
       (SELECT LISTAGG(t.code, ', ') WITHIN GROUP (ORDER BY t.code)
          FROM service_tax st JOIN tax t ON t.id = st.tax_id
         WHERE st.service_id = s.id) AS tax_codes,
       (SELECT LISTAGG(f.name || '=' || sf.value, '; ') WITHIN GROUP (ORDER BY f.name)
          FROM service_feature sf JOIN feature f ON f.id = sf.feature_id
         WHERE sf.service_id = s.id) AS features
  FROM service s
 ORDER BY s.code;

-- -----------------------------------------------------------------------------
-- 5. listFeatures + deleteFeature (borrado bloqueado si está en uso)
-- -----------------------------------------------------------------------------
SELECT f.id, f.name, f.description, f.unit,
       (SELECT COUNT(*) FROM service_feature sf WHERE sf.feature_id = f.id) AS used_by_services
  FROM feature f
 ORDER BY f.name;

-- -----------------------------------------------------------------------------
-- 6. listTaxes + listTaxHistory (línea de tiempo de tasas del módulo Taxes)
-- -----------------------------------------------------------------------------
SELECT id, code, name, current_rate, active FROM tax ORDER BY code;

SELECT th.id, t.code, th.rate, th.valid_from, th.valid_to, u.full_name AS changed_by_name
  FROM tax_history th
  JOIN tax t ON t.id = th.tax_id
  LEFT JOIN app_user u ON u.id = th.changed_by
 ORDER BY t.code, th.valid_from;

-- -----------------------------------------------------------------------------
-- 7. changeTaxRate (taxService) — cambio futuro: cerrar vigente + abrir nueva.
--    Ejemplo manual (lo automatiza la API): programar VAT16 al 16 % desde mañana.
-- -----------------------------------------------------------------------------
/*
UPDATE tax_history
   SET valid_to = TRUNC(SYSDATE)
 WHERE tax_id = (SELECT id FROM tax WHERE code = 'VAT16')
   AND valid_to IS NULL;

INSERT INTO tax_history (tax_id, rate, valid_from, valid_to, changed_by)
VALUES ((SELECT id FROM tax WHERE code = 'VAT16'), 0.1600, TRUNC(SYSDATE) + 1, NULL,
        (SELECT id FROM app_user WHERE email = 'admin@northwind.test'));
*/

-- -----------------------------------------------------------------------------
-- 8. listInvoices (staff: todas; cliente: solo las suyas no borrador)
--    Frontend: claims.role = 'CUSTOMER' filtra por customerId y excluye DRAFT.
-- -----------------------------------------------------------------------------
-- Staff (ADMIN/BILLER):
SELECT i.id, i.folio, i.uuid, i.status, c.name AS customer_name,
       i.subtotal, i.tax_total, i.total, i.created_at, i.issued_at, i.paid_at, i.cancelled_at
  FROM invoice i
  JOIN customer c ON c.id = i.customer_id
 ORDER BY i.created_at DESC;

-- Portal del cliente (CUSTOMER): reemplazar :customer_id
/*
SELECT i.id, i.folio, i.uuid, i.status, i.subtotal, i.tax_total, i.total, i.issued_at, i.paid_at
  FROM invoice i
 WHERE i.customer_id = :customer_id
   AND i.status <> 'DRAFT'
 ORDER BY i.created_at DESC;
*/

-- -----------------------------------------------------------------------------
-- 9. getInvoice (detalle completo con snapshot y desglose por impuesto)
--    Frontend: Invoice { receiver, lines[], taxes por línea }
-- -----------------------------------------------------------------------------
-- Cabecera + receptor snapshot:
SELECT i.id, i.uuid, i.folio, i.status,
       iss.legal_name AS issuer_name, iss.tax_id AS issuer_tax_id, iss.address AS issuer_address,
       i.receiver_name, i.receiver_tax_id, i.receiver_address,
       i.subtotal, i.tax_total, i.total,
       i.created_at, i.issued_at, i.paid_at, i.cancelled_at, i.cancellation_reason,
       c.name AS customer_name, u.full_name AS created_by_name
  FROM invoice i
  JOIN issuer iss ON iss.id = i.issuer_id
  JOIN customer c ON c.id = i.customer_id
  JOIN app_user u ON u.id = i.created_by
 WHERE i.id = 1;

-- Líneas con desglose de impuestos (InvoiceLine.taxes[]):
SELECT d.id AS line_no, d.service_id, d.service_name, d.quantity, d.unit_price,
       d.line_subtotal, d.tax_amount, d.line_total,
       t.code AS tax_code, idt.rate, idt.amount AS tax_line_amount
  FROM invoice_detail d
  LEFT JOIN invoice_detail_tax idt ON idt.invoice_detail_id = d.id
  LEFT JOIN tax t ON t.id = idt.tax_id
 WHERE d.invoice_id = 1
 ORDER BY d.id, t.code;

-- -----------------------------------------------------------------------------
-- 10. Desglose por impuesto de una factura (breakdown.ts del comprobante)
-- -----------------------------------------------------------------------------
SELECT t.code, t.name, idt.rate,
       SUM(d.line_subtotal) AS base,
       SUM(idt.amount)      AS amount
  FROM invoice_detail_tax idt
  JOIN invoice_detail d ON d.id = idt.invoice_detail_id
  JOIN tax t ON t.id = idt.tax_id
 WHERE d.invoice_id = 3
 GROUP BY t.code, t.name, idt.rate
 ORDER BY t.code;

-- -----------------------------------------------------------------------------
-- 11. listPayments (historial de pagos de una factura)
-- -----------------------------------------------------------------------------
SELECT p.id, p.method, p.amount, p.reference, p.paid_at, u.full_name AS registered_by_name
  FROM payment p
  JOIN app_user u ON u.id = p.registered_by
 WHERE p.invoice_id = 3
 ORDER BY p.paid_at DESC;

-- -----------------------------------------------------------------------------
-- 12. getDashboard (dashboardService): totales por estado
-- -----------------------------------------------------------------------------
SELECT status, COUNT(*) AS count, NVL(SUM(total), 0) AS amount
  FROM invoice
 GROUP BY status
 ORDER BY status;

-- Dashboard: últimas 6 facturas recientes (por fecha de emisión o creación)
SELECT i.id, i.folio, i.status, c.name AS customer_name, i.total,
       NVL(i.issued_at, i.created_at) AS event_at
  FROM invoice i
  JOIN customer c ON c.id = i.customer_id
 ORDER BY NVL(i.issued_at, i.created_at) DESC
 FETCH FIRST 8 ROWS ONLY;

-- Dashboard: facturado vs cobrado por mes (últimos 6 meses)
SELECT TO_CHAR(issued_at, 'YYYY-MM') AS month,
       SUM(CASE WHEN status <> 'CANCELLED' THEN total ELSE 0 END) AS invoiced
  FROM invoice
 WHERE issued_at IS NOT NULL
   AND issued_at >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -5)
 GROUP BY TO_CHAR(issued_at, 'YYYY-MM')
 ORDER BY month;

SELECT TO_CHAR(paid_at, 'YYYY-MM') AS month,
       SUM(amount) AS collected
  FROM payment
 WHERE paid_at >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -5)
 GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
 ORDER BY month;

-- -----------------------------------------------------------------------------
-- 13. Operaciones de escritura vía procedimientos (equivalente a los servicios)
-- -----------------------------------------------------------------------------
-- Emitir la factura en borrador (id = 1) como el usuario biller:
/*
VAR rc REFCURSOR
EXEC sp_issue_invoice(1, 2, :rc)
PRINT rc
*/

-- Registrar el pago total de una factura emitida (método CARD, referencia simulada):
/*
VAR rc REFCURSOR
EXEC sp_register_payment(2, 'CARD', 'SIM-8F3K2A', 2, :rc)
PRINT rc
*/

-- Cancelar una factura emitida con motivo:
/*
VAR rc REFCURSOR
EXEC sp_cancel_invoice(4, 'Cancelación a solicitud del cliente', 1, :rc)
PRINT rc
*/
