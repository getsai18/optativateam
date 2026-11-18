# 6. Interconexión de datos entre MySQL, PostgreSQL y DynamoDB

## 6.1 Reparto de responsabilidades

```mermaid
flowchart LR
    subgraph MY["RDS MySQL: facturación"]
        M1["app_user"]
        M2["customer"]
        M3["issuer"]
        M4["invoice"]
        M5["invoice_detail"]
        M6["invoice_detail_tax"]
        M7["folio_counter"]
        M8["payment"]
    end

    subgraph PGS["RDS PostgreSQL: catálogo"]
        P1["service"]
        P2["feature"]
        P3["service_feature"]
        P4["tax"]
        P5["tax_history"]
        P6["service_tax"]
    end

    subgraph DY["DynamoDB: eventos y temporales"]
        D1["billing_audit_log"]
        D2["billing_invoice_event"]
        D3["billing_user_session"]
        D4["billing_invoice_cart"]
    end

    M5 -. "service_id" .-> P1
    M6 -. "tax_id" .-> P4
    P5 -. "changed_by" .-> M1
    D1 -. "user_id y entity_id" .-> M1
    D1 -. "entity_id" .-> M4
    D4 -. "customer_id y service_id" .-> M2
    D4 -. "service_id" .-> P1
```

Las líneas punteadas son referencias lógicas: el identificador se guarda, pero no existe una llave
foránea porque los datos viven en motores distintos.

## 6.2 Referencias entre bases

| Origen | Campo | Destino | Cómo se garantiza la integridad |
|---|---|---|---|
| MySQL `invoice_detail` | `service_id` | PostgreSQL `service.id` | El backend verifica que el servicio exista y esté activo antes de guardar |
| MySQL `invoice_detail_tax` | `tax_id` | PostgreSQL `tax.id` | El backend toma los impuestos del catálogo; además guarda copia de código, nombre y tasa |
| PostgreSQL `tax_history` | `changed_by` | MySQL `app_user.id` | El backend toma el usuario del token JWT |
| DynamoDB `billing_audit_log` | `user_id`, `entity_id` | MySQL `app_user`, `invoice`, `customer` y PostgreSQL `service`, `feature`, `tax` | Al consultar, el backend resuelve etiquetas legibles en la base que corresponde |
| DynamoDB `billing_invoice_cart` | `customer_id`, `items.service_id` | MySQL `customer` y PostgreSQL `service` | Al emitir, el backend vuelve a validar cliente y servicios |

## 6.3 Por qué se separó así

| Dato | Dónde vive | Motivo |
|---|---|---|
| Facturas, pagos, folios, usuarios | MySQL | Requieren transacciones, bloqueo de filas y integridad estricta |
| Servicios, características, impuestos | PostgreSQL | Catálogo de lectura frecuente, con historial de vigencias y restricciones de integridad |
| Auditoría, eventos, carrito, sesiones | DynamoDB | Alto volumen de escrituras, acceso por clave, solo inserción y expiración automática (TTL) |

## 6.4 Consistencia entre bases

- Cada petición modifica **una sola base relacional**, por lo que no se necesita una transacción
  distribuida.
- Las copias (snapshots) en la factura hacen que un documento emitido siga siendo válido aunque el
  catálogo cambie o no esté disponible.
- La auditoría se escribe después del `COMMIT`. Si DynamoDB falla, el evento completo queda en
  CloudWatch Logs para poder reconstruirlo.
