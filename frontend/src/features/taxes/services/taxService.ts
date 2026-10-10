import { mutate, query } from '../../../mocks/db';
import { requireRole, writeAudit } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { ApiError } from '../../../shared/lib/errors';
import { toDateKey } from '../../../shared/lib/format';
import { newId } from '../../../shared/lib/id';
import { requireClaims } from '../../../shared/lib/session';
import type { Tax, TaxRateHistory } from '../../../shared/types';

// TODO: replace with API Gateway call (GET /taxes)
export async function listTaxes(): Promise<Tax[]> {
  await latency();
  requireClaims();
  return query((db) => db.taxes);
}

// TODO: replace with API Gateway call (GET /taxes/history)
export async function listTaxHistory(): Promise<TaxRateHistory[]> {
  await latency();
  requireClaims();
  return query((db) => db.taxHistory);
}

export interface ChangeRateInput {
  taxId: string;
  /** fraction, 0.16 = 16% */
  rate: number;
  /** YYYY-MM-DD, today or later */
  validFrom: string;
}

// TODO: replace with API Gateway call (POST /taxes/{id}/rates)
export async function changeTaxRate(input: ChangeRateInput): Promise<Tax> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return mutate((db) => {
    const tax = db.taxes.find((t) => t.id === input.taxId);
    if (!tax) throw new ApiError('NOT_FOUND', 'Tax not found');
    if (input.rate < 0 || input.rate > 1) throw new ApiError('VALIDATION', 'Rate must be between 0% and 100%');
    const today = toDateKey(new Date());
    if (input.validFrom < today) throw new ApiError('VALIDATION', 'The new rate cannot start in the past');

    const entries = db.taxHistory.filter((h) => h.taxId === tax.id);
    const open = entries.find((h) => h.validTo === null);
    if (open && input.validFrom <= open.validFrom.slice(0, 10)) {
      throw new ApiError('VALIDATION', `The new rate must start after ${open.validFrom.slice(0, 10)}`);
    }
    if (open) open.validTo = input.validFrom;
    db.taxHistory.push({ id: newId('txh'), taxId: tax.id, rate: input.rate, validFrom: input.validFrom, validTo: null });

    // currentRate = rate whose period covers today (a future-dated change is only scheduled)
    const covering = db.taxHistory.find(
      (h) => h.taxId === tax.id && h.validFrom.slice(0, 10) <= today && (h.validTo === null || today < h.validTo.slice(0, 10)),
    );
    if (covering) tax.currentRate = covering.rate;

    writeAudit(db, claims, 'tax.rate_change', 'tax', tax.id);
    return tax;
  });
}
