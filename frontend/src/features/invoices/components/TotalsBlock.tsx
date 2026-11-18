import { useI18n } from '../../../shared/i18n';
import { cn } from '../../../shared/lib/cn';
import { formatMoney } from '../../../shared/lib/format';
import type { TaxBreakdownRow } from '../types';

interface TotalsBlockProps {
  subtotal: number;
  taxTotal: number;
  total: number;
  breakdown: TaxBreakdownRow[];
  className?: string;
}

/** Subtotal, per-tax breakdown and grand total. Money is right-aligned, monospace and tabular. */
export function TotalsBlock({ subtotal, taxTotal, total, breakdown, className }: TotalsBlockProps) {
  const { t } = useI18n();
  return (
    <dl className={cn('flex flex-col gap-2 text-sm', className)}>
      <div className="flex justify-between gap-6">
        <dt className="text-muted">{t('invoices.totals.subtotal')}</dt>
        <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
      </div>
      {breakdown.map((row) => (
        <div key={row.key} className="flex justify-between gap-6">
          <dt className="text-muted">{row.label}</dt>
          <dd className="tabular-nums">{formatMoney(row.amount)}</dd>
        </div>
      ))}
      {breakdown.length > 1 ? (
        <div className="flex justify-between gap-6 border-t border-line pt-2">
          <dt className="text-muted">{t('invoices.totals.taxes')}</dt>
          <dd className="tabular-nums">{formatMoney(taxTotal)}</dd>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-6 border-t border-line pt-3 text-lg font-semibold">
        <dt>{t('invoices.totals.total')}</dt>
        <dd className="tabular-nums">{formatMoney(total)}</dd>
      </div>
    </dl>
  );
}
