import { useMemo, useState } from 'react';
import { Plus, UserCog } from 'lucide-react';
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
  Truncate,
  toast,
  type Column,
} from '../../../shared/components/ui';
import { ROLE_LABEL } from '../../../shared/constants/labels';
import { useTableState } from '../../../shared/hooks/useTableState';
import { errorMessage } from '../../../shared/lib/errors';
import type { User } from '../../../shared/types';
import { useAuth } from '../../auth';
import { useCustomers } from '../../customers';
import { UserForm, type UserFormValues } from '../components/UserForm';
import { useUsers } from '../hooks/useUsers';
import { createUser, updateUser } from '../services/userService';

const PAGE_SIZE = 10;

export function UsersPage() {
  const { user: me } = useAuth();
  const users = useUsers();
  const customers = useCustomers();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

  const customerName = useMemo(() => new Map((customers.data ?? []).map((c) => [c.id, c.name])), [customers.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data ?? []).filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users.data, search]);

  const table = useTableState<User>(
    filtered,
    { name: (u) => u.fullName.toLowerCase(), role: (u) => u.role, status: (u) => (u.active ? 'a' : 'b') },
    PAGE_SIZE,
    search,
    { key: 'name', dir: 'asc' },
  );

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name', sortable: true, cell: (u) => <NameCell name={u.fullName} sub={u.email} /> },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      cell: (u) => <Badge tone={u.role === 'ADMIN' ? 'primary' : u.role === 'BILLER' ? 'issued' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge>,
    },
    {
      key: 'customer',
      header: 'Linked customer',
      hideBelow: 'lg',
      cell: (u) => <Truncate className="text-muted">{u.customerId ? (customerName.get(u.customerId) ?? u.customerId) : '—'}</Truncate>,
    },
    { key: 'status', header: 'Status', sortable: true, cell: (u) => <Badge tone={u.active ? 'paid' : 'draft'}>{u.active ? 'Active' : 'Inactive'}</Badge> },
  ];

  const save = async (values: UserFormValues) => {
    setSaving(true);
    try {
      if (selected && selected !== 'new') {
        await updateUser(selected.id, values);
        toast.success('User updated');
      } else {
        await createUser(values);
        toast.success('User created');
      }
      setSelected(null);
      users.reload();
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
        title="Users"
        description="Create accounts, change roles and activate or deactivate access."
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setSelected('new')}>
            New user
          </Button>
        }
      />
      <Panel>
        <TableToolbar count={`${table.total} user${table.total === 1 ? '' : 's'}`}>
          <SearchInput value={search} onChange={setSearch} label="Search users" placeholder="Search by name or email" className="w-full max-w-sm" />
        </TableToolbar>
        <DataTable
          caption="Users"
          columns={columns}
          rows={table.pageRows}
          rowKey={(u) => u.id}
          loading={users.loading && !users.data}
          sort={table.sort}
          onSortChange={table.setSort}
          onRowClick={setSelected}
          rowLabel={(u) => `Edit ${u.fullName}`}
          empty={<EmptyState icon={UserCog} title="No users found" description="Try a different search." />}
        />
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>
      <Drawer open={selected !== null} onClose={() => setSelected(null)} title={selected === 'new' ? 'New user' : 'Edit user'}>
        {selected !== null ? (
          <UserForm
            key={editing?.id ?? 'new'}
            user={editing}
            customers={(customers.data ?? []).filter((c) => c.active || c.id === editing?.customerId)}
            isSelf={editing?.id === me?.sub}
            submitting={saving}
            onSubmit={save}
            onCancel={() => setSelected(null)}
          />
        ) : null}
      </Drawer>
    </>
  );
}
