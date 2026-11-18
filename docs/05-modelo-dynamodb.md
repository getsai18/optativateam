# 5. Modelo NoSQL — Amazon DynamoDB

Cuatro tablas en modo **On-Demand** (`PAY_PER_REQUEST`) en la cuenta de aplicación. Guardan eventos,
sesiones y datos temporales; no duplican datos de las bases relacionales. Las crea la plantilla
`infra/template.yaml` con el sufijo del stage (por ejemplo `billing_audit_log_dev`);
`database/dynamodb/dynamodb.sh` crea las mismas tablas sin sufijo para pruebas manuales.

```mermaid
erDiagram
    billing_audit_log {
        string entity_key PK "ej. INVOICE#inv_2"
        string event_ts SK "ISO-8601 con id"
        string feed_pk "GSI constante AUDIT"
        string user_id "GSI por usuario"
        string action "ej. invoice.issue"
        string entity_type
        string entity_id
        string timestamp
    }
    billing_invoice_event {
        string invoice_id PK
        string event_ts SK "ISO-8601 con uuid"
        string event_type "CREATED ISSUED PAID CANCELLED"
        string from_status
        string to_status
        string user_id
    }
    billing_user_session {
        string session_id PK
        string user_id "GSI user_id-index"
        string role
        string customer_id
        string created_at
        number ttl "TTL epoch en segundos"
    }
    billing_invoice_cart {
        string user_id PK "un carrito por usuario"
        string invoice_id
        string customer_id
        list items "service_id y quantity"
        number step "0 a 3"
        string updated_at
        number ttl "TTL epoch en segundos"
    }
```

## Claves e índices

| Tabla | Partition key | Sort key | Índices secundarios (GSI) | TTL |
|---|---|---|---|---|
| `billing_audit_log` | `entity_key` | `event_ts` | `user_id-event_ts-index`, `feed_pk-event_ts-index` | No |
| `billing_invoice_event` | `invoice_id` | `event_ts` | Ninguno | No |
| `billing_user_session` | `session_id` | Ninguna | `user_id-index` | `ttl` |
| `billing_invoice_cart` | `user_id` | Ninguna | Ninguno | `ttl` |

## Patrones de acceso

| Necesidad | Tabla | Operación | Acceso |
|---|---|---|---|
| Registrar cada alta, cambio, emisión, pago o cancelación | `billing_audit_log` | `PutItem` | Escritura directa |
| Pantalla de auditoría, más reciente primero | `billing_audit_log` | `Query` | GSI `feed_pk`, `ScanIndexForward=false` |
| Historial de una entidad | `billing_audit_log` | `Query` | Partition key `entity_key` |
| Actividad de un usuario | `billing_audit_log` | `Query` | GSI `user_id` |
| Línea de tiempo de una factura | `billing_invoice_event` | `Query` | Partition key `invoice_id` |
| Guardar, reanudar o borrar el carrito del asistente | `billing_invoice_cart` | `PutItem`, `GetItem`, `DeleteItem` | Partition key `user_id` |
| Validar y cerrar sesiones | `billing_user_session` | `GetItem`, `Query`, `DeleteItem` | Partition key o GSI `user_id` |

## Decisiones de diseño

- **Diseñado por patrones de acceso**, sin `Scan`: cada consulta usa una clave o un índice.
- **Sort key con sufijo único.** `event_ts` guarda `<fecha ISO>#<id>` para que dos eventos del
  mismo milisegundo sobre la misma entidad no se sobrescriban.
- **Feed global sin `Scan`.** `feed_pk` vale siempre `AUDIT`, de modo que un GSI permite listar toda
  la auditoría ordenada por fecha con un `Query`.
- **TTL.** Sesiones y carritos expiran solos, sin costo de borrado ni tareas de limpieza.
- **Datos inmutables.** La auditoría y los eventos solo se insertan, nunca se actualizan.

## Estado de uso

| Tabla | Estado |
|---|---|
| `billing_audit_log` | En uso: la Lambda `billing-api` escribe cada cambio y la pantalla Bitácora la consulta |
| `billing_invoice_cart` | En uso: la Lambda `billing-cart` guarda el carrito del asistente de facturación |
| `billing_invoice_event` | Creada con el stack; reservada para la línea de tiempo de facturas |
| `billing_user_session` | Creada con el stack; reservada para revocación de sesiones |
