import { Ban, CheckCircle2, CircleDashed, CreditCard, FilePlus2, Stamp, type LucideIcon } from 'lucide-react';
import { Avatar } from '../../../shared/components/ui';
import { useLabels } from '../../../shared/constants/labels';
import { useI18n, type TFn } from '../../../shared/i18n';
import { cn } from '../../../shared/lib/cn';
import { formatDateTime, formatMoney } from '../../../shared/lib/format';
import type { Invoice, Payment } from '../../../shared/types';

interface Step {
  key: string;
  label: string;
  at: string | null;
  icon: LucideIcon;
  tone: string;
  note?: string | null;
}

function stepsFor(t: TFn, invoice: Invoice): Step[] {
  const steps: Step[] = [{ key: 'created', label: t('invoices.rail.created'), at: invoice.createdAt, icon: FilePlus2, tone: 'bg-primary-soft text-primary' }];
  if (invoice.status === 'CANCELLED') {
    if (invoice.issuedAt) steps.push({ key: 'issued', label: t('invoices.rail.issued'), at: invoice.issuedAt, icon: Stamp, tone: 'bg-status-issued-bg text-status-issued' });
    steps.push({
      key: 'cancelled',
      label: t('invoices.rail.cancelled'),
      at: invoice.cancelledAt,
      icon: Ban,
      tone: 'bg-status-cancelled-bg text-status-cancelled',
      note: invoice.cancellationReason,
    });
    return steps;
  }
  steps.push({
    key: 'issued',
    label: invoice.issuedAt ? t('invoices.rail.issued') : t('invoices.rail.notIssuedYet'),
    at: invoice.issuedAt,
    icon: Stamp,
    tone: 'bg-status-issued-bg text-status-issued',
  });
  steps.push({
    key: 'paid',
    label: invoice.paidAt ? t('invoices.rail.paid') : t('invoices.rail.awaitingPayment'),
    at: invoice.paidAt,
    icon: CheckCircle2,
    tone: 'bg-status-paid-bg text-status-paid',
  });
  return steps;
}

/** Right-hand summary for the invoice detail: amount, lifecycle timeline, payment and customer. */
export function InvoiceRail({ invoice, payments }: { invoice: Invoice; payments: Payment[] }) {
  const { t } = useI18n();
  const labels = useLabels();
  const payment = payments[0];
  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-20" aria-label={t('invoices.rail.aria')}>
      <section className="animate-rise rounded-panel border border-line/70 bg-surface p-5 shadow-card">
        <p className="text-sm font-medium text-muted">{t(`invoices.rail.amount.${invoice.status}`)}</p>
        <p
          className={cn(
            'mt-2 text-[30px] font-semibold leading-tight tracking-tight tabular-nums',
            invoice.status === 'CANCELLED' && 'text-muted line-through decoration-1',
          )}
        >
          {formatMoney(invoice.total)}
        </p>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {t('invoices.rail.taxesLine', { subtotal: formatMoney(invoice.subtotal), taxes: formatMoney(invoice.taxTotal) })}
        </p>
      </section>

      <section className="animate-rise rounded-panel border border-line/70 bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold">{t('invoices.rail.timeline')}</h2>
        <ol className="flex flex-col">
          {stepsFor(t, invoice).map((step, i, all) => {
            const done = step.at !== null;
            const Icon = done ? step.icon : CircleDashed;
            return (
              <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                {i < all.length - 1 ? <span aria-hidden="true" className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-line" /> : null}
                <span className={cn('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full', done ? step.tone : 'border border-dashed border-line text-muted')}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className={cn('text-sm', done ? 'font-medium text-ink' : 'text-muted')}>{step.label}</p>
                  {done ? <p className="text-sm text-muted">{formatDateTime(step.at)}</p> : null}
                  {step.note ? <p className="mt-1 rounded-control bg-status-cancelled-bg px-2 py-1 text-xs text-status-cancelled">{step.note}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {payment ? (
        <section className="animate-rise rounded-panel border border-line/70 bg-surface p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CreditCard size={16} aria-hidden="true" className="text-muted" /> {t('invoices.rail.payment')}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">{t('invoices.rail.method')}</dt>
            <dd className="text-right">{labels.paymentMethod(payment.method)}</dd>
            <dt className="text-muted">{t('invoices.rail.reference')}</dt>
            <dd className="text-right font-mono text-xs leading-5">{payment.reference}</dd>
            <dt className="text-muted">{t('invoices.rail.amountLabel')}</dt>
            <dd className="text-right font-medium tabular-nums">{formatMoney(payment.amount)}</dd>
          </dl>
        </section>
      ) : null}

      <section className="animate-rise rounded-panel border border-line/70 bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">{t('invoices.rail.customer')}</h2>
        <div className="flex items-center gap-3">
          <Avatar name={invoice.receiver.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={invoice.receiver.name}>
              {invoice.receiver.name}
            </p>
            <p className="font-mono text-xs text-muted">{invoice.receiver.taxId}</p>
          </div>
        </div>
      </section>
    </aside>
  );
}
