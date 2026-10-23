import { Navigate, Outlet } from 'react-router-dom';
import { ROLE_HOME, useAuth } from '../../features/auth';
import type { Role } from '../../shared/types';

/** Restricts a branch of routes to the given roles; others are sent to their own home. */
export function RoleGuard({ allow }: { allow: Role[] }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Navigate to={ROLE_HOME[role]} replace />;
  return <Outlet />;
}
