import { round2, toDateKey } from '../../../shared/lib/format';
import type { InvoiceLine, Tax, TaxRateHistory } from '../../../shared/types';

export interface TotalsLineInput {
  serviceId: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  taxIds: string[];
}

export interface TaxBreakdownEntry {
  taxId: string;
  code: string;
  name: string;
  rate: number;
  /** sum of the line subtotals this tax applies to */
  base: number;
  amount: number;
}

export interface TotalsResult {
  lines: InvoiceLine[];
  subtotal: number;
  taxTotal: number;
  total: number;
  breakdown: TaxBreakdownEntry[];
}

/**
 * Rate of a tax on a given date. History entries are valid for `validFrom <= date < validTo`
 * (validTo exclusive). Falls back to the tax's current rate when no entry covers the date.
 */
export function rateOnDate(tax: Tax, history: TaxRateHistory[], asOf: string | Date): number {
  const day = toDateKey(asOf);
  const entry = history.find(
    (h) => h.taxId === tax.id && h.validFrom.slice(0, 10) <= day && (h.validTo === null || day < h.validTo.slice(0, 10)),
  );
  return entry ? entry.rate : tax.currentRate;
}

/**
 * Pure invoice calculation.
 *  - line subtotal = quantity x unit price
 *  - each assigned tax amount = round2(line subtotal x rate valid on `asOf`)
 *  - line tax = sum of its tax amounts (so the per-tax breakdown always adds up to the total)
 *  - invoice subtotal / tax total / total = sums of the lines, rounded to 2 decimals
 */
export function calculateTotals(
  lines: TotalsLineInput[],
  taxes: Tax[],
  history: TaxRateHistory[],
  asOf: string | Date,
): TotalsResult {
  const taxById = new Map(taxes.map((t) => [t.id, t]));
  const breakdown = new Map<string, TaxBreakdownEntry>();

  const computed: InvoiceLine[] = lines.map((input, index) => {
    const lineSubtotal = round2(input.quantity * input.unitPrice);
    const lineTaxes = input.taxIds.flatMap((taxId) => {
      const tax = taxById.get(taxId);
      if (!tax) return [];
      const rate = rateOnDate(tax, history, asOf);
      const amount = round2(lineSubtotal * rate);

      const entry = breakdown.get(tax.id) ?? {
        taxId: tax.id,
        code: tax.code,
        name: tax.name,
        rate,
        base: 0,
        amount: 0,
      };
      entry.base = round2(entry.base + lineSubtotal);
      entry.amount = round2(entry.amount + amount);
      breakdown.set(tax.id, entry);

      return [{ taxId: tax.id, code: tax.code, rate, amount }];
    });
    const taxAmount = round2(lineTaxes.reduce((sum, t) => sum + t.amount, 0));
    return {
      id: `L${index + 1}`,
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      lineSubtotal,
      taxes: lineTaxes,
      taxAmount,
      lineTotal: round2(lineSubtotal + taxAmount),
    };
  });

  const subtotal = round2(computed.reduce((sum, l) => sum + l.lineSubtotal, 0));
  const taxTotal = round2(computed.reduce((sum, l) => sum + l.taxAmount, 0));
  return {
    lines: computed,
    subtotal,
    taxTotal,
    total: round2(subtotal + taxTotal),
    breakdown: [...breakdown.values()].sort((a, b) => a.code.localeCompare(b.code)),
  };
}
