# Backend — Sistema de Facturación (Flask)

API REST que implementa **1:1 los contratos del frontend** (`frontend/src/features/*/services`,
`shared/types/domain.ts`). JSON en camelCase, errores con los mismos códigos y mensajes que el
mock, roles `ADMIN` / `BILLER` / `CUSTOMER` y máquina de estados de factura
`DRAFT → ISSUED → PAID`, `DRAFT|ISSUED → CANCELLED`.

```
Frontend (React) → API Gateway → Lambda (Flask, este backend) → RDS MySQL/Oracle + DynamoDB
```

## Estructura

```
backend/
├── wsgi.py               # entrada local y para serverless-wsgi
├── app/
│   ├── __init__.py       # create_app, CORS, manejadores de error
│   ├── config.py         # variables de entorno
│   ├── errors.py         # ApiError (UNAUTHORIZED/FORBIDDEN/NOT_FOUND/VALIDATION/CONFLICT)
│   ├── auth.py           # JWT (HS256, exp en epoch ms), decorators login_required/require_role
│   ├── domain.py         # cálculos puros: round2, rate_on_date, calculate_totals, estados, ids
│   ├── db.py             # conector MySQL (PyMySQL) / Oracle (oracledb), transacciones
│   ├── repos.py          # todas las consultas SQL
│   ├── serializers.py    # filas -> JSON camelCase (ids str <-> PK num)
│   ├── audit.py          # DynamoDB (billing_audit_log) con fallback en memoria
│   └── views/            # blueprints: auth, customers, users, catalog, taxes,
│                         # invoices, payments, dashboard, audit
├── tests/                # pytest: unit + API con store en memoria (87 tests)
├── Dockerfile
├── serverless.yml
└── .env.example
```

## Contrato API

| Método | Ruta | Roles |
|---|---|---|
| POST | `/auth/login` | público |
| GET, POST | `/customers` | ADMIN, BILLER |
| PUT | `/customers/{id}` | ADMIN |
| GET, POST, PUT | `/users` | ADMIN |
| GET, POST, PUT | `/services` | GET: ADMIN, BILLER · POST/PUT: ADMIN |
| GET | `/features` | autenticado |
| POST, PUT, DELETE | `/features[/{id}]` | ADMIN |
| GET | `/taxes`, `/taxes/history` | autenticado |
| POST | `/taxes/{id}/rates` | ADMIN |
| GET | `/invoices` | autenticado (CUSTOMER: solo propias, no borradores) |
| GET | `/invoices/{id}` | autenticado + `assertInvoiceAccess` |
| POST | `/invoices` · `/invoices?issue=true` | ADMIN, BILLER |
| PUT, DELETE | `/invoices/{id}` | ADMIN, BILLER |
| POST | `/invoices/{id}/issue`, `/invoices/{id}/cancel` | ADMIN, BILLER |
| GET, POST | `/invoices/{id}/payments` | GET: autenticado · POST: ADMIN, BILLER |
| GET | `/dashboard` | ADMIN, BILLER |
| GET | `/audit` | ADMIN |

Errores: `{ "code": "UNAUTHORIZED|FORBIDDEN|NOT_FOUND|VALIDATION|CONFLICT", "message": "..." }`
con HTTP 401/403/404/400/409. Los mensajes coinciden literalmente con los del frontend.

## Reglas de negocio (idénticas al frontend)

- **JWT**: `exp` en **epoch milisegundos** (el cliente valida contra `Date.now()`), TTL
  `SESSION_TTL_MS` = 30 min. Token firmado HS256 con `JWT_SECRET`.
- **IDs**: la API expone strings (`cus_15`, `usr_1`, `inv_4`…); internamente son PK numéricas.
- **Cálculos**: `calculate_totals` replica `calculateTotals.ts` (redondeo half-up tipo JS con
  `Number.EPSILON`, tasa vigente por fecha con `validFrom <= fecha < validTo`).
- **Borradores**: se re-precifican con `base_price` vigente en cada guardado; al emitir se
  conserva el `unit_price` de la línea y se re-cotizan solo los impuestos.
