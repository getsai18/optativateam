import { create } from 'zustand';
import { clearToken, getClaims, readToken, writeToken } from '../../../shared/lib/session';
import { decodeToken, isExpired, type TokenClaims } from '../../../shared/lib/token';
import { login as loginRequest } from '../services/authService';

interface AuthState {
  claims: TokenClaims | null;
  /** true when the last session ended because the token expired */
  expired: boolean;
  login: (email: string, password: string) => Promise<TokenClaims>;
  logout: () => void;
  /** Called on a timer and on 401s: drops the session if the token is no longer valid. */
  checkExpiry: () => void;
  clearExpired: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  claims: getClaims(),
  expired: false,
  login: async (email, password) => {
    const { token, claims } = await loginRequest(email, password);
    writeToken(token);
    set({ claims, expired: false });
    return claims;
  },
  logout: () => {
    clearToken();
    set({ claims: null, expired: false });
  },
  checkExpiry: () => {
    if (!get().claims) return;
    const token = readToken();
    const claims = token ? decodeToken(token) : null;
    if (!claims || isExpired(claims)) {
      clearToken();
      set({ claims: null, expired: true });
    }
  },
  clearExpired: () => set({ expired: false }),
}));
