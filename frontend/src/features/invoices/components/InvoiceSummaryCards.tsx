import { useMemo } from 'react';
import { CheckCircle2, Clock3, FileEdit, FileText, type LucideIcon } from 'lucide-react';
import { Skeleton } from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
import { cn } from '../../../shared/lib/cn';
import { formatMoney, round2 } from '../../../shared/lib/format';
import type { Invoice, InvoiceStatus } from '../../../shared/types';

interface Stat {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  hero?: boolean;
}

function summarize(invoices: Invoice[], status: InvoiceStatus) {
  const rows = invoices.filter((i) => i.status === status);
  return { count: rows.length, amount: round2(rows.reduce((s, i) => s + i.total, 0)) };
}

/** Compact money summary above invoice lists. Customers see what they owe first. */
export function InvoiceSummaryCards({ invoices, loading, audience }: { invoices: Invoice[]; loading: boolean; audience: 'staff' | 'customer' }) {
  const { t, tn } = useI18n();
  const stats = useMemo<Stat[]>(() => {
    const issued = summarize(invoices, 'ISSUED');
    const paid = summarize(invoices, 'PAID');
    const drafts = summarize(invoices, 'DRAFT');
    const outstanding: Stat = {
      label: audience === 'customer' ? t('invoices.stats.outstanding.customer') : t('invoices.stats.outstanding.staff'),
      value: formatMoney(issued.amount),
      hint: tn('invoices.stats.issuedAwaiting', issued.count),
      icon: Clock3,
      tone: 'bg-status-issued-bg text-status-issued',
      hero: true,
    };
    const collected: Stat = {
      label: audience === 'customer' ? t('invoices.stats.paid.customer') : t('invoices.stats.paid.staff'),
      value: formatMoney(paid.amount),
      hint: tn('invoices.stats.paidCount', paid.count),
      icon: CheckCircle2,
      tone: 'bg-status-paid-bg text-status-paid',
    };
    const third: Stat =
      audience === 'customer'
        ? {
            label: t('invoices.stats.third.customer.label'),
            value: String(invoices.length),
            hint: t('invoices.stats.third.customer.hint'),
            icon: FileText,
            tone: 'bg-primary-soft text-primary',
          }
        : {
            label: t('invoices.stats.third.staff.label'),
            value: String(drafts.count),
            hint: t('invoices.stats.third.staff.hint', { amount: formatMoney(drafts.amount) }),
            icon: FileEdit,
            tone: 'bg-status-draft-bg text-status-draft',
          };
    return [outstanding, collected, third];
  }, [invoices, audience, t, tn]);

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {stats.map((s) => (
        <section
          key={s.label}
          className={cn(
            'flex animate-rise items-center gap-4 rounded-panel border p-4',
            s.hero ? 'border-transparent bg-brand text-white shadow-pop' : 'border-line/70 bg-surface shadow-card',
          )}
        >
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-control', s.hero ? 'bg-white/15 text-white' : s.tone)}>
            <s.icon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={cn('text-xs font-medium', s.hero ? 'text-white/80' : 'text-muted')}>{s.label}</p>
            {loading ? (
              <Skeleton className={cn('mt-1 h-6 w-28', s.hero && 'bg-white/20')} />
            ) : (
              <p className="truncate text-xl font-semibold tracking-tight tabular-nums">{s.value}</p>
            )}
            <p className={cn('truncate text-xs', s.hero ? 'text-white/70' : 'text-muted')}>{s.hint}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
