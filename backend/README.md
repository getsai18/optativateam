# Backend — Sistema de Facturación (Flask en AWS Lambda)

API REST que atiende al frontend (`frontend/src/features/*/services`). JSON en camelCase, roles
`ADMIN` / `BILLER` / `CUSTOMER` y máquina de estados `DRAFT → ISSUED → PAID`, `DRAFT|ISSUED → CANCELLED`.
La lógica transaccional vive en **Stored Procedures** (`database/procedures/`); la API los invoca.

```
API Gateway → Lambda billing-api (wsgi.handler, apig-wsgi) → RDS MySQL (facturación) + RDS PostgreSQL (catálogo) + DynamoDB (auditoría)
```

Especificación completa: [`docs/openapi.yaml`](../docs/openapi.yaml).

## Estructura

```
backend/
├── wsgi.py               # handler de Lambda (apig-wsgi) y arranque local
├── app/
│   ├── __init__.py       # create_app, CORS, encabezados de seguridad, manejadores de error
│   ├── config.py         # variables de entorno
│   ├── errors.py         # ApiError (UNAUTHORIZED/FORBIDDEN/NOT_FOUND/VALIDATION/CONFLICT)
│   ├── auth.py           # JWT HS256 (exp en epoch ms), login_required / require_role
│   ├── domain.py         # cálculos puros (vista previa de totales con retenciones), estados, ids
│   ├── db.py             # conexiones MySQL (PyMySQL) / PostgreSQL (psycopg); CALL y BusinessRuleError
│   ├── repos.py          # consultas SQL y llamadas a los Stored Procedures
│   ├── serializers.py    # filas → JSON camelCase
│   ├── audit.py          # DynamoDB (billing_audit_log) o memoria
│   └── views/            # auth, customers, users, catalog, taxes, invoices, payments, reports, dashboard, audit
├── functions/            # Lambdas independientes: authorizer, cart, tax_rate_sync
├── tests/                # pytest (140 pruebas: 133 locales + 7 de integración con BD)
├── requirements.txt      # dependencias de la Lambda
└── requirements-dev.txt  # + pytest
```

## Stored Procedures que usa la API

| Endpoint | SP |
|---|---|
| `POST /invoices`, `PUT /invoices/{id}` | `sp_calculate_invoice_totals` (+ `sp_apply_discount`) |
| `POST /invoices/{id}/issue`, `POST /invoices?issue=true` | `sp_issue_invoice` (+ `sp_next_folio`) |
| `POST /invoices/{id}/payments` | `sp_register_payment` |
| `POST /invoices/{id}/cancel` | `sp_cancel_invoice` |
| `GET /invoices/{id}/stamp` | `sp_build_stamp_payload` |
| `GET /reports/aging` | `sp_aging_report` |
| `POST /reports/fiscal-closings` | `sp_fiscal_closing` |
| `GET /reports/payment-validation` | `sp_validate_payment_status` |
| `POST /taxes/{id}/rates` | `sp_change_tax_rate` (PostgreSQL) |
| `PUT /services/{id}` con cambio de precio | `sp_update_service_price` (PostgreSQL) |
| `POST /features/bulk-assign` | `sp_bulk_assign_features` (PostgreSQL) |
| Lambda `tax_rate_sync` (diaria) | `sp_sync_tax_rates` (PostgreSQL) |

Cuando un SP rechaza una operación (`SIGNAL SQLSTATE '45000'` en MySQL o `RAISE EXCEPTION` en PostgreSQL),
`db.py` lo convierte en `BusinessRuleError` y la API responde `409 {"code":"CONFLICT","message":"<mensaje del SP>"}`.

## Reglas principales

- **JWT**: HS256 con `JWT_SECRET` (≥ 32 caracteres), `exp` en milisegundos, sesión de 30 min.
- **IDs**: la API expone `cus_15`, `inv_4`…; internamente son PK numéricas.
- **Totales**: `total = subtotal − descuento + impuestos trasladados − retenciones`. El descuento por cliente o
  volumen lo decide `sp_apply_discount` con la tabla `discount_rule`.
- **Copia del catálogo**: cada línea guarda nombre, precio, tasa y tipo de impuesto vigentes. Una factura
  emitida no cambia si el catálogo cambia.
- **Clientes (`CUSTOMER`)**: solo ven sus facturas emitidas; cualquier sondeo responde `NOT_FOUND`.

## Configuración (`backend/.env`)

| Variable | Descripción |
|---|---|
| `BILLING_DB_HOST/PORT/NAME/USER/PASSWORD` | RDS MySQL de facturación |
| `CATALOG_DB_HOST/PORT/NAME/USER/PASSWORD` | RDS PostgreSQL del catálogo |
| `JWT_SECRET` | Obligatorio, ≥ 32 caracteres aleatorios |
| `SESSION_TTL_MS` | `1800000` |
| `ALLOW_DEMO_LOGIN`, `DEMO_PASSWORD` | Solo desarrollo: acepta `DEMO_PASSWORD` si el hash no es bcrypt |
| `AUDIT_BACKEND`, `AUDIT_TABLE`, `AUDIT_REQUIRED` | `memory` en local; `dynamodb` en Lambda (lo fija la plantilla) |
| `CORS_ORIGINS` | Orígenes permitidos separados por comas |

En AWS estas variables las define `infra/template.yaml` a partir de `backend/.env`.

## Ejecutar en local

```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate   # Linux/macOS: .venv/bin/activate
pip install -r requirements-dev.txt
python wsgi.py                                          # http://127.0.0.1:5000 (usa backend/.env)
```

El frontend local apunta aquí con `VITE_API_URL=http://127.0.0.1:5000` en `frontend/.env`.

## Pruebas

```bash
python -m pytest -q
```

No requieren base de datos: `tests/conftest.py` sustituye `app/repos.py` por un almacén en memoria y
`tests/fake_procedures.py` emula los Stored Procedures con las mismas reglas y mensajes.

## Desplegar

Ver [`docs/DESPLIEGUE.md`](../docs/DESPLIEGUE.md): `python infra/deploy.py --profile learnerlab`.
