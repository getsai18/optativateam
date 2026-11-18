import type { Role } from '../../../shared/types';
import type { TokenClaims } from '../../../shared/lib/token';
import { useAuthStore } from '../store/authStore';

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/dashboard',
  BILLER: '/dashboard',
  CUSTOMER: '/my-invoices',
};

/** Current session user plus auth actions. */
export function useAuth() {
  const user = useAuthStore((s) => s.claims);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  return { user, role: user?.role ?? null, isAuthenticated: user !== null, login, logout };
}

/** For screens that are only reachable while authenticated. */
export function useCurrentUser(): TokenClaims {
  const user = useAuthStore((s) => s.claims);
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}
