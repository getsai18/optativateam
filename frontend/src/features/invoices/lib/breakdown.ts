import { round2, formatPercent } from '../../../shared/lib/format';
import type { InvoiceLine, Tax } from '../../../shared/types';
import type { TaxBreakdownRow } from '../types';

/**
 * Per-tax breakdown of stored invoice lines, labelled like "VAT 16%".
 * Withheld taxes are negative. `discountPct` scales the amounts the same way the
 * backend does (the discount reduces the taxable base).
 */
export function breakdownFromLines(lines: InvoiceLine[], taxes: Tax[], discountPct = 0): TaxBreakdownRow[] {
  const names = new Map(taxes.map((t) => [t.id, t.name]));
  const rows = new Map<string, TaxBreakdownRow>();
  lines.forEach((line) =>
    line.taxes.forEach((t) => {
      const key = `${t.taxId}@${t.rate}`;
      const signed = t.kind === 'WITHHELD' ? -t.amount : t.amount;
      const existing = rows.get(key);
      if (existing) existing.amount = round2(existing.amount + signed);
      else rows.set(key, { key, label: `${names.get(t.taxId) ?? t.code} ${formatPercent(t.rate)}`, amount: signed });
    }),
  );
  return [...rows.values()]
    .map((row) => ({ ...row, amount: round2(row.amount * (1 - discountPct)) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function taxLabel(name: string | undefined, code: string, rate: number): string {
  return `${name ?? code} ${formatPercent(rate)}`;
}
