export type Role = 'ADMIN' | 'BILLER' | 'CUSTOMER';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CARD' | 'TRANSFER' | 'CASH';
export type ServiceCategory =
  | 'Cloud Infrastructure'
  | 'Software Licenses'
  | 'Support & Maintenance'
  | 'Consulting'
  | 'Training'
  | 'Security'
  | 'Data & Analytics'
  | 'Development';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  customerId?: string;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  taxId: string;
  email: string;
  phone?: string;
  address: string;
  active: boolean;
}

/** `currentRate` is a fraction: 0.16 = 16%. */
export interface Tax {
  id: string;
  code: string;
  name: string;
  currentRate: number;
}

/** Valid for `validFrom <= date < validTo` (validTo exclusive, null = open ended). */
export interface TaxRateHistory {
  id: string;
  taxId: string;
  rate: number;
  validFrom: string;
  validTo: string | null;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  unit?: string;
}

export interface ServiceFeatureValue {
  featureId: string;
  value: string;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  description: string;
  basePrice: number;
  category: ServiceCategory;
  taxIds: string[];
  features: ServiceFeatureValue[];
  active: boolean;
}

export interface InvoiceLineTax {
  taxId: string;
  code: string;
  rate: number;
  amount: number;
}

export interface InvoiceLine {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  taxes: InvoiceLineTax[];
  taxAmount: number;
  lineTotal: number;
}

export interface Party {
  name: string;
  taxId: string;
  address: string;
}

export interface Invoice {
  id: string;
  folio: string | null;
  uuid: string | null;
  status: InvoiceStatus;
  customerId: string;
  createdBy: string;
  issuer: Party;
  receiver: Party;
  lines: InvoiceLine[];
  subtotal: number;
  taxTotal: number;
  total: number;
  createdAt: string;
  issuedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  amount: number;
  reference: string;
  paidAt: string;
  registeredBy: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
}
