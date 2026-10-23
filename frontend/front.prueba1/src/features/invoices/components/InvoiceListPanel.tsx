import { useMemo, useState, type ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DataTable,
  EmptyState,
  DateRangeInput,
  Money,
  NameCell,
  Pagination,
  Panel,
  SearchInput,
  TableToolbar,
  StatusBadge,
  Tabs,
  type Column,
} from '../../../shared/components/ui';
import { INVOICE_STATUSES, useLabels } from '../../../shared/constants/labels';
import { useI18n } from '../../../shared/i18n';
import { useTableState } from '../../../shared/hooks/useTableState';
import { formatDate, formatMoney, toDateKey } from '../../../shared/lib/format';
import type { Invoice, InvoiceStatus } from '../../../shared/types';

const PAGE_SIZE = 10;

interface InvoiceListPanelProps {
  invoices: Invoice[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  statuses?: InvoiceStatus[];
  showCustomer?: boolean;
  emptyAction?: ReactNode;
}

export function InvoiceListPanel({
  invoices,
  loading,
  error,
  onRetry,
  statuses = INVOICE_STATUSES,
  showCustomer = true,
  emptyAction,
}: InvoiceListPanelProps) {
  const { t, tn } = useI18n();
  const labels = useLabels();
  const navigate = useNavigate();
  const [tab, setTab] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const counts = useMemo(() => {
    const map = new Map<InvoiceStatus, number>();
    invoices.forEach((i) => map.set(i.status, (map.get(i.status) ?? 0) + 1));
    return map;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (tab !== 'ALL' && i.status !== tab) return false;
      const day = toDateKey(i.issuedAt ?? i.createdAt);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return [i.folio ?? '', i.receiver.name, i.uuid ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [invoices, tab, search, from, to]);

  const table = useTableState<Invoice>(
    filtered,
    {
      folio: (i) => i.folio ?? '~',
      customer: (i) => i.receiver.name.toLowerCase(),
      date: (i) => i.issuedAt ?? i.createdAt,
      total: (i) => i.total,
      status: (i) => i.status,
    },
    PAGE_SIZE,
    `${tab}|${search}|${from}|${to}`,
    { key: 'date', dir: 'desc' },
  );

  const columns: Column<Invoice>[] = [
    {
      key: 'folio',
      header: t('invoices.list.col.folio'),
      sortable: true,
      cell: (i) =>
        i.folio ? (
          <span className="font-mono text-xs font-medium">{i.folio}</span>
        ) : (
          <span className="text-muted">{i.status === 'DRAFT' ? t('invoices.list.folio.draft') : t('invoices.list.folio.notIssued')}</span>
        ),
    },
    ...(showCustomer
      ? [
          {
            key: 'customer',
            header: t('invoices.list.col.customer'),
            sortable: true,
            cell: (i: Invoice) => <NameCell name={i.receiver.name} />,
          } satisfies Column<Invoice>,
        ]
      : []),
    { key: 'date', header: t('invoices.list.col.date'), sortable: true, cell: (i) => <span className="text-muted">{formatDate(i.issuedAt ?? i.createdAt)}</span> },
    { key: 'status', header: t('invoices.list.col.status'), sortable: true, cell: (i) => <StatusBadge status={i.status} /> },
    { key: 'total', header: t('invoices.list.col.total'), align: 'right', sortable: true, cell: (i) => <Money>{formatMoney(i.total)}</Money> },
  ];

  const hasFilters = tab !== 'ALL' || search !== '' || from !== '' || to !== '';
  const clear = () => {
    setTab('ALL');
    setSearch('');
    setFrom('');
    setTo('');
  };

  return (
    <Panel>
      <div className="px-5 pt-5">
        <Tabs<InvoiceStatus | 'ALL'>
          label={t('invoices.list.filterByStatus')}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'ALL', label: t('invoices.list.tab.all'), count: invoices.length },
            ...statuses.map((s) => ({ value: s, label: labels.status(s), count: counts.get(s) ?? 0 })),
          ]}
        />
      </div>
      <TableToolbar count={tn('plural.invoices', table.total)}>
        <SearchInput
          value={search}
          onChange={setSearch}
          label={t('invoices.list.searchLabel')}
          placeholder={showCustomer ? t('invoices.list.searchPlaceholder') : t('invoices.list.searchPlaceholderShort')}
          className="w-full max-w-xs"
        />
        <DateRangeInput from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        {hasFilters ? <Button variant="ghost" onClick={clear}>{t('actions.clearFilters')}</Button> : null}
      </TableToolbar>
      {error ? (
        <EmptyState
          title={t('invoices.list.error.title')}
          description={error.message}
          action={
            <Button onClick={onRetry}>{t('actions.retry')}</Button>
          }
        />
      ) : (
        <DataTable
          caption={t('invoices.list.caption')}
          columns={columns}
          rows={table.pageRows}
          rowKey={(i) => i.id}
          loading={loading}
          sort={table.sort}
          onSortChange={table.setSort}
          onRowClick={(i) => navigate(`/invoices/${i.id}`)}
          rowLabel={(i) => t('invoices.list.rowLabel', { folio: i.folio ?? t('invoices.list.folio.draft'), name: i.receiver.name })}
          empty={
            <EmptyState
              icon={FileText}
              title={hasFilters ? t('invoices.list.emptyFiltered.title') : t('invoices.list.empty.title')}
              description={
                hasFilters
                  ? t('invoices.list.emptyFiltered.description')
                  : showCustomer
                    ? t('invoices.list.empty.description')
                    : t('invoices.list.empty.customerDescription')
              }
              action={hasFilters ? <Button onClick={clear}>{t('actions.clearFilters')}</Button> : emptyAction}
            />
          }
        />
      )}
      <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
    </Panel>
  );
}
