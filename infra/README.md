# /infra — despliegue automático (AWS Academy Learner Lab)

Arquitectura en **dos cuentas** de Learner Lab:

| Cuenta | Recursos | Cómo se crea |
|---|---|---|
| Datos | RDS MySQL (facturación) y RDS PostgreSQL (catálogo), públicos con TLS | Ya existen; esquema con `python database/apply.py` |
| Aplicación | API Gateway HTTP API, 4 Lambdas (LabRole), EventBridge, 4 tablas DynamoDB, S3 (frontend) | `python infra/deploy.py` |

`template.yaml` es una plantilla SAM (CloudFormation). No crea roles IAM: todas las Lambdas usan `LabRole`.
Lambdas de 128 MB (`billing-api` 256 MB), DynamoDB On-Demand y logs con retención de 7 días.

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

## Rutas de API Gateway

| Ruta | Lambda | Authorizer |
|---|---|---|
| `POST /auth/login`, `GET /health` | `billing-api` | No |
| `ANY /cart` | `billing-cart` | Sí |
| `ANY /{proxy+}` | `billing-api` | Sí (JWT HS256, caché 300 s) |
| EventBridge `cron(5 0 * * ? *)` | `billing-tax-rate-sync` | — |

## Red

Sin VPC: las Lambdas salen a internet y llegan al endpoint público de los RDS. Los security groups de los RDS
(cuenta de datos) deben aceptar 3306 y 5432 desde las Lambdas; como no tienen IP fija, la regla es
`0.0.0.0/0`, protegida por TLS obligatorio, contraseñas largas y usuarios de aplicación.
