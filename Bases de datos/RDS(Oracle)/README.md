# Base de datos relacional — Oracle (Amazon RDS)

Esquema relacional del **Sistema de Facturación** en sintaxis **Oracle Database 19c+**
(compatible con Amazon RDS for Oracle). Fuente de verdad: el frontend en
`frontend/src` (tipos de `shared/types/domain.ts`, mocks y servicios de cada módulo).

> **Estado:** estos scripts están preparados para desplegarse; **no** se creó ninguna
> instancia en AWS desde este repositorio. El despliegue real requiere credenciales
> y permisos que se describen más abajo.

## Archivos

| Archivo | Contenido |
|---|---|
| `01_schema.sql` | 14 tablas, PKs/FKs, CHECKs, índices, triggers de `updated_at` |
| `02_seed_test_data.sql` | Datos de prueba coherentes con el frontend (clientes, usuarios, servicios, impuestos, 4 facturas) |
| `03_example_queries.sql` | Consultas de ejemplo para cada operación del frontend |
| `04_procedures.sql` | 2 funciones + 3 procedimientos almacenados (emisión, pago, cancelación) |
| `load_all.sql` | Ejecuta 01 → 02 → 04 en orden (SQLcl/SQL*Plus) |
| `99_drop_all.sql` | Elimina todos los objetos (solo desarrollo) |
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
- Los enums `role`, `status`, `method` y `category` son unions de TypeScript **sin CRUD
  de catálogo** en el frontend, por lo que se modelan como `VARCHAR2` + `CHECK`.
- `uuid` es anulable: el frontend mantiene `uuid: null` en borradores y lo asigna al
  emitir (`stamp()`).
- Se agrega `invoice_detail_tax` porque `InvoiceLine.taxes[]` guarda el desglose por
  impuesto de cada línea (lo muestra el comprobante).
- Se omiten `customer_discount` y `monthly_closing` (del Avance 1): **no existen** en
  el frontend actual.
- Auditoría (`AuditEntry`), sesiones y carrito **no** están aquí: van en DynamoDB
  (ver `../DynamoDB/`), según la arquitectura del proyecto.

Suposición: `password_hash` (bcrypt/argon2) lo escribe el backend; el seed incluye un
marcador que **debe** reemplazarse con hashes reales.

## Cómo crear y verificar la base

### Opción A — instancia local Oracle (para probar los scripts)

```bash
# Con SQLcl (recomendado) o SQL*Plus, desde esta carpeta:
sql system/<password>@localhost:1521/XEPDB1 @load_all.sql
```

Verificación:

```sql
SELECT COUNT(*) AS tablas FROM user_tables;           -- = 14
SELECT COUNT(*) AS facturas FROM invoice;             -- = 4
SELECT id, folio, status, total FROM invoice;         -- estados DRAFT/ISSUED/PAID/CANCELLED
-- Emitir el borrador (id=1) como biller (id=2) y ver el folio nuevo:
VAR rc REFCURSOR
EXEC sp_issue_invoice(1, 2, :rc)
PRINT rc
```

### Opción B — Amazon RDS for Oracle

1. Crear la instancia en RDS (Oracle 19c o superior), **Multi-AZ** para QA/producción.
2. La red debe ser **privada**: subredes privadas del VPC, **Public access = No**.
3. Grupo de seguridad: solo ingress TCP 1521 desde el segmento de la aplicación
   (por ejemplo el security group de los Lambdas), nunca `0.0.0.0/0`.
4. Crear un usuario de aplicación dedicado (no usar el admin de RDS) y otorgarle
   `CREATE SESSION`, `CREATE TABLE`, `CREATE PROCEDURE`, `CREATE TRIGGER`,
   `CREATE SEQUENCE`, cuota en el tablespace de usuarios.
5. Conectar y ejecutar `load_all.sql`:
   ```bash
   sql billing_app@<endpoint>:1521/<service_name> @load_all.sql
   ```
6. Habilitar SSL/TLS del cliente y verificar con `SELECT * FROM v$session_connect_info;`.

**Credenciales:** nunca en el código. Usar AWS Secrets Manager (o SSM Parameter Store)
y leerla en runtime desde la capa de backend; `.env.example` documenta las variables
esperadas sin valores reales.

**Pendiente documentado:** falta ejecutar estos scripts contra una instancia RDS real
y generar hashes bcrypt de prueba; nada de esto se ejecutó en AWS desde el repositorio.

## Procedimientos almacenados

| Objeto | Operación del frontend que implementa |
|---|---|
| `fn_tax_rate_on(tax_id, fecha)` | `rateOnDate()` de `calculateTotals.ts` |
| `fn_next_folio(año)` | `Db.folioCounters` (asignación de folio) |
| `sp_issue_invoice(id, usuario)` | `issueInvoice()`/`stamp()` de `invoiceService.ts` |
| `sp_register_payment(id, método, referencia, usuario)` | `registerPayment()` de `paymentService.ts` |
| `sp_cancel_invoice(id, motivo, usuario)` | `cancelInvoice()` de `invoiceService.ts` |

Validaciones incluidas: rol ADMIN/BILLER, máquina de estados de factura
(`DRAFT→ISSUED→PAID`, cancelación solo desde `DRAFT/ISSUED`), motivo de cancelación
≥ 5 caracteres, un solo pago total por factura, y recálculo de tasas al emitir.
Todos los SPs validan con `RAISE_APPLICATION_ERROR` y la API debe envolverlos en una
transacción (autocommit desactivado).

## Seguridad y AWS (resumen)

- RDS en VPC privada; sin acceso público; TLS obligatorio.
- Secretos en Secrets Manager, jamás en `.env` versionado ni en el código.
- El usuario de la aplicación solo necesita los privilegios mínimos listados arriba.
- No se crearon endpoints, ARNs ni credenciales reales en estos archivos; todo valor
  en `.env.example` es un marcador a sustituir.
