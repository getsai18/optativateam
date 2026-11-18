# Manual de despliegue — AWS Academy Learner Lab

El sistema usa **dos cuentas de Learner Lab**:

| Cuenta | Qué contiene | Cómo se prepara |
|---|---|---|
| **Datos** | RDS MySQL (`Facturacion_Mysql`) y RDS PostgreSQL (`postgres`) | Una vez: crear instancias y aplicar scripts (pasos 1–3) |
| **Aplicación** | API Gateway, 4 Lambdas (LabRole), EventBridge, 4 tablas DynamoDB, S3 + API Gateway (proxy HTTPS) | Cada vez: `python infra/deploy.py` (paso 5) |

```
Navegador ──► API Gateway (proxy HTTPS) ──► S3 sitio web (frontend React)
    └──► API Gateway HTTP API ──► Lambda authorizer (JWT)
              ├──► Lambda billing-api (Flask) ──► RDS MySQL / RDS PostgreSQL (cuenta de datos, TLS)
              │                                └──► DynamoDB (auditoría)
              └──► Lambda billing-cart ──► DynamoDB (carrito)
EventBridge (00:05 UTC) ──► Lambda billing-tax-rate-sync ──► sp_sync_tax_rates (PostgreSQL)
```

## 0. Herramientas

| Herramienta | Uso |
|---|---|
| AWS CLI v2 | Despliegue y logs |
| Python 3.10+ y `pip install pymysql "psycopg[binary]" python-dotenv` | Scripts de base de datos y de despliegue |
| Node.js 18+ y npm | Build del frontend |
| Git Bash (Windows) | Comandos de esta guía |

No se necesita Docker ni Serverless Framework: las dependencias de Lambda se descargan como wheels de Linux.

## 1. RDS en la cuenta de datos (solo la primera vez)

1. **RDS → Create database**, una instancia **MySQL 8** y otra **PostgreSQL 16+**:
   - Plantilla *Free tier/Dev*, clase **`db.t3.micro`**, almacenamiento **gp2 de 20 GB** (sin autoscaling).
   - **Public access: Yes**. Security group propio para cada una.
2. Security groups, *Inbound*: MySQL/Aurora 3306 y PostgreSQL 5432 desde `0.0.0.0/0`.
   Las Lambdas no usan VPC y no tienen IP fija. La conexión exige TLS y usa contraseñas largas.
3. Copia los endpoints.

## 2. `backend/.env`

Copia `backend/.env.example` a `backend/.env` y llena:

```ini
BILLING_DB_HOST=<endpoint-mysql>
BILLING_DB_NAME=Facturacion_Mysql
BILLING_DB_USER=<usuario>
BILLING_DB_PASSWORD=<contraseña>
CATALOG_DB_HOST=<endpoint-postgres>
CATALOG_DB_NAME=postgres
CATALOG_DB_USER=<usuario>
CATALOG_DB_PASSWORD=<contraseña>
JWT_SECRET=<32+ caracteres aleatorios>
```

`backend/.env` está en `.gitignore`: nunca se sube al repositorio.

## 3. Esquema, Stored Procedures y datos

Desde la raíz del repositorio:

```bash
python database/apply.py --fresh            # SOLO en una base nueva: crea las tablas (borra datos)
python database/apply.py --seed             # extensiones, 14 SPs/funciones, trigger y datos sintéticos
python database/seed/seed_invoices.py       # ~150 facturas de 6 meses usando los SPs
```

`apply.py` sin `--fresh` es idempotente: se puede ejecutar varias veces sin perder datos.

## 4. Credenciales de la cuenta de aplicación

En Learner Lab: **Start Lab → AWS Details → AWS CLI → Show**. Abre el archivo de credenciales:

```bash
notepad ~/.aws/credentials
```

Pega el bloque y cambia `[default]` por `[learnerlab]`:

```ini
[learnerlab]
aws_access_key_id=ASIA...
aws_secret_access_key=...
aws_session_token=...
```

Verifica con `aws sts get-caller-identity --profile learnerlab`: el ARN debe contener `assumed-role/voclabs`.
Las credenciales caducan con la sesión del laboratorio; al iniciar otra sesión, reemplaza las tres líneas.

## 5. Desplegar

```bash
python infra/deploy.py --profile learnerlab
```

El script:

1. Verifica que la cuenta tenga el rol `LabRole`. Si no lo tiene, se detiene.
2. Empaqueta las 4 Lambdas para Linux x86_64 / Python 3.12.
3. Crea el bucket de artefactos y despliega `infra/template.yaml` como stack `billing-dev`.
4. Compila el frontend con `VITE_API_URL` = URL de la API y lo publica en S3.
5. Prueba `GET /health` e imprime las URLs:

```
Frontend : https://<id-frontend>.execute-api.us-east-1.amazonaws.com  (HTTPS)
S3 (HTTP): http://billing-frontend-<cuenta>-dev.s3-website-us-east-1.amazonaws.com
API      : https://<id>.execute-api.us-east-1.amazonaws.com
```

| Variante | Comando |
|---|---|
| Solo backend e infraestructura | `python infra/deploy.py --profile learnerlab --skip-frontend` |
| Solo frontend | `python infra/deploy.py --profile learnerlab --frontend-only` |
| Otro stage | `python infra/deploy.py --profile learnerlab --stage prod` |

## 6. Verificar

```bash
API=https://<id>.execute-api.us-east-1.amazonaws.com
curl $API/health
curl -X POST $API/auth/login -H "Content-Type: application/json" \
     -d '{"email":"admin@northwind.test","password":"demo1234"}'
curl $API/invoices -H "Authorization: Bearer <token>"
```

Abre la URL del frontend e inicia sesión con `admin@northwind.test` o `biller@northwind.test`. La contraseña
de ambos es `demo1234`. Para probar toda la API, importa `docs/openapi.yaml` en Postman.

## 7. Apagar y limpiar

- **Al terminar la sesión de trabajo:** RDS → *Actions → Stop temporarily* en las dos instancias (cuenta de datos).
- **Eliminar la cuenta de aplicación:** `python infra/destroy.py --profile learnerlab`. Vacía el bucket y borra
  el stack y el bucket de artefactos. No toca los RDS.

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `ExpiredToken` o `InvalidClientTokenId` | La sesión del laboratorio terminó: copia credenciales nuevas en `[learnerlab]` |
| `Esta cuenta no tiene el rol LabRole` | El perfil apunta a una cuenta que no es Learner Lab |
| `/health` 200 pero el login da 500 | La Lambda no llega a RDS: sesión de la cuenta de datos apagada o security group cerrado |
| 500 en todas las rutas protegidas | Falta el permiso de invocación del authorizer (lo crea `AuthorizerInvokePermission`) |
| Ver logs de una Lambda | `MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/billing-api-dev --profile learnerlab --since 15m` |
| El frontend muestra datos viejos | `python infra/deploy.py --profile learnerlab --frontend-only` y recarga sin caché |
