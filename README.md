# Sistema de Facturación

Proyecto de Equipo 1 a 3. Sistema web de facturación con catálogo de 100+ servicios y 50+ características.

**Arquitectura:** Frontend (Web) → API Gateway → AWS Lambda / Flask → RDS MySQL 8 + DynamoDB

## Estructura del repositorio

```
billing-system/
├── frontend/                 # Aplicación web
├── backend/                  # API (Python + Flask)
├── database/
│   ├── schema/
│   │   └── 01_schema.sql     # 17 tablas en RDS MySQL 8
│   ├── seeds/
│   │   └── 00_base_catalogs.sql   # roles, métodos de pago, impuestos, emisor
│   ├── procedures/           # 10+ Stored Procedures (pendiente)
│   └── dynamodb/             # 4 tablas NoSQL (JSON para AWS CLI) + README
└── docs/
    └── DER.md                # Diagrama ER (Mermaid) y cambios vs. DER original
```

## Cómo levantar la base de datos (RDS MySQL 8.0)

```bash
mysql -h <endpoint-rds> -u <usuario> -p < database/schema/01_schema.sql
mysql -h <endpoint-rds> -u <usuario> -p < database/seeds/00_base_catalogs.sql
```

Requiere MySQL 8.0.16+ (para que se apliquen los `CHECK`) y 8.0.13+ (para `DEFAULT (UUID())`).

## Reparto de datos

| RDS (MySQL) | DynamoDB |
|---|---|
| role, app_user, customer, issuer | audit_log |
| service_category, service, feature, service_feature | invoice_event |
| tax, tax_history, service_tax | user_session (TTL) |
| invoice, invoice_detail, payment_method, payment | invoice_cart (TTL) |
| customer_discount, monthly_closing | |

## Pendiente (Avance 1)

- [ ] 10+ Stored Procedures en `database/procedures/`
- [ ] Scripts de datos sintéticos: 100 servicios y 50 características
- [ ] Diagrama de arquitectura AWS
