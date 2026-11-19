# Manual de despliegue — AWS Academy Learner Lab

El sistema usa **dos cuentas de Learner Lab**:

| Cuenta | Qué contiene | Cómo se prepara |
|---|---|---|
| **Datos** | RDS MySQL (`Facturacion_Mysql`), RDS PostgreSQL (`postgres`) y la Lambda de apagado automático | Una vez: crear instancias y aplicar scripts (pasos 1–3) y desplegar la Lambda (paso 7) |
| **Aplicación** | API Gateway, 4 Lambdas (LabRole), EventBridge, 4 tablas DynamoDB, S3 + API Gateway (proxy HTTPS) | Cada vez: `python infra/deploy.py` (paso 5) |

```
Navegador ──► API Gateway (proxy HTTPS) ──► S3 sitio web (frontend React)
    └──► API Gateway HTTP API ──► Lambda authorizer (JWT)
              ├──► Lambda billing-api (Flask) ──► RDS MySQL / RDS PostgreSQL (cuenta de datos, TLS)
              │                                └──► DynamoDB (auditoría)
              └──► Lambda billing-cart ──► DynamoDB (carrito)
EventBridge (00:05 UTC) ──► Lambda billing-tax-rate-sync ──► sp_sync_tax_rates (PostgreSQL)
EventBridge (04:00 UTC, cuenta de datos) ──► Lambda billing-rds-stop ──► apaga los RDS del paso 1
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
   - Plantilla *Free tier/Dev*, clase **`db.t4g.micro`** (o `db.t3.micro`), almacenamiento **gp2 de 20 GB** (sin autoscaling).
   - **Public access: Yes**. Security group propio para cada una.
2. Security groups, *Inbound*: MySQL/Aurora 3306 y PostgreSQL 5432 desde `0.0.0.0/0`.
   Las Lambdas no usan VPC y no tienen IP fija. La conexión exige TLS y usa contraseñas largas.
3. Copia los endpoints.

### Red: por qué no hay VPC ni NAT

Learner Lab no habilita crear VPC, subredes ni un NAT Gateway con el rol `LabRole` (permisos de red
restringidos), y un NAT Gateway además tendría costo. Por eso las Lambdas se ejecutan **fuera de VPC**
y salen a internet hacia el endpoint público de RDS con una **IP dinámica** que cambia entre
invocaciones: no se puede escribir una regla de security group por IP de Lambda.

`0.0.0.0/0` en el *Inbound* 3306/5432 significa "aceptar conexiones entrantes desde cualquier IPv4".
**No** implica que cualquiera pueda leer los datos: el security group es solo el primer filtro; para
conectarse hacen falta también el endpoint, un usuario de aplicación y su contraseña, y el servidor
exige TLS. Es el precio de no tener VPC/NAT en el laboratorio y se asume de forma explícita.

> Nota: el PDF de la entrega (Avance 1) describe un esquema con VPC privada; era un diseño
> preliminar. La configuración real desplegada es la de esta guía y la de `README.md`.

### Riesgo aceptado

| Medida | Cómo se aplica |
|---|---|
| TLS obligatorio a RDS | El backend conecta con `ssl=require` (MySQL) y `sslmode=require` (PostgreSQL) cuando el host no es local; `tax_rate_sync` usa `sslmode=require` |
| Secretos con `NoEcho` | Contraseñas RDS, `JWT_SECRET` y `DEMO_PASSWORD` son parámetros `NoEcho: true` en `infra/template.yaml`; `deploy.py` los pasa por un archivo temporal que borra, no en la línea de comandos, y `backend/.env` no se versiona |
| Throttling de API Gateway | HTTP API con 25 req/s y ráfaga 50; el proxy HTTPS del frontend, con 50 req/s y ráfaga 100 |
| Sin IP fija en Lambdas | Las Lambdas no tienen IP estática: no hay una IP a la que restringir el security group, de ahí el `0.0.0.0/0` |
| Contraseñas largas y usuarios de aplicación | Se usan usuarios propios de la app (no la cuenta maestra) con contraseñas largas, configuradas en `backend/.env` |

Se acepta que el acceso público con `0.0.0.0/0` amplía la superficie de exposición; las medidas
anteriores son las que hacen viable el despliegue dentro de Learner Lab.

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

## 7. Apagado automático de RDS (cuenta de datos)

Los RDS viven en la cuenta de datos, así que esta función se despliega **en esa cuenta** (no con
`infra/deploy.py`, que despliega solo la cuenta de aplicación). `infra/rds_stop/` contiene
`handler.py`, `requirements.txt` y `template.yaml`. La Lambda lee `DB_IDS` (CSV), llama a
`stop_db_instance` solo para esos identificadores, trata `InvalidDBInstanceStateFault` como
"ya detenida" y sigue con las demás si alguna falla. El evento de EventBridge no se usa para
elegir instancias: solo se apagan las que estén en `DB_IDS`.

Se ejecuta **todos los días** porque un RDS apagado se reenciende automáticamente a los 7 días.
La regla `cron(0 4 * * ? *)` dispara a las **04:00 UTC = 22:00 hora de CDMX** (UTC-6).

### 7.1 Desplegar

1. Consigue credenciales de la **cuenta de datos**: en su Learner Lab, **Start Lab → AWS Details →
   AWS CLI → Show**, y pega el bloque en `~/.aws/credentials` con el perfil `[datos]` (distinto de
   `[learnerlab]`, que es la cuenta de aplicación):

   ```ini
   [datos]
   aws_access_key_id=ASIA...
   aws_secret_access_key=...
   aws_session_token=...
   ```

   Verifica con `aws sts get-caller-identity --profile datos`: el ARN debe contener
   `assumed-role/voclabs`. Las credenciales caducan con la sesión; al iniciar otra, reemplaza las
   tres líneas.

2. Obtén el número de cuenta y, si hace falta, crea un bucket de artefactos en la cuenta de datos
   (los nombres de bucket son globales):

   ```bash
   ACCOUNT=$(aws sts get-caller-identity --profile datos --query Account --output text)
   aws s3api create-bucket --bucket billing-artifacts-$ACCOUNT-us-east-1 --region us-east-1 --profile datos
   ```

   Si el bucket ya existía, `create-bucket` dará error: es normal, continúa con el paso 3.

3. Desde la raíz del repositorio, empaqueta y despliega la plantilla:

   ```bash
   mkdir -p .build

   aws cloudformation package \
     --template-file infra/rds_stop/template.yaml \
     --s3-bucket billing-artifacts-$ACCOUNT-us-east-1 \
     --s3-prefix rds-stop \
     --output-template-file .build/rds_stop_packaged.yaml \
     --profile datos

   echo '["DbIds=id-mysql,id-postgres"]' > .build/rds_stop_params.json

   aws cloudformation deploy \
     --template-file .build/rds_stop_packaged.yaml \
     --stack-name billing-rds-stop \
     --capabilities CAPABILITY_AUTO_EXPAND \
     --parameter-overrides file://.build/rds_stop_params.json \
     --profile datos
   ```

   Sustituye `Facturacion_Mysql,postgres` por los identificadores reales de tus RDS (consola RDS →
   *Databases*). `DbIds` no contiene secretos, por eso el parámetro es `NoEcho: false`. La plantilla
   usa `LabRole`, 128 MB, timeout de 15 s, sin VPC y sin crear roles IAM ni políticas con comodines.

   > El archivo de parámetros evita que la lista con comas sea ambigua en la línea de comandos.
   > Bórralo al terminar (`rm .build/rds_stop_params.json`).

### 7.2 Verificar

```bash
aws cloudformation describe-stacks --stack-name billing-rds-stop --profile datos \
  --query "Stacks[0].StackStatus"                     # CREATE_COMPLETE / UPDATE_COMPLETE
