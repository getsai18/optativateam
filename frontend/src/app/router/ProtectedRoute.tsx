import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth';

/** Requires a valid session; otherwise sends the user to /login and remembers where they were going. */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
