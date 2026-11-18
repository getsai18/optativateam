import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Button, DataTable, EmptyState, Input, Money, PageHeader, Panel, PanelHeader, Select, Tabs, toast, type Column } from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
import { useQuery } from '../../../shared/hooks/useQuery';
import { formatDate, formatDateTime, formatMoney, toDateKey } from '../../../shared/lib/format';
import { useAuth } from '../../auth';
import {
  getAgingReport,
  getPaymentValidation,
  listFiscalClosings,
  runFiscalClosing,
  type AgingRow,
  type FiscalClosing,
  type PaymentValidationRow,
} from '../services/reportService';

type Tab = 'aging' | 'closings' | 'validation';

const money = (value: number) => <Money>{formatMoney(value)}</Money>;

function AgingPanel() {
  const { t } = useI18n();
  const [asOf, setAsOf] = useState(toDateKey(new Date()));
  const { data, loading, error } = useQuery(() => getAgingReport(asOf), [asOf]);
  const rows = data ?? [];
  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  const columns: Column<AgingRow>[] = [
    { key: 'customer', header: t('reports.aging.customer'), cell: (r) => <span className="font-medium text-ink">{r.customerName}</span> },
    { key: 'open', header: t('reports.aging.open'), align: 'right', hideBelow: 'lg', cell: (r) => r.openInvoices },
    { key: 'd0', header: '0–30', align: 'right', cell: (r) => money(r.days0To30) },
    { key: 'd31', header: '31–60', align: 'right', cell: (r) => money(r.days31To60) },
    { key: 'd61', header: '61–90', align: 'right', cell: (r) => money(r.days61To90) },
    { key: 'd90', header: '+90', align: 'right', cell: (r) => money(r.daysOver90) },
    { key: 'balance', header: t('reports.aging.balance'), align: 'right', cell: (r) => <Money className="font-semibold">{formatMoney(r.balance)}</Money> },
  ];
  return (
    <Panel>
      <PanelHeader
        title={t('reports.aging.title')}
        description={t('reports.aging.description', { total: formatMoney(total) })}
        action={<Input label={t('reports.aging.asOf')} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} wrapperClassName="w-44" />}
      />
      <div className="p-5 pt-3">
        {error ? (
          <EmptyState title={t('reports.loadError')} description={error.message} />
        ) : (
          <DataTable
            caption={t('reports.aging.title')}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.customerId}
            loading={loading}
            empty={<EmptyState title={t('reports.aging.empty')} />}
          />
        )}
      </div>
    </Panel>
  );
}

