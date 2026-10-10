import { ApiError } from './errors';
import { sessionStore } from './storage';
import { decodeToken, isExpired, type TokenClaims } from './token';

const TOKEN_KEY = 'billing.token';

export function readToken(): string | null {
  return sessionStore.get<string>(TOKEN_KEY);
}

export function writeToken(token: string): void {
  sessionStore.set(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStore.remove(TOKEN_KEY);
}

/** Claims of the current token, or null when missing, malformed or expired. */
export function getClaims(): TokenClaims | null {
  const token = readToken();
  if (!token) return null;
  const claims = decodeToken(token);
  if (!claims || isExpired(claims)) return null;
  return claims;
}

/** Plays the role of the API authorizer: services call this before touching data. */
export function requireClaims(): TokenClaims {
  const claims = getClaims();
  if (!claims) throw new ApiError('UNAUTHORIZED', 'Session expired');
  return claims;
}
