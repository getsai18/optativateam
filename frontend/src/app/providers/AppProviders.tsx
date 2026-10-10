import { useEffect, type ReactNode } from 'react';
import { Toaster } from '../../shared/components/ui';
import { UNAUTHORIZED_EVENT } from '../../shared/hooks/useQuery';
import { useAuthStore } from '../../features/auth';

const CHECK_INTERVAL_MS = 10_000;

/** Watches the session token: expiry (timer) and 401s from services both end the session. */
function SessionWatcher() {
  const checkExpiry = useAuthStore((s) => s.checkExpiry);
  useEffect(() => {
    const id = window.setInterval(checkExpiry, CHECK_INTERVAL_MS);
    window.addEventListener(UNAUTHORIZED_EVENT, checkExpiry);
    window.addEventListener('focus', checkExpiry);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(UNAUTHORIZED_EVENT, checkExpiry);
      window.removeEventListener('focus', checkExpiry);
    };
  }, [checkExpiry]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <SessionWatcher />
      {children}
      <Toaster />
    </>
  );
}
