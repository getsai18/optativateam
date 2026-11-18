# 8. Cumplimiento de la rúbrica (Proyecto C)

Evidencia en el repositorio para cada criterio de [RUBRICA.md](RUBRICA.md).

## Requisitos específicos del Proyecto C

| Requisito | Evidencia |
|---|---|
| 100 servicios y 50 características | 104 servicios y 50 características (419 asignaciones): `database/postgres/04_seed_catalog.sql` |
| Mínimo 8 tablas relacionales (Clientes, Facturas, Detalle, Servicios, Características, Pagos, Impuestos histórico, Usuarios/Roles) | 12 tablas en MySQL + 7 en PostgreSQL: [03](03-modelo-rds-mysql.md), [04](04-modelo-rds-postgres.md) |
| DynamoDB: auditoría, sesiones, carritos o eventos | 4 tablas On-Demand con GSI y TTL: [05](05-modelo-dynamodb.md); auditoría y carrito en uso |
| 10 Stored Procedures con los temas indicados | 10 en MySQL + 4 en PostgreSQL + trigger de auditoría: [database/README.md](../database/README.md) |

## 1. Diseño, modelado y rigor en base de datos (30 %)

| Criterio | Evidencia |
|---|---|
| DER normalizado | [03](03-modelo-rds-mysql.md) y [04](04-modelo-rds-postgres.md) en Mermaid; copia de nombre, precio y tasa en las líneas para conservar facturas emitidas |
| Usuarios/Roles normalizados | `app_role` (`ADMIN`/`BILLER`/`CUSTOMER`) y `app_user.role_id` `NOT NULL` con FK a `app_role(id)`; se conservan `app_user.role` y su `CHECK`, y dos triggers derivan `role_id` de `role` para no romper la API. Migración idempotente: `database/mysql/05_roles_migration.sql` |
| Volumen | 104 servicios, 50 características (419 asignaciones), 40 clientes, ~150 facturas generadas con `python database/seed/seed_invoices.py`, ~730 asientos, 14 cierres |
| PK, FK e índices | FK y `CHECK` en ambos motores; índices compuestos para estado/fecha, cliente y reglas de descuento; índice único parcial de periodo abierto en `tax_history` |
| GSI en DynamoDB | `user_id-event_ts-index`, `feed_pk-event_ts-index` (auditoría) y `user_id-index` (sesiones) |

## 2. Arquitectura en AWS y optimización en Learner Lab (25 %)

| Criterio | Evidencia |
|---|---|
| Integración API Gateway, Lambda, DynamoDB y RDS | [01](01-arquitectura-aws.md); stack desplegado y probado de punta a punta |
| `LabRole` | Todas las Lambdas en `infra/template.yaml`; no se crean roles IAM |
| Recursos mínimos | RDS `db.t4g.micro` con 20 GB; Lambda 128/256 MB; DynamoDB On-Demand; logs de 7 días; sin EC2/NAT/ALB |
| Variables de entorno y credenciales temporales | Endpoints y secretos por parámetros `NoEcho` → variables de Lambda; `deploy.py` usa el perfil `learnerlab` |
| Automatización | `python infra/deploy.py` despliega todo; `python database/apply.py` aplica esquema y SPs ([DESPLIEGUE.md](DESPLIEGUE.md)) |

## 3. Lógica de negocio, Stored Procedures y transacciones (20 %)

| Criterio | Evidencia |
|---|---|
| SPs creados y probados | `database/procedures/*.sql`; probados contra RDS y con 17 pruebas de API (`backend/tests/test_procedures_api.py`) |
| Ejecutados desde la aplicación | Cada endpoint indica su SP en `docs/openapi.yaml` (`x-stored-procedure`); `backend/app/repos.py` concentra las llamadas `CALL` |
| Sin condiciones de carrera | Emisión, pago y cancelación con `START TRANSACTION` + `SELECT ... FOR UPDATE`; folio con `LAST_INSERT_ID()` sobre fila bloqueada; tasas con `FOR UPDATE` en PostgreSQL |
| Reversión contable | Asientos de partida doble en `accounting_entry`; la cancelación invierte los asientos `ISSUE` |

## 4. Ciberseguridad, RBAC y OWASP (15 %)

| Criterio | Evidencia |
|---|---|
| JWT | HS256, secreto de 32+ caracteres, expiración de 30 min, validado por el Lambda authorizer y por Flask |
| RBAC | Matriz en [02](02-flujos-y-seguridad.md); `@require_role` en cada ruta; el cliente solo ve sus facturas (404 anti-sondeo) |
| Inyección SQL | Consultas y `CALL` siempre parametrizados |
| XSS | React escapa la salida; API con `Content-Security-Policy`, `X-Content-Type-Options` y `X-Frame-Options` |
| Contraseñas | bcrypt; límite de 5 intentos de login en 15 min |
| Secretos fuera del código | `.env` ignorado por git; parámetros `NoEcho` en CloudFormation; TLS hacia RDS |

## 5. Frontend, documentación y Git (10 %)

| Criterio | Evidencia |
|---|---|
| Interfaz funcional | React en S3: facturación con asistente, catálogo, impuestos, usuarios, bitácora y reportes (antigüedad, cierres, validación de pagos) |
| Documentación | DER ([03](03-modelo-rds-mysql.md), [04](04-modelo-rds-postgres.md)), arquitectura ([01](01-arquitectura-aws.md)), OpenAPI ([openapi.yaml](openapi.yaml)) y manual ([DESPLIEGUE.md](DESPLIEGUE.md)) |
| Control de versiones | Repositorio en GitHub con historial de commits; el reparto de autoría entre los tres integrantes y las acciones pendientes se documentan en `INSTRUCCIONES_EQUIPO.md` |

## Checklist de entregables

- [x] `/database`: DDL + DML (`mysql/`, `postgres/`), SPs en script independiente (`procedures/`), esquema DynamoDB (`dynamodb/` e `infra/template.yaml`)
- [x] `/docs`: DER, diagrama de arquitectura, OpenAPI (importable en Postman)
- [x] Código fuente: `/backend` (Python/Flask/Lambda) y `/frontend`
- [x] `README.md` con instrucciones para pruebas locales y despliegue en Learner Lab
