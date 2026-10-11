# DER — RDS MySQL 8

Modelo relacional del Sistema de Facturación para **Amazon RDS for MySQL 8.0** (14 tablas).
Fuente de verdad: `frontend/src/shared/types/domain.ts`. Script: `Bases de datos/RDS(MySQL)/mysql.sql`.

```mermaid
erDiagram
    customer ||--o{ app_user : "cuenta CUSTOMER"
    customer ||--o{ invoice : "recibe"
    issuer ||--o{ invoice : "emite"
    app_user ||--o{ invoice : "crea"
    app_user ||--o{ payment : "registra"
    app_user ||--o{ tax_history : "cambia tasa"
    invoice ||--|{ invoice_detail : "contiene"
    invoice ||--o| payment : "pago unico"
    service ||--o{ invoice_detail : "snapshot"
    invoice_detail ||--o{ invoice_detail_tax : "desglose"
    tax ||--o{ invoice_detail_tax : "tasa congelada"
    service ||--o{ service_feature : "valor"
    feature ||--o{ service_feature : "describe"
    service ||--o{ service_tax : "aplica"
    tax ||--o{ service_tax : "grava"
    tax ||--o{ tax_history : "historial"

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
        varchar role "ADMIN|BILLER|CUSTOMER"
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
    tax {
        int id PK
        varchar code UK
        varchar name
        decimal current_rate
        tinyint active
    }
    tax_history {
        int id PK
        int tax_id FK
        decimal rate
        date valid_from
        date valid_to "NULL = vigente"
        int changed_by FK
        timestamp created_at
    }
    service {
        int id PK
        varchar code UK
        varchar name
        varchar description
        decimal base_price
        varchar category "8 categorias"
        tinyint active
        timestamp created_at
        timestamp updated_at
    }
    feature {
        int id PK
        varchar name UK
        varchar description
        varchar unit
    }
    service_feature {
        int id PK
        int service_id FK "UK con feature_id"
        int feature_id FK
        varchar value
    }
    service_tax {
        int service_id PK,FK
        int tax_id PK,FK
    }
    invoice {
        int id PK
        varchar uuid UK "al emitir"
        varchar folio UK "INV-YYYY-NNNN"
        int issuer_id FK
        int customer_id FK
        int created_by FK
        varchar status "DRAFT|ISSUED|PAID|CANCELLED"
        varchar receiver_name
        varchar receiver_tax_id
        varchar receiver_address
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
        int invoice_id FK "UK con service_id"
        int service_id FK
        varchar service_name "snapshot"
        int quantity "1..9999"
        decimal unit_price "snapshot"
        decimal line_subtotal
        decimal tax_amount
        decimal line_total
    }
    invoice_detail_tax {
        int id PK
        int invoice_detail_id FK "UK con tax_id"
        int tax_id FK
        varchar tax_code "snapshot"
        decimal rate "snapshot"
        decimal amount
    }
    folio_counter {
        int year PK
        int last_number
    }
    payment {
        int id PK
        int invoice_id FK "UK: un pago"
        varchar method "CARD|TRANSFER|CASH"
        decimal amount
        varchar reference
        timestamp paid_at
        int registered_by FK
    }
```

## Notas

- `uuid` y `folio` son nulos en borrador; se asignan al emitir. El folio sale de `folio_counter` (un contador por año).
- Snapshots (no cambian si cambia el catálogo): `receiver_*`, `service_name`, `unit_price`, `tax_code`, `rate`.
- Un pago por factura (`payment.invoice_id` UNIQUE). Un servicio no se repite en una factura.
- Un solo periodo de tasa abierto por impuesto (`valid_to` nulo).
- Auditoría, sesiones y carrito no están aquí: van en DynamoDB.
