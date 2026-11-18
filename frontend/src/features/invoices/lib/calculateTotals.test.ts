import { describe, expect, it } from 'vitest';
import type { Tax, TaxRateHistory } from '../../../shared/types';
import { calculateTotals, rateOnDate } from './calculateTotals';

const VAT: Tax = { id: 'vat16', code: 'VAT16', name: 'VAT', currentRate: 0.16 };
const IEPS: Tax = { id: 'ieps', code: 'IEPS', name: 'IEPS', currentRate: 0.03 };
const taxes = [VAT, IEPS];

const history: TaxRateHistory[] = [
  { id: 'h1', taxId: 'vat16', rate: 0.16, validFrom: '2020-01-01', validTo: null },
  { id: 'h2', taxId: 'ieps', rate: 0.025, validFrom: '2024-01-01', validTo: '2026-03-01' },
  { id: 'h3', taxId: 'ieps', rate: 0.03, validFrom: '2026-03-01', validTo: null },
];

describe('rateOnDate', () => {
  it('picks the history entry valid on the date', () => {
    expect(rateOnDate(IEPS, history, '2026-02-28')).toBe(0.025);
    expect(rateOnDate(IEPS, history, '2026-03-01')).toBe(0.03);
  });

  it('falls back to the current rate without history', () => {
    expect(rateOnDate(VAT, [], '2026-05-01')).toBe(0.16);
  });
});

describe('calculateTotals', () => {
  it('computes line subtotal, tax and total', () => {
    const r = calculateTotals(
      [{ serviceId: 's1', serviceName: 'Hosting', quantity: 3, unitPrice: 1000, taxIds: ['vat16'] }],
      taxes,
      history,
      '2026-05-10',
    );
    const line = r.lines[0];
    expect(line?.lineSubtotal).toBe(3000);
    expect(line?.taxAmount).toBe(480);
    expect(line?.lineTotal).toBe(3480);
    expect(r.subtotal).toBe(3000);
    expect(r.taxTotal).toBe(480);
    expect(r.total).toBe(3480);
  });

  it('sums the rates of several taxes assigned to one service', () => {
    const r = calculateTotals(
      [{ serviceId: 's1', serviceName: 'License', quantity: 1, unitPrice: 1000, taxIds: ['vat16', 'ieps'] }],
      taxes,
      history,
      '2026-05-10',
    );
    expect(r.lines[0]?.taxAmount).toBe(190); // 16% + 3%
    expect(r.total).toBe(1190);
  });

  it('uses the rate valid on the issue date, not the current rate', () => {
    const input = [{ serviceId: 's1', serviceName: 'License', quantity: 1, unitPrice: 1000, taxIds: ['ieps'] }];
    expect(calculateTotals(input, taxes, history, '2026-01-15').taxTotal).toBe(25);
    expect(calculateTotals(input, taxes, history, '2026-06-15').taxTotal).toBe(30);
  });

  it('rounds to two decimals', () => {
    const r = calculateTotals(
      [{ serviceId: 's1', serviceName: 'Item', quantity: 3, unitPrice: 33.33, taxIds: ['vat16'] }],
      taxes,
      history,
      '2026-05-10',
    );
    expect(r.lines[0]?.lineSubtotal).toBe(99.99);
    expect(r.lines[0]?.taxAmount).toBe(16); // 15.9984
    expect(r.total).toBe(115.99);
  });

  it('builds a per-tax breakdown that adds up to the tax total', () => {
    const r = calculateTotals(
      [
        { serviceId: 's1', serviceName: 'A', quantity: 2, unitPrice: 500, taxIds: ['vat16'] },
        { serviceId: 's2', serviceName: 'B', quantity: 1, unitPrice: 2000, taxIds: ['vat16', 'ieps'] },
      ],
      taxes,
      history,
      '2026-05-10',
    );
    const vat = r.breakdown.find((b) => b.taxId === 'vat16');
    const ieps = r.breakdown.find((b) => b.taxId === 'ieps');
    expect(vat?.base).toBe(3000);
    expect(vat?.amount).toBe(480);
    expect(ieps?.amount).toBe(60);
    expect(r.breakdown.reduce((s, b) => s + b.amount, 0)).toBe(r.taxTotal);
  });

  it('returns zeros for an empty cart', () => {
    const r = calculateTotals([], taxes, history, '2026-05-10');
    expect(r.total).toBe(0);
    expect(r.breakdown).toEqual([]);
  });
});
