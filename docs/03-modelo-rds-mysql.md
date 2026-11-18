# 3. Modelo relacional — RDS MySQL 8 (facturación)

Base `Facturacion_Mysql` (RDS `db.t4g.micro`, 20 GB gp2, TLS). **12 tablas**: roles, usuarios, clientes,
emisor, facturas, líneas, desglose de impuestos, folios, pagos, reglas de descuento, asientos contables y
cierres fiscales. Scripts: `database/mysql/01_schema.sql` (DDL base), `database/mysql/03_rubrica_ext.sql`
(extensión de la rúbrica) y `database/mysql/05_roles_migration.sql` (migración idempotente de roles para una
base ya existente). Stored Procedures: `database/procedures/mysql_procedures.sql`.

```mermaid
erDiagram
    app_role ||--o{ app_user : "clasifica"
    customer ||--o{ app_user : "cuenta con rol CUSTOMER"
    customer ||--o{ invoice : "recibe"
    customer ||--o{ discount_rule : "descuento del cliente"
    issuer ||--o{ invoice : "emite"
    app_user ||--o{ invoice : "crea"
    app_user ||--o{ payment : "registra"
    app_user ||--o{ accounting_entry : "genera"
    app_user ||--o{ fiscal_closing : "ejecuta"
    invoice ||--|{ invoice_detail : "contiene"
    invoice ||--o| payment : "un solo pago"
    invoice ||--o{ accounting_entry : "asientos"
    invoice_detail ||--o{ invoice_detail_tax : "impuestos trasladados y retenidos"

    customer {
        int id PK
        varchar tax_id UK "RFC"
        varchar email UK
        varchar name
        varchar phone
        varchar address
        tinyint active
        datetime created_at
        datetime updated_at
    }
    app_role {
        tinyint id PK
        varchar code UK "ADMIN BILLER CUSTOMER"
        varchar description
    }
    app_user {
        int id PK
        varchar email UK
        varchar password_hash "bcrypt"
        varchar full_name
        varchar role "ADMIN BILLER CUSTOMER"
        tinyint role_id FK "normaliza role"
        int customer_id FK "solo rol CUSTOMER"
        tinyint active
        datetime created_at
        datetime updated_at
    }
    issuer {
        int id PK
        varchar tax_id UK
        varchar legal_name
        varchar address
        tinyint active
    }
    invoice {
        int id PK
        char uuid UK "al emitir"
        varchar folio UK "INV-AAAA-NNNN"
        int issuer_id FK
        int customer_id FK
        int created_by FK
        varchar status "DRAFT ISSUED PAID CANCELLED"
        varchar receiver_name "copia"
        varchar receiver_tax_id "copia"
        varchar receiver_address "copia"
        decimal subtotal
        decimal discount_pct
        decimal discount_total
        decimal tax_total "trasladados"
        decimal withholding_total "retenidos"
        decimal total
        datetime created_at
        datetime issued_at
        datetime paid_at
        datetime cancelled_at
        varchar cancellation_reason
    }
    invoice_detail {
        int id PK
        int invoice_id FK
        int service_id "ref. logica a PostgreSQL"
        varchar service_name "copia"
        int quantity
        decimal unit_price "copia"
        decimal line_subtotal
        decimal tax_amount
        decimal line_total
    }
    invoice_detail_tax {
        int id PK
        int invoice_detail_id FK
        smallint tax_id "ref. logica a PostgreSQL"
        varchar tax_code "copia"
        varchar tax_name "copia"
        varchar kind "TRANSFER WITHHELD"
        decimal rate
        decimal amount
    }
    folio_counter {
        smallint year PK
        int last_number
    }
    payment {
        int id PK
        int invoice_id FK,UK
        varchar method "CARD TRANSFER CASH"
        decimal amount
        varchar reference
        datetime paid_at
        int registered_by FK
    }
    discount_rule {
        int id PK
        varchar name
        int customer_id FK "NULL = regla de volumen"
        decimal min_subtotal
        decimal pct
        tinyint active
        datetime created_at
    }
    accounting_entry {
        int id PK
        int invoice_id FK
        varchar entry_type "ISSUE PAYMENT REVERSAL"
        varchar account
        decimal debit
        decimal credit
        int created_by FK
        datetime created_at
    }
    fiscal_closing {
        int id PK
        varchar period_type "DAY MONTH"
        date period_start "UK con period_type"
        date period_end
        int invoice_count
        int cancelled_count
        decimal subtotal
        decimal discount_total
        decimal tax_total
        decimal withholding_total
        decimal total
        decimal collected_total
        int closed_by FK
        datetime closed_at
    }
```

## Reglas de integridad

| Tabla | Restricción | Propósito |
|---|---|---|
| `app_role` | `UNIQUE (code)`, tres filas sembradas: `ADMIN`, `BILLER`, `CUSTOMER` | Catálogo normalizado de roles |
| `app_user.role_id` | `NOT NULL`, FK a `app_role(id)`; los triggers `trg_app_user_bi`/`trg_app_user_bu` lo derivan de `role` | Roles normalizados sin romper la API, que sigue escribiendo `role` |
| `app_user` | `CHECK (role='CUSTOMER' AND customer_id IS NOT NULL) OR (role<>'CUSTOMER' AND customer_id IS NULL)` | Solo los clientes se ligan a un `customer` |
| `invoice` | `CHECK status IN (...)`, `CHECK` motivo obligatorio si `CANCELLED`, importes ≥ 0, `discount_pct` entre 0 y 1 | Máquina de estados y montos válidos |
| `invoice_detail` | `UNIQUE (invoice_id, service_id)`, cantidad 1–9999 | Un servicio por factura |
| `invoice_detail_tax` | `UNIQUE (invoice_detail_id, tax_id)`, `rate` 0–1, `kind IN ('TRANSFER','WITHHELD')` | Desglose sin duplicados |
| `payment` | `UNIQUE (invoice_id)`, `amount > 0`, método en lista | Un pago total por factura |
| `discount_rule` | `pct` 0–0.5, `customer_id` o `min_subtotal` obligatorio | Reglas de descuento válidas |
| `accounting_entry` | `debit ≥ 0`, `credit ≥ 0`, solo uno distinto de cero | Partida doble |
| `fiscal_closing` | `UNIQUE (period_type, period_start)`, `period_end > period_start` | Un cierre por periodo |

## Índices de consulta frecuente

| Índice | Consulta que acelera |
|---|---|
| `invoice (status, issued_at)`, `invoice (status, created_at)` | Listados por estado, dashboard, cierres |
| `invoice (customer_id, status, issued_at)` | Facturas del cliente y antigüedad de saldos |
| `invoice (status, cancelled_at)` | Cancelaciones del periodo en el cierre |
| `accounting_entry (invoice_id, entry_type)` | Reversión contable de una factura |
| `discount_rule (customer_id, active)`, `(active, min_subtotal)` | Búsqueda de la mejor regla de descuento |

## Volumen

40 clientes, ~150 facturas (borradores, emitidas, pagadas y canceladas en 6 meses), ~390 líneas, ~730 asientos
contables y 14 cierres fiscales. Los clientes se siembran con `database/mysql/04_seed_customers.sql`;
las facturas **no son DML versionado**: se generan en ejecución con
`python database/seed/seed_invoices.py` usando los propios Stored Procedures.
