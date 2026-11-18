# DER - RDS Oracle (catalogo, 6 tablas)

Modulo de **catalogo** del Sistema de Facturacion en **Amazon RDS for Oracle**.
Fuente de verdad: `frontend/src/shared/types/domain.ts`. Script: `Bases de datos/RDS(Oracle)/oracle.sql`.

```mermaid
erDiagram
    tax ||--o{ tax_history : "historial de tasas"
    tax ||--o{ service_tax : "grava"
    service ||--o{ service_tax : "aplica"
    service ||--o{ service_feature : "valor"
    feature ||--o{ service_feature : "describe"

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
        date valid_to "NULL es vigente"
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
        number service_id FK
        number feature_id FK
        varchar2 value
    }
    service_tax {
        number service_id PK
        number tax_id PK
    }
```

## Notas

- Modulo autocontenido: ninguna tabla referencia a MySQL.
- Las facturas (MySQL) apuntan a `service.id` y `tax.id` sin llave foranea y guardan snapshots de nombre, precio, codigo y tasa.
- `tax_history`: vigencia `valid_from <= fecha < valid_to`; `valid_to` nulo es la tasa vigente y solo puede haber una abierta por impuesto.
- `service_feature` es UNIQUE por (`service_id`, `feature_id`). Una caracteristica asignada a un servicio no se puede borrar.
- Facturacion: ver [`DER-mysql.md`](DER-mysql.md). Auditoria, sesiones y carrito: ver [`modelo-dynamodb.md`](modelo-dynamodb.md).
