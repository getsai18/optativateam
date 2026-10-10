import { query } from '../../../mocks/db';
import { requireRole } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { round2 } from '../../../shared/lib/format';
import { requireClaims } from '../../../shared/lib/session';
import type { Invoice, InvoiceStatus } from '../../../shared/types';

export interface DashboardData {
  totalInvoiced: number;
  paid: number;
  pending: number;
  cancelled: number;
  drafts: number;
  byStatus: { status: InvoiceStatus; count: number; amount: number }[];
  monthly: { key: string; label: string; invoiced: number; collected: number }[];
  recent: Invoice[];
}

const MONTH_FMT = new Intl.DateTimeFormat('en-MX', { month: 'short', timeZone: 'UTC' });

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

// TODO: replace with API Gateway call (GET /dashboard)
export async function getDashboard(): Promise<DashboardData> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return query((db) => {
    const sum = (rows: Invoice[]) => round2(rows.reduce((s, i) => s + i.total, 0));
    const of = (status: InvoiceStatus) => db.invoices.filter((i) => i.status === status);

    const byStatus = (['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'] as const).map((status) => ({
      status,
      count: of(status).length,
      amount: sum(of(status)),
    }));

    // last 6 calendar months, oldest first
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
      return { key: d.toISOString().slice(0, 7), label: MONTH_FMT.format(d) };
    });
    const monthly = months.map((m) => ({
      ...m,
      invoiced: sum(db.invoices.filter((i) => i.issuedAt && i.status !== 'CANCELLED' && monthKey(i.issuedAt) === m.key)),
      collected: sum(db.invoices.filter((i) => i.paidAt && monthKey(i.paidAt) === m.key)),
    }));

    return {
      totalInvoiced: round2(sum(of('ISSUED')) + sum(of('PAID'))),
      paid: sum(of('PAID')),
      pending: sum(of('ISSUED')),
      cancelled: sum(of('CANCELLED')),
      drafts: of('DRAFT').length,
      byStatus,
      monthly,
      recent: [...db.invoices].sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt)).slice(0, 8),
    };
  });
}
