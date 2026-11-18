# Guía de despliegue — Sistema de Facturación (AWS, todo público)

Esta guía lleva el proyecto de cero a funcionando en AWS **sin VPC**: las bases RDS son públicas, la
Lambda sale a internet y el frontend vive en S3. Sigue los pasos en orden.

```
Navegador ──► S3 (frontend)
    └──► API Gateway (HTTP API) ──► Lambda (Flask) ──► RDS MySQL     (facturación)
                                                  ├──► RDS Postgres  (catálogo)
                                                  └──► DynamoDB      (auditoría)
EventBridge (1 vez al día) ──► Lambda tax_rate_sync ──► RDS Postgres
```

## 0. Antes de empezar

| Necesitas | Para qué |
|---|---|
| Cuenta AWS y una región (usa la misma en todo; esta guía asume `us-east-1`) | Todo |
| AWS CLI v2 con `aws configure` hecho | DynamoDB, S3 |
| Node.js 18+ y `npm` | Serverless y build del frontend |
| **Docker Desktop abierto** | `serverless-python-requirements` compila `bcrypt` y `psycopg` para Linux |
| Python 3.12 (o 3.10+) | Empaquetar la Lambda `tax_rate_sync` |
| Cliente SQL: `mysql`, `psql`, DBeaver o MySQL Workbench | Crear tablas y datos iniciales |
| Git Bash (Windows) | Para correr `dynamodb.sh` |

> **Seguridad.** Con bases públicas y una Lambda sin IP fija, los security groups deben abrir
> 3306 y 5432 a `0.0.0.0/0`. Eso expone las bases a internet. Usa contraseñas largas y aleatorias,
> un usuario de aplicación (no el maestro) y mantén TLS (ya viene activado en el código).
> Cuando puedan, muévanlo a VPC: el código no cambia.

---

## 1. RDS MySQL (facturación)

1. **RDS → Create database** → *Standard create* → **MySQL 8.0.x** (8.0.16 o superior; se necesitan los `CHECK`).
2. Plantilla *Free tier* / *Dev*; instancia `db.t3.micro`.
3. Identificador: `billing-mysql`. Usuario maestro: `admin` y una contraseña fuerte.
4. **Connectivity → Public access: Yes.** Security group nuevo: `billing-mysql-sg`.
5. *Additional configuration → Initial database name*: `billing_db`.
6. Crear. Espera a que esté *Available* y copia el **Endpoint**.
7. En el security group: **Inbound rules → Add rule** → Type *MySQL/Aurora* (3306), Source `0.0.0.0/0`.
8. Crea las tablas:

   ```bash
   mysql -h <endpoint-mysql> -u admin -p --ssl-mode=REQUIRED < "Bases de datos/RDS(MySQL)/mysql.sql"
   ```

   > `mysql.sql` empieza con `DROP TABLE IF EXISTS`. Es seguro en una base vacía; **borra los datos
   > si lo vuelves a correr**. Si ya creaste las tablas, no lo ejecutes otra vez.

9. Crea un usuario de aplicación (recomendado) y úsalo en la Lambda:

   ```sql
   CREATE USER 'billing_app'@'%' IDENTIFIED BY '<contraseña-larga>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON billing_db.* TO 'billing_app'@'%';
   ```

## 2. RDS PostgreSQL (catálogo)

1. **Create database** → **PostgreSQL 15 o 16**, `db.t3.micro`.
2. Identificador: `billing-catalog`. Usuario maestro: `postgres` y contraseña fuerte.
3. **Public access: Yes**, security group `billing-catalog-sg`.
4. *Initial database name*: `catalog_db`.
5. Crear y copiar el **Endpoint**.
6. Security group → Inbound: *PostgreSQL* (5432), Source `0.0.0.0/0`.
7. Crea las tablas:

   ```bash
   psql "host=<endpoint-postgres> port=5432 dbname=catalog_db user=postgres sslmode=require" \
        -f "Bases de datos/RDS(Postgres)/postgres.sql"
   ```

   - Si **ya tenías** el catálogo creado, ejecuta en su lugar `compat.sql` (agrega `changed_by` y el
     índice de un solo periodo abierto).
   - `postgres.sql` es no destructivo (`CREATE … IF NOT EXISTS`).

8. Usuario de aplicación (recomendado):

   ```sql
   CREATE USER catalog_app WITH PASSWORD '<contraseña-larga>';
   GRANT CONNECT ON DATABASE catalog_db TO catalog_app;
   GRANT USAGE ON SCHEMA public TO catalog_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO catalog_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO catalog_app;
   ```

## 3. DynamoDB

Desde Git Bash, en `Bases de datos/DynamoDB/`:

