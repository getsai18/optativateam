import { useMemo, useState } from 'react';
import { Plus, UserCog } from 'lucide-react';
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
  Truncate,
  toast,
  type Column,
} from '../../../shared/components/ui';
import { useLabels } from '../../../shared/constants/labels';
import { useTableState } from '../../../shared/hooks/useTableState';
import { useI18n } from '../../../shared/i18n';
import { errorMessage } from '../../../shared/lib/errors';
import type { User } from '../../../shared/types';
import { useAuth } from '../../auth';
import { useCustomers } from '../../customers';
import { UserForm, type UserFormValues } from '../components/UserForm';
import { useUsers } from '../hooks/useUsers';
import { createUser, updateUser } from '../services/userService';

const PAGE_SIZE = 10;

export function UsersPage() {
  const { t, tn } = useI18n();
  const labels = useLabels();
  const { user: me } = useAuth();
  const users = useUsers();
  const customers = useCustomers();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<UserFormValues | null>(null);

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

  const editing = selected && selected !== 'new' ? selected : undefined;

  const columns: Column<User>[] = [
    { key: 'name', header: t('users.table.header.name'), sortable: true, cell: (u) => <NameCell name={u.fullName} sub={u.email} /> },
    {
      key: 'role',
      header: t('users.table.header.role'),
      sortable: true,
      cell: (u) => (
        <Badge tone={u.role === 'ADMIN' ? 'primary' : u.role === 'BILLER' ? 'issued' : 'neutral'}>{labels.role(u.role)}</Badge>
      ),
    },
    {
      key: 'customer',
      header: t('users.table.header.customer'),
      hideBelow: 'lg',
      cell: (u) => <Truncate className="text-muted">{u.customerId ? (customerName.get(u.customerId) ?? u.customerId) : '—'}</Truncate>,
    },
    {
      key: 'status',
      header: t('users.table.header.status'),
      sortable: true,
      cell: (u) => <Badge tone={u.active ? 'paid' : 'draft'}>{u.active ? t('users.status.active') : t('users.status.inactive')}</Badge>,
    },
  ];

  const persist = async (values: UserFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, values);
        toast.success(editing.active && !values.active ? t('users.toast.deactivated') : t('users.toast.updated'));
      } else {
        await createUser(values);
        toast.success(t('users.toast.created'));
      }
      setSelected(null);
      setPendingDeactivate(null);
      users.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const save = (values: UserFormValues) => {
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
        title={t('users.page.title')}
        description={t('users.page.description')}
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setSelected('new')}>
            {t('users.action.new')}
          </Button>
        }
      />
      <Panel>
        <TableToolbar count={tn('plural.users', table.total)}>
          <SearchInput
            value={search}
            onChange={setSearch}
            label={t('users.search.label')}
            placeholder={t('users.search.placeholder')}
            className="w-full max-w-sm"
          />
        </TableToolbar>
        <DataTable
          caption={t('users.table.caption')}
          columns={columns}
          rows={table.pageRows}
          rowKey={(u) => u.id}
          loading={users.loading && !users.data}
          sort={table.sort}
          onSortChange={table.setSort}
          onRowClick={setSelected}
          rowLabel={(u) => t('users.table.rowEdit', { name: u.fullName })}
          empty={
            <EmptyState
              icon={UserCog}
              title={search ? t('users.empty.searchTitle') : t('users.empty.title')}
              description={search ? t('users.empty.searchDescription') : t('users.empty.description')}
            />
          }
        />
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>
      <Drawer open={selected !== null} onClose={() => setSelected(null)} title={selected === 'new' ? t('users.drawer.title.new') : t('users.drawer.title.edit')}>
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

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title={t('users.deactivate.title')}
        description={t('users.deactivate.description')}
        confirmLabel={t('users.deactivate.confirm')}
        destructive
        loading={saving}
        onConfirm={confirmDeactivate}
        onCancel={() => setPendingDeactivate(null)}
      />
    </>
  );
}
