import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Button, DataTable, DateRangeInput, EmptyState, NameCell, PageHeader, Pagination, Panel, Select, TableToolbar, Truncate, type Column } from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
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
  const { t, tn } = useI18n();
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
    { key: 'timestamp', header: t('audit.col.when'), sortable: true, cell: (e) => <span className="whitespace-nowrap text-muted">{formatDateTime(e.timestamp)}</span> },
    { key: 'user', header: t('audit.col.user'), sortable: true, cell: (e) => <NameCell name={e.userName} /> },
    { key: 'action', header: t('audit.col.action'), sortable: true, cell: (e) => <ActionChip action={e.action} /> },
    { key: 'entityType', header: t('audit.col.entity'), hideBelow: 'lg', cell: (e) => <span className="capitalize text-muted">{e.entityType}</span> },
    { key: 'entity', header: t('audit.col.reference'), cell: (e) => <Truncate className="font-mono text-sm">{e.entityLabel}</Truncate> },
  ];

  const hasFilters = Boolean(userId || action || from || to);

  return (
    <>
      <PageHeader title={t('audit.title')} description={t('audit.description')} />
      <Panel>
        <TableToolbar count={tn('plural.entries', table.total)}>
          <Select label={t('audit.filter.user')} value={userId} onChange={(e) => setUserId(e.target.value)} wrapperClassName="w-52 [&>label]:sr-only">
            <option value="">{t('audit.filter.allUsers')}</option>
            {users.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select label={t('audit.filter.action')} value={action} onChange={(e) => setAction(e.target.value)} wrapperClassName="w-52 [&>label]:sr-only">
            <option value="">{t('audit.filter.allActions')}</option>
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
              {t('actions.clearFilters')}
            </Button>
          ) : null}
        </TableToolbar>
        {error ? (
          <EmptyState title={t('audit.loadError.title')} description={error.message} action={<Button onClick={reload}>{t('actions.retry')}</Button>} />
        ) : (
          <DataTable
            caption={t('audit.caption')}
            columns={columns}
            rows={table.pageRows}
            rowKey={(e) => e.id}
            loading={loading && !data}
            sort={table.sort}
            onSortChange={table.setSort}
            empty={<EmptyState icon={ScrollText} title={t('audit.empty.title')} description={t('audit.empty.desc')} />}
          />
        )}
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>
    </>
  );
}
