import { useI18n } from '../../../shared/i18n';
import { cn } from '../../../shared/lib/cn';
import { formatMoney, formatPercent } from '../../../shared/lib/format';
import type { TaxBreakdownRow } from '../types';

interface TotalsBlockProps {
  subtotal: number;
  /** Discount applied by the backend (sp_apply_discount). */
  discountPct?: number;
  discountTotal?: number;
  /** Transferred taxes (IVA, IEPS). */
  taxTotal: number;
  /** Withheld taxes (ISR, IVA retenido); subtracted from the total. */
  withholdingTotal?: number;
  total: number;
  /** Per-tax rows; withheld taxes come negative. */
  breakdown: TaxBreakdownRow[];
  /** Live preview: discounts are only known after saving. */
  discountNote?: boolean;
  className?: string;
}

/** Subtotal, discount, per-tax breakdown, withholdings and grand total. Money is right-aligned and tabular. */
export function TotalsBlock({
  subtotal,
  discountPct = 0,
  discountTotal = 0,
  taxTotal,
  withholdingTotal = 0,
  total,
  breakdown,
  discountNote = false,
  className,
}: TotalsBlockProps) {
  const { t } = useI18n();
  const transferred = breakdown.filter((row) => row.amount >= 0);
  return (
    <dl className={cn('flex flex-col gap-2 text-sm', className)}>
      <div className="flex justify-between gap-6">
        <dt className="text-muted">{t('invoices.totals.subtotal')}</dt>
        <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
      </div>
      {discountTotal > 0 ? (
        <div className="flex justify-between gap-6">
          <dt className="text-muted">
            {t('invoices.totals.discount')} {formatPercent(discountPct)}
          </dt>
          <dd className="tabular-nums">−{formatMoney(discountTotal)}</dd>
        </div>
      ) : null}
      {breakdown.map((row) => (
        <div key={row.key} className="flex justify-between gap-6">
          <dt className="text-muted">
            {row.amount < 0 ? `${t('invoices.totals.withheld')} ` : ''}
            {row.label}
          </dt>
          <dd className="tabular-nums">{row.amount < 0 ? `−${formatMoney(-row.amount)}` : formatMoney(row.amount)}</dd>
        </div>
      ))}
      {transferred.length > 1 ? (
        <div className="flex justify-between gap-6 border-t border-line pt-2">
          <dt className="text-muted">{t('invoices.totals.taxes')}</dt>
          <dd className="tabular-nums">{formatMoney(taxTotal)}</dd>
        </div>
      ) : null}
      {withholdingTotal > 0 ? (
        <div className="flex justify-between gap-6">
          <dt className="text-muted">{t('invoices.totals.withholdings')}</dt>
          <dd className="tabular-nums">−{formatMoney(withholdingTotal)}</dd>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-6 border-t border-line pt-3 text-lg font-semibold">
        <dt>{t('invoices.totals.total')}</dt>
        <dd className="tabular-nums">{formatMoney(total)}</dd>
      </div>
      {discountNote ? <p className="text-xs text-muted">{t('invoices.totals.discountNote')}</p> : null}
    </dl>
  );
}
