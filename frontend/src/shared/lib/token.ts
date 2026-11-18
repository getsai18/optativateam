import type { Role } from '../types';

export interface TokenClaims {
  sub: string;
  email: string;
  name: string;
  role: Role;
  customerId?: string;
  /** expiry, epoch milliseconds */
  exp: number;
}

function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Mock JWT: header.payload.signature (the signature is NOT cryptographic). */
export function encodeToken(claims: TokenClaims): string {
  const header = b64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  return `${header}.${b64urlEncode(JSON.stringify(claims))}.${b64urlEncode('mock-signature')}`;
}

export function decodeToken(token: string): TokenClaims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const parsed: unknown = JSON.parse(b64urlDecode(part));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const c = parsed as Partial<TokenClaims>;
    if (!c.sub || !c.role || typeof c.exp !== 'number') return null;
    return c as TokenClaims;
  } catch {
    return null;
  }
}

export function isExpired(claims: TokenClaims, now: number = Date.now()): boolean {
  return claims.exp <= now;
}
