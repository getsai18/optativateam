import { api } from '../../../shared/lib/http';
import type { Tax, TaxRateHistory } from '../../../shared/types';

export async function listTaxes(): Promise<Tax[]> {
  return api<Tax[]>('/taxes');
}

export async function listTaxHistory(): Promise<TaxRateHistory[]> {
  return api<TaxRateHistory[]>('/taxes/history');
}

export interface ChangeRateInput {
  taxId: string;
  /** fraction, 0.16 = 16% */
  rate: number;
  /** YYYY-MM-DD, today or later */
  validFrom: string;
}

export async function changeTaxRate(input: ChangeRateInput): Promise<Tax> {
  return api<Tax>(`/taxes/${encodeURIComponent(input.taxId)}/rates`, {
    method: 'POST',
    body: { rate: input.rate, validFrom: input.validFrom },
  });
}
