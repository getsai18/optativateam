# Lambdas independientes

Complementan a `billing-api`. Cada carpeta tiene `handler.py` (handler `handler.handler`) y, si hace falta,
`requirements.txt`. Runtime Python 3.12, rol `LabRole`. Las empaqueta y despliega `infra/deploy.py`.

| Lambda (stack) | Disparador | Memoria | Variables | Qué hace |
|---|---|---|---|---|
| `billing-authorizer-<stage>` | Authorizer de API Gateway (payload 1.0) | 128 MB | `JWT_SECRET` | Valida el JWT HS256; token inválido → 401. Caché de 300 s |
| `billing-cart-<stage>` | `ANY /cart` | 128 MB | `CART_TABLE`, `CART_TTL_DAYS`, `CORS_ORIGIN` | `GET/PUT/DELETE` del carrito del asistente en DynamoDB; el usuario sale del contexto del authorizer |
| `billing-tax-rate-sync-<stage>` | EventBridge `cron(5 0 * * ? *)` | 128 MB | `CATALOG_DB_*` | Llama a `sp_sync_tax_rates` para activar las tasas programadas |

## Prueba manual

```bash
aws lambda invoke --function-name billing-tax-rate-sync-dev --payload '{"today":"2026-12-01"}' \
  --cli-binary-format raw-in-base64-out --profile learnerlab out.json && cat out.json
```