function ClosingsPanel({ canRun }: { canRun: boolean }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useQuery(listFiscalClosings, []);
  const [periodType, setPeriodType] = useState<'DAY' | 'MONTH'>('MONTH');
  const [date, setDate] = useState(toDateKey(new Date()));
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const closing = await runFiscalClosing(periodType, date);
      toast.success(t('reports.closings.done', { period: formatDate(closing.periodStart), total: formatMoney(closing.total) }));
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reports.loadError'));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<FiscalClosing>[] = [
    { key: 'type', header: t('reports.closings.type'), cell: (r) => t(`reports.closings.type.${r.periodType}`) },
    { key: 'period', header: t('reports.closings.period'), cell: (r) => <span className="whitespace-nowrap">{formatDate(r.periodStart)}</span> },
    { key: 'count', header: t('reports.closings.invoices'), align: 'right', cell: (r) => `${r.invoiceCount} / ${r.cancelledCount}` },
    { key: 'subtotal', header: t('invoices.totals.subtotal'), align: 'right', hideBelow: 'lg', cell: (r) => money(r.subtotal) },
    { key: 'discount', header: t('invoices.totals.discount'), align: 'right', hideBelow: 'lg', cell: (r) => money(r.discountTotal) },
    { key: 'tax', header: t('invoices.totals.taxes'), align: 'right', hideBelow: 'lg', cell: (r) => money(r.taxTotal) },
    { key: 'withholding', header: t('invoices.totals.withholdings'), align: 'right', hideBelow: 'lg', cell: (r) => money(r.withholdingTotal) },
    { key: 'total', header: t('invoices.totals.total'), align: 'right', cell: (r) => <Money className="font-semibold">{formatMoney(r.total)}</Money> },
    { key: 'collected', header: t('reports.closings.collected'), align: 'right', cell: (r) => money(r.collectedTotal) },
    { key: 'closedAt', header: t('reports.closings.closedAt'), hideBelow: 'lg', cell: (r) => <span className="text-muted">{formatDateTime(r.closedAt)}</span> },
  ];

  return (
    <Panel>
      <PanelHeader
        title={t('reports.closings.title')}
        description={t('reports.closings.description')}
        action={
          canRun ? (
            <div className="flex flex-wrap items-end gap-2">
              <Select label={t('reports.closings.type')} value={periodType} onChange={(e) => setPeriodType(e.target.value as 'DAY' | 'MONTH')} wrapperClassName="w-32">
                <option value="DAY">{t('reports.closings.type.DAY')}</option>
                <option value="MONTH">{t('reports.closings.type.MONTH')}</option>
              </Select>
              <Input label={t('reports.closings.date')} type="date" value={date} max={toDateKey(new Date())} onChange={(e) => setDate(e.target.value)} wrapperClassName="w-44" />
              <Button variant="primary" loading={busy} icon={<CalendarCheck size={16} aria-hidden="true" />} onClick={run}>
                {t('reports.closings.run')}
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="p-5 pt-3">
        {error ? (
          <EmptyState title={t('reports.loadError')} description={error.message} />
        ) : (
          <DataTable
            caption={t('reports.closings.title')}
            columns={columns}
            rows={data ?? []}
            rowKey={(r) => r.id}
            loading={loading}
            empty={<EmptyState title={t('reports.closings.empty')} />}
          />
        )}
      </div>
    </Panel>
  );
}

function ValidationPanel() {
  const { t } = useI18n();
  const { data, loading, error } = useQuery(getPaymentValidation, []);
  const columns: Column<PaymentValidationRow>[] = [
    { key: 'folio', header: t('reports.validation.folio'), cell: (r) => <span className="font-mono">{r.folio ?? r.invoiceId}</span> },
    { key: 'status', header: t('reports.validation.status'), cell: (r) => r.status },
    { key: 'total', header: t('invoices.totals.total'), align: 'right', cell: (r) => money(r.total) },
    { key: 'paid', header: t('reports.validation.paid'), align: 'right', cell: (r) => money(r.paidAmount) },
    { key: 'issue', header: t('reports.validation.issue'), cell: (r) => <span className="font-mono text-xs text-danger">{r.validation}</span> },
  ];
  return (
    <Panel>
      <PanelHeader title={t('reports.validation.title')} description={t('reports.validation.description')} />
      <div className="p-5 pt-3">
        {error ? (
          <EmptyState title={t('reports.loadError')} description={error.message} />
        ) : (
          <DataTable
            caption={t('reports.validation.title')}
            columns={columns}
            rows={data ?? []}
            rowKey={(r) => r.invoiceId}
            loading={loading}
            empty={<EmptyState title={t('reports.validation.empty')} description={t('reports.validation.emptyDesc')} />}
          />
        )}
      </div>
    </Panel>
  );
}

/** Reportes fiscales respaldados por Stored Procedures (aging, cierres, validación de pagos). */
export function ReportsPage() {
  const { t } = useI18n();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('aging');
  const tabs: { value: Tab; label: string }[] = [
    { value: 'aging', label: t('reports.tab.aging') },
    { value: 'closings', label: t('reports.tab.closings') },
    ...(isAdmin ? [{ value: 'validation' as Tab, label: t('reports.tab.validation') }] : []),
  ];
  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.description')} />
      <div className="mb-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label={t('reports.title')} />
      </div>
      {tab === 'aging' ? <AgingPanel /> : null}
      {tab === 'closings' ? <ClosingsPanel canRun={isAdmin} /> : null}
      {tab === 'validation' && isAdmin ? <ValidationPanel /> : null}
    </>
  );
}
