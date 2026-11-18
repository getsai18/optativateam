# Sistema de Facturación y Servicios (Proyecto C)

**Asignatura:** Optativa I – Bases de Datos en la Nube · **Entorno:** AWS Academy Learner Lab

Arquitectura serverless: S3 (frontend React) → API Gateway → AWS Lambda (Flask + funciones) →
RDS MySQL (facturación) + RDS PostgreSQL (catálogo) + DynamoDB (auditoría, carrito, sesiones, eventos).

## Estructura del repositorio

```
.
├── database/            # Entregable /database de la rúbrica
│   ├── mysql/           # DDL + DML de facturación (RDS MySQL)
│   ├── postgres/        # DDL + DML del catálogo (RDS PostgreSQL)
│   ├── procedures/      # Stored Procedures
│   └── dynamodb/        # Esquema de tablas DynamoDB e índices
├── docs/                # Entregable /docs: DER, arquitectura AWS, flujos, rúbrica
├── backend/             # API Flask (Lambda billing-api) + tests
│   └── functions/       # Lambdas: authorizer, cart, tax_rate_sync
└── frontend/            # React + Vite (se publica en S3)
```

## Cuentas AWS (Learner Lab)

| Cuenta | Recursos |
|---|---|
| Datos | RDS MySQL y RDS PostgreSQL (endpoints públicos con TLS) |
| Aplicación | Lambdas, API Gateway, EventBridge, DynamoDB y S3 |

## Configuración local

- `backend/.env` a partir de `backend/.env.example` (credenciales de RDS y `JWT_SECRET`).
- `frontend/.env` con `VITE_API_URL`.
- Ninguno de los dos se versiona.

## Pruebas

```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest -q
cd frontend && npm ci && npm test
```
