import { useQuery } from '../../../shared/hooks/useQuery';
import { listPayments } from '../services/paymentService';

export function usePayments(invoiceId: string) {
  return useQuery(() => listPayments(invoiceId), [invoiceId]);
}
