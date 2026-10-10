# Modelo NoSQL — Amazon DynamoDB (4 tablas)

Diseño orientado a los **patrones de acceso reales del frontend**. Ninguna tabla
replica datos del relacional: solo guarda eventos, sesiones y carritos.

- Versión renderizada: [`modelo-dynamodb.svg`](modelo-dynamodb.svg) (abrir en el navegador).
- Regenerar: `python generar_diagramas.py`.

```mermaid
erDiagram
    billing_audit_log {
        varchar entity_key PK "HASH  ej. INVOICE#2"
        varchar event_ts SK "RANGE  ISO 8601"
        varchar feed_pk "GSI2  constante AUDIT"
        varchar user_id "GSI1"
        varchar action "invoice.issue, ..."
        varchar entity_type
        varchar entity_id
        map details
    }
    billing_invoice_event {
        varchar invoice_id PK "HASH"
        varchar event_ts SK "RANGE"
        varchar event_type "CREATED|ISSUED|PAID|CANCELLED"
        varchar from_status
        varchar to_status
        varchar user_id
        map details
    }
    billing_user_session {
        varchar session_id PK "HASH"
        varchar user_id GSI "user_id-index"
        varchar role
        varchar customer_id
        timestamp created_at
        timestamp expires_at
        number ttl "TTL epoch seg"
    }
    billing_invoice_cart {
        varchar user_id PK "HASH  un carrito por usuario"
        varchar invoice_id
        varchar customer_id
        list items "service_id + quantity"
        number step
        timestamp updated_at
        number ttl "TTL epoch seg"
    }
```

## Claves, índices y por qué

| Tabla | PK (HASH) | SK (RANGE) | Índices (GSI) | TTL | Justificación (operación del frontend) |
|---|---|---|---|---|---|
| `billing_audit_log` | `entity_key` (`INVOICE#2`, `CUSTOMER#1`…) | `event_ts` (ISO 8601) | `user_id-event_ts-index`; `feed_pk-event_ts-index` (`feed_pk="AUDIT"`) | — | `writeAudit()` se ejecuta en **cada** mutación; `AuditPage` lista el feed global desc (Query al GSI `feed_pk`, sin Scan); el PK consulta el historial de **una** entidad |
| `billing_invoice_event` | `invoice_id` | `event_ts` | — | — | Historial inmutable del ciclo de vida por factura (`DRAFT→ISSUED→PAID`, cancelaciones); `Query` por factura |
| `billing_user_session` | `session_id` | — | `user_id-index` (listar/revocar todas las sesiones de un usuario) | `ttl` (30 min, `SESSION_TTL_MS`) | `login()` emite JWT con `exp`; validación server-side por request con `GetItem`; revocación instantánea con `DeleteItem` |
| `billing_invoice_cart` | `user_id` | — | — | `ttl` | `builderStore` del wizard: un carrito por usuario (`GetItem`/`PutItem`/`UpdateItem`/`DeleteItem`); se limpia solo si se abandona |

## Patrones de acceso → operación DynamoDB

| Operación del frontend | Tabla | API DynamoDB | Acceso |
|---|---|---|---|
| `writeAudit()` en cada mutación | `billing_audit_log` | `PutItem` | PK + GSI2 |
| `AuditPage` (feed global desc) | `billing_audit_log` | `Query` | GSI `feed_pk-event_ts-index`, `ScanIndexForward=false` |
| Auditoría de UNA entidad | `billing_audit_log` | `Query` | PK `entity_key` |
| Actividad de un usuario | `billing_audit_log` | `Query` | GSI `user_id-event_ts-index` |
| Volcado/exportación (admin) | `billing_audit_log` | `Scan` (ocasional) | — |
| emitir / pagar / cancelar factura | `billing_invoice_event` | `PutItem` | PK `invoice_id` + `event_ts` |
| Timeline de una factura | `billing_invoice_event` | `Query` | PK `invoice_id` |
| `login()` / validar sesión por request | `billing_user_session` | `PutItem` / `GetItem` | PK `session_id` |
| Logout global de un usuario | `billing_user_session` | `Query` + `DeleteItem` | GSI `user_id-index` |
| Guardar/reanudar/borrar carrito del wizard | `billing_invoice_cart` | `PutItem` / `GetItem` / `DeleteItem` | PK `user_id` |

Ejemplos de ítems y comandos: `../DynamoDB/data/*_items.json` y
`../DynamoDB/examples/operations.sh`. IaC: `../DynamoDB/cloudformation/dynamodb-tables.yaml`.
