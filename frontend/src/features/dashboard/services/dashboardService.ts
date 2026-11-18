import { api } from '../../../shared/lib/http';
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

export async function getDashboard(): Promise<DashboardData> {
  return api<DashboardData>('/dashboard');
}
