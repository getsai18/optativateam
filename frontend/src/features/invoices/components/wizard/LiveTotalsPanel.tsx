import { Panel, PanelHeader } from '../../../../shared/components/ui';
import { formatPercent } from '../../../../shared/lib/format';
import { useBuilderStore } from '../../store/builderStore';
import type { BuilderView } from '../../hooks/useBuilderTotals';
import { TotalsBlock } from '../TotalsBlock';

/** Sticky summary shown beside every wizard step. */
export function LiveTotalsPanel({ view }: { view: BuilderView }) {
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
      <PanelHeader title="Invoice summary" description="Updates as you build" />
      <div className="flex flex-col gap-4 p-5">
        <div>
          <p className="text-xs font-medium text-muted">Customer</p>
          <p className="text-sm font-medium" title={customer?.name}>
            {customer?.name ?? <span className="text-muted">Not selected</span>}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Lines</p>
          <p className="text-sm">
            <span className="font-mono tabular-nums">{lines.length}</span> service{lines.length === 1 ? '' : 's'},{' '}
            <span className="font-mono tabular-nums">{itemCount}</span> unit{itemCount === 1 ? '' : 's'}
          </p>
        </div>
        <TotalsBlock subtotal={totals.subtotal} taxTotal={totals.taxTotal} total={totals.total} breakdown={breakdown} />
        <p className="text-xs text-muted">Taxes use the rates valid today; they are fixed when the invoice is issued.</p>
      </div>
    </Panel>
  );
}
