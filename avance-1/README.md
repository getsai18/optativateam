# Avance 1 - Sistema de Facturación

Proyecto de Equipo 1 a 3. Contenido que pide el correo del profesor para el Avance 1:
**Modelo de BD (DER en RDS con 8+ tablas, 10 SPs y esquema de DynamoDB) + Diagrama de Arquitectura AWS.**

> Esta carpeta es la copia de entrega. Los archivos de trabajo viven en `database/` y `docs/` del repo.

## Checklist contra los requerimientos

| Requisito | Estado | Dónde |
|---|---|---|
| DER en RDS con 8+ tablas | 17 tablas | `1-modelo-bd/DER.md`, `1-modelo-bd/schema/01_schema.sql` |
| 10 Stored Procedures en RDS | 12 SPs + 1 helper | `1-modelo-bd/procedures/` |
| Esquema de DynamoDB | 4 tablas | `2-dynamodb/` |
| Diagrama de arquitectura AWS | Listo | `3-arquitectura-aws/` |

## Estructura

```
avance-1/
├── 1-modelo-bd/
│   ├── DER.md                  # Diagrama ER (Mermaid) + cambios vs. el DER original
│   ├── schema/01_schema.sql    # 17 tablas MySQL 8
│   ├── seeds/00_base_catalogs.sql
│   ├── procedures/             # sp_00 ... sp_12 (un archivo por SP)
│   └── load_all.sh             # carga schema + catálogos + SPs en el RDS
├── 2-dynamodb/                 # 4 tablas en JSON para AWS CLI + README
└── 3-arquitectura-aws/         # diagrama PNG/SVG + explicación sencilla
```

## Stored Procedures

| SP | Qué hace | Roles |
|---|---|---|
| `sp_create_invoice_draft` | Crea una factura en borrador | ADMIN, BILLER |
| `sp_add_invoice_item` | Agrega un servicio y recalcula | ADMIN, BILLER |
| `sp_remove_invoice_item` | Quita una línea y recalcula | ADMIN, BILLER |
| `sp_recalculate_invoice` | Cálculo de subtotal, descuento, impuestos y total (usa `tax_history`) | interno |
| `sp_issue_invoice` | Emite la factura: asigna folio y pasa a ISSUED | ADMIN, BILLER |
| `sp_register_payment` | Pago simulado, parcial o total; al completar pasa a PAID | ADMIN, BILLER |
| `sp_cancel_invoice` | Cancelación atómica con reembolso simulado; bloquea meses cerrados | ADMIN, BILLER |
| `sp_set_customer_discount` | Descuento por cliente y categoría; recalcula sus borradores | ADMIN |
| `sp_update_tax_rate` | Cambia una tasa conservando el histórico | ADMIN |
| `sp_monthly_closing` | Cierre mensual de facturación | ADMIN |
| `sp_get_invoice_detail` | Encabezado, líneas y pagos; el cliente solo ve las suyas | cualquiera vía API |
| `sp_sales_report_by_category` | Ventas por categoría en un rango de fechas | cualquiera vía API |
| `sp_assert_user_role` | Helper que valida el rol del usuario | interno |

Todos los SPs que escriben usan transacción con `ROLLBACK` automático ante cualquier error, y validan el rol del usuario además de la validación del JWT en la API.

## Cómo cargarlo en el RDS

```bash
./1-modelo-bd/load_all.sh <endpoint-rds> <usuario>
```

Pide la contraseña una vez y ejecuta, en orden: schema, catálogos base y los 13 procedimientos. Requiere el cliente `mysql` y MySQL 8.0.16 o superior.

## Qué se probó

El schema y los SPs se probaron en un **MariaDB 10.11 local** (cambiando solo la collation, que es exclusiva de MySQL 8), no en un MySQL 8 real. Se verificó el flujo completo (borrador, líneas, descuento, emisión, pagos parciales y total, cancelación con reembolso, cambio de tasa, cierre mensual y reporte), los cálculos contra valores hechos a mano, los casos de error y que una falla a mitad de la cancelación revierte todo. Falta correrlo una vez en el RDS real.

## Pendiente (no es del Avance 1, pero se necesita después)

- [ ] Scripts de datos sintéticos: 100 servicios y 50 características
- [ ] Documento técnico en el formato oficial que comparta el profesor
