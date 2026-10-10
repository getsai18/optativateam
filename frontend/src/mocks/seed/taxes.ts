import type { Tax, TaxRateHistory } from '../../shared/types';

export const SEED_TAXES: Tax[] = [
  { id: 'tax_vat16', code: 'VAT16', name: 'VAT', currentRate: 0.16 },
  { id: 'tax_vat0', code: 'VAT0', name: 'VAT', currentRate: 0 },
  { id: 'tax_ieps', code: 'IEPS', name: 'IEPS', currentRate: 0.03 },
];

export const SEED_TAX_HISTORY: TaxRateHistory[] = [
  { id: 'txh_vat16_1', taxId: 'tax_vat16', rate: 0.16, validFrom: '2020-01-01', validTo: null },
  { id: 'txh_vat0_1', taxId: 'tax_vat0', rate: 0, validFrom: '2020-01-01', validTo: null },
  { id: 'txh_ieps_1', taxId: 'tax_ieps', rate: 0.025, validFrom: '2024-01-01', validTo: '2026-03-01' },
  { id: 'txh_ieps_2', taxId: 'tax_ieps', rate: 0.03, validFrom: '2026-03-01', validTo: null },
];
