# Lambdas independientes

Funciones que complementan al backend Flask (`backend/backend`). Cada carpeta es un paquete de
despliegue: `handler.py` + `requirements.txt`. Runtime Python 3.12, handler `handler.handler`.

Empaquetar (ejemplo con `authorizer`):

```bash
cd lambdas/authorizer
pip install -r requirements.txt -t package --platform manylinux2014_x86_64 --only-binary=:all:
cp handler.py package/ && cd package && zip -r ../authorizer.zip .
```

| Lambda | Disparador | VPC | Variables | Permisos IAM |
|---|---|---|---|---|
| `authorizer` | API Gateway (Lambda authorizer) | No | `JWT_SECRET` | ninguno extra |
| `cart` | `GET/PUT/DELETE /cart` | No | `CART_TABLE`, `CART_TTL_DAYS`, `CORS_ORIGIN` | `dynamodb:GetItem/PutItem/DeleteItem` sobre `billing_invoice_cart` |
| `tax_rate_sync` | EventBridge `cron(5 0 * * ? *)` (diario, UTC) | No (RDS público) | `DB_ENGINE`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (o `DB_SECRET_ARN`), `DB_SSL` | `secretsmanager:GetSecretValue` si usas `DB_SECRET_ARN` |

## authorizer

- Usa el mismo `JWT_SECRET` que el backend. El token lleva `exp` en milisegundos; HTTP API no puede
  validarlo con su authorizer JWT nativo, por eso existe esta función.
- Con REST API (tipo TOKEN) o HTTP API con *payload format 1.0*, un token inválido responde **401**,
  que es lo que el frontend interpreta como sesión expirada. Con HTTP API *payload 2.0 simple response*
  la respuesta es 403.
- No lo asocies a `POST /auth/login` ni a `OPTIONS`.
- Cache de resultados: 300 s es razonable; la policy ya usa `.../stage/*/*` para reutilizarse entre rutas.
- Flask sigue validando el token y los roles; el authorizer solo corta antes las peticiones sin sesión.

## cart

Requiere crear antes la tabla (`Bases de datos/DynamoDB/dynamodb.sh` ya la crea, con TTL en `ttl`).
El `user_id` sale del contexto del authorizer (`sub`), no del body. Para usarlo, `builderStore.ts` del
frontend debe leer/escribir `/cart` en lugar de `localStorage`.

## tax_rate_sync

Actualiza `tax.current_rate` cuando llega la fecha de una tasa programada. Prueba manual con un
evento `{"today": "2026-10-13"}`. Si el catálogo queda en una base distinta a la de facturación,
apunta `DB_*` a la base que contiene `tax` y `tax_history`.
