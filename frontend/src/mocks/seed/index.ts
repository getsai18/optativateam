import type { AuditEntry, Feature, Service, User, Customer, Tax, TaxRateHistory, Invoice, Payment } from '../../shared/types';
import { buildFeatures } from './features';
import { buildInvoices } from './invoices';
import { buildCustomers, buildUsers } from './people';
import { createRng } from './rng';
import { buildServices } from './services';
import { SEED_TAXES, SEED_TAX_HISTORY } from './taxes';

export interface Db {
  users: User[];
  customers: Customer[];
  taxes: Tax[];
  taxHistory: TaxRateHistory[];
  features: Feature[];
  services: Service[];
  invoices: Invoice[];
  payments: Payment[];
  audit: AuditEntry[];
  /** last used folio number per year, e.g. { "2026": 31 } */
  folioCounters: Record<string, number>;
}

const SEED_VALUE = 20260401;

/** Deterministic dataset: same structure on every run (dates are relative to `now`). */
export function buildSeed(now: Date = new Date()): Db {
  const rng = createRng(SEED_VALUE);
  const taxes = SEED_TAXES.map((t) => ({ ...t }));
  const taxHistory = SEED_TAX_HISTORY.map((h) => ({ ...h }));
  const features = buildFeatures();
  const services = buildServices(rng, taxes, features);
  const customers = buildCustomers(rng);
  const users = buildUsers(customers);
  const { invoices, payments, audit, folioCounters } = buildInvoices({
    rng,
    now,
    customers,
    users,
    services,
    taxes,
    history: taxHistory,
  });

  const setupAt = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString();
  const setupAudit: AuditEntry[] = [
    ...users.map((u, i) => ({
      id: `aud_setup_u${i}`,
      userId: 'usr_admin',
      action: 'user.create',
      entityType: 'user',
      entityId: u.id,
      timestamp: setupAt,
    })),
    ...customers.map((c, i) => ({
      id: `aud_setup_c${i}`,
      userId: 'usr_admin',
      action: 'customer.create',
      entityType: 'customer',
      entityId: c.id,
      timestamp: setupAt,
    })),
    {
      id: 'aud_setup_tax',
      userId: 'usr_admin',
      action: 'tax.rate_change',
      entityType: 'tax',
      entityId: 'tax_ieps',
      timestamp: '2026-03-01T12:00:00.000Z',
    },
  ];

  return {
    users,
    customers,
    taxes,
    taxHistory,
    features,
    services,
    invoices,
    payments,
    audit: [...setupAudit, ...audit].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    folioCounters,
  };
}