aws lambda list-functions --profile datos \
  --query "Functions[?starts_with(FunctionName, 'billing-rds-stop')].FunctionName"
aws events list-rules --name-prefix billing-rds-stop --profile datos \
  --query "Rules[].{Name:Name,Schedule:ScheduleExpression,State:State}"
```

En la consola EventBridge (cuenta de datos) comprueba que el *Schedule expression* es
`cron(0 4 * * ? *)` y que el destino es la Lambda. Para probar sin esperar a las 04:00 UTC, invoca
la función manualmente **solo durante la preparación de la demo** (esto detiene los RDS):

```bash
aws lambda invoke --function-name billing-rds-stop-$ACCOUNT --profile datos \
  --payload '{}' .build/rds_stop_result.json
cat .build/rds_stop_result.json
```

La respuesta lista `requested`, `stopped`, `already_stopped` y `failed`: una instancia ya apagada
aparece en `already_stopped` y un error parcial en `failed`, sin afectar a las demás. Confirma el
estado *Stopped* en RDS y revisa los logs:

```bash
MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/billing-rds-stop-$ACCOUNT --profile datos --since 15m
```

Si la Lambda no aparece o falla, revisa que el perfil apunte a la cuenta de datos (ARN con
`assumed-role/voclabs`) y que esa cuenta tenga `LabRole`.

## 8. Apagar y limpiar

- **RDS (cuenta de datos):** el apagado diario es automático (sección 7). Para un apagado puntual
  inmediato fuera de la regla, RDS → *Actions → Stop temporarily* en las dos instancias; no hace
  falta en la operación normal.
- **Eliminar la cuenta de aplicación:** `python infra/destroy.py --profile learnerlab`. Vacía el bucket y borra
  el stack y el bucket de artefactos. No toca los RDS ni la Lambda de la cuenta de datos.
- **Retirar la Lambda de apagado:** `aws cloudformation delete-stack --stack-name billing-rds-stop --profile datos`.

## 9. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `ExpiredToken` o `InvalidClientTokenId` | La sesión del laboratorio terminó: copia credenciales nuevas en `[learnerlab]` |
| `Esta cuenta no tiene el rol LabRole` | El perfil apunta a una cuenta que no es Learner Lab |
| `/health` 200 pero el login da 500 | La Lambda no llega a RDS: instancias apagadas (por la regla de las 04:00 UTC o al terminar la sesión) o security group cerrado; enciende RDS temporalmente para la demo |
| 500 en todas las rutas protegidas | Falta el permiso de invocación del authorizer (lo crea `AuthorizerInvokePermission`) |
| Ver logs de una Lambda | `MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/billing-api-dev --profile learnerlab --since 15m` |
| El frontend muestra datos viejos | `python infra/deploy.py --profile learnerlab --frontend-only` y recarga sin caché |
| La Lambda de apagado no detiene los RDS | Revisa `DB_IDS` en `aws lambda get-function-configuration`, que el perfil apunte a la cuenta de datos y los logs `/aws/lambda/billing-rds-stop-<cuenta>`; una instancia ya detenida aparece en `already_stopped`, un error en `failed` |
