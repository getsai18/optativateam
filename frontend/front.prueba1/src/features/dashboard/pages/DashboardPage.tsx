import { CheckCircle2, Clock3, FileEdit, Plus, TrendingUp, XCircle, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  EmptyState,
  LinkButton,
  Money,
  NameCell,
  PageHeader,
  Panel,
  PanelHeader,
  Skeleton,
  StatusBadge,
} from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
import { useQuery } from '../../../shared/hooks/useQuery';
import { cn } from '../../../shared/lib/cn';
import { formatDate, formatMoney } from '../../../shared/lib/format';
import { useAuth } from '../../auth';
import { RevenueChart, StatusBars } from '../components/Charts';
import { getDashboard } from '../services/dashboardService';

interface KpiProps {
  label: string;
  value: string | undefined;
  hint?: string | undefined;
  icon: LucideIcon;
  tone: 'hero' | 'paid' | 'issued' | 'cancelled' | 'draft';
}

const ICON_TONE: Record<Exclude<KpiProps['tone'], 'hero'>, string> = {
  paid: 'bg-status-paid-bg text-status-paid',
  issued: 'bg-status-issued-bg text-status-issued',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled',
  draft: 'bg-status-draft-bg text-status-draft',
};

function Kpi({ label, value, hint, icon: Icon, tone }: KpiProps) {
  const hero = tone === 'hero';
  return (
    <section
      className={cn(
        'relative animate-rise overflow-hidden rounded-panel border p-5',
        hero ? 'border-transparent bg-brand text-white shadow-pop' : 'border-line/70 bg-surface shadow-card',
      )}
    >
      {hero ? <div aria-hidden="true" className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" /> : null}
      <div className="relative flex items-start justify-between">
        <p className={cn('text-sm font-medium', hero ? 'text-white/80' : 'text-muted')}>{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-control', hero ? 'bg-white/15' : ICON_TONE[tone])}>
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      {value === undefined ? (
        <Skeleton className={cn('mt-4 h-8 w-36', hero && 'bg-white/20')} />
      ) : (
        <p className="relative mt-3 text-[28px] font-semibold leading-9 tracking-tight tabular-nums">{value}</p>
      )}
      {hint ? <p className={cn('relative mt-1 text-sm', hero ? 'text-white/70' : 'text-muted')}>{hint}</p> : null}
    </section>
  );
}

export function DashboardPage() {
  const { t, tn } = useI18n();
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useQuery(getDashboard, []);
  const isAdmin = role === 'ADMIN';

  const h = new Date().getHours();
  const greeting = t(h < 12 ? 'dashboard.greet.morning' : h < 19 ? 'dashboard.greet.afternoon' : 'dashboard.greet.evening');

  if (error) {
    return <EmptyState title={t('dashboard.error.title')} description={error.message} action={<Button onClick={reload}>{t('actions.retry')}</Button>} />;
  }

  const count = (s: 'ISSUED' | 'PAID' | 'CANCELLED') => data?.byStatus.find((b) => b.status === s)?.count ?? 0;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.name.split(' ')[0] ?? ''}`}
        description={isAdmin ? t('dashboard.desc.admin') : t('dashboard.desc.default')}
        actions={
          <LinkButton to="/invoices/new" variant="primary" icon={<Plus size={16} aria-hidden="true" />}>
            {t('dashboard.newInvoice')}
          </LinkButton>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? (
          <Kpi tone="hero" icon={TrendingUp} label={t('dashboard.kpi.totalInvoiced')} value={data && formatMoney(data.totalInvoiced)} hint={t('dashboard.kpi.hint.issuedPaid')} />
        ) : (
          <Kpi
            tone="hero"
            icon={Clock3}
            label={t('dashboard.kpi.pendingCollection')}
            value={data && formatMoney(data.pending)}
            hint={data ? t('dashboard.kpi.hint.issuedInvoices', { n: count('ISSUED') }) : undefined}
          />
        )}
        <Kpi
          tone="paid"
          icon={CheckCircle2}
          label={t('dashboard.kpi.paid')}
          value={data && formatMoney(data.paid)}
          hint={data ? tn('plural.invoices', count('PAID')) : undefined}
        />
        {isAdmin ? (
          <Kpi
            tone="issued"
            icon={Clock3}
            label={t('dashboard.kpi.pending')}
            value={data && formatMoney(data.pending)}
            hint={data ? t('dashboard.kpi.hint.awaitingPayment', { n: count('ISSUED') }) : undefined}
          />
        ) : (
          <Kpi tone="draft" icon={FileEdit} label={t('dashboard.kpi.drafts')} value={data ? String(data.drafts) : undefined} hint={t('dashboard.kpi.hint.notIssued')} />
        )}
        <Kpi
          tone="cancelled"
          icon={XCircle}
          label={t('dashboard.kpi.cancelled')}
          value={data && formatMoney(data.cancelled)}
          hint={data ? tn('plural.invoices', count('CANCELLED')) : undefined}
        />
      </div>

      {isAdmin ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <Panel>
            <PanelHeader title={t('dashboard.panels.byStatus')} description={t('dashboard.panels.byStatusDesc')} />
            <div className="p-5">{data ? <StatusBars data={data.byStatus} /> : <Skeleton className="h-32 w-full" />}</div>
          </Panel>
          <Panel>
            <PanelHeader title={t('dashboard.panels.monthly')} description={t('dashboard.panels.monthlyDesc')} />
            <div className="p-5">{data ? <RevenueChart data={data.monthly} /> : <Skeleton className="h-52 w-full" />}</div>
          </Panel>
        </div>
      ) : null}

      <Panel className="mt-5">
        <PanelHeader
          title={t('dashboard.panels.recent')}
          description={t('dashboard.panels.recentDesc')}
          action={
            <Link to="/invoices" className="rounded-sm text-sm font-medium text-primary hover:underline">
              {t('dashboard.viewAll')}
            </Link>
          }
        />
        {loading && !data ? (
          <div className="flex flex-col gap-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('dashboard.table.caption')}</caption>
              <thead>
                <tr className="text-sm text-muted">
                  <th scope="col" className="px-5 py-2 text-left font-medium">{t('dashboard.table.customer')}</th>
                  <th scope="col" className="px-5 py-2 text-left font-medium">{t('dashboard.table.folio')}</th>
                  <th scope="col" className="hidden px-5 py-2 text-left font-medium md:table-cell">{t('dashboard.table.date')}</th>
                  <th scope="col" className="px-5 py-2 text-left font-medium">{t('dashboard.table.status')}</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">{t('dashboard.table.total')}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent ?? []).map((i) => (
                  <tr
                    key={i.id}
                    className="h-16 cursor-pointer border-t border-line/60 transition-colors hover:bg-primary-soft/50"
                    onClick={() => navigate(`/invoices/${i.id}`)}
                  >
                    <td className="px-5">
                      <NameCell name={i.receiver.name} />
                    </td>
                    <td className="px-5">
                      <Link to={`/invoices/${i.id}`} className="font-mono text-sm font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {i.folio ?? (i.status === 'DRAFT' ? t('dashboard.table.draft') : t('dashboard.table.notIssued'))}
                      </Link>
                    </td>
                    <td className="hidden px-5 text-muted md:table-cell">{formatDate(i.issuedAt ?? i.createdAt)}</td>
                    <td className="px-5">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-5 text-right">
                      <Money className="font-medium">{formatMoney(i.total)}</Money>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
