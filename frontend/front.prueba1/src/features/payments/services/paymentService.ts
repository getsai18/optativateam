import { api } from '../../../shared/lib/http';
import type { Payment, PaymentMethod } from '../../../shared/types';

export async function listPayments(invoiceId: string): Promise<Payment[]> {
  return api<Payment[]>(`/invoices/${encodeURIComponent(invoiceId)}/payments`);
}

/**
 * One full, simulated payment per ISSUED invoice. No card data is ever collected:
 * only the chosen method is sent; the backend generates the SIM-XXXXXX reference.
 */
export async function registerPayment(invoiceId: string, method: PaymentMethod): Promise<Payment> {
  return api<Payment>(`/invoices/${encodeURIComponent(invoiceId)}/payments`, { method: 'POST', body: { method } });
}
