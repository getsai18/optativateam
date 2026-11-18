import { Panel, PanelHeader } from '../../../../shared/components/ui';
import { useI18n } from '../../../../shared/i18n';
import { formatPercent } from '../../../../shared/lib/format';
import { useBuilderStore } from '../../store/builderStore';
import type { BuilderView } from '../../hooks/useBuilderTotals';
import { TotalsBlock } from '../TotalsBlock';

/** Sticky summary shown beside every wizard step. */
export function LiveTotalsPanel({ view }: { view: BuilderView }) {
  const { t, tn } = useI18n();
  const lines = useBuilderStore((s) => s.lines);
  const { totals, customer } = view;
  const breakdown = totals.breakdown.map((b) => ({
    key: b.taxId,
    label: `${view.taxNames.get(b.taxId) ?? b.code} ${formatPercent(b.rate)}`,
    amount: b.amount,
  }));
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Panel className="lg:sticky lg:top-20">
      <PanelHeader title={t('invoices.summary.title')} description={t('invoices.summary.subtitle')} />
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="text-sm font-medium text-muted">{t('invoices.summary.customer')}</p>
          {customer ? (
            <div className="mt-1">
              <p className="text-sm font-medium" title={customer.name}>
                {customer.name}
              </p>
              <p className="font-mono text-xs text-muted">{customer.taxId}</p>
              <p className="mt-0.5 text-xs text-muted">{customer.address}</p>
            </div>
          ) : (
            <p className="mt-1 rounded-control bg-paper px-3 py-2 text-sm text-muted">{t('invoices.summary.selectCustomer')}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-muted">{t('invoices.summary.lines')}</p>
          <p className="text-sm">
            <span className="font-mono tabular-nums">{lines.length}</span> {tn('invoices.summary.serviceCount', lines.length)},{' '}
            <span className="font-mono tabular-nums">{itemCount}</span> {tn('invoices.summary.unitCount', itemCount)}
          </p>
        </div>
        <div className="rounded-control border border-line/70 bg-paper p-4">
          <p className="text-sm font-medium text-ink">{t('invoices.summary.willIssue.title')}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            <li>{t('invoices.summary.willIssue.folio')}</li>
            <li>{t('invoices.summary.willIssue.uuid')}</li>
            <li>{t('invoices.summary.willIssue.taxes')}</li>
            <li>{t('invoices.summary.willIssue.lock')}</li>
          </ul>
        </div>
        <TotalsBlock subtotal={totals.subtotal} taxTotal={totals.taxTotal} total={totals.total} breakdown={breakdown} />
        <p className="text-sm text-muted">{t('invoices.summary.taxesNote')}</p>
      </div>
    </Panel>
  );
}
