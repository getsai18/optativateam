# 7. Servicios utilizados

Todos los servicios están disponibles en AWS Academy Learner Lab. El cómputo es **solo Lambda**.

## 7.1 Servicios AWS

| Servicio | Uso en el proyecto | Configuración |
|---|---|---|
| **S3** | Aloja el frontend web estático (React + Vite) | Bucket con alojamiento de sitio web; `index.html` como documento de error para el enrutado de la SPA |
| **API Gateway (HTTP API)** | Punto de entrada único de la API; enruta a las Lambdas y aplica el authorizer | CORS limitado al origen del frontend; todas las rutas hacia `billing-api` y `/cart` hacia `cart` (cuando se despliegue) |
| **Lambda** `billing-api` | Backend Flask (adaptador WSGI): clientes, catálogo, facturas, pagos, impuestos, usuarios, dashboard, auditoría | Python 3.12; variables de entorno para bases, secreto JWT y auditoría |
| **Lambda** `authorizer` | Valida el JWT antes de llegar al backend | Usa el mismo `JWT_SECRET`; caché de resultados de 300 s. Código listo en `backend/functions/authorizer`; la guía de despliegue actual lo marca como opcional (Flask ya valida el token) |
| **Lambda** `cart` | Guarda, recupera y borra el carrito del asistente de facturación | Lee `sub` del contexto del authorizer; tabla en `CART_TABLE`. Código listo en `backend/functions/cart`; pendiente de desplegar y de conectar en el frontend |
| **Lambda** `tax_rate_sync` | Activa las tasas de impuesto programadas | Disparada por EventBridge; escribe en PostgreSQL |
| **EventBridge** | Programa la ejecución diaria de `tax_rate_sync` | `cron(5 0 * * ? *)` (00:05 UTC) |
| **RDS MySQL 8** | Base transaccional de facturación (8 tablas) | `db.t3.micro`, almacenamiento de hasta 20 GB, TLS obligatorio |
| **RDS PostgreSQL** | Catálogo de servicios, características e impuestos (6 tablas) | `db.t3.micro`, almacenamiento de hasta 20 GB, TLS obligatorio |
| **DynamoDB** | Auditoría, carrito, sesiones y eventos de factura (4 tablas) | Modo On-Demand; TTL en sesiones y carritos; 2 GSI en auditoría |
| **CloudWatch** | Logs y métricas de API Gateway y de las Lambdas | Grupos de logs por función |
| **IAM** | Permisos de ejecución de las Lambdas | Rol `LabRole` preconfigurado |

## 7.2 Servicios descartados

| Servicio | Motivo |
|---|---|
| **EC2** | El backend corre en Lambda; ya no se necesita servidor ni bastión |
| **ALB / ELB** | Sin servidores que balancear; API Gateway cumple esa función |
| **ElastiCache** | Cobra por hora y no aporta lo suficiente para el volumen del proyecto |
| **SQS** | La auditoría se escribe directo en DynamoDB, que es suficientemente rápido |

## 7.3 Tecnologías de aplicación

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Router, React Hook Form, Zod |
| Backend | Python 3.12, Flask, adaptador WSGI para Lambda |
| Autenticación | JWT (PyJWT, HS256) y bcrypt |
| Acceso a datos | PyMySQL, psycopg 3, boto3 |
| Pruebas | pytest (backend), Vitest (frontend) |
| Despliegue | Serverless Framework, AWS CLI, scripts SQL y `dynamodb.sh` |

## 7.4 Cumplimiento de las restricciones del Learner Lab

| Restricción | Cómo se atiende | Estado |
|---|---|---|
| RDS `db.t3.micro` o `db.t4g.micro`, máximo 20 GB | Ambas instancias son `db.t3.micro`; al crearlas se fija el almacenamiento en 20 GB (la guía de despliegue no lo especifica y debe agregarse) | Cumple en clase de instancia; tamaño de disco por confirmar |
| Apagar RDS fuera de horario | Se detienen las dos instancias al terminar la sesión de trabajo | Procedimiento manual |
| DynamoDB On-Demand | Las cuatro tablas usan `PAY_PER_REQUEST` | Cumple |
| Lambda entre 128 y 256 MB | Objetivo: 256 MB en todas las funciones | Pendiente de ajustar: la configuración actual del backend es 512 MB |
| Sin roles IAM con wildcard; usar `LabRole` | Las Lambdas se ejecutan con `LabRole` | Cumple al desplegar |
| Sin IP pública estática | Los endpoints se pasan por variables de entorno (`BILLING_DB_HOST`, `CATALOG_DB_HOST`, `VITE_API_URL`) | Cumple |
| Credenciales temporales renovables | Sin credenciales en el código; las variables de entorno se actualizan con cada despliegue | Cumple |

## 7.5 Mínimos de la rúbrica del Proyecto C

| Requisito | Estado |
|---|---|
| Mínimo 8 tablas relacionales en RDS | Cumple: 8 en MySQL y 6 en PostgreSQL |
| DynamoDB para auditoría, sesiones y carritos | Cumple: 4 tablas |
| 100 servicios y 50 características | Pendiente: carga de datos sintéticos |
| 10 Stored Procedures en RDS | Parcial: existen 12 procedimientos en `database/procedures/_legacy_avance1.sql`; falta que la aplicación los invoque y cubrir los temas de retenciones, descuentos, cierre fiscal y antigüedad de saldos |
| JWT y RBAC | Cumple |
| Documentación: DER, arquitectura, OpenAPI o Postman | Parcial: DER y arquitectura en esta carpeta; falta OpenAPI o colección de Postman |
