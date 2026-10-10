import type { InvoiceStatus, PaymentMethod, Role, ServiceCategory } from '../types';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  BILLER: 'Biller',
  CUSTOMER: 'Customer',
};

export const ROLES: Role[] = ['ADMIN', 'BILLER', 'CUSTOMER'];

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export const INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CARD: 'Credit/Debit Card',
  TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
};

export const PAYMENT_METHODS: PaymentMethod[] = ['CARD', 'TRANSFER', 'CASH'];

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  'Cloud Infrastructure',
  'Software Licenses',
  'Support & Maintenance',
  'Consulting',
  'Training',
  'Security',
  'Data & Analytics',
  'Development',
];

export const SESSION_TTL_MS = 30 * 60 * 1000;
