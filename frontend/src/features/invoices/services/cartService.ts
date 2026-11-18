import { api } from '../../../shared/lib/http';
import type { BuilderLine } from '../types';

export interface CartData {
  invoiceId: string | null;
  customerId: string | null;
  lines: BuilderLine[];
  step: number;
}

// The cart lives in the AWS `cart` Lambda (DynamoDB), not in the local Flask backend.
export async function getCart(): Promise<CartData> {
  return api<CartData>('/cart', { target: 'lambda' });
}

export async function saveCart(cart: CartData): Promise<CartData> {
  return api<CartData>('/cart', { method: 'PUT', body: cart, target: 'lambda' });
}

export async function clearCart(): Promise<void> {
  await api<unknown>('/cart', { method: 'DELETE', target: 'lambda' });
}
