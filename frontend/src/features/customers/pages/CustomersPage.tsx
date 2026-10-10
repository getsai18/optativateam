import { useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import {
  Badge,
  Button,
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
import { errorMessage } from '../../../shared/lib/errors';
import type { Customer } from '../../../shared/types';
import { useAuth } from '../../auth';
import { CustomerForm, type CustomerFormValues } from '../components/CustomerForm';
import { useCustomers } from '../hooks/useCustomers';
import { createCustomer, updateCustomer } from '../services/customerService';

const PAGE_SIZE = 10;

export function CustomersPage() {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const { data, loading, error, reload } = useCustomers();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

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

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Name', sortable: true, cell: (c) => <NameCell name={c.name} sub={c.email} /> },
    { key: 'taxId', header: 'Tax ID', sortable: true, cell: (c) => <span className="font-mono text-xs">{c.taxId}</span> },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', cell: (c) => <span className="text-muted">{c.phone ?? '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (c) => <Badge tone={c.active ? 'paid' : 'draft'}>{c.active ? 'Active' : 'Inactive'}</Badge>,
    },
  ];

  const handleSubmit = async (values: CustomerFormValues) => {
    setSaving(true);
    try {
      const input = { ...values, phone: values.phone || undefined } as Parameters<typeof createCustomer>[0];
      if (selected && selected !== 'new') {
        await updateCustomer(selected.id, input);
        toast.success('Customer updated');
      } else {
        await createCustomer(input);
        toast.success('Customer created');
      }
      setSelected(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const editing = selected && selected !== 'new' ? selected : undefined;

  return (
    <>
      <PageHeader
        title="Customers"
        description={isAdmin ? 'Create, edit and deactivate customers.' : 'Create and view customers.'}
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setSelected('new')}>
            New customer
          </Button>
        }
      />
      <Panel>
        <TableToolbar count={`${table.total} customer${table.total === 1 ? '' : 's'}`}>
          <SearchInput value={search} onChange={setSearch} label="Search customers" placeholder="Search by name, tax ID or email" className="w-full max-w-sm" />
        </TableToolbar>
        {error ? (
          <EmptyState title="Could not load customers" description={error.message} action={<Button onClick={reload}>Retry</Button>} />
        ) : (
          <DataTable
            caption="Customers"
            columns={columns}
            rows={table.pageRows}
            rowKey={(c) => c.id}
            loading={loading && !data}
            sort={table.sort}
            onSortChange={table.setSort}
            onRowClick={setSelected}
            rowLabel={(c) => `Open ${c.name}`}
            empty={
              <EmptyState
                icon={Users}
                title={search ? 'No customers match your search' : 'No customers yet'}
                description={search ? 'Try a different name, tax ID or email.' : 'Create your first customer to start invoicing.'}
                action={!search ? <Button variant="primary" onClick={() => setSelected('new')}>New customer</Button> : undefined}
              />
            }
          />
        )}
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected === 'new' ? 'New customer' : editing ? (isAdmin ? 'Edit customer' : 'Customer') : ''}
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
    </>
  );
}
