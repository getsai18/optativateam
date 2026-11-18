# 2. Flujos, estados y seguridad

## 2.1 Inicio de sesión (JWT)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend (S3)
    participant GW as API Gateway
    participant API as Lambda billing-api
    participant DB as RDS MySQL

    U->>FE: correo y contraseña
    FE->>GW: POST /auth/login
    GW->>API: invoca (sin authorizer)
    API->>API: límite de intentos por IP y correo (5 en 15 min)
    API->>DB: busca app_user por correo
    DB-->>API: fila con password_hash
    API->>API: bcrypt.checkpw
    alt credenciales válidas y cuenta activa
        API-->>FE: 200 token JWT (HS256) y claims
        FE->>FE: guarda el token en sessionStorage
    else inválidas
        API-->>FE: 401 Invalid email or password
    else cuenta desactivada
        API-->>FE: 403 cuenta desactivada
    end
```

El token incluye `sub`, `email`, `name`, `role`, `customerId` (solo rol cliente) y `exp`. Dura
30 minutos por defecto (`SESSION_TTL_MS`).

## 2.2 Carrito temporal del asistente de facturación

```mermaid
sequenceDiagram
    actor B as Facturador
    participant FE as Frontend
    participant GW as API Gateway
    participant AU as Lambda authorizer
    participant C as Lambda cart
    participant D as DynamoDB billing_invoice_cart

    B->>FE: avanza en el asistente (cliente, servicios)
    FE->>GW: PUT /cart (Bearer JWT)
    GW->>AU: valida token
    AU-->>GW: permitido, contexto con sub
    GW->>C: invoca
    C->>D: PutItem con user_id = sub y ttl
    D-->>C: ok
    C-->>FE: carrito guardado
    Note over D: El TTL elimina carritos abandonados
```

El `user_id` sale del contexto del authorizer, no del cuerpo de la petición, para que un usuario no
pueda leer ni escribir el carrito de otro.

## 2.3 Emisión de factura

```mermaid
sequenceDiagram
    actor B as Facturador
    participant FE as Frontend
    participant API as Lambda billing-api
    participant PG as RDS PostgreSQL (catálogo)
    participant MY as RDS MySQL (facturación)
    participant DY as DynamoDB (auditoría)

    B->>FE: confirma y emite
    FE->>API: POST /invoices?issue=true
    API->>API: valida rol ADMIN o BILLER
    API->>MY: cliente activo
    API->>PG: servicios, impuestos y su historial de tasas
    API->>MY: guarda borrador y líneas con copia de precio, tasa y tipo de impuesto
    API->>MY: CALL sp_calculate_invoice_totals (descuento, IVA y retenciones)
    API->>MY: CALL sp_issue_invoice
    Note over MY: START TRANSACTION, SELECT ... FOR UPDATE,<br/>sp_calculate_invoice_totals, sp_next_folio,<br/>ISSUED + folio + UUID, asientos ISSUE, COMMIT
    MY-->>API: factura emitida
    API->>DY: PutItem invoice.issue
    API-->>FE: factura emitida
```

Las líneas de la factura guardan una copia (snapshot) del nombre, precio y tasa de impuesto vigentes.
Una factura emitida no cambia aunque el catálogo se modifique después.

## 2.4 Estados de una factura

```mermaid
stateDiagram-v2
    [*] --> DRAFT: crear
    DRAFT --> ISSUED: emitir (asigna folio y uuid)
    DRAFT --> CANCELLED: cancelar con motivo
    ISSUED --> PAID: registrar pago
    ISSUED --> CANCELLED: cancelar con motivo
    PAID --> [*]
    CANCELLED --> [*]
    note right of DRAFT
        Solo en borrador se puede
        editar o eliminar
    end note
```

`PAID` y `CANCELLED` son estados finales. Una factura admite un solo pago.

## 2.5 Control de acceso por rol (RBAC)

```mermaid
flowchart TB
    subgraph ROLES["Roles"]
        A["ADMIN"]
        B["BILLER<br/>facturador"]
        C["CUSTOMER<br/>cliente"]
    end

    subgraph RECURSOS["Recursos"]
        R1["Usuarios, auditoría,<br/>impuestos, características"]
        R2["Servicios<br/>crear y editar"]
        R3["Clientes<br/>crear"]
        R4["Facturas y pagos<br/>crear, emitir, pagar, cancelar"]
        R5["Dashboard y<br/>lista de servicios"]
        R6["Sus propias facturas<br/>emitidas, solo lectura"]
    end

    A --> R1
    A --> R2
    A --> R3
    A --> R4
    A --> R5
    B --> R3
    B --> R4
    B --> R5
    C --> R6
```

| Recurso | ADMIN | BILLER | CUSTOMER |
|---|:---:|:---:|:---:|
| Usuarios (alta y edición) | Sí | No | No |
| Auditoría | Sí | No | No |
| Impuestos: cambiar tasa | Sí | No | No |
| Características: crear, editar, borrar | Sí | No | No |
| Servicios: crear y editar | Sí | No | No |
| Servicios: consultar | Sí | Sí | No |
| Clientes: consultar y crear | Sí | Sí | No |
| Clientes: editar | Sí | No | No |
| Facturas: crear, editar borrador, emitir, cancelar, eliminar borrador | Sí | Sí | No |
| Pagos: registrar | Sí | Sí | No |
| Facturas: consultar | Todas | Todas | Solo las suyas, y nunca un borrador |
| Dashboard | Sí | Sí | No |

## 2.6 Controles de seguridad (OWASP)

| Riesgo | Control implementado |
|---|---|
| Inyección SQL | Todas las consultas y llamadas a Stored Procedures usan parámetros nombrados (`:nombre`), nunca concatenan valores del usuario |
| Autenticación rota | JWT firmado HS256 con secreto de 32 caracteres o más, expiración, límite de intentos de login |
| Almacenamiento de contraseñas | bcrypt con sal |
| Control de acceso roto | RBAC en cada ruta; el cliente solo ve sus facturas; el `user_id` del carrito sale del token |
| Exposición de datos | TLS hacia RDS; respuestas de error genéricas; sin secretos en el código |
| Configuración insegura | Encabezados `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Cache-Control: no-store`; CORS restringible al origen del frontend |
| Datos de entrada | Validación de tipos, largos y caracteres de control; cuerpos mayores a 256 KB se rechazan |
| Condiciones de carrera | `sp_issue_invoice`, `sp_register_payment` y `sp_cancel_invoice` bloquean la factura con `SELECT ... FOR UPDATE` dentro de su transacción; `sp_next_folio` usa `INSERT ... ON DUPLICATE KEY UPDATE` con `LAST_INSERT_ID()` |
| Trazabilidad | Cada alta, cambio, emisión, pago y cancelación se registra en DynamoDB |
