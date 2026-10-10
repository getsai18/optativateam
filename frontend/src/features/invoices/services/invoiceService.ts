import { mutate, query, type Db } from '../../../mocks/db';
import { assertInvoiceAccess, requireRole, writeAudit } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { ISSUER } from '../../../shared/constants/company';
import { ApiError } from '../../../shared/lib/errors';
import { newId, newUuid } from '../../../shared/lib/id';
import { canCancelInvoice, canDeleteInvoice, canEditInvoice, canIssueInvoice } from '../../../shared/lib/invoiceStatus';
import { requireClaims } from '../../../shared/lib/session';
import type { TokenClaims } from '../../../shared/lib/token';
import type { Invoice } from '../../../shared/types';
import { calculateTotals } from '../lib/calculateTotals';
import type { SaveDraftInput } from '../types';

// ---------------------------------------------------------------------------
// Internal helpers: operate on the DB inside a single mutate() call.
// ---------------------------------------------------------------------------

function pricedLines(db: Db, input: SaveDraftInput, asOf: Date) {
  if (input.lines.length === 0) throw new ApiError('VALIDATION', 'Add at least one service');
  const lines = input.lines.map((l) => {
    const service = db.services.find((s) => s.id === l.serviceId);
    if (!service || !service.active) throw new ApiError('VALIDATION', 'A selected service is no longer available');
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 9999) {
      throw new ApiError('VALIDATION', 'Quantities must be whole numbers between 1 and 9999');
    }
    return {
      serviceId: service.id,
      serviceName: service.name,
      quantity: l.quantity,
      unitPrice: service.basePrice,
      taxIds: service.taxIds,
    };
  });
  return calculateTotals(lines, db.taxes, db.taxHistory, asOf);
}

function persistDraft(db: Db, claims: TokenClaims, input: SaveDraftInput): Invoice {
  const customer = db.customers.find((c) => c.id === input.customerId);
  if (!customer || !customer.active) throw new ApiError('VALIDATION', 'Choose an active customer');
  const now = new Date();
  const totals = pricedLines(db, input, now);
  const receiver = { name: customer.name, taxId: customer.taxId, address: customer.address };

  if (input.id) {
    const invoice = db.invoices.find((i) => i.id === input.id);
    if (!invoice) throw new ApiError('NOT_FOUND', 'Invoice not found');
    if (!canEditInvoice(invoice.status)) throw new ApiError('CONFLICT', 'Only draft invoices can be edited');
    Object.assign(invoice, {
      customerId: customer.id,
      receiver,
      lines: totals.lines,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
    });
    writeAudit(db, claims, 'invoice.update', 'invoice', invoice.id);
    return invoice;
  }

  const invoice: Invoice = {
    id: newId('inv'),
    folio: null,
    uuid: null,
    status: 'DRAFT',
    customerId: customer.id,
    createdBy: claims.sub,
    issuer: { ...ISSUER },
    receiver,
    lines: totals.lines,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    createdAt: now.toISOString(),
    issuedAt: null,
    paidAt: null,
    cancelledAt: null,
    cancellationReason: null,
  };
  db.invoices.push(invoice);
  writeAudit(db, claims, 'invoice.create', 'invoice', invoice.id);
  return invoice;
}

/** "Symbolic stamping": folio + UUID, taxes re-evaluated at the issue date, then locked. */
function stamp(db: Db, claims: TokenClaims, invoiceId: string): Invoice {
  const invoice = db.invoices.find((i) => i.id === invoiceId);
  if (!invoice) throw new ApiError('NOT_FOUND', 'Invoice not found');
  if (!canIssueInvoice(invoice.status)) throw new ApiError('CONFLICT', 'Only draft invoices can be issued');

  const now = new Date();
  const totals = calculateTotals(
    invoice.lines.map((l) => ({
      serviceId: l.serviceId,
      serviceName: l.serviceName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxIds: db.services.find((s) => s.id === l.serviceId)?.taxIds ?? l.taxes.map((t) => t.taxId),
    })),
    db.taxes,
    db.taxHistory,
    now,
  );

  const year = now.toISOString().slice(0, 4);
  const next = (db.folioCounters[year] ?? 0) + 1;
  db.folioCounters[year] = next;

  Object.assign(invoice, {
    status: 'ISSUED',
    folio: `INV-${year}-${String(next).padStart(4, '0')}`,
    uuid: newUuid(),
    issuedAt: now.toISOString(),
    lines: totals.lines,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
  } satisfies Partial<Invoice>);
  writeAudit(db, claims, 'invoice.issue', 'invoice', invoice.id);
  return invoice;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// TODO: replace with API Gateway call (GET /invoices)
export async function listInvoices(): Promise<Invoice[]> {
  await latency();
  const claims = requireClaims();
  return query((db) => {
    const rows =
      claims.role === 'CUSTOMER'
        ? db.invoices.filter((i) => i.customerId === claims.customerId && i.status !== 'DRAFT')
        : db.invoices;
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

// TODO: replace with API Gateway call (GET /invoices/{id})
export async function getInvoice(id: string): Promise<Invoice> {
  await latency();
  const claims = requireClaims();
  return query((db) => assertInvoiceAccess(claims, db.invoices.find((i) => i.id === id)));
}

// TODO: replace with API Gateway call (POST /invoices, PUT /invoices/{id})
export async function saveDraft(input: SaveDraftInput): Promise<Invoice> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return mutate((db) => persistDraft(db, claims, input));
}

// TODO: replace with API Gateway call (POST /invoices/{id}/issue)
export async function issueInvoice(id: string): Promise<Invoice> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return mutate((db) => stamp(db, claims, id));
}

/** Wizard step 4: save the builder as a draft and issue it in one call. */
// TODO: replace with API Gateway call (POST /invoices?issue=true)
export async function saveAndIssue(input: SaveDraftInput): Promise<Invoice> {
  await latency(250, 500);
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return mutate((db) => {
    const draft = persistDraft(db, claims, input);
    return stamp(db, claims, draft.id);
  });
}

// TODO: replace with API Gateway call (POST /invoices/{id}/cancel)
export async function cancelInvoice(id: string, reason: string): Promise<Invoice> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  const trimmed = reason.trim();
  if (trimmed.length < 5) throw new ApiError('VALIDATION', 'A cancellation reason is required');
  return mutate((db) => {
    const invoice = db.invoices.find((i) => i.id === id);
    if (!invoice) throw new ApiError('NOT_FOUND', 'Invoice not found');
    if (!canCancelInvoice(invoice.status)) {
      throw new ApiError('CONFLICT', 'Paid or already cancelled invoices cannot be cancelled');
    }
    invoice.status = 'CANCELLED';
    invoice.cancelledAt = new Date().toISOString();
    invoice.cancellationReason = trimmed;
    writeAudit(db, claims, 'invoice.cancel', 'invoice', id);
    return invoice;
  });
}

// TODO: replace with API Gateway call (DELETE /invoices/{id})
export async function deleteDraft(id: string): Promise<void> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  mutate((db) => {
    const invoice = db.invoices.find((i) => i.id === id);
    if (!invoice) throw new ApiError('NOT_FOUND', 'Invoice not found');
    if (!canDeleteInvoice(invoice.status)) throw new ApiError('CONFLICT', 'Only draft invoices can be deleted');
    db.invoices = db.invoices.filter((i) => i.id !== id);
    writeAudit(db, claims, 'invoice.delete', 'invoice', id);
  });
}
