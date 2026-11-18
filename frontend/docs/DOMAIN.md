# Domain model

Source of truth: `src/shared/types/domain.ts`. Dates are ISO 8601 strings; money is a number in MXN rounded to 2 decimals;
rates are fractions (`0.16` = 16%).

## Persistence (real backend)

The frontend does **not** store business data in the browser. Every read and write goes through
`shared/lib/http.ts` (`api()`), which sends JSON to the Flask backend (`VITE_API_URL`, e.g.
`http://127.0.0.1:5000` locally) or to API Gateway / the Lambdas (`VITE_LAMBDA_URL` in AWS).
The API contract is [`docs/openapi.yaml`](../../docs/openapi.yaml); transactional writes are executed
by Stored Procedures called from the backend ([`backend/README.md`](../../backend/README.md)).

| Store | Data it owns | Model |
| --- | --- | --- |
| RDS MySQL 8.4 (facturación) | users and normalized roles, customers, issuer, invoices and lines, folio counters, payments, discount rules, accounting entries, fiscal closings | [docs/03 — DER MySQL](../../docs/03-modelo-rds-mysql.md) |
| RDS PostgreSQL 18 (catálogo) | taxes and rate history, services and price history, features, `service_feature`, `service_tax` | [docs/04 — DER PostgreSQL](../../docs/04-modelo-rds-postgres.md) |
| DynamoDB | audit log, cart, sessions and invoice events | [docs/05 — Modelo DynamoDB](../../docs/05-modelo-dynamodb.md) |

The API exposes prefixed string IDs (`usr_3`, `cus_15`, `svc_7`, `feat_2`, `inv_4`, `tax_1`, `pay_9`, …)
that decode to the numeric primary keys of those stores. Cross-engine references (for example,
`InvoiceLine.serviceId` → PostgreSQL `service.id`) are logical: MySQL keeps name, price and tax snapshots
so an issued invoice never changes when the catalog changes.

## Entities

### User
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `usr_…` (MySQL `app_user.id`) |
| email | string | unique (case-insensitive) |
| fullName | string | |
| role | `ADMIN \| BILLER \| CUSTOMER` | MySQL `app_user.role`; `role_id` is the normalized FK to `app_role` |
| customerId | string? | required when role is CUSTOMER → `Customer.id` |
| active | boolean | inactive users cannot sign in |

Screens: Login (authentication), Users (admin CRUD), Audit log (actor name), Topbar user menu.

### Customer
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `cus_…` |
| name | string | |
| taxId | string | unique, format `AAA999999XXX` (3–4 letters, 6 digits, 3 alphanumerics) |
| email | string | |
| phone | string? | |
| address | string | |
| active | boolean | only active customers can be selected on new invoices |

Relationships: 1 customer → n invoices; 1 customer → n customer users.
Screens: Customers (admin edit, biller create/view), New invoice step 1, Users (link), Invoice document ("Bill to").

### Tax
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `tax_…` (PostgreSQL `tax.id`) |
| code | string | `VAT16`, `VAT0`, `IEPS`, `RET_ISR`, `RET_IVA` |
| name | string | invoices label it `name + rate`, e.g. "VAT 16%" |
| currentRate | number | rate whose history entry covers today |
| kind | `TRANSFER \| WITHHELD` | transferred taxes add to the total, withheld taxes subtract |

Screens: Taxes (cards with rate history, change rate), Service form (tax assignment), Services list, invoice builder/document.

### TaxRateHistory
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `txh_…` |
| taxId | string | → Tax.id |
| rate | number | |
| validFrom | string | inclusive |
| validTo | string \| null | exclusive; null = open ended (at most one open entry per tax) |

Changing a rate closes the open entry at the new `validFrom` and opens a new one (admin only, `tax.rate_change` audit).
Used by `calculateTotals` to pick the rate valid on the issue date. Screens: Taxes (timeline).

### Feature
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `feat_…` (PostgreSQL `feature.id`) |
| name | string | unique |
| description | string | |
| unit | string? | e.g. `GB`, `days` |

A feature cannot be deleted while assigned to a service. Screens: Features (admin CRUD), Service form, service preview drawer.

### Service
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `svc_…` |
| code | string | unique (case-insensitive) |
| name, description | string | |
| basePrice | number | from the PostgreSQL catalog (450 – 192,000 in the seeded catalog) |
| category | ServiceCategory | one of 8 categories |
| taxIds | string[] | 1–2 → Tax.id |
| features | `{ featureId, value }[]` | typically 3–6 in the seeded catalog, unique per feature |
| active | boolean | inactive services cannot be added to invoices |

Screens: Services (admin CRUD, biller read-only), New invoice step 2 (+ feature preview drawer), Features (usage count).

