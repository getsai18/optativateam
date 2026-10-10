# Domain model

Source of truth: `src/shared/types/domain.ts`. Dates are ISO 8601 strings; money is a number in MXN rounded to 2 decimals;
rates are fractions (`0.16` = 16%). Persisted in the mock DB (`src/mocks/db.ts`, `localStorage` key `billing.db.v1`).

## Entities

### User
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `usr_…` |
| email | string | unique (case-insensitive) |
| fullName | string | |
| role | `ADMIN \| BILLER \| CUSTOMER` | |
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
| id | string | `tax_vat16`, `tax_vat0`, `tax_ieps` in the seed |
| code | string | `VAT16`, `VAT0`, `IEPS` |
| name | string | `VAT`, `VAT`, `IEPS`; invoices label it `name + rate`, e.g. "VAT 16%" |
| currentRate | number | rate whose history entry covers today |

Screens: Taxes (cards with rate history, change rate), Service form (tax assignment), Services list, invoice builder/document.

### TaxRateHistory
| Field | Type | Notes |
| --- | --- | --- |
| id | string | |
| taxId | string | → Tax.id |
| rate | number | |
| validFrom | string | inclusive |
| validTo | string \| null | exclusive; null = open ended (at most one open entry per tax) |

Changing a rate closes the open entry at the new `validFrom` and opens a new one (admin only, `tax.rate_change` audit).
Used by `calculateTotals` to pick the rate valid on the issue date. Screens: Taxes (timeline).

### Feature
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `feat_…` |
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
| basePrice | number | 150 – 25,000 in the seed |
| category | ServiceCategory | one of 8 categories |
| taxIds | string[] | 1–2 → Tax.id |
| features | `{ featureId, value }[]` | 3–6 in the seed, unique per feature |
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
| issuer | `{ name, taxId, address }` | fixed company constant (`shared/constants/company.ts`), snapshotted |
| receiver | `{ name, taxId, address }` | snapshot of the customer at save time |
| lines | InvoiceLine[] | |
| subtotal, taxTotal, total | number | sums of lines |
| createdAt, issuedAt, paidAt, cancelledAt | string \| null | |
| cancellationReason | string \| null | required to cancel |

Status flow: `DRAFT → ISSUED → PAID`; `DRAFT | ISSUED → CANCELLED`; PAID and CANCELLED are terminal; only DRAFT can be
edited or deleted (`shared/lib/invoiceStatus.ts`, unit-tested).
Screens: Dashboard, Invoices (list), My invoices (customer list), New/Edit invoice wizard, Invoice detail, Receipt (print).

### InvoiceLine
| Field | Type | Notes |
| --- | --- | --- |
| id | string | `L1`, `L2`, … inside the invoice |
| serviceId, serviceName | string | name is a snapshot |
| quantity | number | integer 1–9999 |
| unitPrice | number | snapshot of the base price |
| lineSubtotal | number | quantity × unitPrice |
| taxes | `{ taxId, code, rate, amount }[]` | rates and amounts frozen on issue |
| taxAmount | number | sum of `taxes[].amount` |
| lineTotal | number | lineSubtotal + taxAmount |

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

Written by every mutating service call. Screens: Audit log (admin, read-only; filter by user, action, date range).

## Client-only state (not part of the DB)
- **Session**: token claims `{ sub, email, name, role, customerId?, exp }` in `sessionStorage` (`billing.token`).
- **Invoice builder**: `{ invoiceId, customerId, lines: {serviceId, quantity}[], step }` in `localStorage`
  (`billing.invoiceBuilder.v1`) until the invoice is saved or discarded.
- **Theme**: `'light' | 'dark' | 'system'` in `localStorage` (`billing.theme`).

## Calculation (`features/invoices/lib/calculateTotals.ts`)
1. `lineSubtotal = round2(quantity × unitPrice)`
2. For each tax assigned to the service: `amount = round2(lineSubtotal × rate valid on the issue date)`
3. `taxAmount = Σ amounts`, `lineTotal = lineSubtotal + taxAmount`
4. Invoice `subtotal`, `taxTotal`, `total` = sums of the lines (rounded); breakdown per tax = sum of its amounts.

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

## Seed (`src/mocks/seed`)
100 services (12–13 per category), 50 features, 25 customers, 1 admin, 2 billers, 5 customer users, 40 invoices
(6 draft / 10 issued / 18 paid / 6 cancelled) over the last ~6 months with matching payments and audit entries.
Deterministic (mulberry32); dates are relative to the moment the seed is built.
