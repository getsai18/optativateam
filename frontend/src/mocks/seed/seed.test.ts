import { describe, expect, it } from 'vitest';
import { SERVICE_CATEGORIES } from '../../shared/constants/labels';
import { buildSeed } from './index';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const db = buildSeed(NOW);

describe('seed data', () => {
  it('has the requested volumes', () => {
    expect(db.services).toHaveLength(100);
    expect(db.features).toHaveLength(50);
    expect(db.customers).toHaveLength(25);
    expect(db.invoices).toHaveLength(40);
    expect(db.users.filter((u) => u.role === 'ADMIN')).toHaveLength(1);
    expect(db.users.filter((u) => u.role === 'BILLER')).toHaveLength(2);
    expect(db.users.filter((u) => u.role === 'CUSTOMER')).toHaveLength(5);
  });

  it('spreads services over the 8 categories with 1-2 taxes and 3-6 features each', () => {
    SERVICE_CATEGORIES.forEach((c) => {
      const n = db.services.filter((s) => s.category === c).length;
      expect(n).toBeGreaterThanOrEqual(12);
      expect(n).toBeLessThanOrEqual(13);
    });
    db.services.forEach((s) => {
      expect(s.basePrice).toBeGreaterThanOrEqual(150);
      expect(s.basePrice).toBeLessThanOrEqual(25000);
      expect(s.taxIds.length).toBeGreaterThanOrEqual(1);
      expect(s.taxIds.length).toBeLessThanOrEqual(2);
      expect(s.features.length).toBeGreaterThanOrEqual(3);
      expect(s.features.length).toBeLessThanOrEqual(6);
    });
  });

  it('covers all four invoice statuses with consistent totals', () => {
    const statuses = new Set(db.invoices.map((i) => i.status));
    expect(statuses).toEqual(new Set(['DRAFT', 'ISSUED', 'PAID', 'CANCELLED']));
    db.invoices.forEach((i) => {
      const sub = Math.round(i.lines.reduce((s, l) => s + l.lineSubtotal, 0) * 100) / 100;
      expect(i.subtotal).toBe(sub);
      expect(Math.round((i.subtotal + i.taxTotal) * 100) / 100).toBe(i.total);
    });
  });

  it('gives issued invoices unique sequential folios and paid invoices one payment', () => {
    const folios = db.invoices.flatMap((i) => (i.folio ? [i.folio] : []));
    expect(new Set(folios).size).toBe(folios.length);
    db.invoices
      .filter((i) => i.status === 'PAID')
      .forEach((i) => expect(db.payments.filter((p) => p.invoiceId === i.id)).toHaveLength(1));
    db.invoices.filter((i) => i.status === 'DRAFT').forEach((i) => expect(i.folio).toBeNull());
  });

  it('is deterministic', () => {
    expect(buildSeed(NOW)).toEqual(db);
  });
});
