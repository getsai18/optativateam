import { describe, expect, it } from 'vitest';
import {
  canCancelInvoice,
  canDeleteInvoice,
  canEditInvoice,
  canIssueInvoice,
  canPayInvoice,
  canTransition,
} from './invoiceStatus';

describe('invoice status transitions', () => {
  it('allows the happy path DRAFT -> ISSUED -> PAID', () => {
    expect(canTransition('DRAFT', 'ISSUED')).toBe(true);
    expect(canTransition('ISSUED', 'PAID')).toBe(true);
  });

  it('cannot skip steps', () => {
    expect(canTransition('DRAFT', 'PAID')).toBe(false);
  });

  it('allows cancelling DRAFT and ISSUED only', () => {
    expect(canCancelInvoice('DRAFT')).toBe(true);
    expect(canCancelInvoice('ISSUED')).toBe(true);
    expect(canCancelInvoice('PAID')).toBe(false);
    expect(canCancelInvoice('CANCELLED')).toBe(false);
  });

  it('treats PAID and CANCELLED as terminal', () => {
    for (const to of ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'] as const) {
      expect(canTransition('PAID', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });

  it('only DRAFT invoices are editable and deletable', () => {
    expect(canEditInvoice('DRAFT')).toBe(true);
    expect(canDeleteInvoice('DRAFT')).toBe(true);
    for (const s of ['ISSUED', 'PAID', 'CANCELLED'] as const) {
      expect(canEditInvoice(s)).toBe(false);
      expect(canDeleteInvoice(s)).toBe(false);
    }
  });

  it('only ISSUED invoices can be paid, only DRAFT can be issued', () => {
    expect(canPayInvoice('ISSUED')).toBe(true);
    expect(canPayInvoice('DRAFT')).toBe(false);
    expect(canIssueInvoice('DRAFT')).toBe(true);
    expect(canIssueInvoice('ISSUED')).toBe(false);
  });
});
