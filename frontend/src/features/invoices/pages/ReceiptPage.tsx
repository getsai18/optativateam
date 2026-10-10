import { useEffect, useRef } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button, EmptyState, LinkButton, Skeleton } from '../../../shared/components/ui';
import { usePayments } from '../../payments';
import { useTaxes } from '../../taxes';
import { InvoiceDocument } from '../components/InvoiceDocument';
import { useInvoice } from '../hooks/useInvoices';

/** Print-optimized view: opens the browser print dialog once the data is on screen. */
export function ReceiptPage() {
  const { id = '' } = useParams();
  const invoice = useInvoice(id);
  const payments = usePayments(id);
  const taxes = useTaxes();
  const printed = useRef(false);

  const ready = Boolean(invoice.data && payments.data && taxes.data);
  useEffect(() => {
    if (!ready || printed.current) return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [ready]);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <LinkButton to={`/invoices/${id}`} variant="ghost" icon={<ArrowLeft size={16} aria-hidden="true" />}>
          Back to invoice
        </LinkButton>
        <Button variant="primary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()} disabled={!ready}>
          Print / Save as PDF
        </Button>
      </div>
      {invoice.error ? (
        <EmptyState title="Receipt not available" description="The invoice does not exist or you do not have access to it." />
      ) : invoice.data && invoice.data.status !== 'DRAFT' && ready ? (
        <InvoiceDocument invoice={invoice.data} payments={payments.data ?? []} taxes={taxes.data ?? []} />
      ) : (
        <Skeleton className="h-[32rem] w-full" />
      )}
    </div>
  );
}
