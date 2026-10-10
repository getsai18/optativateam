import { StatusBadge } from '../../../shared/components/ui';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../../../shared/lib/format';
import type { Invoice, Party, Payment, Tax } from '../../../shared/types';
import { PaymentHistory } from '../../payments';
import { breakdownFromLines, taxLabel } from '../lib/breakdown';
import { TotalsBlock } from './TotalsBlock';

function PartyBlock({ heading, party }: { heading: string; party: Party }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{heading}</h3>
      <p className="text-sm font-semibold text-ink">{party.name}</p>
      <p className="font-mono text-xs text-ink">{party.taxId}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{party.address}</p>
    </div>
  );
}

interface InvoiceDocumentProps {
  invoice: Invoice;
  payments: Payment[];
  taxes: Tax[];
}

/** Presentational invoice "paper": used by the detail page and the print receipt. */
export function InvoiceDocument({ invoice, payments, taxes }: InvoiceDocumentProps) {
  const taxNames = new Map(taxes.map((t) => [t.id, t.name]));
  const breakdown = breakdownFromLines(invoice.lines, taxes);

  return (
    <article className="overflow-hidden rounded-panel border border-line/70 bg-surface p-8 shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none" aria-label="Invoice">
      <div aria-hidden="true" className="-mx-8 -mt-8 mb-8 h-1.5 bg-brand print:hidden" />
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line/70 pb-6">
        <PartyBlock heading="Issuer" party={invoice.issuer} />
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Invoice</p>
          <p className="font-mono text-xl font-semibold tracking-tight">{invoice.folio ?? 'Not issued'}</p>
          <div className="mt-2 flex justify-end">
            <StatusBadge status={invoice.status} />
          </div>
        </div>
      </header>

      <section className="grid gap-6 border-b border-line/70 py-6 sm:grid-cols-2">
        <PartyBlock heading="Bill to" party={invoice.receiver} />
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm sm:justify-self-end">
          <dt className="text-muted">UUID</dt>
          <dd className="break-all font-mono text-xs">{invoice.uuid ?? '—'}</dd>
          <dt className="text-muted">Issue date</dt>
          <dd>{formatDateTime(invoice.issuedAt)}</dd>
          <dt className="text-muted">Created</dt>
          <dd>{formatDate(invoice.createdAt)}</dd>
          {invoice.paidAt ? (
            <>
              <dt className="text-muted">Paid</dt>
              <dd>{formatDateTime(invoice.paidAt)}</dd>
            </>
          ) : null}
          {invoice.cancelledAt ? (
            <>
              <dt className="text-muted">Cancelled</dt>
              <dd>{formatDateTime(invoice.cancelledAt)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {invoice.status === 'CANCELLED' && invoice.cancellationReason ? (
        <section className="mt-6 rounded-control border border-status-cancelled/30 bg-status-cancelled-bg p-4 text-sm" aria-label="Cancellation">
          <p className="font-semibold text-status-cancelled">Cancellation reason</p>
          <p className="mt-1 text-ink">{invoice.cancellationReason}</p>
        </section>
      ) : null}

      <section className="py-6" aria-label="Line items">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Invoice line items</caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-4 text-left font-semibold">Service</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Qty</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Unit price</th>
                <th scope="col" className="py-2 pr-4 text-left font-semibold">Taxes</th>
                <th scope="col" className="py-2 text-right font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-line align-top">
                  <td className="py-3 pr-4 font-medium">{line.serviceName}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatNumber(line.quantity)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
                  <td className="py-3 pr-4 text-xs text-muted">
                    {line.taxes.length === 0
                      ? '—'
                      : line.taxes.map((t) => (
                          <div key={t.taxId}>
                            {taxLabel(taxNames.get(t.taxId), t.code, t.rate)}: <span className="tabular-nums">{formatMoney(t.amount)}</span>
                          </div>
                        ))}
                  </td>
                  <td className="py-3 text-right tabular-nums">{formatMoney(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <TotalsBlock className="w-full max-w-xs rounded-panel bg-paper p-5" subtotal={invoice.subtotal} taxTotal={invoice.taxTotal} total={invoice.total} breakdown={breakdown} />
        </div>
      </section>

      <section className="border-t border-line pt-6" aria-label="Payments">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Payment history</h3>
        <PaymentHistory payments={payments} />
      </section>
    </article>
  );
}