```bash
cd "Bases de datos/DynamoDB"
./dynamodb.sh us-east-1
```

Crea `billing_audit_log` (la usa el backend), `billing_invoice_event`, `billing_user_session` y
`billing_invoice_cart`, y activa el TTL en las dos últimas. Hoy el backend solo escribe en
`billing_audit_log`; las demás quedan listas. Si una tabla ya existe, el script se detiene con
`ResourceInUseException`: bórrala o comenta su bloque `create`.

## 4. Datos iniciales (sin esto nadie puede iniciar sesión)

El login exige un hash bcrypt real. El hash de abajo corresponde a la contraseña **`demo1234`**.

**MySQL** (`billing_db`):

```sql
USE billing_db;

INSERT INTO customer (name, tax_id, email, phone, address, active) VALUES
 ('Grupo Alameda Logística S.A. de C.V.', 'GAL860415HX3', 'billing@alameda.example',
  '+52 55 1234 5678', 'Calzada de las Bombas 120, Coyoacán, CDMX', 1);

INSERT INTO app_user (email, password_hash, full_name, role, customer_id, active) VALUES
 ('admin@northwind.test',  '$2b$10$7anZ487mREnSU.gkB5JnLOZLFQ1oC/zMeh6VpO/JashaXbXbnUuP.', 'Admin Northwind',  'ADMIN',    NULL, 1),
 ('biller@northwind.test', '$2b$10$7anZ487mREnSU.gkB5JnLOZLFQ1oC/zMeh6VpO/JashaXbXbnUuP.', 'Biller Northwind', 'BILLER',   NULL, 1),
 ('customer@client.test',  '$2b$10$7anZ487mREnSU.gkB5JnLOZLFQ1oC/zMeh6VpO/JashaXbXbnUuP.', 'Cliente Alameda',  'CUSTOMER', 1,    1);
```

El emisor (`issuer`) se crea solo la primera vez que se emite una factura.

**Postgres** (`catalog_db`):

```sql
INSERT INTO tax (code, name, current_rate, active) VALUES
 ('VAT16', 'VAT',  0.16, 1),
 ('VAT0',  'VAT',  0,    1),
 ('IEPS',  'IEPS', 0.03, 1);

INSERT INTO tax_history (tax_id, rate, valid_from, valid_to)
SELECT id, current_rate, DATE '2020-01-01', NULL FROM tax;
```

Servicios y características se crean desde la pantalla de administración una vez dentro de la app.

> Cambia estas contraseñas antes de enseñar el sistema a alguien externo. Para generar un hash:
> `python -c "import bcrypt;print(bcrypt.hashpw(b'MiClave',bcrypt.gensalt()).decode())"`

---

## 5. Backend (Lambda Flask + API Gateway)

### 5.1 Instalar herramientas (una sola vez)

```bash
npm i -g serverless@3
cd backend/backend
serverless plugin install -n serverless-wsgi
serverless plugin install -n serverless-python-requirements
```

Con Docker Desktop abierto. Esto crea un `package.json` local con los plugins.

### 5.2 Variables de entorno

`serverless.yml` las lee del shell **al desplegar**. En PowerShell:

```powershell
$env:JWT_SECRET            = "<32+ caracteres aleatorios>"     # OBLIGATORIA
$env:BILLING_DB_HOST       = "<endpoint-mysql>"
$env:BILLING_DB_USER       = "billing_app"
$env:BILLING_DB_PASSWORD   = "<contraseña>"
$env:CATALOG_DB_HOST       = "<endpoint-postgres>"
$env:CATALOG_DB_USER       = "catalog_app"
$env:CATALOG_DB_PASSWORD   = "<contraseña>"
$env:AUDIT_BACKEND         = "dynamodb"
$env:FRONTEND_ORIGIN       = "*"        # luego pon el origen del bucket (paso 7)
```

Generar un `JWT_SECRET`: `python -c "import secrets;print(secrets.token_urlsafe(48))"`.

| Variable | Valor por defecto | Notas |
|---|---|---|
| `JWT_SECRET` | — (obligatoria) | Debe ser el mismo en cualquier Lambda que valide tokens |
| `BILLING_DB_HOST/PORT/NAME/USER/PASSWORD` | `3306`, `billing_db` | MySQL |
| `CATALOG_DB_HOST/PORT/NAME/USER/PASSWORD` | `5432`, `catalog_db` | Postgres. Sin `CATALOG_DB_HOST` usa la base de facturación |
| `BILLING_DB_SSL`, `CATALOG_DB_SSL` | `require` fuera de localhost | `disable` / `require` / `verify` (+ `*_DB_SSL_CA`) |
| `AUDIT_BACKEND` | `dynamodb` en `serverless.yml` | `memory` solo en desarrollo |
| `AUDIT_TABLE` | `billing_audit_log` | |
| `AUDIT_REQUIRED` | `false` | `true` hace fallar la operación si DynamoDB no responde |
| `SESSION_TTL_MS` | `1800000` | 30 min; debe coincidir con la sesión del frontend |
| `ALLOW_DEMO_LOGIN` | `false` | Déjala en `false` |
| `FRONTEND_ORIGIN` | `*` | Origen permitido para CORS |

