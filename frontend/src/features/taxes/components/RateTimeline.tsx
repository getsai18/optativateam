import { formatDate, formatPercent } from '../../../shared/lib/format';
import { cn } from '../../../shared/lib/cn';
import { Badge } from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
import type { TaxRateHistory } from '../../../shared/types';

export function RateTimeline({ entries }: { entries: TaxRateHistory[] }) {
  const { t } = useI18n();
  const sorted = [...entries].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ol className="flex flex-col" aria-label={t('taxes.timeline.label')}>
      {sorted.map((e, i) => {
        const current = e.validFrom.slice(0, 10) <= today && (e.validTo === null || today < e.validTo.slice(0, 10));
        const scheduled = e.validFrom.slice(0, 10) > today;
        return (
          <li key={e.id} className="relative flex gap-4 pb-4 last:pb-0">
            <span aria-hidden="true" className={cn('relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2', current ? 'border-primary bg-primary' : 'border-muted bg-surface')} />
            {i < sorted.length - 1 ? <span aria-hidden="true" className="absolute left-[4px] top-4 h-full w-px bg-line" /> : null}
            <div className="flex flex-1 flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium tabular-nums">{formatPercent(e.rate)}</span>
                {current ? <Badge tone="primary">{t('taxes.timeline.current')}</Badge> : null}
                {scheduled ? <Badge tone="accent">{t('taxes.timeline.scheduled')}</Badge> : null}
              </div>
              <span className="text-sm text-muted">
                {formatDate(e.validFrom)} → {e.validTo ? formatDate(e.validTo) : t('taxes.timeline.open')}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
