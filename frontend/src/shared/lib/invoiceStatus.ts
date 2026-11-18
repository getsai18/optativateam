import type { InvoiceStatus } from '../types';

/** Allowed status transitions: DRAFT -> ISSUED -> PAID, DRAFT/ISSUED -> CANCELLED. */
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const canEditInvoice = (s: InvoiceStatus): boolean => s === 'DRAFT';
export const canDeleteInvoice = (s: InvoiceStatus): boolean => s === 'DRAFT';
export const canIssueInvoice = (s: InvoiceStatus): boolean => canTransition(s, 'ISSUED');
export const canPayInvoice = (s: InvoiceStatus): boolean => canTransition(s, 'PAID');
export const canCancelInvoice = (s: InvoiceStatus): boolean => canTransition(s, 'CANCELLED');
