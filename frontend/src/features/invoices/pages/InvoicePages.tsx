import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { LinkButton, EmptyState, PageHeader, SkeletonBlock, Panel } from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
import { InvoiceListPanel } from '../components/InvoiceListPanel';
import { InvoiceSummaryCards } from '../components/InvoiceSummaryCards';
import { InvoiceWizard } from '../components/wizard/InvoiceWizard';
import { useInvoice, useInvoices } from '../hooks/useInvoices';
import { useBuilderStore } from '../store/builderStore';

/** Admin / Biller: all invoices. */
export function InvoicesPage() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useInvoices();
  const newButton = (
    <LinkButton to="/invoices/new" variant="primary" icon={<Plus size={16} aria-hidden="true" />}>
      {t('invoices.list.newInvoice')}
    </LinkButton>
  );
  return (
    <>
      <PageHeader title={t('invoices.list.title')} description={t('invoices.list.description')} actions={newButton} />
      <InvoiceSummaryCards invoices={data ?? []} loading={loading && !data} audience="staff" />
      <InvoiceListPanel invoices={data ?? []} loading={loading && !data} error={error} onRetry={reload} emptyAction={newButton} />
    </>
  );
}

/** Customer: own issued invoices only (the service never returns drafts or other customers' invoices). */
export function MyInvoicesPage() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useInvoices();
  return (
    <>
      <PageHeader title={t('invoices.my.title')} description={t('invoices.my.description')} />
      <InvoiceSummaryCards invoices={data ?? []} loading={loading && !data} audience="customer" />
      <InvoiceListPanel
        invoices={data ?? []}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        statuses={['ISSUED', 'PAID', 'CANCELLED']}
        showCustomer={false}
      />
    </>
  );
}

export function NewInvoicePage() {
  const { t } = useI18n();
  // Leftover state from editing a draft must not leak into a brand-new invoice.
  useState(() => {
    const s = useBuilderStore.getState();
    if (s.invoiceId) s.reset();
  });
  return (
    <>
      <PageHeader title={t('invoices.new.title')} description={t('invoices.new.description')} />
      <InvoiceWizard />
    </>
  );
}

export function EditInvoicePage() {
  const { t } = useI18n();
  const { id = '' } = useParams();
  const { data, loading, error } = useInvoice(id);
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    const s = useBuilderStore.getState();
    // Resume the in-progress edit of this same draft; otherwise load it fresh.
    if (s.invoiceId !== data.id) {
      s.loadDraft({
        invoiceId: data.id,
        customerId: data.customerId,
        lines: data.lines.map((l) => ({ serviceId: l.serviceId, quantity: l.quantity })),
      });
    }
    setReady(true);
  }, [data]);

  if (error) {
    return (
      <Panel>
        <EmptyState
          title={t('invoices.detail.notFound.title')}
          description={error.message}
          action={<LinkButton to="/invoices">{t('invoices.detail.back')}</LinkButton>}
        />
      </Panel>
    );
  }
  if (data && data.status !== 'DRAFT') return <Navigate to={`/invoices/${data.id}`} replace />;
  if (loading || !ready) {
    return (
      <Panel className="p-6">
        <SkeletonBlock lines={6} />
      </Panel>
    );
  }
  return (
    <>
      <PageHeader title={t('invoices.edit.title')} description={t('invoices.edit.description')} />
      <InvoiceWizard />
    </>
  );
}
