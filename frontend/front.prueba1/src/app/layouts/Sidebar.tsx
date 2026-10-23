import { LogOut, Receipt } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../../shared/i18n';
import { cn } from '../../shared/lib/cn';
import type { Role } from '../../shared/types';
import { NAVIGATION } from './navigation';

interface SidebarProps {
  role: Role;
  onNavigate: () => void;
  onLogout: () => void;
}

export function Sidebar({ role, onNavigate, onLogout }: SidebarProps) {
  const { t } = useI18n();

  return (
    <div className="flex h-full w-sidebar flex-col border-r border-line/70 bg-surface">
      <div className="flex h-topbar shrink-0 items-center gap-3 px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand text-white shadow-btn">
          <Receipt size={18} aria-hidden="true" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-ink">{t('brand.name')}</p>
          <p className="text-sm text-muted">{t('brand.subtitle')}</p>
        </div>
      </div>

      <nav aria-label={t('nav.main')} className="flex-1 overflow-y-auto px-4 py-4">
        {NAVIGATION[role].map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 px-3 text-xs font-semibold text-muted">{t(section.title)}</p>
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end ?? false}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex min-h-10 items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
                        isActive ? 'bg-primary-soft font-semibold text-primary' : 'text-sidebar-text hover:bg-paper hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? <span aria-hidden="true" className="absolute -left-4 top-2 h-6 w-1 rounded-r-full bg-accent" /> : null}
                        <item.icon size={18} aria-hidden="true" className={cn(isActive ? 'text-primary' : 'text-muted group-hover:text-ink')} />
                        {t(item.label)}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line/70 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-muted transition-colors hover:bg-status-cancelled-bg hover:text-status-cancelled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
        >
          <LogOut size={18} aria-hidden="true" />
          {t('nav.signOut')}
        </button>
      </div>
    </div>
  );
}
