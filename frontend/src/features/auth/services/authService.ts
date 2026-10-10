import { query } from '../../../mocks/db';
import { latency } from '../../../mocks/latency';
import { DEMO_PASSWORD } from '../../../mocks/seed/people';
import { SESSION_TTL_MS } from '../../../shared/constants/labels';
import { ApiError } from '../../../shared/lib/errors';
import { encodeToken, type TokenClaims } from '../../../shared/lib/token';

export interface LoginResult {
  token: string;
  claims: TokenClaims;
}

// TODO: replace with API Gateway call (POST /auth/login)
export async function login(email: string, password: string): Promise<LoginResult> {
  await latency();
  const user = query((db) => db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()));
  if (!user || password !== DEMO_PASSWORD) {
    throw new ApiError('UNAUTHORIZED', 'Invalid email or password');
  }
  if (!user.active) {
    throw new ApiError('FORBIDDEN', 'This account has been deactivated');
  }
  const claims: TokenClaims = {
    sub: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
    ...(user.customerId ? { customerId: user.customerId } : {}),
  };
  return { token: encodeToken(claims), claims };
}
