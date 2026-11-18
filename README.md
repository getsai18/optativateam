# Sistema de Facturación y Servicios (Proyecto C)

**Asignatura:** Optativa I – Bases de Datos en la Nube · **Profesor:** Aldo Romero Arroyo ·
**Entorno:** AWS Academy Learner Lab

Sistema web de facturación: catálogo de 105 servicios y 50 características, clientes, facturas con
descuentos, IVA y retenciones, pagos, cancelación con reversión contable, cierres fiscales y reportes.
La lógica transaccional está en **14 Stored Procedures/funciones** sobre RDS, invocados desde la API.

```
API Gateway proxy HTTPS → S3 (React) · API Gateway HTTP API → Lambda authorizer (JWT)
                                 → Lambda billing-api (Flask) → RDS MySQL 8.4 (facturación, 11 tablas, 10 SPs)
                                                             → RDS PostgreSQL 18 (catálogo, 7 tablas, 4 SPs)
                                                             → DynamoDB (auditoría)
                                 → Lambda billing-cart → DynamoDB (carrito)
EventBridge (diario) → Lambda billing-tax-rate-sync → sp_sync_tax_rates
```

## Estructura

```
.
├── database/       # DDL + DML, Stored Procedures, esquema DynamoDB, loader y datos sintéticos
├── docs/           # DER, arquitectura AWS, flujos y seguridad, OpenAPI, manual de despliegue, rúbrica
├── infra/          # Plantilla SAM y scripts de despliegue / eliminación en Learner Lab
├── backend/        # API Flask (Lambda) + Lambdas authorizer, cart y tax_rate_sync + pruebas
└── frontend/       # React + TypeScript + Vite (se publica en S3)
```

## Documentación

| Tema | Archivo |
|---|---|
| Índice de documentación | [docs/INDEX.md](docs/INDEX.md) |
| Arquitectura AWS | [docs/01-arquitectura-aws.md](docs/01-arquitectura-aws.md) |
| DER MySQL / PostgreSQL / DynamoDB | [docs/03](docs/03-modelo-rds-mysql.md), [docs/04](docs/04-modelo-rds-postgres.md), [docs/05](docs/05-modelo-dynamodb.md) |
| Stored Procedures vs. rúbrica | [database/README.md](database/README.md) |
| API (OpenAPI 3, importable en Postman) | [docs/openapi.yaml](docs/openapi.yaml) |
| Manual de despliegue | [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) |
| Cumplimiento de la rúbrica | [docs/08-cumplimiento-rubrica.md](docs/08-cumplimiento-rubrica.md) |

## Inicio rápido

Requisitos: Python 3.10+, Node 18+, AWS CLI v2.

```bash
# 1. Credenciales de base de datos y JWT (no se versiona)
cp backend/.env.example backend/.env        # llenar BILLING_DB_*, CATALOG_DB_*, JWT_SECRET

# 2. Esquema, Stored Procedures y datos en RDS (idempotente)
pip install pymysql "psycopg[binary]" python-dotenv
python database/apply.py --seed
python database/seed/seed_invoices.py

# 3. Despliegue en Learner Lab (perfil [learnerlab] en ~/.aws/credentials)
python infra/deploy.py --profile learnerlab
```

Usuarios de prueba: `admin@northwind.test` y `biller@northwind.test`, contraseña `demo1234`.

## Pruebas locales

```bash
cd backend  && pip install -r requirements-dev.txt && python -m pytest -q    # 126 pruebas
cd frontend && npm ci && npm test && npm run build
```

Ejecutar en local contra RDS: `python backend/wsgi.py` (API en `:5000`) y en `frontend/`
`VITE_API_URL=http://127.0.0.1:5000 npm run dev`.

## Cuentas AWS (Learner Lab)

| Cuenta | Recursos |
|---|---|
| Datos | RDS MySQL y RDS PostgreSQL (`db.t4g.micro`, 20 GB, TLS) |
| Aplicación | API Gateway, 4 Lambdas (`LabRole`), EventBridge, 4 tablas DynamoDB On-Demand, S3 + API Gateway como proxy HTTPS del frontend |
