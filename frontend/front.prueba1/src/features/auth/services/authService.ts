import { api } from '../../../shared/lib/http';
import type { TokenClaims } from '../../../shared/lib/token';

export interface LoginResult {
  token: string;
  claims: TokenClaims;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return api<LoginResult>('/auth/login', { method: 'POST', body: { email: email.trim(), password }, auth: false });
}
