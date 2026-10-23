import { round2, formatPercent } from '../../../shared/lib/format';
import type { InvoiceLine, Tax } from '../../../shared/types';
import type { TaxBreakdownRow } from '../types';

/** Per-tax breakdown of stored invoice lines, labelled like "VAT 16%". */
export function breakdownFromLines(lines: InvoiceLine[], taxes: Tax[]): TaxBreakdownRow[] {
  const names = new Map(taxes.map((t) => [t.id, t.name]));
  const rows = new Map<string, TaxBreakdownRow>();
  lines.forEach((line) =>
    line.taxes.forEach((t) => {
      const key = `${t.taxId}@${t.rate}`;
      const existing = rows.get(key);
      if (existing) existing.amount = round2(existing.amount + t.amount);
      else rows.set(key, { key, label: `${names.get(t.taxId) ?? t.code} ${formatPercent(t.rate)}`, amount: t.amount });
    }),
  );
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function taxLabel(name: string | undefined, code: string, rate: number): string {
  return `${name ?? code} ${formatPercent(rate)}`;
}
