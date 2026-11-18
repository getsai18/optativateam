# 1. Arquitectura en AWS (solo Lambda)

```mermaid
flowchart LR
    U["Usuario<br/>(navegador)"]

    subgraph FE["Frontend"]
        S3["S3<br/>sitio estático React"]
    end

    subgraph API["Entrada de la API"]
        APIGW["API Gateway<br/>HTTP API"]
        AUTH["Lambda authorizer<br/>valida JWT"]
    end

    subgraph COMPUTE["Cómputo: solo Lambda"]
        L_API["Lambda billing-api<br/>Flask vía WSGI<br/>clientes, catálogo, facturas,<br/>pagos, impuestos, usuarios"]
        L_CART["Lambda cart<br/>carrito del wizard"]
        L_TAX["Lambda tax_rate_sync<br/>actualiza tasas vigentes"]
    end

    subgraph DATA["Datos"]
        MYSQL[("RDS MySQL 8<br/>facturación<br/>8 tablas + SPs")]
        PG[("RDS PostgreSQL<br/>catálogo<br/>6 tablas")]
        DDB[("DynamoDB<br/>auditoría, carrito,<br/>sesiones, eventos")]
    end

    EB["EventBridge<br/>cron diario 00:05 UTC"]
    CW["CloudWatch<br/>logs y métricas"]

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
8. **CloudWatch** recibe los logs y métricas de API Gateway y de las tres Lambdas.

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
