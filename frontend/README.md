# Frontend — Northwind Billing (React + TypeScript + Vite)

Interfaz web del sistema de facturación. Se publica en un bucket **S3** servido por HTTPS mediante un **API Gateway** que hace de proxy y consume la API de
API Gateway. Toda la información viene del backend; no hay datos simulados.

## Ejecutar

```bash
npm ci
cp .env.example .env    # VITE_API_URL y VITE_LAMBDA_URL
npm run dev             # http://localhost:5173
npm test                # Vitest
npm run typecheck && npm run lint
npm run build           # genera dist/
```

En AWS no hace falta compilar a mano: `python infra/deploy.py --profile learnerlab` compila con la URL de la
API recién desplegada y publica `dist/` en el bucket.

## Funcionalidad por rol

| Módulo | ADMIN | BILLER | CUSTOMER |
|---|:---:|:---:|:---:|
| Dashboard | Sí | Sí | — |
| Facturas: asistente (cliente → servicios → revisión), emitir, pagar, cancelar | Sí | Sí | — |
| Detalle de factura, recibo imprimible y comprobante JSON (timbrado) | Sí | Sí | Solo las suyas |
| Reportes: antigüedad de saldos y cierres fiscales | Sí | Sí | — |
| Reportes: ejecutar cierre y validación de pagos | Sí | — | — |
| Clientes | Sí | Consulta y alta | — |
| Servicios | Sí | Consulta | — |
| Características, impuestos, usuarios, bitácora | Sí | — | — |

Los totales muestran el subtotal, el descuento (que aplica `sp_apply_discount` al guardar), los impuestos
trasladados y las retenciones, que se restan del total.

## Estructura

```
src/
├── app/            # layouts, navegación por rol, rutas y guardas (ProtectedRoute, RoleGuard)
├── features/       # audit, auth, catalog, customers, dashboard, invoices, payments, reports, taxes, users
│   └── <feature>/  # pages, components, hooks, services (llamadas a la API), types
└── shared/         # componentes UI, i18n (es/en), http.ts, formato, tipos de dominio
```

## Notas

- La sesión (JWT) se guarda en `sessionStorage` y expira a los 30 minutos. Un 401 de la API regresa al login.
- La app usa `BrowserRouter`: en S3 el documento de error es `index.html` (lo configura la plantilla).
- Usuarios de prueba: `admin@northwind.test` y `biller@northwind.test`, contraseña `demo1234`.
