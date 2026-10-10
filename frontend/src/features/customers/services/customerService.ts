import { mutate, query } from '../../../mocks/db';
import { requireRole, writeAudit } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { ApiError } from '../../../shared/lib/errors';
import { newId } from '../../../shared/lib/id';
import { requireClaims } from '../../../shared/lib/session';
import type { Customer } from '../../../shared/types';
import type { CustomerInput } from '../types';

// TODO: replace with API Gateway call (GET /customers)
export async function listCustomers(): Promise<Customer[]> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return query((db) => db.customers);
}

// TODO: replace with API Gateway call (POST /customers)
export async function createCustomer(input: CustomerInput): Promise<Customer> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN', 'BILLER');
  return mutate((db) => {
    if (db.customers.some((c) => c.taxId === input.taxId)) {
      throw new ApiError('CONFLICT', 'A customer with this tax ID already exists');
    }
    const customer: Customer = { ...input, id: newId('cus'), active: input.active ?? true };
    db.customers.push(customer);
    writeAudit(db, claims, 'customer.create', 'customer', customer.id);
    return customer;
  });
}

// TODO: replace with API Gateway call (PUT /customers/{id})
export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return mutate((db) => {
    const customer = db.customers.find((c) => c.id === id);
    if (!customer) throw new ApiError('NOT_FOUND', 'Customer not found');
    if (db.customers.some((c) => c.id !== id && c.taxId === input.taxId)) {
      throw new ApiError('CONFLICT', 'A customer with this tax ID already exists');
    }
    Object.assign(customer, input, { active: input.active ?? customer.active });
    if (!input.phone) delete customer.phone;
    writeAudit(db, claims, 'customer.update', 'customer', id);
    return customer;
  });
}
