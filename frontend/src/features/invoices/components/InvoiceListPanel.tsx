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
import { INVOICE_STATUSES, STATUS_LABEL } from '../../../shared/constants/labels';
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
      header: 'Folio',
      sortable: true,
      cell: (i) =>
        i.folio ? (
          <span className="font-mono text-xs font-medium">{i.folio}</span>
        ) : (
          <span className="text-muted">{i.status === 'DRAFT' ? 'Draft' : 'Not issued'}</span>
        ),
    },
    ...(showCustomer
      ? [{ key: 'customer', header: 'Customer', sortable: true, cell: (i: Invoice) => <NameCell name={i.receiver.name} /> } satisfies Column<Invoice>]
      : []),
    { key: 'date', header: 'Date', sortable: true, cell: (i) => <span className="text-muted">{formatDate(i.issuedAt ?? i.createdAt)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (i) => <StatusBadge status={i.status} /> },
    { key: 'total', header: 'Total', align: 'right', sortable: true, cell: (i) => <Money>{formatMoney(i.total)}</Money> },
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
          label="Filter by status"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'ALL', label: 'All', count: invoices.length },
            ...statuses.map((s) => ({ value: s, label: STATUS_LABEL[s], count: counts.get(s) ?? 0 })),
          ]}
        />
      </div>
      <TableToolbar count={`${table.total} invoice${table.total === 1 ? '' : 's'}`}>
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Search invoices"
          placeholder={showCustomer ? 'Search by folio, customer or UUID' : 'Search by folio or UUID'}
          className="w-full max-w-xs"
        />
        <DateRangeInput from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        {hasFilters ? <Button variant="ghost" onClick={clear}>Clear filters</Button> : null}
      </TableToolbar>
      {error ? (
        <EmptyState title="Could not load invoices" description={error.message} action={<Button onClick={onRetry}>Retry</Button>} />
      ) : (
        <DataTable
          caption="Invoices"
          columns={columns}
          rows={table.pageRows}
          rowKey={(i) => i.id}
          loading={loading}
          sort={table.sort}
          onSortChange={table.setSort}
          onRowClick={(i) => navigate(`/invoices/${i.id}`)}
          rowLabel={(i) => `Open invoice ${i.folio ?? 'draft'} for ${i.receiver.name}`}
          empty={
            <EmptyState
              icon={FileText}
              title={hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
              description={hasFilters ? 'Adjust the filters or clear them to see everything.' : 'Invoices will show up here.'}
              action={hasFilters ? <Button onClick={clear}>Clear filters</Button> : emptyAction}
            />
          }
        />
      )}
      <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
    </Panel>
  );
}
