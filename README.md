# Sistema de Facturación

Proyecto de Equipo 1 a 3. Sistema web de facturación con catálogo de 100+ servicios y 50+ características.

**Arquitectura:** Frontend (Web) → API Gateway → AWS Lambda (Flask) → RDS MySQL 8 + DynamoDB

## Estructura del repositorio

```
billing-system/
├── frontend/                  # Aplicación web
├── backend/                   # API (Python + Flask)
├── database/
│   ├── schema/01_schema.sql   # 17 tablas en RDS MySQL 8
│   ├── seeds/00_base_catalogs.sql
│   ├── procedures/            # 12 SPs + helper (un archivo por SP)
│   ├── dynamodb/              # 4 tablas NoSQL (JSON para AWS CLI) + README
│   └── load_all.sh            # carga todo en el RDS
├── docs/
│   ├── DER.md                 # Diagrama ER (Mermaid)
│   └── arquitectura-aws.png   # Diagrama de arquitectura (.svg editable)
└── avance-1/                  # Copia de entrega del Avance 1 (ver su README)
```

## Cómo levantar la base de datos (RDS MySQL 8.0)

```bash
./database/load_all.sh <endpoint-rds> <usuario>
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

## Avances

- [x] **Avance 1:** modelo de BD, SPs, esquema DynamoDB y diagrama de arquitectura (`avance-1/`)
- [ ] Datos sintéticos: 100 servicios y 50 características
- [ ] **Avance 2:** CRUDs en API Gateway/Lambda/Flask + login con JWT
- [ ] **Avance 3:** integración frontend-backend + flujo completo de facturación
