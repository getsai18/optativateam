# DER - RDS MySQL (facturacion, 8 tablas)

Modulo de **facturacion** del Sistema de Facturacion en **Amazon RDS for MySQL 8.0**.
Fuente de verdad: `frontend/src/shared/types/domain.ts`. Script: `Bases de datos/RDS(MySQL)/mysql.sql`.

```mermaid
erDiagram
    customer ||--o{ app_user : "cuenta CUSTOMER"
    customer ||--o{ invoice : "recibe"
    issuer ||--o{ invoice : "emite"
    app_user ||--o{ invoice : "crea"
    app_user ||--o{ payment : "registra"
    invoice ||--|{ invoice_detail : "contiene"
    invoice ||--o| payment : "pago unico"
    invoice_detail ||--o{ invoice_detail_tax : "desglose"

    customer {
        int id PK
        varchar name
        varchar tax_id UK
        varchar email
        varchar phone
        varchar address
        tinyint active
        timestamp created_at
        timestamp updated_at
    }
    app_user {
        int id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar role "ADMIN BILLER CUSTOMER"
        int customer_id FK "solo rol CUSTOMER"
        tinyint active
        timestamp created_at
        timestamp updated_at
    }
    issuer {
        int id PK
        varchar legal_name
        varchar tax_id UK
        varchar address
        tinyint active
    }
    invoice {
        int id PK
        varchar uuid UK "al emitir"
        varchar folio UK "INV-YYYY-NNNN"
        int issuer_id FK
        int customer_id FK
        int created_by FK
        varchar status "DRAFT ISSUED PAID CANCELLED"
        varchar receiver_name "snapshot"
        varchar receiver_tax_id "snapshot"
        varchar receiver_address "snapshot"
        decimal subtotal
        decimal tax_total
        decimal total
        timestamp created_at
        timestamp issued_at
        timestamp paid_at
        timestamp cancelled_at
        varchar cancellation_reason
    }
    invoice_detail {
        int id PK
        int invoice_id FK
        int service_id "ref a Oracle service"
        varchar service_name "snapshot"
        int quantity "1 a 9999"
        decimal unit_price "snapshot"
        decimal line_subtotal
        decimal tax_amount
        decimal line_total
    }
    invoice_detail_tax {
        int id PK
        int invoice_detail_id FK
        int tax_id "ref a Oracle tax"
        varchar tax_code "snapshot"
        varchar tax_name "snapshot"
        decimal rate "snapshot"
        decimal amount
    }
    folio_counter {
        int year PK
        int last_number
    }
    payment {
        int id PK
        int invoice_id FK "UK un pago"
        varchar method "CARD TRANSFER CASH"
        decimal amount
        varchar reference
        timestamp paid_at
        int registered_by FK
    }
```

## Notas

- `uuid` y `folio` son nulos en borrador; se asignan al emitir. El folio sale de `folio_counter` (un contador por anio), en la misma transaccion que la factura.
- `invoice_detail.service_id` e `invoice_detail_tax.tax_id` apuntan al catalogo en **Oracle** sin llave foranea (son otra base). El backend los valida; los snapshots hacen que la factura emitida no dependa del catalogo.
- Un pago por factura (`payment.invoice_id` UNIQUE). Un servicio no se repite en una factura.
- Catalogo (servicios, caracteristicas, impuestos): ver [`DER-oracle.md`](DER-oracle.md). Auditoria, sesiones y carrito: ver [`modelo-dynamodb.md`](modelo-dynamodb.md).
