# Modelo - Amazon DynamoDB (4 tablas)

Disenado por patrones de acceso del frontend. Script: `Bases de datos/DynamoDB/dynamodb.sh`.
No replica datos de MySQL ni de Oracle: solo eventos, sesiones y carritos.

```mermaid
erDiagram
    billing_audit_log {
        string entity_key PK "HASH ej INVOICE-2 o CUSTOMER-1"
        string event_ts "SK RANGE ISO-8601 con uuid"
        string feed_pk "GSI feed constante AUDIT"
        string user_id "GSI usuario"
        string action "ej invoice.issue"
        string entity_type
        string entity_id
        map details
    }
    billing_invoice_event {
        string invoice_id PK "HASH"
        string event_ts "SK RANGE ISO-8601 con uuid"
        string event_type "CREATED ISSUED PAID CANCELLED"
        string from_status
        string to_status
        string user_id
    }
    billing_user_session {
        string session_id PK "HASH"
        string user_id "GSI user_id-index"
        string role
        string customer_id
        string created_at
        number ttl "TTL epoch en segundos"
    }
    billing_invoice_cart {
        string user_id PK "HASH un carrito por usuario"
        string invoice_id
        string customer_id
        list items "service_id y quantity"
        number step "0 a 3"
        string updated_at
        number ttl "TTL epoch en segundos"
    }
```

## Claves e indices

| Tabla | PK | SK | GSI | TTL |
|---|---|---|---|---|
| `billing_audit_log` | `entity_key` | `event_ts` | `user_id-event_ts-index`, `feed_pk-event_ts-index` | - |
| `billing_invoice_event` | `invoice_id` | `event_ts` | - | - |
| `billing_user_session` | `session_id` | - | `user_id-index` | `ttl` |
| `billing_invoice_cart` | `user_id` | - | - | `ttl` |

## Patron de acceso y operacion

| Operacion del frontend | Tabla | Operacion | Acceso |
|---|---|---|---|
| `writeAudit()` en cada mutacion | audit_log | `PutItem` | - |
| AuditPage (feed descendente) | audit_log | `Query` | GSI `feed_pk`, `ScanIndexForward=false` |
| Historial de una entidad | audit_log | `Query` | PK `entity_key` |
| Actividad de un usuario | audit_log | `Query` | GSI `user_id` |
| Emitir, pagar o cancelar | invoice_event | `PutItem` | - |
| Linea de tiempo de factura | invoice_event | `Query` | PK `invoice_id` |
| Login y validar sesion | user_session | `PutItem` y `GetItem` | PK `session_id` |
| Cerrar sesiones de un usuario | user_session | `Query` y `DeleteItem` | GSI `user_id-index` |
| Guardar, reanudar o borrar wizard | invoice_cart | `PutItem`, `GetItem`, `DeleteItem` | PK `user_id` |

`entity_key` y `event_ts` son cadenas compuestas (por ejemplo `INVOICE#2` y `2026-10-02T10:30:00.000Z#uuid`).
