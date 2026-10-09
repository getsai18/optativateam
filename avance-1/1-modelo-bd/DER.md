# Diagrama Entidad-Relación (RDS MySQL 8)

17 tablas relacionales. Las 4 tablas de DynamoDB (`audit_log`, `invoice_event`, `user_session`,
`invoice_cart`) no tienen FKs hacia RDS; ver `database/dynamodb/README.md`.

```mermaid
erDiagram
    role ||--o{ app_user : "tiene"
    customer |o--o{ app_user : "cuenta de acceso"
    customer ||--o{ invoice : "recibe"
    issuer ||--o{ invoice : "emite"
    app_user ||--o{ invoice : "genera"
    invoice ||--|{ invoice_detail : "contiene"
    service ||--o{ invoice_detail : "se factura en"
    invoice ||--o{ payment : "se paga con"
    payment_method ||--o{ payment : "usa"
    service_category ||--o{ service : "agrupa"
    service ||--o{ service_feature : "tiene"
    feature ||--o{ service_feature : "describe"
    service ||--o{ service_tax : "aplica"
    tax ||--o{ service_tax : "grava"
    tax ||--o{ tax_history : "historial"
    app_user |o--o{ tax_history : "modifica"
    customer ||--o{ customer_discount : "obtiene"
    service_category |o--o{ customer_discount : "limita a"
    app_user ||--o{ monthly_closing : "cierra"

    role {
        tinyint id PK
        varchar name UK
        varchar description
    }
    app_user {
        int id PK
        varchar email UK
        varchar password_hash
        tinyint role_id FK
        int customer_id FK
        tinyint active
        tinyint failed_attempts
        datetime locked_until
    }
    customer {
        int id PK
        varchar name
        varchar rfc UK
        varchar email UK
        varchar tax_regime
        varchar address
        char postal_code
    }
    issuer {
        int id PK
        varchar legal_name
        varchar rfc UK
        varchar tax_regime
    }
    service_category {
        smallint id PK
        varchar name UK
    }
    service {
        int id PK
        varchar code UK
        varchar name
        text description
        decimal base_price
        smallint category_id FK
        tinyint active
    }
    feature {
        int id PK
        varchar name UK
        text description
        varchar unit
    }
    service_feature {
        int id PK
        int service_id FK
        int feature_id FK
        varchar value
    }
    tax {
        smallint id PK
        varchar code UK
        varchar name
        decimal current_rate
    }
    tax_history {
        int id PK
        smallint tax_id FK
        decimal rate
        date valid_from
        date valid_to
        int changed_by FK
    }
    service_tax {
        int service_id PK
        smallint tax_id PK
    }
    invoice {
        int id PK
        char uuid UK
        varchar folio UK
        int issuer_id FK
        int customer_id FK
        int created_by FK
        enum status
        decimal subtotal
        decimal discount_total
        decimal tax_total
        decimal total
        datetime issued_at
        datetime paid_at
        datetime cancelled_at
    }
    invoice_detail {
        int id PK
        int invoice_id FK
        int service_id FK
        varchar service_name
        int quantity
        decimal unit_price
        decimal line_subtotal
        decimal discount_amount
        decimal tax_amount
        decimal line_total
    }
    payment_method {
        tinyint id PK
        varchar name UK
    }
    payment {
        int id PK
        int invoice_id FK
        tinyint payment_method_id FK
        decimal amount
        varchar reference
        enum status
        datetime paid_at
    }
    customer_discount {
        int id PK
        int customer_id FK
        smallint category_id FK
        decimal percentage
        date valid_from
        date valid_to
    }
    monthly_closing {
        int id PK
        smallint period_year
        tinyint period_month
        int invoice_count
        decimal total_amount
        decimal total_tax
        int closed_by FK
    }
```

## Cambios respecto al DER original

| Antes | Ahora |
|---|---|
| Tablas en inglés, columnas en español | Todo en inglés (`customer_id`, `paid_at`, `unit_price`) |
| Sin usuarios ni roles | `role` + `app_user` (ADMIN, BILLER, CUSTOMER) |
| Sin impuestos | `tax`, `tax_history`, `service_tax` |
| `invoice` solo con cliente, fecha, total y estado | UUID, folio, emisor, creador, subtotal, descuento, impuestos, total y fechas por estado |
| `service` sin categoría | `service_category` + `code` + `active` |
| `invoice_detail` solo con cantidad y precio | Snapshot de nombre, subtotal, descuento, impuesto y total por línea |
| `payment` sin referencia ni estado | `reference`, `status` y `paid_at` como DATETIME |
| Sin soporte para descuentos ni cierre | `customer_discount`, `monthly_closing` |
| `service_feature` permitía duplicados | `UNIQUE (service_id, feature_id)` |
