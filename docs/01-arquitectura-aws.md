# 1. Arquitectura en AWS (solo Lambda, dos cuentas de Learner Lab)

La infraestructura de la cuenta de aplicación se crea con `infra/template.yaml` (CloudFormation/SAM) ejecutando `python infra/deploy.py`. Las bases relacionales viven en una cuenta de datos separada.

```mermaid
flowchart LR
    U["Usuario<br/>(navegador)"]

    subgraph APP["Cuenta de aplicación (LabRole)"]
    subgraph FE["Frontend"]
        S3["S3<br/>sitio estático React"]
    end

    subgraph API["Entrada de la API"]
        APIGW["API Gateway<br/>HTTP API"]
        AUTH["Lambda authorizer<br/>valida JWT"]
    end

    subgraph COMPUTE["Cómputo: solo Lambda"]
        L_API["Lambda billing-api 256 MB<br/>Flask + apig-wsgi<br/>facturas, catálogo, pagos,<br/>impuestos, usuarios, reportes"]
        L_CART["Lambda billing-cart<br/>carrito del wizard"]
        L_TAX["Lambda billing-tax-rate-sync<br/>sp_sync_tax_rates"]
    end

    DDB[("DynamoDB On-Demand<br/>auditoría, carrito,<br/>sesiones, eventos")]
    EB["EventBridge<br/>cron diario 00:05 UTC"]
    CW["CloudWatch Logs<br/>retención 7 días"]
    end

    subgraph DATA["Cuenta de datos"]
        MYSQL[("RDS MySQL 8.4<br/>facturación<br/>11 tablas + 10 SPs")]
        PG[("RDS PostgreSQL 18<br/>catálogo<br/>7 tablas + 4 SPs + trigger")]
    end

    U --> S3
    U -->|"HTTPS + Bearer JWT"| APIGW
    APIGW -->|"rutas protegidas"| AUTH
    APIGW --> L_API
    APIGW -->|"/cart"| L_CART
    L_API --> MYSQL
    L_API --> PG
    L_API -->|"auditoría"| DDB
    L_CART --> DDB
    EB --> L_TAX
    L_TAX --> PG
    L_API -.-> CW
    L_CART -.-> CW
    L_TAX -.-> CW
    APIGW -.-> CW
```

## Flujo de una petición

1. El navegador descarga el frontend (React + Vite) desde **S3**.
2. El frontend llama a **API Gateway** con el token JWT en el encabezado `Authorization`.
3. El **Lambda authorizer** valida la firma y la vigencia del token. Si no es válido, responde 401
   sin llegar al backend. `POST /auth/login` no pasa por el authorizer.
4. API Gateway invoca la Lambda correspondiente:
   - `billing-api` (Flask) atiende clientes, catálogo, facturas, pagos, impuestos, usuarios,
     dashboard y auditoría.
   - `cart` atiende `GET/PUT/DELETE /cart` (carrito temporal del asistente de facturación).
5. `billing-api` lee y escribe en **RDS MySQL** (facturación) y **RDS PostgreSQL** (catálogo).
   Cada petición escribe en una sola base, por lo que no hace falta una transacción entre motores.
6. Cada acción que modifica datos se registra en **DynamoDB** (`billing_audit_log`).
7. **EventBridge** ejecuta una vez al día `tax_rate_sync`, que activa las tasas de impuesto
   programadas para esa fecha.
8. **CloudWatch** recibe los logs de las cuatro Lambdas (retención de 7 días).

## Qué cambia al no usar EC2

| Antes | Ahora |
|---|---|
| EC2 como bastión para correr scripts SQL | Los scripts se ejecutan desde el equipo del desarrollador con un cliente SQL, sobre RDS con acceso público restringido por security group |
| Subred pública y privada para EC2/Lambda/RDS | Sin VPC: la Lambda sale a internet y RDS usa TLS |
| Servidor de aplicación siempre encendido | Cómputo bajo demanda: se paga solo por invocación |

El código de la aplicación no cambia entre ambos esquemas. Mover las Lambdas y RDS a una VPC más
adelante es una decisión de despliegue, no de código.

## Aspectos de seguridad de esta arquitectura

- Las credenciales de base de datos y el `JWT_SECRET` se pasan por variables de entorno de la
  Lambda, nunca en el código fuente.
- El backend rechaza arrancar si `JWT_SECRET` tiene menos de 32 caracteres.
- La conexión a RDS usa TLS (`ssl=require`) cuando el host no es local.
- El rol de ejecución de las Lambdas es `LabRole`, como exige el Learner Lab.
