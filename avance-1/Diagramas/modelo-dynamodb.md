# Modelo — Amazon DynamoDB (4 tablas)

Diseñado por patrones de acceso del frontend. Script: `Bases de datos/DynamoDB/dynamodb.sh`.
No replica datos del relacional: solo eventos, sesiones y carritos.

```mermaid
erDiagram
    billing_audit_log {
        string entity_key PK "HASH: INVOICE#id, CUSTOMER#id..."
        string event_ts SK "RANGE: ISO-8601#uuid"
        string feed_pk "GSI feed: constante AUDIT"
        string user_id "GSI usuario"
        string action "invoice.issue, tax.rate_change..."
        string entity_type
        string entity_id
        map details
    }
    billing_invoice_event {
        string invoice_id PK "HASH"
        string event_ts SK "RANGE: ISO-8601#uuid"
        string event_type "CREATED|ISSUED|PAID|CANCELLED"
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
        number ttl "TTL epoch seg (30 min)"
    }
    billing_invoice_cart {
        string user_id PK "HASH: un carrito por usuario"
        string invoice_id
        string customer_id
        list items "service_id + quantity"
        number step "0..3"
        string updated_at
        number ttl "TTL epoch seg"
    }
```

## Claves e índices

| Tabla | PK | SK | GSI | TTL |
|---|---|---|---|---|
| `billing_audit_log` | `entity_key` | `event_ts` | `user_id-event_ts-index`, `feed_pk-event_ts-index` | — |
| `billing_invoice_event` | `invoice_id` | `event_ts` | — | — |
| `billing_user_session` | `session_id` | — | `user_id-index` | `ttl` |
| `billing_invoice_cart` | `user_id` | — | — | `ttl` |

## Patrón de acceso → operación

| Operación del frontend | Tabla | Operación | Acceso |
|---|---|---|---|
| `writeAudit()` en cada mutación | audit_log | `PutItem` | — |
| AuditPage (feed desc) | audit_log | `Query` | GSI `feed_pk`, `ScanIndexForward=false` |
| Historial de una entidad | audit_log | `Query` | PK `entity_key` |
| Actividad de un usuario | audit_log | `Query` | GSI `user_id` |
| Emitir / pagar / cancelar | invoice_event | `PutItem` | — |
| Línea de tiempo de factura | invoice_event | `Query` | PK `invoice_id` |
| Login / validar sesión | user_session | `PutItem` / `GetItem` | PK `session_id` |
| Cerrar todas las sesiones de un usuario | user_session | `Query` + `DeleteItem` | GSI `user_id-index` |
| Guardar / reanudar / borrar wizard | invoice_cart | `PutItem` / `GetItem` / `DeleteItem` | PK `user_id` |
