import { api } from '../../../shared/lib/http';
import type { BuilderLine } from '../types';

export interface CartData {
  invoiceId: string | null;
  customerId: string | null;
  lines: BuilderLine[];
  step: number;
}

// The cart lives in the AWS `cart` Lambda (DynamoDB), not in the local Flask backend.
// Off unless VITE_LAMBDA_ENABLED=true: the cart then stays in localStorage and no request leaves the browser.
const LAMBDA_ENABLED = import.meta.env.VITE_LAMBDA_ENABLED === 'true';
const EMPTY_CART: CartData = { invoiceId: null, customerId: null, lines: [], step: 0 };

export async function getCart(): Promise<CartData> {
  if (!LAMBDA_ENABLED) return EMPTY_CART;
  return api<CartData>('/cart', { target: 'lambda' });
}

export async function saveCart(cart: CartData): Promise<CartData> {
  if (!LAMBDA_ENABLED) return cart;
  return api<CartData>('/cart', { method: 'PUT', body: cart, target: 'lambda' });
}

export async function clearCart(): Promise<void> {
  if (!LAMBDA_ENABLED) return;
  await api<unknown>('/cart', { method: 'DELETE', target: 'lambda' });
}
