# DER — RDS Oracle

Modelo relacional del Sistema de Facturación para **Amazon RDS for Oracle** (14 tablas).
Fuente de verdad: `frontend/src/shared/types/domain.ts`. Script: `Bases de datos/RDS(Oracle)/oracle.sql`.

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
        number id PK
        varchar2 name
        varchar2 tax_id UK
        varchar2 email
        varchar2 phone
        varchar2 address
        number active
        timestamp created_at
        timestamp updated_at
    }
    app_user {
        number id PK
        varchar2 email UK
        varchar2 password_hash
        varchar2 full_name
        varchar2 role "ADMIN|BILLER|CUSTOMER"
        number customer_id FK "solo rol CUSTOMER"
        number active
        timestamp created_at
        timestamp updated_at
    }
    issuer {
        number id PK
        varchar2 legal_name
        varchar2 tax_id UK
        varchar2 address
        number active
    }
    tax {
        number id PK
        varchar2 code UK
        varchar2 name
        number current_rate
        number active
    }
    tax_history {
        number id PK
        number tax_id FK
        number rate
        date valid_from
        date valid_to "NULL = vigente"
        number changed_by FK
        timestamp created_at
    }
    service {
        number id PK
        varchar2 code UK
        varchar2 name
        varchar2 description
        number base_price
        varchar2 category "8 categorias"
        number active
        timestamp created_at
        timestamp updated_at
    }
    feature {
        number id PK
        varchar2 name UK
        varchar2 description
        varchar2 unit
    }
    service_feature {
        number id PK
        number service_id FK "UK con feature_id"
        number feature_id FK
        varchar2 value
    }
    service_tax {
        number service_id PK,FK
        number tax_id PK,FK
    }
    invoice {
        number id PK
        varchar2 uuid UK "al emitir"
        varchar2 folio UK "INV-YYYY-NNNN"
        number issuer_id FK
        number customer_id FK
        number created_by FK
        varchar2 status "DRAFT|ISSUED|PAID|CANCELLED"
        varchar2 receiver_name
        varchar2 receiver_tax_id
        varchar2 receiver_address
        number subtotal
        number tax_total
        number total
        timestamp created_at
        timestamp issued_at
        timestamp paid_at
        timestamp cancelled_at
        varchar2 cancellation_reason
    }
    invoice_detail {
        number id PK
        number invoice_id FK "UK con service_id"
        number service_id FK
        varchar2 service_name "snapshot"
        number quantity "1..9999"
        number unit_price "snapshot"
        number line_subtotal
        number tax_amount
        number line_total
    }
    invoice_detail_tax {
        number id PK
        number invoice_detail_id FK "UK con tax_id"
        number tax_id FK
        varchar2 tax_code "snapshot"
        number rate "snapshot"
        number amount
    }
    folio_counter {
        number year PK
        number last_number
    }
    payment {
        number id PK
        number invoice_id FK "UK: un pago"
        varchar2 method "CARD|TRANSFER|CASH"
        number amount
        varchar2 reference
        timestamp paid_at
        number registered_by FK
    }
```

## Notas

- `uuid` y `folio` son nulos en borrador; se asignan al emitir. El folio sale de `folio_counter` (un contador por año).
- Snapshots (no cambian si cambia el catálogo): `receiver_*`, `service_name`, `unit_price`, `tax_code`, `rate`.
- Un pago por factura (`payment.invoice_id` UNIQUE). Un servicio no se repite en una factura.
- Un solo periodo de tasa abierto por impuesto (`valid_to` nulo).
- Auditoría, sesiones y carrito no están aquí: van en DynamoDB.