### 5.3 Desplegar

```bash
cd backend/backend
serverless deploy --stage dev --region us-east-1
```

Al terminar imprime:

```
endpoint: ANY - https://abc123.execute-api.us-east-1.amazonaws.com
```

**Esa URL (sin barra final y sin `/dev`) es tu `VITE_API_URL`.** Pruébala:

```bash
curl https://abc123.execute-api.us-east-1.amazonaws.com/health
# {"status":"ok"}
```

Si se queda colgado o responde 5xx, revisa la sección 9.

> Permisos IAM: `serverless deploy` crea el rol de la Lambda con `dynamodb:PutItem` y `Query` sobre
> `billing_audit_log`. El usuario que despliega necesita permisos para CloudFormation, Lambda, IAM,
> API Gateway y S3 (sirve `AdministratorAccess` en una cuenta de pruebas).

---

## 6. Lambda `tax_rate_sync` (opcional pero recomendada)

Actualiza `tax.current_rate` cuando llega la fecha de una tasa programada. Sin ella, una tasa con
fecha futura se aplica en las facturas, pero la pantalla de impuestos muestra la anterior.

1. Empaquetar (PowerShell, en `lambdas/tax_rate_sync`):

   ```powershell
   pip install PyMySQL pg8000 -t package
   Copy-Item handler.py package\
   Compress-Archive -Path package\* -DestinationPath tax_rate_sync.zip -Force
   ```

2. **Lambda → Create function** → *Author from scratch*: nombre `billing-tax-rate-sync`, runtime
   **Python 3.12**. *Upload from → .zip* con `tax_rate_sync.zip`.
3. *Runtime settings → Handler*: `handler.handler`. *Configuration → General*: Timeout **30 s**.
4. *Configuration → Environment variables* (apunta a la base que contiene `tax` y `tax_history`,
   es decir **Postgres**):

   | Clave | Valor |
   |---|---|
   | `DB_ENGINE` | `postgres` |
   | `DB_HOST` | `<endpoint-postgres>` |
   | `DB_PORT` | `5432` |
   | `DB_NAME` | `catalog_db` |
   | `DB_USER` | `catalog_app` |
   | `DB_PASSWORD` | `<contraseña>` |

5. Prueba con el evento `{}`: la respuesta debe traer `"updated": []`.
6. **EventBridge → Rules → Create rule**: `cron(5 0 * * ? *)` (diario 00:05 UTC), target = esa Lambda.

> Las Lambdas `authorizer` y `cart` de `lambdas/` **no** hacen falta para que el sistema funcione:
> Flask ya valida el token y el carrito del wizard sigue en `localStorage`. Despliégalas después si
> las necesitas (ver `lambdas/README.md`).

---

## 7. Frontend en S3

### 7.1 Build

```powershell
cd frontend
copy .env.example .env
# edita .env:  VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com
npm install
npm run build
```

La variable se incrusta al compilar: si cambias la URL de la API, vuelve a hacer `npm run build`.

### 7.2 Bucket

1. **S3 → Create bucket**: nombre único global, p. ej. `facturacion-northwind-web`, misma región.
2. *Block Public Access settings*: **desactiva** "Block all public access" y confirma.
3. **Properties → Static website hosting → Enable**:
   - Index document: `index.html`
   - **Error document: `index.html`** (necesario: la app usa `BrowserRouter`; sin esto, recargar
     `/invoices/inv_3` da 404).
4. **Permissions → Bucket policy**:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicRead",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::facturacion-northwind-web/*"
     }]
   }
   ```

5. Sube el build:

   ```bash
   aws s3 sync dist/ s3://facturacion-northwind-web --delete
   ```

6. La URL del sitio aparece en *Static website hosting* (`http://<bucket>.s3-website-us-east-1.amazonaws.com`).

### 7.3 Cerrar CORS al origen real

Con la URL del sitio ya conocida, vuelve al paso 5.3 con:

```powershell
$env:FRONTEND_ORIGIN = "http://facturacion-northwind-web.s3-website-us-east-1.amazonaws.com"
serverless deploy --stage dev --region us-east-1
```

