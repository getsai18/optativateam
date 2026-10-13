import { api } from '../../../shared/lib/http';
import type { Customer } from '../../../shared/types';
import type { CustomerInput } from '../types';

export async function listCustomers(): Promise<Customer[]> {
  return api<Customer[]>('/customers');
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  return api<Customer>('/customers', { method: 'POST', body: input });
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  return api<Customer>(`/customers/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}