- **Folio**: `INV-YYYY-NNNN` secuencial por año, transaccional (`SELECT ... FOR UPDATE`).
- **Pagos**: uno total por factura `ISSUED`; referencia simulada `SIM-XXXXXX`.
- **Clientes (`CUSTOMER`)**: solo ven sus facturas no borradores; cualquier intento de sondeo
  responde `NOT_FOUND` (anti-probing), no `FORBIDDEN`.
- **Seed**: el `password_hash` del script SQL es un marcador; el login acepta `DEMO_PASSWORD`
  (`demo1234`) mientras el hash no sea un bcrypt válido de 60 caracteres. Usuarios creados por
  API reciben un hash bcrypt real de `DEMO_PASSWORD` (o de `password` si se envía en el body).

## Configuración (`.env`)

Copia `.env.example` a `.env`. Variables principales:

| Variable | Descripción |
|---|---|
| `DB_ENGINE` | `mysql` (principal) u `oracle` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | conexión RDS |
| `DB_NAME` | `billing_db` (MySQL) · `DB_SERVICE_NAME` para el service name de Oracle |
| `JWT_SECRET` | obligatorio en producción (aleatorio ≥ 32 bytes) |
| `SESSION_TTL_MS` | `1800000` (misma sesión que el frontend) |
| `AUDIT_BACKEND` | `memory` (dev) o `dynamodb` (producción) |
| `AUDIT_TABLE` | `billing_audit_log` |
| `AUDIT_REQUIRED` | `true` falla la operación si DynamoDB no acepta el evento |
| `CORS_ORIGINS` | comas; `*` por defecto |

## Puesta en marcha local

1. Crear la base de datos con los scripts de `../../Bases de datos/RDS(MySQL)/`
   (`load_all.sh` o `01_schema.sql → 02_seed → 04_procedures`), o de `RDS(Oracle)/` con `load_all.sql`.
2. Para DynamoDB (opcional en dev): `../../Bases de datos/DynamoDB/create-tables.sh` y
   `AUDIT_BACKEND=dynamodb`.
3. ```bash
   python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env    # completar credenciales
   python wsgi.py          # http://127.0.0.1:5000
   ```
4. Login de prueba: `POST /auth/login` con `admin@northwind.test` / `demo1234`.

## Pruebas

```bash
python -m pytest tests -q
```

Sin necesidad de base de datos: unitarios de dominio/cálculos/token + tests de API contra un
store en memoria que sustituye `app/repos.py`. La validación de integración contra RDS se hace
con los mismos scripts SQL descritos arriba (pendiente en entornos con instancia real).

## Docker

```bash
docker build -t billing-api .
docker run --rm -p 8000:8000 --env-file .env billing-api
```

## Despliegue serverless (AWS)

`serverless.yml` publica la app Flask en **API Gateway (HTTP API) + Lambda** vía
`serverless-wsgi`:

```bash
npm i -g serverless serverless-wsgi serverless-python-requirements
export JWT_SECRET=... DB_HOST=... DB_USER=... DB_PASSWORD=... AUDIT_BACKEND=dynamodb
serverless deploy --stage dev --region us-east-1
```

Pendiente documentado (no incluido a propósito): VPC/subnets de la RDS, referencia a secretos en
Secrets Manager y el bucket/lógica de políticas IAM — rellenar con los valores reales del entorno.

## Notas de implementación

- Los SPs de los scripts SQL (`sp_issue_invoice`, `sp_register_payment`, `sp_cancel_invoice`,
  `fn_*`) son una alternativa de utilidad a nivel de base de datos; el backend implementa la
  lógica en Python para reproducir exactamente el comportamiento del frontend y funcionar igual
  en MySQL y Oracle.
- `created_at`/`issued_at`/`paid_at`/`cancelled_at` se escriben siempre en UTC desde la app.
- Unicidades: email de usuario y code de servicio respetan el chequeo case-insensitive del
  frontend; el backend también mapea duplicados de BD (1062 / ORA-00001) a `CONFLICT`.
- El frontend elimina `phone`/`unit` cuando no hay valor: la API omite la clave (no manda `null`).
