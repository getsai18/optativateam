import { mutate, query } from '../../../mocks/db';
import { assertInvoiceAccess, requireRole, writeAudit } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { ApiError } from '../../../shared/lib/errors';
import { newId, newPaymentReference } from '../../../shared/lib/id';
import { canPayInvoice } from '../../../shared/lib/invoiceStatus';
import { requireClaims } from '../../../shared/lib/session';
import type { Payment, PaymentMethod } from '../../../shared/types';

// TODO: replace with API Gateway call (GET /invoices/{id}/payments)
export async function listPayments(invoiceId: string): Promise<Payment[]> {
  await latency();
  const claims = requireClaims();
  return query((db) => {
    assertInvoiceAccess(claims, db.invoices.find((i) => i.id === invoiceId));
    return db.payments.filter((p) => p.invoiceId === invoiceId);
  });
}

/**
 * One full, simulated payment per ISSUED invoice. No card data is ever collected:
 * the app only records the chosen method and generates a reference.
 */
// TODO: replace with API Gateway call (POST /invoices/{id}/payments)
export async function registerPayment(invoiceId: string, method: PaymentMethod): Promise<Payment> {
  await latency(250, 600);
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return mutate((db) => {
    const invoice = db.invoices.find((i) => i.id === invoiceId);
    if (!invoice) throw new ApiError('NOT_FOUND', 'Invoice not found');
    if (!canPayInvoice(invoice.status)) {
      throw new ApiError('CONFLICT', 'Only issued invoices can be paid');
    }
    if (db.payments.some((p) => p.invoiceId === invoiceId)) {
      throw new ApiError('CONFLICT', 'This invoice already has a payment');
    }
    const now = new Date().toISOString();
    const payment: Payment = {
      id: newId('pay'),
      invoiceId,
      method,
      amount: invoice.total,
      reference: newPaymentReference(),
      paidAt: now,
      registeredBy: claims.sub,
    };
    db.payments.push(payment);
    invoice.status = 'PAID';
    invoice.paidAt = now;
    writeAudit(db, claims, 'invoice.pay', 'invoice', invoiceId);
    return payment;
  });
}
