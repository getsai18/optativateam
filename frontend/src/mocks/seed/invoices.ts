import { calculateTotals } from '../../features/invoices/lib/calculateTotals';
import { ISSUER } from '../../shared/constants/company';
import type {
  AuditEntry,
  Customer,
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  Service,
  Tax,
  TaxRateHistory,
  User,
} from '../../shared/types';
import type { Rng } from './rng';

const DAY = 24 * 60 * 60 * 1000;
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface SeedContext {
  rng: Rng;
  now: Date;
  customers: Customer[];
  users: User[];
  services: Service[];
  taxes: Tax[];
  history: TaxRateHistory[];
}

interface SeedInvoiceResult {
  invoices: Invoice[];
  payments: Payment[];
  audit: AuditEntry[];
  folioCounters: Record<string, number>;
}

const STATUS_PLAN: InvoiceStatus[] = [
  ...Array<InvoiceStatus>(6).fill('DRAFT'),
  ...Array<InvoiceStatus>(10).fill('ISSUED'),
  ...Array<InvoiceStatus>(18).fill('PAID'),
  ...Array<InvoiceStatus>(6).fill('CANCELLED'),
];

const CANCEL_REASONS = [
  'Customer requested a different service scope',
  'Duplicate invoice issued by mistake',
  'Wrong billing entity selected',
  'Purchase order was cancelled by the customer',
  'Pricing agreed in contract differs from invoice',
  'Service could not be delivered in the agreed period',
];

function isoAt(now: Date, daysAgo: number, rng: Rng): string {
  const base = now.getTime() - daysAgo * DAY;
  const d = new Date(base);
  d.setUTCHours(rng.int(14, 23), rng.int(0, 59), rng.int(0, 59), 0);
  return d.toISOString();
}

export function buildInvoices(ctx: SeedContext): SeedInvoiceResult {
  const { rng, now, customers, users, services, taxes, history } = ctx;
  const billers = users.filter((u) => u.role === 'BILLER' || u.role === 'ADMIN');
  const admin = users.find((u) => u.role === 'ADMIN');
  const featuredCustomers = customers.slice(0, 5);
  const statuses = rng.shuffle(STATUS_PLAN);

  const drafts: Invoice[] = [];
  const issuedLike: Invoice[] = [];
  const payments: Payment[] = [];
  const audit: AuditEntry[] = [];

  statuses.forEach((status, i) => {
    const customer = rng.chance(0.65) ? rng.pick(featuredCustomers) : rng.pick(customers);
    const creator = rng.pick(billers);

    const wasIssued = status === 'ISSUED' || status === 'PAID' || (status === 'CANCELLED' && rng.chance(0.6));
    let issuedDaysAgo = 0;
    if (status === 'PAID') issuedDaysAgo = rng.int(10, 175);
    else if (status === 'ISSUED') issuedDaysAgo = rng.int(1, 70);
    else if (wasIssued) issuedDaysAgo = rng.int(8, 150);

    const createdDaysAgo = wasIssued ? issuedDaysAgo + rng.int(0, 2) : rng.int(0, 60);
    const createdAt = isoAt(now, createdDaysAgo, rng);
    const issuedAt = wasIssued ? isoAt(now, issuedDaysAgo, rng) : null;
    const calcDate = issuedAt ?? createdAt;

    const lineCount = rng.int(1, 4);
    const picked = rng.shuffle(services).slice(0, lineCount);
    const totals = calculateTotals(
      picked.map((s) => ({
        serviceId: s.id,
        serviceName: s.name,
        quantity: s.category === 'Software Licenses' ? rng.int(1, 20) : rng.int(1, 4),
        unitPrice: s.basePrice,
        taxIds: s.taxIds,
      })),
      taxes,
      history,
      calcDate,
    );

    let paidAt: string | null = null;
    if (status === 'PAID') {
      const paidDaysAfter = Math.min(rng.int(1, 25), Math.max(1, issuedDaysAgo - 1));
      paidAt = isoAt(now, issuedDaysAgo - paidDaysAfter, rng);
    }
    let cancelledAt: string | null = null;
    if (status === 'CANCELLED') {
      if (wasIssued) {
        cancelledAt = isoAt(now, issuedDaysAgo - Math.min(rng.int(1, 4), issuedDaysAgo - 1), rng);
      } else {
        cancelledAt = createdDaysAgo >= 1 ? isoAt(now, createdDaysAgo - 1, rng) : now.toISOString();
      }
    }

    const invoice: Invoice = {
      id: `inv_${String(i + 1).padStart(3, '0')}`,
      folio: null,
      uuid: wasIssued ? rng.uuid() : null,
      status,
      customerId: customer.id,
      createdBy: creator.id,
      issuer: { ...ISSUER },
      receiver: { name: customer.name, taxId: customer.taxId, address: customer.address },
      lines: totals.lines,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      createdAt,
      issuedAt,
      paidAt,
      cancelledAt,
      cancellationReason: status === 'CANCELLED' ? rng.pick(CANCEL_REASONS) : null,
    };

    (wasIssued ? issuedLike : drafts).push(invoice);
  });

  // Sequential folios per year, in issue order.
  const folioCounters: Record<string, number> = {};
  issuedLike
    .sort((a, b) => (a.issuedAt ?? '').localeCompare(b.issuedAt ?? ''))
    .forEach((inv) => {
      const year = (inv.issuedAt ?? inv.createdAt).slice(0, 4);
      const n = (folioCounters[year] ?? 0) + 1;
      folioCounters[year] = n;
      inv.folio = `INV-${year}-${String(n).padStart(4, '0')}`;
    });

  const invoices = [...issuedLike, ...drafts].sort((a, b) => a.id.localeCompare(b.id));

  let seq = 0;
  const log = (userId: string, action: string, entityId: string, timestamp: string): void => {
    seq += 1;
    audit.push({ id: `aud_seed_${String(seq).padStart(4, '0')}`, userId, action, entityType: 'invoice', entityId, timestamp });
  };

  invoices.forEach((inv) => {
    log(inv.createdBy, 'invoice.create', inv.id, inv.createdAt);
    if (inv.issuedAt) log(inv.createdBy, 'invoice.issue', inv.id, inv.issuedAt);
    if (inv.status === 'PAID' && inv.paidAt) {
      const registeredBy = rng.pick(billers).id;
      const method: PaymentMethod = rng.pick(['CARD', 'TRANSFER', 'CASH'] as const);
      payments.push({
        id: `pay_${inv.id.slice(4)}`,
        invoiceId: inv.id,
        method,
        amount: inv.total,
        reference: `SIM-${rng.code(REF_ALPHABET, 6)}`,
        paidAt: inv.paidAt,
        registeredBy,
      });
      log(registeredBy, 'invoice.pay', inv.id, inv.paidAt);
    }
    if (inv.status === 'CANCELLED' && inv.cancelledAt) {
      log(admin?.id ?? inv.createdBy, 'invoice.cancel', inv.id, inv.cancelledAt);
    }
  });

  return { invoices, payments, audit, folioCounters };
}
