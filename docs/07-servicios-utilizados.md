# 7. Servicios utilizados

Todos los servicios están disponibles en AWS Academy Learner Lab. El cómputo es **solo Lambda** y el sistema
se reparte en **dos cuentas** de Learner Lab: una de datos (RDS) y una de aplicación (todo lo demás).

## 7.1 Servicios AWS

| Servicio | Cuenta | Uso en el proyecto | Configuración |
|---|---|---|---|
| **S3** | Aplicación | Archivos del frontend (React + Vite) | Bucket `billing-frontend-<cuenta>-<stage>` con alojamiento web; solo lectura pública de objetos |
| **API Gateway (proxy del frontend)** | Aplicación | Sirve el frontend por HTTPS | HTTP API con integraciones `HTTP_PROXY` (`GET /` y `GET /{proxy+}`) hacia el sitio web de S3; Learner Lab no permite CloudFront |
| **API Gateway (HTTP API)** | Aplicación | Punto de entrada único de la API | CORS limitado al origen del frontend; throttling 25 req/s (ráfaga 50); authorizer en todas las rutas salvo `/auth/login` y `/health` |
| **Lambda** `billing-api` | Aplicación | Backend Flask (adaptador `apig-wsgi`): clientes, catálogo, facturas, pagos, impuestos, usuarios, reportes, dashboard, auditoría | Python 3.12, **256 MB**, 20 s; variables de entorno para bases, JWT y auditoría |
| **Lambda** `billing-authorizer` | Aplicación | Valida el JWT (HS256) antes de llegar al backend | 128 MB, 5 s; payload 1.0 (responde 401); caché de 300 s |
| **Lambda** `billing-cart` | Aplicación | Guarda, recupera y borra el carrito del asistente de facturación | 128 MB; el usuario sale del contexto del authorizer, nunca del body |
| **Lambda** `billing-tax-rate-sync` | Aplicación | Activa las tasas de impuesto programadas | 128 MB; llama a `sp_sync_tax_rates` en PostgreSQL |
| **EventBridge** | Aplicación | Ejecución diaria de `billing-tax-rate-sync` | `cron(5 0 * * ? *)` (00:05 UTC) |
| **DynamoDB** | Aplicación | Auditoría, carrito, sesiones y eventos de factura (4 tablas) | On-Demand; TTL en sesiones y carritos; 2 GSI en auditoría |
| **CloudWatch Logs** | Aplicación | Logs de las 4 Lambdas | Retención de 7 días |
| **CloudFormation (SAM)** | Aplicación | Infraestructura como código (`infra/template.yaml`) | Stack `billing-<stage>`; sin creación de roles IAM |
| **IAM** | Aplicación | Rol de ejecución de las Lambdas | `LabRole` preconfigurado |
| **RDS MySQL 8.4** | Datos | Base transaccional de facturación (11 tablas, 10 SPs) | `db.t4g.micro`, 20 GB gp2, TLS obligatorio |
| **RDS PostgreSQL 18** | Datos | Catálogo de servicios, características e impuestos (7 tablas, 4 SPs + trigger) | `db.t4g.micro`, 20 GB gp2, TLS obligatorio |

## 7.2 Servicios descartados

| Servicio | Motivo |
|---|---|
| **EC2** | El backend corre en Lambda; no se necesita servidor ni bastión |
| **ALB / ELB** | Sin servidores que balancear; API Gateway cumple esa función |
| **NAT Gateway / VPC** | Cobra por hora; las Lambdas llegan a RDS por su endpoint público con TLS |
| **ElastiCache** | Cobra por hora y no aporta lo suficiente para el volumen del proyecto |

## 7.3 Tecnologías de aplicación

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Router, React Hook Form, Zod |
| Backend | Python 3.12, Flask, `apig-wsgi` (Lambda) |
| Autenticación | JWT (PyJWT, HS256) y bcrypt |
| Acceso a datos | PyMySQL, psycopg 3, boto3 |
| Pruebas | pytest (126 pruebas de backend), Vitest (frontend) |
| Despliegue | CloudFormation/SAM con `infra/deploy.py`; scripts SQL con `database/apply.py` |

## 7.4 Cumplimiento de las restricciones del Learner Lab

| Restricción | Cómo se atiende |
|---|---|
| RDS `db.t3.micro` o `db.t4g.micro`, máximo 20 GB | Ambas instancias son `db.t4g.micro` (Graviton) con 20 GB gp2 |
| Apagar RDS fuera de horario | Se detienen las dos instancias al terminar la sesión de trabajo |
| DynamoDB On-Demand | Las cuatro tablas usan `PAY_PER_REQUEST` |
| Lambda entre 128 y 256 MB | `billing-api` 256 MB; las otras tres 128 MB |
| Sin roles IAM con wildcard; usar `LabRole` | Todas las Lambdas usan `LabRole`; la plantilla no crea roles |
| Sin IP pública estática | Endpoints por variables de entorno; la URL de la API se inyecta al compilar el frontend |
| Credenciales temporales renovables | `deploy.py` usa el perfil `learnerlab` de `~/.aws/credentials`; no hay credenciales en el código |
| Consumo de crédito | Sin EC2/NAT/ALB; logs con retención de 7 días; throttling en API Gateway |
