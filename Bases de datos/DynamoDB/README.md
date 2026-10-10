# Base de datos no relacional — Amazon DynamoDB

Solución **NoSQL** del Sistema de Facturación para Amazon DynamoDB, diseñada a
partir de los patrones de acceso reales del frontend (`frontend/src`). Sigue la
arquitectura documentada del proyecto: **RDS (relacional) + DynamoDB (NoSQL)**;
el detalle de qué vive en cada motor está en los README de `../RDS(MySQL)/` y
`../RDS(Oracle)/`.

> **Estado:** los archivos están listos para desplegarse; **no** se creó ninguna
> tabla en AWS desde este repositorio (requiere credenciales/permisos). Todo lo
> necesario para desplegar está aquí.

## Por qué estas entidades van en DynamoDB (y no en RDS)

| Tabla | Operación del frontend que la justifica | Patrón de acceso |
|---|---|---|
| `billing_audit_log` | `writeAudit()` se ejecuta en **cada** mutación (crear/editar usuario, cliente, servicio, feature, tasa, factura; emitir, pagar, cancelar); `AuditPage` lista todo ordenado desc por timestamp; `auditService` indica "*DynamoDB-backed in production*" | Append-only, escritura por evento, lectura por entidad, por usuario o feed global |
| `billing_invoice_event` | Máquina de estados `invoiceStatus.ts` (`DRAFT→ISSUED→PAID`, `DRAFT/ISSUED→CANCELLED`); `stamp()`, `registerPayment()` y `cancelInvoice()` registran transiciones | Historial inmutable **por factura**, consultado con `Query` por `invoice_id` |
| `billing_user_session` | `authService.login()` emite un JWT con `exp` (`SESSION_TTL_MS` = 30 min); se necesita revocación/registro server-side de sesiones | Lookup directo por `session_id`; expiración automática por TTL |
| `billing_invoice_cart` | `builderStore` del wizard de nueva factura persiste `{invoiceId, customerId, lines[], step}` "*mirrored to localStorage until saved or discarded*" | Un carrito **por usuario**, con expiración automática por TTL |

Lo que **no** va aquí: usuarios, clientes, catálogos, facturas y pagos. Son
transaccionales con FKs e integridad (emitir factura = folio + totales +
detalle); eso pertenece a RDS (MySQL u Oracle). **Ninguna tabla de DynamoDB
replica datos del relacional**: se guarda solo el evento/sesión/carrito.

## Diseño de claves e índices (orientado a consultas)

### `billing_audit_log`
- **PK** `entity_key` (S): clave compuesta del tipo `INVOICE#2`, `CUSTOMER#1`,
  `USER#1`, `TAX#3` → `Query` devuelve el historial completo de una entidad.
- **SK** `event_ts` (S, ISO 8601): orden cronológico estable (varios eventos
  en el mismo instante no colisionan gracias al resto del timestamp).
- **GSI `user_id-event_ts-index`**: actividad de un usuario (por ejemplo,
  auditoría personal o filtrado interno).
- **GSI `feed_pk-event_ts-index`** con `feed_pk = "AUDIT"` (constante): feed
  global de auditoría que `AuditPage` lista de más reciente a más antiguo
  (`Query` + `ScanIndexForward=false`), evitando un `Scan` de tabla completa.
  *Compromiso de diseño:* el GSI global concentra las escrituras en una
  partición del índice; para este volumen es aceptable, y si crece se puede
  shardear por mes (`AUDIT#2026-10`) sin cambiar la PK base.

### `billing_invoice_event`
- **PK** `invoice_id` (S) + **SK** `event_ts`: `Query` por factura devuelve su
  ciclo de vida completo ordenado. Sin GSI: no hay consulta "global" de
  eventos en el frontend (la global la responde `audit_log`).

### `billing_user_session`
- **PK** `session_id` (S): el JWT referencia la sesión y se valida con
  `GetItem` en cada request (revocación efectiva al instante).
- **GSI `user_id-index`**: listar/revocar todas las sesiones de un usuario.
- **TTL** `ttl` (N, epoch segundos): expiración a los 30 min
  (`SESSION_TTL_MS`) sin jobs; el ítem se elimina automáticamente.

### `billing_invoice_cart`
- **PK** `user_id` (S): un solo carrito activo por usuario (el builder solo
  sostiene un borrador).
- Atributos: `items` (lista de `{service_id, quantity}` = `BuilderLine[]`),
  `customer_id`, `invoice_id`, `step` (0..3), `updated_at`.
- **TTL** `ttl`: el carrito se limpia solo si el usuario abandona el wizard.

## Archivos

