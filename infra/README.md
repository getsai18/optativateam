# /infra — despliegue automático (AWS Academy Learner Lab)

Arquitectura en **dos cuentas** de Learner Lab:

| Cuenta | Recursos | Cómo se crea |
|---|---|---|
| Datos | RDS MySQL (facturación) y RDS PostgreSQL (catálogo), públicos con TLS | Ya existen; esquema con `python database/apply.py` |
| Aplicación | API Gateway HTTP API, 4 Lambdas (LabRole), EventBridge, 4 tablas DynamoDB, S3 + API Gateway proxy HTTPS (frontend) | `python infra/deploy.py` |

`template.yaml` es una plantilla SAM (CloudFormation) de la cuenta de aplicación. No crea roles IAM:
todas las Lambdas usan `LabRole`. Lambdas de 128 MB (`billing-api` 256 MB), DynamoDB On-Demand y
logs con retención de 7 días.

`rds_stop/template.yaml` es una **segunda plantilla SAM**, esta vez para la **cuenta de datos**: crea
la Lambda `billing-rds-stop-<cuenta>` (`LabRole`, 128 MB, timeout 15 s) y una regla de EventBridge
`cron(0 4 * * ? *)` (04:00 UTC = 22:00 en CDMX) que apaga los RDS indicados en `DB_IDS`. Se ejecuta
a diario porque un RDS apagado se reenciende automáticamente a los 7 días. Tampoco crea roles IAM
ni políticas con comodines, y no usa VPC.

## Requisitos

AWS CLI v2, Python 3.10+, Node 18+ y `backend/.env` con `BILLING_DB_*`, `CATALOG_DB_*` y `JWT_SECRET` (≥ 32 caracteres).

## Credenciales del Learner Lab

En el Learner Lab: **AWS Details → AWS CLI → Show**. Copia el bloque en `~/.aws/credentials` con el nombre
de perfil `[learnerlab]`. Caducan al terminar la sesión: al iniciar otra, vuelve a pegarlas.

## Desplegar

```bash
python infra/deploy.py --profile learnerlab            # todo (5-8 min la primera vez)
python infra/deploy.py --profile learnerlab --skip-frontend
python infra/deploy.py --profile learnerlab --frontend-only
```

El script verifica que la cuenta tenga `LabRole`, empaqueta las Lambdas para Linux (sin Docker), despliega el
stack `billing-<stage>`, compila el frontend con `VITE_API_URL` = URL de la API y lo publica en S3. Al final
imprime la URL del sitio y de la API.

## Eliminar

```bash
python infra/destroy.py --profile learnerlab
```

Para retirar la Lambda de apagado (cuenta de datos):
`aws cloudformation delete-stack --stack-name billing-rds-stop --profile datos`.

## Apagado automático de RDS (cuenta de datos)

`infra/rds_stop/` contiene `handler.py`, `requirements.txt` (boto3, ya incluido en el runtime de
Python 3.12 de Lambda) y `template.yaml`. El handler lee `DB_IDS` (CSV), llama a `stop_db_instance`
solo para esos identificadores, trata `InvalidDBInstanceStateFault` como "ya detenida" y continúa si
alguna instancia falla. El evento de EventBridge no decide qué apagar: solo se detienen las
instancias listadas en `DB_IDS`.

Se despliega con las credenciales de la cuenta de datos (perfil `[datos]`, distinto de
`[learnerlab]`) y un bucket de artefactos de esa cuenta. El procedimiento paso a paso y la
verificación están en la [sección 7 de docs/DESPLIEGUE.md](../docs/DESPLIEGUE.md):

```bash
ACCOUNT=$(aws sts get-caller-identity --profile datos --query Account --output text)
aws s3api create-bucket --bucket billing-artifacts-$ACCOUNT-us-east-1 --region us-east-1 --profile datos

aws cloudformation package --template-file infra/rds_stop/template.yaml \
  --s3-bucket billing-artifacts-$ACCOUNT-us-east-1 --s3-prefix rds-stop \
  --output-template-file .build/rds_stop_packaged.yaml --profile datos

# .build/rds_stop_params.json contiene: ["DB_IDS=Facturacion_Mysql,postgres"]
aws cloudformation deploy --template-file .build/rds_stop_packaged.yaml \
  --stack-name billing-rds-stop --capabilities CAPABILITY_AUTO_EXPAND \
  --parameter-overrides file://.build/rds_stop_params.json --profile datos
```

`DB_IDS` no contiene secretos, por eso el parámetro es `NoEcho: false`. No hace falta instalar
boto3 en el paquete: viene con el runtime de Lambda.

## Rutas de API Gateway

| Ruta | Lambda | Authorizer |
|---|---|---|
| `POST /auth/login`, `GET /health` | `billing-api` | No |
| `GET, PUT, DELETE /cart` | `billing-cart` | Sí |
| `GET, POST, PUT, DELETE /{proxy+}` | `billing-api` | Sí (JWT HS256, caché 300 s) |
| `OPTIONS` (preflight CORS) | API Gateway | No (lo responde API Gateway) |
| EventBridge `cron(5 0 * * ? *)` | `billing-tax-rate-sync` | — |

## Red

Sin VPC: las Lambdas salen a internet y llegan al endpoint público de los RDS. Learner Lab no
habilita crear VPC, subredes ni NAT Gateway con `LabRole` (permisos de red restringidos), y un NAT
Gateway además tendría costo. Cada invocación de Lambda usa una IP dinámica, así que no se puede
escribir una regla de security group por IP: los security groups de los RDS (cuenta de datos) aceptan
3306 y 5432 desde `0.0.0.0/0`.

`0.0.0.0/0` significa "aceptar conexiones entrantes desde cualquier IPv4" en esos puertos, **no**
"cualquiera puede leer los datos": además del security group hacen falta el endpoint, un usuario de
aplicación con contraseña larga y TLS obligatorio (`ssl=require` / `sslmode=require`). Es el precio
de no tener VPC/NAT en el laboratorio, y se asume de forma explícita.

> El PDF de Avance 1 describe una VPC privada (diseño preliminar). La configuración real desplegada
> es esta y la de `README.md`.

### Riesgo aceptado

| Medida | Detalle |
|---|---|
| TLS obligatorio a RDS | `ssl=require` en MySQL y `sslmode=require` en PostgreSQL cuando el host no es local; `tax_rate_sync` también usa `sslmode=require` |
| Secretos con `NoEcho` | Contraseñas RDS, `JWT_SECRET` y `DEMO_PASSWORD` son parámetros `NoEcho: true`; `deploy.py` los pasa por archivo temporal que borra y `backend/.env` no se versiona |
| Throttling de API Gateway | HTTP API a 25 req/s con ráfaga 50; proxy HTTPS del frontend a 50 req/s con ráfaga 100 |
| Sin IP fija en Lambdas | No hay una IP estática que restringir en el security group; de ahí el `0.0.0.0/0` |
| Contraseñas largas y usuarios de aplicación | Usuarios propios de la app, no la cuenta maestra, con contraseñas largas configuradas en `backend/.env` |

Se acepta que el acceso público amplíe la superficie de exposición; estas son las mitigaciones que
hacen viable el despliegue dentro de Learner Lab.
