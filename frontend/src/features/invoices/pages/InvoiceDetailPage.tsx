import { useState } from 'react';
import { Ban, CreditCard, Download, Pencil, Stamp, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ConfirmDialog, EmptyState, LinkButton, StatusBadge, PageHeader, Panel, Skeleton, toast } from '../../../shared/components/ui';
import { errorMessage } from '../../../shared/lib/errors';
import { canCancelInvoice, canDeleteInvoice, canEditInvoice, canIssueInvoice, canPayInvoice } from '../../../shared/lib/invoiceStatus';
import { useAuth } from '../../auth';
import { RegisterPaymentDialog, usePayments } from '../../payments';
import { useTaxes } from '../../taxes';
import { CancelInvoiceDialog } from '../components/CancelInvoiceDialog';
import { InvoiceDocument } from '../components/InvoiceDocument';
import { InvoiceRail } from '../components/InvoiceRail';
import { useInvoice } from '../hooks/useInvoices';
import { cancelInvoice, deleteDraft, issueInvoice } from '../services/invoiceService';

type Dialog = 'issue' | 'cancel' | 'delete' | 'pay' | null;

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const staff = role === 'ADMIN' || role === 'BILLER';
  const invoiceQuery = useInvoice(id);
  const paymentsQuery = usePayments(id);
  const taxes = useTaxes();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const { data: invoice, loading, error } = invoiceQuery;
  const backTo = staff ? '/invoices' : '/my-invoices';

  if (error) {
    return (
      <Panel>
        <EmptyState
          title="Invoice not found"
          description="It may not exist, or you may not have access to it."
          action={<LinkButton to={backTo}>Back to invoices</LinkButton>}
        />
      </Panel>
    );
  }

  if (loading && !invoice) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    );
  }
  if (!invoice) return null;

  const refresh = () => {
    invoiceQuery.reload();
    paymentsQuery.reload();
  };

  const run = async (action: () => Promise<unknown>, success: string, close = true) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      if (close) setDialog(null);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = invoice.folio ? `Invoice ${invoice.folio}` : 'Draft invoice';
  const status = invoice.status;

  const actions = (
    <>
      {staff && canEditInvoice(status) ? (
        <LinkButton to={`/invoices/${invoice.id}/edit`} icon={<Pencil size={16} aria-hidden="true" />}>
          Edit
        </LinkButton>
      ) : null}
      {staff && canDeleteInvoice(status) ? (
        <Button variant="danger" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setDialog('delete')}>
          Delete
        </Button>
      ) : null}
      {staff && canCancelInvoice(status) ? (
        <Button variant="danger" icon={<Ban size={16} aria-hidden="true" />} onClick={() => setDialog('cancel')}>
          Cancel invoice
        </Button>
      ) : null}
      {status !== 'DRAFT' ? (
        <LinkButton to={`/invoices/${invoice.id}/receipt`} icon={<Download size={16} aria-hidden="true" />}>
          Download receipt
        </LinkButton>
      ) : null}
      {staff && canIssueInvoice(status) ? (
        <Button variant="primary" icon={<Stamp size={16} aria-hidden="true" />} onClick={() => setDialog('issue')}>
          Issue invoice
        </Button>
      ) : null}
      {staff && canPayInvoice(status) ? (
        <Button variant="primary" icon={<CreditCard size={16} aria-hidden="true" />} onClick={() => setDialog('pay')} className="h-11 px-6 text-base">
          Register payment
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <PageHeader title={title} description={invoice.receiver.name} actions={actions} badge={<StatusBadge status={status} />} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <InvoiceDocument invoice={invoice} payments={paymentsQuery.data ?? []} taxes={taxes.data ?? []} />
        <InvoiceRail invoice={invoice} payments={paymentsQuery.data ?? []} />
      </div>

      <ConfirmDialog
        open={dialog === 'issue'}
        title="Issue invoice"
        confirmLabel="Issue invoice"
        loading={busy}
        description="Issuing assigns the folio and UUID, fixes the tax amounts at today's rates and locks the invoice."
        onConfirm={() => run(() => issueInvoice(invoice.id), 'Invoice issued')}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete draft"
        destructive
        confirmLabel="Delete draft"
        loading={busy}
        description="This draft will be permanently deleted."
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteDraft(invoice.id);
            toast.success('Draft deleted');
            navigate('/invoices', { replace: true });
          } catch (e) {
            toast.error(errorMessage(e));
            setBusy(false);
          }
        }}
        onCancel={() => setDialog(null)}
      />
      <CancelInvoiceDialog
        open={dialog === 'cancel'}
        folio={invoice.folio}
        submitting={busy}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => run(() => cancelInvoice(invoice.id, reason), 'Invoice cancelled')}
      />
      <RegisterPaymentDialog
        open={dialog === 'pay'}
        invoiceId={invoice.id}
        folio={invoice.folio}
        amount={invoice.total}
        onClose={() => setDialog(null)}
        onPaid={refresh}
      />
    </>
  );
}