| Ruta | Contenido |
|---|---|
| `cloudformation/dynamodb-tables.yaml` | IaC: las 4 tablas, GSIs, TTL y cifrado (recomendado) |
| `cli/*.json` | Definiciones para `aws dynamodb create-table --cli-input-json` (alternativa al CloudFormation) |
| `data/*_items.json` | Ítems de ejemplo en JSON tipado de DynamoDB |
| `create-tables.sh` | Crea las 4 tablas vía AWS CLI |
| `load-sample-data.sh` | Carga los ítems de ejemplo vía `batch-write-item` |
| `examples/operations.sh` | GetItem, PutItem, UpdateItem, DeleteItem, Query y Scan de los patrones reales |
| `.env.example` | Variables de entorno **sin secretos** |

## Cómo desplegar

**Opción A — CloudFormation (recomendado):**

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name billing-dynamodb \
  --template-file cloudformation/dynamodb-tables.yaml \
  --capabilities CAPABILITY_IAM
aws cloudformation describe-stacks --stack-name billing-dynamodb \
  --query 'Stacks[0].Outputs'
```

**Opción B — AWS CLI:**

```bash
./create-tables.sh us-east-1
```

Cargar datos de ejemplo y probar operaciones:

```bash
./load-sample-data.sh us-east-1
./examples/operations.sh us-east-1
```

Verificación rápida:

```bash
aws dynamodb list-tables --region us-east-1
aws dynamodb describe-time-to-live --table-name billing_user_session --region us-east-1
aws dynamodb query --table-name billing_audit_log \
  --index-name feed_pk-event_ts-index \
  --key-condition-expression "feed_pk = :p" \
  --expression-attribute-values '{":p": {"S": "AUDIT"}}' \
  --scan-index-forward false --limit 5 --region us-east-1
```

## Ejemplos de ítems (resumen)

```json
// audit_log — evento de emisión de factura
{ "entity_key": "INVOICE#2", "event_ts": "2026-10-02T10:30:00.000Z",
  "feed_pk": "AUDIT", "user_id": "2", "action": "invoice.issue",
  "entity_type": "invoice", "entity_id": "2",
  "details": { "folio": "INV-2026-0001", "total": 10440.00 } }

// invoice_event — transición DRAFT -> ISSUED
{ "invoice_id": "2", "event_ts": "2026-10-02T10:30:00.000Z",
  "event_type": "ISSUED", "from_status": "DRAFT", "to_status": "ISSUED",
  "user_id": "2" }

// user_session — sesión con expiración (TTL en epoch segundos)
{ "session_id": "7f3c1a9e-...", "user_id": "1", "role": "ADMIN",
  "created_at": "2026-10-10T14:30:00.000Z", "ttl": 1791644400 }

// invoice_cart — carrito del wizard
{ "user_id": "2", "customer_id": "2",
  "items": [ { "service_id": "1", "quantity": 2 } ],
  "step": 1, "ttl": 1792248000 }
```

Los archivos `data/*_items.json` usan la forma tipada de DynamoDB
(`{"S": "..."}`, `{"N": "..."}`, `{"L": [...]}`, `{"M": {...}}`) que exige el
AWS CLI. Los valores `ttl` de ejemplo son fijos; en producción los calcula la
aplicación (`epoch_segundos = ahora + ttl_deseado`).

## Seguridad y AWS (resumen)

- Tablas con **cifrado en servidor** (`SSEEnabled: true` en el CloudFormation).
- **Sin acceso público**: no se habilita acceso desde Internet; la capa de
  backend accede desde la misma VPC (recomendado: **VPC Endpoint** para
  DynamoDB y así evitar tráfico por Internet y NAT).
- **Permisos IAM mínimos** para el rol de la Lambda (ajustar nombres de tabla
  y región):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem",
        "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/billing_audit_log",
        "arn:aws:dynamodb:*:*:table/billing_audit_log/index/*",
        "arn:aws:dynamodb:*:*:table/billing_invoice_event",
        "arn:aws:dynamodb:*:*:table/billing_user_session",
        "arn:aws:dynamodb:*:*:table/billing_user_session/index/*",
        "arn:aws:dynamodb:*:*:table/billing_invoice_cart"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Scan"],
      "Resource": ["arn:aws:dynamodb:*:*:table/billing_audit_log"],
      "Condition": { "StringEquals": { "aws:PrincipalTag/role": "admin-tooling" } }
    }
  ]
}
```

- El `Scan` se limita a exportaciones/administración; los flujos normales usan
  `Query`/`GetItem`.
- No se usaron ARNs ni identificadores reales en los archivos; el ARN del
  ejemplo es una plantilla con comodines que debe restringirse al desplegar.
