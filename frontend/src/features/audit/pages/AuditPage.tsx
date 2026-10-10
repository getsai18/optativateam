import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Button, DataTable, DateRangeInput, EmptyState, NameCell, PageHeader, Pagination, Panel, Select, TableToolbar, Truncate, type Column } from '../../../shared/components/ui';
import { useTableState } from '../../../shared/hooks/useTableState';
import { useQuery } from '../../../shared/hooks/useQuery';
import { formatDateTime, toDateKey } from '../../../shared/lib/format';
import { cn } from '../../../shared/lib/cn';
import { TINTS, TINT_CLASS, tintStyle } from '../../../shared/lib/tint';
import { listAudit, type AuditRow } from '../services/auditService';

const PAGE_SIZE = 15;

const VERB_TINT: Record<string, number> = { create: 0, issue: 1, update: 2, rate_change: 2, pay: 5, cancel: 4, delete: 4 };

function ActionChip({ action }: { action: string }) {
  const verb = action.split('.')[1] ?? action;
  const tint = TINTS[VERB_TINT[verb] ?? 7] ?? TINTS[0]!;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium', TINT_CLASS)} style={tintStyle(tint)}>
      {action}
    </span>
  );
}

export function AuditPage() {
  const { data, loading, error, reload } = useQuery(listAudit, []);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const users = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((e) => map.set(e.userId, e.userName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const actions = useMemo(() => [...new Set((data ?? []).map((e) => e.action))].sort(), [data]);

  const filtered = useMemo(
    () =>
      (data ?? []).filter((e) => {
        const day = toDateKey(e.timestamp);
        return (!userId || e.userId === userId) && (!action || e.action === action) && (!from || day >= from) && (!to || day <= to);
      }),
    [data, userId, action, from, to],
  );

  const table = useTableState<AuditRow>(
    filtered,
    { timestamp: (e) => e.timestamp, user: (e) => e.userName.toLowerCase(), action: (e) => e.action },
    PAGE_SIZE,
    `${userId}|${action}|${from}|${to}`,
    { key: 'timestamp', dir: 'desc' },
  );

  const columns: Column<AuditRow>[] = [
    { key: 'timestamp', header: 'When', sortable: true, cell: (e) => <span className="whitespace-nowrap text-muted">{formatDateTime(e.timestamp)}</span> },
    { key: 'user', header: 'User', sortable: true, cell: (e) => <NameCell name={e.userName} /> },
    { key: 'action', header: 'Action', sortable: true, cell: (e) => <ActionChip action={e.action} /> },
    { key: 'entityType', header: 'Entity', hideBelow: 'lg', cell: (e) => <span className="capitalize text-muted">{e.entityType}</span> },
    { key: 'entity', header: 'Reference', cell: (e) => <Truncate className="font-mono text-xs">{e.entityLabel}</Truncate> },
  ];

  const hasFilters = Boolean(userId || action || from || to);

  return (
    <>
      <PageHeader title="Audit log" description="Read-only record of every create, update, issue, payment and cancellation." />
      <Panel>
        <TableToolbar count={`${table.total} entr${table.total === 1 ? 'y' : 'ies'}`}>
          <Select label="User" value={userId} onChange={(e) => setUserId(e.target.value)} wrapperClassName="w-52 [&>label]:sr-only">
            <option value="">All users</option>
            {users.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select label="Action" value={action} onChange={(e) => setAction(e.target.value)} wrapperClassName="w-52 [&>label]:sr-only">
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <DateRangeInput from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          {hasFilters ? (
            <Button
              variant="ghost"
              onClick={() => {
                setUserId('');
                setAction('');
                setFrom('');
                setTo('');
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </TableToolbar>
        {error ? (
          <EmptyState title="Could not load the audit log" description={error.message} action={<Button onClick={reload}>Retry</Button>} />
        ) : (
          <DataTable
            caption="Audit log"
            columns={columns}
            rows={table.pageRows}
            rowKey={(e) => e.id}
            loading={loading && !data}
            sort={table.sort}
            onSortChange={table.setSort}
            empty={<EmptyState icon={ScrollText} title="No entries match your filters" description="Widen the date range or clear the filters." />}
          />
        )}
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>
    </>
  );
}
