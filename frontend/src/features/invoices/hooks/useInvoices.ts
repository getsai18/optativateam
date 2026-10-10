import { useQuery } from '../../../shared/hooks/useQuery';
import { getInvoice, listInvoices } from '../services/invoiceService';

export function useInvoices() {
  return useQuery(listInvoices, []);
}

export function useInvoice(id: string) {
  return useQuery(() => getInvoice(id), [id]);
}
