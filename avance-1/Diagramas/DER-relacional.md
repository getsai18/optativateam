# DER — Sistema de Facturación (modelo relacional, 14 tablas)

Diagrama Entidad-Relación del modelo relacional compartido por **RDS MySQL** y
**RDS Oracle** (mismas tablas, sintaxis nativa en cada carpeta). Fuente de verdad:
`frontend/src/shared/types/domain.ts` y `frontend/docs/DOMAIN.md`.

- Versión renderizada: [`DER-relacional.svg`](DER-relacional.svg) (abrir en el navegador).
- Regenerar: `python generar_diagramas.py`.

```mermaid
erDiagram
    customer ||--o{ app_user : "cuenta CUSTOMER"
    customer ||--o{ invoice : "recibe"
    issuer ||--o{ invoice : "emite"
    app_user ||--o{ invoice : "crea factura"
    app_user ||--o| payment : "registra pago"
    app_user ||--o{ tax_history : "modifica tasa"
    invoice ||--|{ invoice_detail : "contiene"
    invoice ||--o| payment : "pago total unico"
    service ||--o{ invoice_detail : "snapshot de precio"
    invoice_detail ||--|{ invoice_detail_tax : "desglose"
    tax ||--o{ invoice_detail_tax : "tasa congelada"
    service ||--o{ service_feature : "asigna valor"
    feature ||--o{ service_feature : "describe"
    service ||--o{ service_tax : "aplica"
    tax ||--o{ service_tax : "grava"
    tax ||--o{ tax_history : "historial de tasas"

    customer {
        int id PK
        varchar name
        varchar tax_id UK
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
        varchar password_hash
        varchar full_name
        varchar role
        int customer_id FK
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
        date valid_to
        int changed_by FK
        timestamp created_at
    }
    service {
        int id PK
        varchar code UK
        varchar name
        varchar description
        decimal base_price
        varchar category
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
        int service_id FK
        int feature_id FK
        varchar value
    }
    service_tax {
        int service_id PK,FK
        int tax_id PK,FK
    }
    invoice {
        int id PK
        char uuid UK
        varchar folio UK
        int issuer_id FK
        int customer_id FK
        int created_by FK
        varchar status
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
        int invoice_id FK
        int service_id FK
        varchar service_name
        int quantity
        decimal unit_price
        decimal line_subtotal
        decimal tax_amount
        decimal line_total
    }
    invoice_detail_tax {
        int id PK
        int invoice_detail_id FK
        int tax_id FK
        decimal rate
        decimal amount
    }
    folio_counter {
        smallint year PK
        int last_number
    }
    payment {
        int id PK
        int invoice_id FK
        varchar method
        decimal amount
        varchar reference
        timestamp paid_at
        int registered_by FK
    }
```

## Notas del modelo

| Tema | Detalle |
|---|---|
| `uuid` y `folio` anulables | El frontend solo los asigna al emitir (`DRAFT` → `ISSUED`); folio `INV-YYYY-NNNN` secuencial por año vía `folio_counter`. |
| Snapshots | `receiver_*` en `invoice`, `service_name`/`unit_price` en `invoice_detail` y `rate`/`amount` en `invoice_detail_tax` congelan los valores al emitir; los cambios de catálogo o tasas no alteran facturas emitidas. |
| Un pago por factura | `payment.invoice_id` es UNIQUE (regla del frontend `registerPayment()`). |
| Máx. 1 tasa abierta | La unicidad del periodo abierto (`valid_to IS NULL`) la garantiza la API/SP al cerrar el anterior (ver `04_procedures.sql`). |
| Enums | `role`, `status`, `method` y `category` = `VARCHAR` + `CHECK` (sin CRUD de catálogo en el frontend). |
| Fuera de este DER | Auditoría, sesiones y carrito → DynamoDB (ver [`modelo-dynamodb.md`](modelo-dynamodb.md)). |
