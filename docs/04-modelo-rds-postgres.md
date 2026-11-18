# 4. Modelo relacional — RDS PostgreSQL (catálogo)

Base `catalog_db`. Contiene impuestos con su historial de tasas, servicios, características y las
asociaciones entre ellos: **6 tablas**. Script: `database/postgres/01_schema.sql`.

```mermaid
erDiagram
    tax ||--o{ tax_history : "historial de tasas"
    tax ||--o{ service_tax : "se aplica a"
    service ||--o{ service_tax : "tiene impuestos"
    service ||--o{ service_feature : "tiene características"
    feature ||--o{ service_feature : "se asigna a"

    tax {
        int id PK
        varchar code UK "ej. VAT16"
        varchar name
        numeric current_rate "0 a 1"
        smallint active
    }
    tax_history {
        int id PK
        int tax_id FK
        numeric rate "0 a 1"
        date valid_from
        date valid_to "exclusivo, NULL = vigente"
        int changed_by "app_user.id en MySQL"
        timestamp created_at
    }
    service {
        int id PK
        varchar code UK "SKU ej. CLD-0001"
        varchar name
        varchar description
        numeric base_price "mayor o igual a 0"
        varchar category "8 categorías"
        smallint active
        timestamp created_at
        timestamp updated_at
    }
    feature {
        int id PK
        varchar name UK
        varchar description
        varchar unit "ej. días, GB, horas"
    }
    service_feature {
        int id PK
        int service_id FK
        int feature_id FK
        varchar value
    }
    service_tax {
        int service_id PK, FK
        int tax_id PK, FK
    }
```

## Decisiones de diseño

- **Historial de tasas con vigencia.** Cada tasa vale desde `valid_from` hasta `valid_to`
  (exclusivo). Un índice único parcial garantiza **a lo sumo un periodo abierto por impuesto**
  (`valid_to IS NULL`). Así una factura se calcula con la tasa vigente en su fecha.
- **Tasa actual desnormalizada.** `tax.current_rate` guarda la tasa vigente hoy para consultas
  rápidas. La Lambda `tax_rate_sync` la actualiza cuando llega la fecha de una tasa programada.
- **Relación muchos a muchos con valor.** `service_feature` asocia servicio y característica y
  guarda el valor (por ejemplo, "Soporte" = "24x7"). La pareja `(service_id, feature_id)` es única.
- **Borrado protegido.** Borrar un servicio elimina sus asociaciones (`ON DELETE CASCADE`), pero
  una característica asignada a algún servicio no se puede borrar.
- **Categorías fijas.** `category` se limita con un `CHECK` a ocho valores: Cloud Infrastructure,
  Software Licenses, Support & Maintenance, Consulting, Training, Security, Data & Analytics y
  Development.
- **Índices.** `ix_service_active_name`, `ix_service_feature_feature`, `ix_service_tax_tax` y
  `ix_tax_history_tax_dates` cubren las consultas frecuentes.
- **Volumen requerido.** Carga sintética de 100 servicios y 50 características.
