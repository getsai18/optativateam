import { PAYMENT_METHOD_LABEL } from '../../../shared/constants/labels';
import { formatDateTime, formatMoney } from '../../../shared/lib/format';
import type { Payment } from '../../../shared/types';

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return <p className="text-sm text-muted">No payments registered.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Payment history</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="py-2 pr-4 font-medium">Date</th>
            <th scope="col" className="py-2 pr-4 font-medium">Method</th>
            <th scope="col" className="py-2 pr-4 font-medium">Reference</th>
            <th scope="col" className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-line/70 last:border-0">
              <td className="py-2 pr-4">{formatDateTime(p.paidAt)}</td>
              <td className="py-2 pr-4">{PAYMENT_METHOD_LABEL[p.method]}</td>
              <td className="py-2 pr-4 font-mono text-xs">{p.reference}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
