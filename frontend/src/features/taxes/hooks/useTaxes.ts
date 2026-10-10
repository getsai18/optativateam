import { useQuery } from '../../../shared/hooks/useQuery';
import { listTaxHistory, listTaxes } from '../services/taxService';

export function useTaxes() {
  return useQuery(listTaxes, []);
}

export function useTaxHistory() {
  return useQuery(listTaxHistory, []);
}
