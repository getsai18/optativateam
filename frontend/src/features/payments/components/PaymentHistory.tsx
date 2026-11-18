import { useLabels } from '../../../shared/constants/labels';
import { useI18n } from '../../../shared/i18n';
import { formatDateTime, formatMoney } from '../../../shared/lib/format';
import type { Payment } from '../../../shared/types';

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  const { t } = useI18n();
  const labels = useLabels();
  if (payments.length === 0) {
    return <p className="text-sm text-muted">{t('payments.history.empty')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('payments.history.caption')}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('payments.history.header.date')}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('payments.history.header.method')}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('payments.history.header.reference')}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t('payments.history.header.amount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-line/70 last:border-0">
              <td className="py-2 pr-4">{formatDateTime(p.paidAt)}</td>
              <td className="py-2 pr-4">{labels.paymentMethod(p.method)}</td>
              <td className="py-2 pr-4 font-mono text-xs">{p.reference}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
