# Base de datos relacional — MySQL (Amazon RDS)

Esquema relacional del **Sistema de Facturación** en **MySQL 8.0.16+**, compatible
con Amazon RDS for MySQL. Fuente de verdad: el frontend en `frontend/src`
(tipos de `shared/types/domain.ts`, mocks y servicios de cada módulo).

> **Estado:** estos scripts están preparados para desplegarse; **no** se creó ninguna
> instancia en AWS desde este repositorio. El despliegue real requiere credenciales
> y permisos que se describen más abajo.

## Relación con Oracle (modelo compartido)

Oracle y MySQL contienen **el mismo modelo lógico relacional (14 tablas)**, escrito
con la sintaxis nativa de cada motor. Son **bases alternativas**: según la
arquitectura del proyecto (`frontend/README.md`: API Gateway + Lambda/Flask +
RDS **MySQL** + DynamoDB), el entorno de
producción usa MySQL; Oracle queda como alternativa de despliegue. **No** se deben
levantar ambos motores para el mismo entorno: duplicarían la misma información sin
ninguna razón funcional y romperían la integridad transaccional entre facturas,
servicios e impuestos.

## Archivos

| Archivo | Contenido |
|---|---|
| `01_schema.sql` | Crea `billing_db` + 14 tablas, PKs/FKs, CHECKs e índices |
| `02_seed_test_data.sql` | Datos de prueba coherentes con el frontend |
| `03_example_queries.sql` | Consultas de ejemplo para cada operación del frontend |
| `04_procedures.sql` | 2 funciones + 3 procedimientos almacenados |
| `load_all.sh` | Carga 01 → 02 → 04 contra un host (local o RDS) |
| `99_drop_all.sql` | Elimina la base de datos completa (solo desarrollo) |
| `.env.example` | Plantilla de variables de conexión **sin secretos** |

## Modelo (14 tablas)

| Tabla | Equivalente en el frontend |
|---|---|
| `customer` | `Customer` (CustomersPage) |
| `app_user` | `User` + login (`password_hash` lo genera el backend) |
| `issuer` | constante `ISSUER` (shared/constants/company.ts) |
| `tax`, `tax_history` | `Tax`, `TaxRateHistory` (TaxesPage, `rateOnDate`) |
| `service`, `feature`, `service_feature`, `service_tax` | `Service`, `Feature`, `ServiceFeatureValue`, `Service.taxIds[]` |
| `invoice`, `invoice_detail`, `invoice_detail_tax` | `Invoice`, `InvoiceLine`, `InvoiceLineTax` |
| `folio_counter` | `Db.folioCounters` (folio `INV-YYYY-NNNN` por año) |
| `payment` | `Payment` (un pago total por factura emitida) |

Decisiones respecto al frontend:
- Enums (`role`, `status`, `method`, `category`) = unions de TypeScript sin CRUD de
  catálogo → `VARCHAR` + `CHECK` (no tablas lookup).
- `uuid` anulable: el frontend solo lo asigna al emitir la factura.
- `invoice_detail_tax` sostiene el desglose por impuesto de cada línea
  (`InvoiceLine.taxes[]`) que muestra el comprobante.
- Se omiten `customer_discount` y `monthly_closing` (Avance 1): no existen en el
  frontend actual.
- Auditoría, sesiones y carrito viven en **DynamoDB**
  (ver `../DynamoDB/`).

Suposición: `password_hash` (bcrypt/argon2) lo escribe el backend; el seed trae un
marcador que **debe** sustituirse por hashes reales.

## Cómo crear y verificar la base

### Opción A — MySQL local

```bash
./load_all.sh localhost root 3306 billing_db
# o manualmente:
mysql -u root -p < 01_schema.sql
mysql -u root -p < 02_seed_test_data.sql
mysql -u root -p < 04_procedures.sql
```

Verificación:

```sql
USE billing_db;
SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema='billing_db'; -- = 14
SELECT id, folio, status, total FROM invoice;          -- DRAFT/ISSUED/PAID/CANCELLED
CALL sp_issue_invoice(1, 2);                            -- emite el borrador (id=1) como biller (id=2)
SELECT id, folio, status FROM invoice WHERE id = 1;     -- ahora ISSUED con folio INV-2026-NNNN
```

### Opción B — Amazon RDS for MySQL

1. Crear la instancia en RDS (MySQL 8.0.16+, Multi-AZ para QA/producción).
2. Red **privada**: subredes privadas del VPC, **Public access = No**.
3. Grupo de seguridad: solo ingress TCP 3306 desde el security group de la
   aplicación (Lambdas), nunca `0.0.0.0/0`.
4. Crear un usuario de aplicación dedicado con privilegios mínimos:
   `SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES,
   CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER, CREATE VIEW` sobre `billing_db`.
5. Ejecutar la carga:
   ```bash
   ./load_all.sh <endpoint-rds> <usuario-app> 3306 billing_db
   ```
6. Habilitar TLS del cliente (`DB_SSL_MODE=REQUIRED`) y verificar con
   `SHOW STATUS LIKE 'Ssl_cipher';`.

**Credenciales:** nunca en el código. Usar AWS Secrets Manager (o SSM Parameter
Store) y leerla en runtime desde la capa de backend; `.env.example` solo documenta
las variables esperadas.

**Pendiente documentado:** falta ejecutar estos scripts contra un RDS real y
generar hashes bcrypt de prueba; nada de esto se ejecutó en AWS desde el repositorio.

## Procedimientos almacenados

| Objeto | Operación del frontend que implementa |
|---|---|
| `fn_tax_rate_on(tax_id, fecha)` | `rateOnDate()` de `calculateTotals.ts` |
| `fn_next_folio(año)` | `Db.folioCounters` (asignación de folio) |
| `sp_issue_invoice(id, usuario)` | `issueInvoice()`/`stamp()` de `invoiceService.ts` |
| `sp_register_payment(id, método, referencia, usuario)` | `registerPayment()` de `paymentService.ts` |
| `sp_cancel_invoice(id, motivo, usuario)` | `cancelInvoice()` de `invoiceService.ts` |

Validaciones: rol ADMIN/BILLER, máquina de estados de factura
(`DRAFT→ISSUED→PAID`; cancelación solo desde `DRAFT/ISSUED`), motivo de cancelación
≥ 5 caracteres, un solo pago total por factura y recálculo de tasas al emitir.
Los SPs usan transacción con `ROLLBACK` automático ante cualquier error
(`EXIT HANDLER ... RESIGNAL`).

## Seguridad y AWS (resumen)

- RDS en VPC privada; sin acceso público; TLS obligatorio.
- Secretos en Secrets Manager, jamás en `.env` versionado ni en el código.
- Usuario de aplicación con privilegios mínimos sobre `billing_db` únicamente.
- No se crearon endpoints, ARNs ni credenciales reales en estos archivos.