Si más adelante pones CloudFront con HTTPS o un dominio propio, cambia `FRONTEND_ORIGIN` a ese origen
y vuelve a desplegar.

---

## 8. Verificación de punta a punta

Con `API=https://abc123.execute-api.us-east-1.amazonaws.com`:

```bash
# 1. salud
curl $API/health

# 2. login (debe devolver token y claims)
curl -s -X POST $API/auth/login -H "Content-Type: application/json" \
     -d '{"email":"admin@northwind.test","password":"demo1234"}'

# 3. con el token
TOKEN=<pega-el-token>
curl -s $API/taxes    -H "Authorization: Bearer $TOKEN"
curl -s $API/services -H "Authorization: Bearer $TOKEN"
```

Luego, en el navegador (URL del bucket):

1. Entra con `admin@northwind.test` / `demo1234`.
2. **Features** → crea una característica. **Services** → crea un servicio con un impuesto.
3. **Customers** → confirma que aparece el cliente sembrado.
4. **New invoice** → cliente, servicio, cantidad → emitir. Debe asignar folio `INV-AAAA-0001`.
5. Abre la factura → **Register payment**.
6. **Audit log** (admin) → deben aparecer los eventos. Si está vacío, revisa DynamoDB y los logs.
7. **Taxes** → cambia una tasa con fecha de hoy o futura.

---

## 9. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `serverless deploy` falla con `JWT_SECRET` | Variable no definida en el shell | Define `$env:JWT_SECRET` y repite |
| Deploy falla compilando requisitos | Docker no está abierto | Abre Docker Desktop |
| `/health` responde, `/auth/login` da 500 | `JWT_SECRET` vacío, o la base no es alcanzable | CloudWatch → log group `/aws/lambda/billing-api-dev-api` |
| Login responde 401 con las credenciales correctas | El usuario no tiene hash bcrypt (paso 4) o `ALLOW_DEMO_LOGIN=false` con marcador | Ejecuta `Bases de datos/RDS(MySQL)/set_demo_passwords.sql` |
| Timeout o `Task timed out` | Security group no abre 3306/5432, o *Public access: No* | Revisa SG y la opción de acceso público |
| `SSL connection is required` / `no pg_hba.conf entry` | TLS desactivado | No pongas `*_DB_SSL=disable` contra RDS |
| El navegador muestra error de CORS | `FRONTEND_ORIGIN` no coincide con el origen exacto | Debe ser `http://…s3-website-…amazonaws.com`, sin barra final |
| Recargar una página interna da 404 en S3 | Falta el *Error document* | Pon `index.html` como Error document |
| "API URL is not configured" | El build no tenía `VITE_API_URL` | Corrige `.env` y repite `npm run build` |
| La sesión se cierra siempre al instante | El reloj de tu equipo está desfasado, o `exp` no está en milisegundos | Verifica la hora del sistema |
| `/audit` responde 500 | La tabla de auditoría no existe o falta el permiso IAM | Revisa `billing_audit_log` y el rol de la Lambda |
| `Duplicate entry` / `Conflict` al crear servicio | El código ya existe (sin importar mayúsculas) | Usa otro `code` |
| La tasa programada no cambia en la pantalla | Falta la Lambda del paso 6 | Despliega `tax_rate_sync` |

## 10. Resumen del orden

1. RDS MySQL → tablas (`mysql.sql`).
2. RDS Postgres → tablas (`postgres.sql` o `compat.sql`).
3. DynamoDB → `dynamodb.sh`.
4. Datos iniciales (usuarios, impuestos).
5. Backend → variables de entorno → `serverless deploy` → anotar la URL.
6. *(Opcional)* Lambda `tax_rate_sync` + EventBridge.
7. Frontend → `.env` con la URL → `npm run build` → bucket S3 → `aws s3 sync`.
8. `serverless deploy` otra vez con `FRONTEND_ORIGIN` = URL del bucket.
9. Verificación de punta a punta.

## 11. Para después (no bloquea el despliegue)

- **HTTPS en el frontend:** CloudFront delante de S3 (certificado en ACM). S3 website solo sirve HTTP.
- **VPC y RDS privado:** el código no cambia; hay que agregar `vpc` en `serverless.yml`, VPC endpoint de
  DynamoDB y Secrets Manager.
- **Verificar el certificado de RDS:** baja `global-bundle.pem` de AWS y usa `*_DB_SSL=verify` con
  `*_DB_SSL_CA`.
- **Lambda `authorizer`:** rechaza peticiones sin sesión antes de llegar a Flask (ver `lambdas/README.md`).
- **Contraseñas de usuarios nuevos:** el frontend no envía contraseña, así que los usuarios creados
  desde la UI reciben `demo1234`. Define cómo asignarlas antes de producción.
