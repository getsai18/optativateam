import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FirstRunTour } from '../../shared/components/onboarding/FirstRunTour';
import { useAuth } from '../../features/auth';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (!user) return null;

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar lg:block print:hidden">
        <Sidebar role={user.role} onNavigate={() => undefined} onLogout={signOut} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-sidebar">
            <Sidebar role={user.role} onNavigate={() => setDrawerOpen(false)} onLogout={signOut} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-sidebar print:pl-0">
        <Topbar user={user} onMenu={() => setDrawerOpen(true)} />
        <main className="page-stack mx-auto w-full max-w-content px-4 py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>

      <FirstRunTour role={user.role} />
    </div>
  );
}
