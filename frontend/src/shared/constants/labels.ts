import { useI18n } from '../i18n';
import type { InvoiceStatus, PaymentMethod, Role, ServiceCategory } from '../types';

export const ROLES: Role[] = ['ADMIN', 'BILLER', 'CUSTOMER'];

export const INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'];

export const PAYMENT_METHODS: PaymentMethod[] = ['CARD', 'TRANSFER', 'CASH'];

/** Domain values sent to the API (kept in English on purpose). */
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

/** Translated display labels for the domain enums above. */
export function useLabels() {
  const { t } = useI18n();
  return {
    role: (role: Role) => t(`roles.${role}`),
    status: (status: InvoiceStatus) => t(`invoiceStatus.${status}`),
    paymentMethod: (method: PaymentMethod) => t(`paymentMethods.${method}`),
    serviceCategory: (category: ServiceCategory) => t(`serviceCategories.${category}`),
  };
}

export const SESSION_TTL_MS = 30 * 60 * 1000;
