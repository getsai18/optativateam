# 3. Modelo relacional — RDS MySQL 8 (facturación)

Base `billing_db`. Contiene usuarios, clientes, emisor, facturas, líneas, desglose de impuestos,
contador de folios y pagos: **8 tablas**. Script: `database/mysql/01_schema.sql`.

```mermaid
erDiagram
    customer ||--o{ app_user : "cuenta con rol CUSTOMER"
    customer ||--o{ invoice : "recibe"
    issuer ||--o{ invoice : "emite"
    app_user ||--o{ invoice : "crea"
    app_user ||--o{ payment : "registra"
    invoice ||--|{ invoice_detail : "contiene"
    invoice ||--o| payment : "un solo pago"
    invoice_detail ||--o{ invoice_detail_tax : "desglose de impuestos"

    customer {
        int id PK
        varchar name
        varchar tax_id UK "RFC"
        varchar email UK
        varchar phone
        varchar address
        tinyint active
        timestamp created_at
        timestamp updated_at
    }
    app_user {
        int id PK
        varchar email UK
        varchar password_hash "bcrypt"
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
        varchar uuid UK "se asigna al emitir"
        varchar folio UK "INV-AAAA-NNNN"
        int issuer_id FK
        int customer_id FK
        int created_by FK
        varchar status "DRAFT ISSUED PAID CANCELLED"
        varchar receiver_name "copia del cliente"
        varchar receiver_tax_id "copia del cliente"
        varchar receiver_address "copia del cliente"
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
        int service_id "referencia al catálogo en PostgreSQL"
        varchar service_name "copia del servicio"
        int quantity "1 a 9999"
        decimal unit_price "copia del precio"
        decimal line_subtotal
        decimal tax_amount
        decimal line_total
    }
    invoice_detail_tax {
        int id PK
        int invoice_detail_id FK
        int tax_id "referencia al catálogo en PostgreSQL"
        varchar tax_code "copia del impuesto"
        varchar tax_name "copia del impuesto"
        decimal rate "tasa aplicada"
        decimal amount
    }
    folio_counter {
        int year PK
        int last_number
    }
    payment {
        int id PK
        int invoice_id FK "UK: un pago por factura"
        varchar method "CARD TRANSFER CASH"
        decimal amount
        varchar reference
        timestamp paid_at
        int registered_by FK
    }
```

## Decisiones de diseño

- **Copias (snapshots) en la factura.** `receiver_*`, `service_name`, `unit_price`, `tax_code`,
  `tax_name` y `rate` se guardan en la propia factura. Una factura emitida es un documento fiscal:
  no debe cambiar si el cliente, el servicio o la tasa se modifican después.
- **Folio atómico.** `folio_counter` guarda un contador por año. Se incrementa dentro de la misma
  transacción que emite la factura, con la fila bloqueada (`FOR UPDATE`), para que dos emisiones
  simultáneas nunca obtengan el mismo folio.
- **Integridad de estados.** `status` solo admite los cuatro valores y las transiciones válidas se
  validan en la aplicación (ver [02-flujos-y-seguridad.md](02-flujos-y-seguridad.md)).
- **Un pago por factura.** `payment.invoice_id` es único.
- **Unicidad.** Correo de usuario, RFC de cliente, folio y uuid de factura son únicos.
- **Referencias entre bases.** `invoice_detail.service_id` e `invoice_detail_tax.tax_id` apuntan al
  catálogo en PostgreSQL. No pueden ser llaves foráneas porque son bases distintas; la aplicación
  las valida antes de guardar (ver [06-interconexion-de-datos.md](06-interconexion-de-datos.md)).