### Invoice
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `inv_…` |
| folio | string \| null | `INV-YYYY-NNNN`, assigned on issue, sequential per year |
| uuid | string \| null | v4, assigned on issue |
| status | `DRAFT \| ISSUED \| PAID \| CANCELLED` | see flow below |
| customerId | string | → Customer.id |
| createdBy | string | → User.id |
| issuer | `{ name, taxId, address }` | snapshot of the MySQL `issuer` row returned by the API |
| receiver | `{ name, taxId, address }` | snapshot of the customer at save time |
| lines | InvoiceLine[] | |
| subtotal, taxTotal, withholdingTotal, total | number | sums of the lines |
| discountPct, discountTotal | number? | applied by the backend (`sp_apply_discount`) when saving |
| createdAt, issuedAt, paidAt, cancelledAt | string \| null | |
| cancellationReason | string \| null | required to cancel |

Status flow: `DRAFT → ISSUED → PAID`; `DRAFT | ISSUED → CANCELLED`; PAID and CANCELLED are terminal; only DRAFT can be
edited or deleted (`shared/lib/invoiceStatus.ts`, unit-tested). Screens: Dashboard, Invoices (list), My invoices
(customer list), New/Edit invoice wizard, Invoice detail, Receipt (print).

### InvoiceLine
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `L1`, `L2`, … inside the invoice |
| serviceId, serviceName | string | name is a snapshot of the PostgreSQL service |
| quantity | number | integer 1–9999 |
| unitPrice | number | snapshot of the service base price |
| lineSubtotal | number | quantity × unitPrice |
| taxes | `{ taxId, code, kind, rate, amount }[]` | rates and amounts frozen on issue |
| taxAmount | number | sum of transferred `taxes[].amount` |
| withholdingAmount | number | sum of withheld `taxes[].amount` |
| lineTotal | number | lineSubtotal + taxAmount − withholdingAmount |

### Payment
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `pay_…` |
| invoiceId | string | → Invoice.id (one payment per invoice) |
| method | `CARD \| TRANSFER \| CASH` | UI: Credit/Debit Card, Bank Transfer, Cash |
| amount | number | always the invoice total |
| reference | string | simulated, `SIM-XXXXXX` |
| paidAt | string | |
| registeredBy | string | → User.id |

Screens: Register payment dialog, Invoice detail (payment history), Receipt.

### AuditEntry
| Field | Type | Notes |
| --- | --- | --- |
| id | string | |
| userId | string | → User.id |
| action | string | `<entity>.<verb>`: `invoice.create/update/issue/pay/cancel/delete`, `customer.create/update`, `service.*`, `feature.*`, `user.*`, `tax.rate_change` |
| entityType, entityId | string | |
| timestamp | string | |

Written by every mutating service call into the DynamoDB audit table; the wizard cart and sessions also live in DynamoDB.
Screens: Audit log (admin, read-only; filter by user, action, date range).

## Data loading (real seed scripts)

The catalog and customers are versioned DML under `database/`; invoices are generated at runtime, not versioned:

- `database/seed/generate_seed.py` regenerates `database/postgres/04_seed_catalog.sql` (104 services, 50 features,
  419 service–feature assignments) and `database/mysql/04_seed_customers.sql` (40 customers).
- `python database/apply.py --seed` applies that DML, the schema extensions and the Stored Procedures.
- `python database/seed/seed_invoices.py` generates the invoice history (default 150 invoices over ~6 months,
  with payments, accounting entries and fiscal closings) by calling the Stored Procedures.

## Client-only state (never a database)

- **Session**: token claims `{ sub, email, name, role, customerId?, exp }` in `sessionStorage` (`billing.token`).
- **Invoice builder**: `{ invoiceId, customerId, lines: {serviceId, quantity}[], step }` in `localStorage`
  (`billing.invoiceBuilder.v1`) until the invoice is saved or discarded through the API.
- **Theme**: `'light' | 'dark' | 'system'` in `localStorage` (`billing.theme`).

## Calculation (`features/invoices/lib/calculateTotals.ts`)

1. `lineSubtotal = round2(quantity × unitPrice)`
2. For each tax assigned to the service: `amount = round2(lineSubtotal × rate valid on the issue date)`
3. Transferred taxes (`TRANSFER`) sum into `taxAmount`; withheld taxes (`WITHHELD`) sum into
   `withholdingAmount`; `lineTotal = lineSubtotal + taxAmount − withholdingAmount`
4. Invoice `subtotal`, `taxTotal`, `withholdingTotal`, `total` = sums of the lines (rounded); breakdown per tax =
   sum of its amounts.
5. Customer/volume discounts are **not** computed here: the backend applies `sp_apply_discount` when saving, so
   `total = subtotal − discountTotal + taxTotal − withholdingTotal` on a persisted invoice.

This is a preview for the wizard; the Flask backend + Stored Procedures recalculate and persist the authoritative totals.

## Authorization matrix
| Capability | ADMIN | BILLER | CUSTOMER |
| --- | :-: | :-: | :-: |
| Dashboard | full | lite | – |
| Customers | CRUD | create, view | – |
| Services | CRUD | read-only | – |
| Features, Taxes, Users, Audit log | ✔ | – | – |
| Invoices: list/view | all | all | own, non-draft |
| Invoices: create/edit draft/issue/pay/cancel | ✔ | ✔ | – |
| Download receipt | ✔ | ✔ | own |
