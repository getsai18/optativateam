# /docs — Sistema de Facturación y Servicios (Proyecto C)

**Asignatura:** Optativa I – Bases de Datos en la Nube · **Profesor:** Aldo Romero Arroyo ·
**Entorno:** AWS Academy Learner Lab

Los diagramas están en Mermaid y se ven directamente en GitHub.

| Archivo | Contenido |
|---|---|
| [01-arquitectura-aws.md](01-arquitectura-aws.md) | Diagrama de arquitectura (dos cuentas, solo Lambda) y flujo de una petición |
| [02-flujos-y-seguridad.md](02-flujos-y-seguridad.md) | Login, carrito y emisión; estados de factura; matriz RBAC; controles OWASP |
| [03-modelo-rds-mysql.md](03-modelo-rds-mysql.md) | DER de facturación (RDS MySQL, 11 tablas) |
| [04-modelo-rds-postgres.md](04-modelo-rds-postgres.md) | DER del catálogo (RDS PostgreSQL, 7 tablas) |
| [05-modelo-dynamodb.md](05-modelo-dynamodb.md) | Modelo DynamoDB (4 tablas), claves, GSI y patrones de acceso |
| [06-interconexion-de-datos.md](06-interconexion-de-datos.md) | Cómo se relacionan MySQL, PostgreSQL y DynamoDB |
| [07-servicios-utilizados.md](07-servicios-utilizados.md) | Servicios AWS y cumplimiento de las restricciones del Learner Lab |
| [08-cumplimiento-rubrica.md](08-cumplimiento-rubrica.md) | Evidencia por cada criterio de la rúbrica |
| [DESPLIEGUE.md](DESPLIEGUE.md) | Manual de despliegue paso a paso |
| [openapi.yaml](openapi.yaml) | Especificación OpenAPI 3 de la API (importable en Postman o Swagger UI) |
| [RUBRICA.md](RUBRICA.md) | Lineamientos y rúbrica de evaluación |
| [avance-1/](avance-1/) | Entrega del Avance 1 (histórico) |

Stored Procedures y su relación con la rúbrica: [../database/README.md](../database/README.md).
