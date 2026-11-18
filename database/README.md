# /database

| Carpeta | Contenido |
|---|---|
| `mysql/` | RDS MySQL 8 (facturación): `01_schema.sql` (DDL, destructivo), `02_set_demo_passwords.sql`, `03_rubrica_ext.sql` (descuentos, retenciones, asientos contables, cierres fiscales) |
| `postgres/` | RDS PostgreSQL (catálogo): `01_schema.sql`, `02_compat.sql`, `03_rubrica_ext.sql` (tipo de impuesto, auditoría de tarifas) |
| `procedures/` | Stored Procedures: `mysql_procedures.sql` y `postgres_procedures.sql` |
| `dynamodb/` | Esquema de las tablas DynamoDB e índices |
| `apply.py` | Aplica los scripts a los RDS con las credenciales de `backend/.env` |

## Aplicar

```bash
pip install pymysql "psycopg[binary]" python-dotenv
python database/apply.py            # extensiones + SPs (idempotente, no borra datos)
python database/apply.py --seed     # + datos sintéticos
python database/apply.py --fresh    # DESTRUCTIVO: recrea las tablas
```

## Stored Procedures vs. rúbrica (Proyecto C)

| # | Requisito | Procedimiento | Motor |
|---|---|---|---|
| 1 | Generación e iteración atómica de folios | `sp_next_folio` (usado por `sp_issue_invoice`) | MySQL |
| 2 | Cálculo de Subtotal, IVA y Retenciones | `sp_calculate_invoice_totals` | MySQL |
| 3 | Descuentos por cliente o volumen | `sp_apply_discount` + tabla `discount_rule` | MySQL |
| 4 | Cancelación formal y reversión contable | `sp_cancel_invoice` + tabla `accounting_entry` | MySQL |
| 5 | Cierre y consolidado fiscal diario/mensual | `sp_fiscal_closing` + tabla `fiscal_closing` | MySQL |
| 6 | Validación de estados de pago | `sp_validate_payment_status`, `sp_register_payment` | MySQL |
| 7 | Reporte de antigüedad de saldos | `sp_aging_report` | MySQL |
| 8 | Estructura para comprobante / timbrado | `sp_build_stamp_payload` (JSON tipo CFDI 4.0) | MySQL |
| 9 | Asignación masiva de características | `sp_bulk_assign_features` | PostgreSQL |
| 10 | Auditoría de cambios en tarifas | `sp_update_service_price` + trigger `trg_service_price_audit` + `service_price_history` | PostgreSQL |
| + | Emisión transaccional | `sp_issue_invoice` | MySQL |
| + | Cambio programado de tasa y sincronización diaria | `sp_change_tax_rate`, `sp_sync_tax_rates`, `fn_tax_rate_on` | PostgreSQL |

Concurrencia: emisión, pago y cancelación bloquean la factura con `SELECT ... FOR UPDATE`; el folio
usa `INSERT ... ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`, que bloquea
la fila del año hasta el `COMMIT`. Los asientos contables son de partida doble (debe = haber).
