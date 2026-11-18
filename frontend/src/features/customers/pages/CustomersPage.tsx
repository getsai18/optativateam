import { useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  NameCell,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  TableToolbar,
  toast,
  type Column,
} from '../../../shared/components/ui';
import { useTableState } from '../../../shared/hooks/useTableState';
import { useI18n } from '../../../shared/i18n';
import { errorMessage } from '../../../shared/lib/errors';
import type { Customer } from '../../../shared/types';
import { useAuth } from '../../auth';
import { CustomerForm, type CustomerFormValues } from '../components/CustomerForm';
import { useCustomers } from '../hooks/useCustomers';
import { createCustomer, updateCustomer } from '../services/customerService';

const PAGE_SIZE = 10;

export function CustomersPage() {
  const { t, tn } = useI18n();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const { data, loading, error, reload } = useCustomers();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<CustomerFormValues | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter((c) => [c.name, c.taxId, c.email].some((v) => v.toLowerCase().includes(q)));
  }, [data, search]);

  const table = useTableState<Customer>(
    filtered,
    { name: (c) => c.name.toLowerCase(), taxId: (c) => c.taxId, status: (c) => (c.active ? 'a' : 'b') },
    PAGE_SIZE,
    search,
    { key: 'name', dir: 'asc' },
  );

  const editing = selected && selected !== 'new' ? selected : undefined;

  const columns: Column<Customer>[] = [
    { key: 'name', header: t('customers.table.header.name'), sortable: true, cell: (c) => <NameCell name={c.name} sub={c.email} /> },
    {
      key: 'taxId',
      header: t('customers.table.header.taxId'),
      sortable: true,
      cell: (c) => <span className="font-mono text-xs">{c.taxId}</span>,
    },
    {
      key: 'phone',
      header: t('customers.table.header.phone'),
      hideBelow: 'lg',
      cell: (c) => <span className="text-muted">{c.phone ?? '—'}</span>,
    },
    {
      key: 'status',
      header: t('customers.table.header.status'),
      sortable: true,
      cell: (c) => <Badge tone={c.active ? 'paid' : 'draft'}>{c.active ? t('customers.status.active') : t('customers.status.inactive')}</Badge>,
    },
  ];

  const persist = async (values: CustomerFormValues) => {
    setSaving(true);
    try {
      const input = { ...values, phone: values.phone || undefined } as Parameters<typeof createCustomer>[0];
      if (editing) {
        await updateCustomer(editing.id, input);
        toast.success(editing.active && !values.active ? t('customers.toast.deactivated') : t('customers.toast.updated'));
      } else {
        await createCustomer(input);
        toast.success(t('customers.toast.created'));
      }
      setSelected(null);
      setPendingDeactivate(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (values: CustomerFormValues) => {
    if (editing && editing.active && !values.active) {
      setPendingDeactivate(values);
      return;
    }
    void persist(values);
  };

  const confirmDeactivate = () => {
    if (pendingDeactivate) void persist(pendingDeactivate);
  };

  return (
    <>
      <PageHeader
        title={t('customers.page.title')}
        description={isAdmin ? t('customers.page.description.admin') : t('customers.page.description.basic')}
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setSelected('new')}>
            {t('customers.action.new')}
          </Button>
        }
      />
      <Panel>
        <TableToolbar count={tn('plural.customers', table.total)}>
          <SearchInput
            value={search}
            onChange={setSearch}
            label={t('customers.search.label')}
            placeholder={t('customers.search.placeholder')}
            className="w-full max-w-sm"
          />
        </TableToolbar>
        {error ? (
          <EmptyState
            title={t('customers.error.title')}
            description={error.message}
            action={<Button onClick={reload}>{t('actions.retry')}</Button>}
          />
        ) : (
          <DataTable
            caption={t('customers.table.caption')}
            columns={columns}
            rows={table.pageRows}
            rowKey={(c) => c.id}
            loading={loading && !data}
            sort={table.sort}
            onSortChange={table.setSort}
            onRowClick={setSelected}
            rowLabel={(c) => t('customers.table.rowOpen', { name: c.name })}
            empty={
              <EmptyState
                icon={Users}
                title={search ? t('customers.empty.searchTitle') : t('customers.empty.title')}
                description={search ? t('customers.empty.searchDescription') : t('customers.empty.description')}
                action={
                  !search ? (
                    <Button variant="primary" onClick={() => setSelected('new')}>
                      {t('customers.action.new')}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected === 'new'
            ? t('customers.drawer.title.new')
            : editing
              ? isAdmin
                ? t('customers.drawer.title.edit')
                : t('customers.drawer.title.view')
              : ''
        }
      >
        {selected !== null ? (
          <CustomerForm
            key={editing?.id ?? 'new'}
            customer={editing}
            readOnly={Boolean(editing) && !isAdmin}
            canToggleActive={isAdmin && Boolean(editing)}
            submitting={saving}
            onSubmit={handleSubmit}
            onCancel={() => setSelected(null)}
          />
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title={t('customers.deactivate.title')}
        description={t('customers.deactivate.description')}
        confirmLabel={t('customers.deactivate.confirm')}
        destructive
        loading={saving}
        onConfirm={confirmDeactivate}
        onCancel={() => setPendingDeactivate(null)}
      />
    </>
  );
}
