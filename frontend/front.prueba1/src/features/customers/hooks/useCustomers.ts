import { useQuery } from '../../../shared/hooks/useQuery';
import { listCustomers } from '../services/customerService';

export function useCustomers() {
  return useQuery(listCustomers, []);
}
