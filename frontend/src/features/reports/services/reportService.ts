import { api } from '../../../shared/lib/http';

/** sp_aging_report: saldo pendiente por cliente en tramos de días desde la emisión. */
export interface AgingRow {
  customerId: string;
  customerName: string;
  taxId: string;
  openInvoices: number;
  days0To30: number;
  days31To60: number;
  days61To90: number;
  daysOver90: number;
  balance: number;
  oldestDays: number;
}

/** sp_fiscal_closing: cierre y consolidado fiscal diario o mensual. */
export interface FiscalClosing {
  id: string;
  periodType: 'DAY' | 'MONTH';
  periodStart: string;
  periodEnd: string;
  invoiceCount: number;
  cancelledCount: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  withholdingTotal: number;
  total: number;
  collectedTotal: number;
  closedBy: string | null;
  closedAt: string;
}

/** sp_validate_payment_status: inconsistencias entre facturas y pagos. */
export interface PaymentValidationRow {
  invoiceId: string;
  folio: string | null;
  status: string;
  total: number;
  paidAmount: number;
  validation: string;
}

export function getAgingReport(asOf?: string): Promise<AgingRow[]> {
  return api<AgingRow[]>('/reports/aging', asOf ? { query: { asOf } } : undefined);
}

export function listFiscalClosings(): Promise<FiscalClosing[]> {
  return api<FiscalClosing[]>('/reports/fiscal-closings');
}

export function runFiscalClosing(periodType: 'DAY' | 'MONTH', date: string): Promise<FiscalClosing> {
  return api<FiscalClosing>('/reports/fiscal-closings', { method: 'POST', body: { periodType, date } });
}

export function getPaymentValidation(): Promise<PaymentValidationRow[]> {
  return api<PaymentValidationRow[]>('/reports/payment-validation');
}
