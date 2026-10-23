# Northwind Billing: front-end prototype

Front-end-only prototype of an invoicing web app (React 18 + TypeScript strict + Vite + Tailwind). There is no backend:
all data lives in an in-memory DB persisted to `localStorage`, behind promise-based `services/` functions that are
meant to be swapped for AWS API Gateway calls (Lambda/Flask + RDS MySQL + DynamoDB).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (calculateTotals, status transitions)
npm run typecheck  # tsc, strict
npm run lint
npm run build
```

## Demo accounts

Password for all accounts: `demo1234` (the login page also has one-click "Sign in as …" buttons).

| Role          | Email                    |
| ------------- | ------------------------ |
| Administrator | `admin@northwind.test`   |
| Biller        | `biller@northwind.test`  |
| Biller        | `biller2@northwind.test` |
| Customer      | `customer@client.test` (also `customer2` … `customer5@client.test`) |

## What is implemented

- Three roles (`ADMIN | BILLER | CUSTOMER`) enforced twice: by `ProtectedRoute` + `RoleGuard` in the UI, and by the
  mock services (`requireClaims`, `requireRole`, `assertInvoiceAccess`) as the API authorizer would. A customer opening
  another customer's invoice (or a draft) by URL gets "Invoice not found".
- Mock JWT-like token (30 min expiry) stored through `shared/lib/storage.ts` in `sessionStorage`. Expiry is checked on a
  timer, on window focus and on 401s; the user lands on `/login` with a "Session expired" notice.
- Catalog of 100 services / 50 features (search, category filter, sort, pagination, create/edit drawer), taxes with
  rate history timeline, customers, users, invoices, payments, audit log, dashboard.
- 4-step invoice wizard with a sticky live-totals panel; the cart persists in `localStorage` until saved or discarded.
- Invoice detail renders as a document; "Download receipt" opens a print-optimized view that calls `window.print()`.

## Folder map

```
src/
├─ app/            router (routes, ProtectedRoute, RoleGuard), providers, layouts (Auth, App, Sidebar, Topbar)
├─ features/       auth · dashboard · customers · catalog · taxes · users · invoices · payments · audit
│                  each: components/ pages/ hooks/ services/ [store/ lib/] types.ts index.ts
├─ shared/         components/ui (UI kit), hooks, lib (format, cn, storage, session, token, invoiceStatus), types, constants
docs/DOMAIN.md     entities, fields, relationships, screens
```

Rules followed: pages are thin; business logic is in hooks, `services/` and pure `lib/` functions; a feature only imports
another feature through its `index.ts`; every service function is async and marked `// TODO: replace with API Gateway call`.

Dependency direction between features: `invoices → payments, catalog, customers, taxes`; `catalog → taxes`;
`users → customers`; everything may use `auth`.

## Design decisions

- **Tax rounding**: each tax amount per line is rounded to 2 decimals and the line tax is the sum of those amounts, so the
  per-tax breakdown always adds up exactly to the invoice tax total.
- **Rate validity**: history entries are valid for `validFrom <= date < validTo` (end exclusive). A rate change closes the
  open entry at the new `validFrom`; future-dated changes are "scheduled" and do not alter `currentRate` until then.
- **Issuing** re-evaluates taxes at the issue instant, then snapshots amounts, issuer and receiver; later rate or price
  changes never alter an issued invoice. Folios are sequential per calendar year (`INV-2026-0001`).
- **Draft prices** use the service's current base price at save time (stored as line `unitPrice`).
- **Cancelling** requires a reason (min 5 characters) and is allowed for DRAFT and ISSUED only. A cancelled draft keeps no folio.
- **Payments** are simulated: method + confirm → `SIM-XXXXXX` reference, one full payment per ISSUED invoice. No card data is collected.
- **Administrators** also have Biller capabilities (create/issue/pay/cancel); they cannot deactivate or demote themselves.
- **Charts** are hand-written SVG (no chart dependency), with hover/focus values and a screen-reader description.
- Money uses `Intl.NumberFormat('en-MX', MXN)` in IBM Plex Sans with tabular figures, right-aligned; IBM Plex Mono is kept for folios, UUIDs, codes and payment references. Status is always label + dot, never color alone.
- **Dark mode**: follows the OS setting until the user flips the sun/moon toggle in the top bar (also on the login page). Sign out lives in the account card at the bottom of the sidebar. Theme colours are CSS variables (`src/index.css`) consumed by the Tailwind tokens, so `bg-primary/20`-style modifiers work in both themes. The preference is saved in `localStorage` (`billing.theme`), applied before the first render, and receipts always print in the light theme.
- **Quick switcher**: `Ctrl/⌘ + K` (or the search button in the top bar) jumps to pages, "Create new invoice" and any invoice the user can see, by folio, customer or UUID.
- Invoice lists show a money summary (outstanding / collected / drafts; for customers: amount due / paid to date). The invoice detail has a side panel with the amount, a lifecycle timeline, the payment and the customer.
- Dependencies are limited to the requested stack; fonts are bundled via `@fontsource` (no external requests).

## Backend real (API Gateway)

Los `services/*.ts` llaman a la API a través de `src/shared/lib/http.ts`. Ya no hay datos mock en el frontend:
todo viene del backend (`VITE_API_URL`) y las Lambdas (`VITE_LAMBDA_URL`).

```bash
cp .env.example .env     # VITE_API_URL=https://<id>.execute-api.<region>.amazonaws.com
npm run build            # genera dist/
aws s3 sync dist/ s3://<bucket> --delete
```

- Sin `VITE_API_URL` la app muestra "API URL is not configured".
- Los errores del backend (`{ code, message }`) se convierten en `ApiError` con los mismos códigos de antes.
  Un 401/403 sin `code` (rechazo del authorizer de API Gateway) se trata como sesión expirada.
- La app usa `BrowserRouter`: en S3 (static website hosting) configura el **error document** como
  `index.html`, o las URL profundas (`/invoices/inv_3`) darán 404 al recargar.
- La API debe permitir CORS desde el dominio del bucket (`Authorization` y `Content-Type`).
