import { Trash2 } from 'lucide-react';
import { Button, EmptyState } from '../../../../shared/components/ui';
import { formatMoney, formatPercent } from '../../../../shared/lib/format';
import { useBuilderStore } from '../../store/builderStore';
import type { BuilderView } from '../../hooks/useBuilderTotals';
import { TotalsBlock } from '../TotalsBlock';

export function ReviewStep({ view }: { view: BuilderView }) {
  const setQuantity = useBuilderStore((s) => s.setQuantity);
  const removeService = useBuilderStore((s) => s.removeService);
  const { totals } = view;

  if (totals.lines.length === 0) {
    return <EmptyState title="No services selected" description="Go back and add at least one service to continue." />;
  }

  const breakdown = totals.breakdown.map((b) => ({
    key: b.taxId,
    label: `${view.taxNames.get(b.taxId) ?? b.code} ${formatPercent(b.rate)}`,
    amount: b.amount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">Invoice lines</caption>
          <thead>
            <tr className="border-b border-line bg-paper text-xs text-muted">
              <th scope="col" className="px-4 py-2 text-left font-medium">Service</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Qty</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Unit price</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Taxes</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Line total</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {totals.lines.map((line) => (
              <tr key={line.serviceId} className="h-11 border-b border-line/70 last:border-0">
                <td className="max-w-[24ch] truncate px-4" title={line.serviceName}>
                  {line.serviceName}
                </td>
                <td className="px-4 text-right">
                  <label className="sr-only" htmlFor={`review-qty-${line.serviceId}`}>
                    Quantity for {line.serviceName}
                  </label>
                  <input
                    id={`review-qty-${line.serviceId}`}
                    type="number"
                    min={1}
                    max={9999}
                    value={line.quantity}
                    onChange={(e) => {
                      const n = Math.floor(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 1) setQuantity(line.serviceId, Math.min(n, 9999));
                    }}
                    className="h-8 w-20 rounded-control border border-line px-2 text-right font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </td>
                <td className="px-4 text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
                <td className="px-4 text-xs text-muted">
                  {line.taxes.map((t) => `${view.taxNames.get(t.taxId) ?? t.code} ${formatPercent(t.rate)}`).join(', ') || '—'}
                </td>
                <td className="px-4 text-right tabular-nums">{formatMoney(line.lineTotal)}</td>
                <td className="px-2 text-right">
                  <Button size="sm" variant="ghost" aria-label={`Remove ${line.serviceName}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => removeService(line.serviceId)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <TotalsBlock className="w-full max-w-xs" subtotal={totals.subtotal} taxTotal={totals.taxTotal} total={totals.total} breakdown={breakdown} />
      </div>
    </div>
  );
}
