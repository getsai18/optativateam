# Diagramas — Sistema de Facturación (RDS + DynamoDB)

Diagramas del modelo de datos y la arquitectura, generados a partir del frontend
(`frontend/src`, `docs/DOMAIN.md`) y de los scripts de `../RDS(MySQL)/`,
`../RDS(Oracle)/` y `../DynamoDB/`.

| Archivo | Contenido |
|---|---|
| [`arquitectura-general.svg`](arquitectura-general.svg) | Frontend → API Gateway → Lambda → **RDS (MySQL u Oracle)** + **DynamoDB** (4 tablas). Fuente: [`arquitectura-general.md`](arquitectura-general.md) |
| [`DER-relacional.svg`](DER-relacional.svg) | Diagrama Entidad-Relación de las **14 tablas** relacionales (PK/UK/FK y relaciones). Fuente: [`DER-relacional.md`](DER-relacional.md) |
| [`modelo-dynamodb.svg`](modelo-dynamodb.svg) | Las 4 tablas DynamoDB con PK/SK/GSI/TTL y las operaciones del frontend que las usan. Fuente: [`modelo-dynamodb.md`](modelo-dynamodb.md) |
| [`generar_diagramas.py`](generar_diagramas.py) | Script que regenera los 3 SVG (Python 3, sin dependencias) |

## Cómo verlos y regenerarlos

- Los `.svg` se abren directamente en cualquier navegador.
- Los `.md` contienen los diagramas en sintaxis **Mermaid** (visibles en GitHub o
  con la extensión de Mermaid de VS Code) y son la fuente editable.
- Regenerar los SVG tras cambiar el script:

```bash
cd Diagramas
python generar_diagramas.py
```

## Relación con las carpetas de base de datos

- `DER-relacional` = modelo lógico **compartido** por `RDS(MySQL)/` y `RDS(Oracle)/`
  (uno u otro motor, nunca ambos en el mismo entorno).
- `modelo-dynamodb` = diseño NoSQL de `DynamoDB/` (auditoría, eventos de factura,
  sesiones con TTL y carrito del wizard); no replica datos del relacional.
