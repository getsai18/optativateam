# Esquema DynamoDB

Los archivos `.json` tienen el formato de `aws dynamodb create-table --cli-input-json file://<archivo>`.
El TTL no es parte de `create-table`: se activa después con `aws dynamodb update-time-to-live` (ver abajo).

Todas las tablas usan `PAY_PER_REQUEST` (sin capacidad aprovisionada) para no generar
costos fijos ni consumo descontrolado de créditos.

| Tabla | PK | SK | Índices | TTL | Para qué |
|---|---|---|---|---|---|
| `audit_log` | `entity_key` (ej. `INVOICE#123`, `USER#7`) | `event_ts` (ISO 8601) | GSI `user_id-event_ts-index` | No | Auditoría inmutable: quién hizo qué y cuándo |
| `invoice_event` | `invoice_uuid` | `event_ts` | — | No | Historial no modificable de cambios de estado de una factura |
| `user_session` | `session_id` | — | GSI `user_id-index` | `expires_at` | Sesiones activas / lista de tokens revocados |
| `invoice_cart` | `user_id` | — | — | `expires_at` | Carrito temporal antes de crear la factura |

## Atributos (no clave)

**audit_log**: `user_id`, `action` (CREATE/UPDATE/CANCEL/LOGIN...), `entity_type`, `ip_address`, `details` (map).

**invoice_event**: `event_type` (CREATED, ISSUED, PAID, CANCELLED), `from_status`, `to_status`, `user_id`, `details` (map).

**user_session**: `user_id`, `role`, `created_at`, `ip_address`, `user_agent`, `expires_at` (epoch en segundos).

**invoice_cart**: `customer_id`, `items` (lista de `{service_id, quantity}`), `updated_at`, `expires_at` (epoch en segundos).

## Crear las tablas

```bash
for t in audit_log invoice_event user_session invoice_cart; do
  aws dynamodb create-table --cli-input-json file://$t.json
done

aws dynamodb update-time-to-live --table-name user_session \
  --time-to-live-specification "Enabled=true,AttributeName=expires_at"
aws dynamodb update-time-to-live --table-name invoice_cart \
  --time-to-live-specification "Enabled=true,AttributeName=expires_at"
```

## Por qué estas tablas van en DynamoDB y no en RDS

- Se escriben mucho y casi nunca se modifican (auditoría, eventos).
- Se consultan siempre por una sola llave (sesión, carrito, factura).
- Expiran solas (sesiones, carritos) y el TTL de DynamoDB lo resuelve sin jobs.
- No necesitan JOINs ni transacciones con el resto del modelo.
