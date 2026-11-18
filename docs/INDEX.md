# Avance 1 — Sistema de Facturación y Servicios (Proyecto C)

**Asignatura:** Optativa I – Bases de Datos en la Nube
**Profesor:** Aldo Romero Arroyo
**Entorno:** AWS Academy Learner Lab

Documentación de preparación para la evaluación del proyecto: diagramas, modelos de datos y
servicios utilizados. Los diagramas están en código Mermaid y se visualizan directamente en GitHub.

> Esta versión no es la versión final.

## Decisión de arquitectura

El backend corre **solo en AWS Lambda**. No hay instancias EC2 (ni servidor de aplicaciones ni
bastión). Esto reduce la infraestructura que se administra y el consumo de crédito del Learner Lab.

## Estado de los componentes

Los diagramas muestran la arquitectura objetivo. Las Lambdas `authorizer` y `cart` ya tienen código
en `backend/functions/`, pero la guía de despliegue actual las trata como opcionales. Cada documento indica
qué está en uso y qué falta.

## Contenido

| Archivo | Qué contiene |
|---|---|
| [01-arquitectura-aws.md](01-arquitectura-aws.md) | Diagrama de arquitectura (solo Lambda) y flujo de una petición |
| [02-flujos-y-seguridad.md](02-flujos-y-seguridad.md) | Secuencias de login, carrito y emisión de factura; estados de factura; matriz de roles (RBAC) |
| [03-modelo-rds-mysql.md](03-modelo-rds-mysql.md) | Diagrama ER de facturación (RDS MySQL, 8 tablas) |
| [04-modelo-rds-postgres.md](04-modelo-rds-postgres.md) | Diagrama ER del catálogo (RDS PostgreSQL, 6 tablas) |
| [05-modelo-dynamodb.md](05-modelo-dynamodb.md) | Modelo DynamoDB (4 tablas), claves, índices y patrones de acceso |
| [06-interconexion-de-datos.md](06-interconexion-de-datos.md) | Cómo se relacionan MySQL, PostgreSQL y DynamoDB |
| [07-servicios-utilizados.md](07-servicios-utilizados.md) | Servicios AWS, configuración y justificación frente a las restricciones del Learner Lab |
