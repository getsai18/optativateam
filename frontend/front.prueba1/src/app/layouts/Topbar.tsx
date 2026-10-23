import { ChevronRight, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { LanguageToggle, ThemeToggle } from '../../shared/components/ui';
import { useI18n } from '../../shared/i18n';
import { useLabels } from '../../shared/constants/labels';
import type { TokenClaims } from '../../shared/lib/token';
import { breadcrumbsFor } from './navigation';

interface TopbarProps {
  user: TokenClaims;
  onMenu: () => void;
}

export function Topbar({ user, onMenu }: TopbarProps) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const labels = useLabels();
  const crumbs = breadcrumbsFor(pathname, user.role);
  const initials = user.name
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('');

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between gap-4 border-b border-line/70 bg-surface/80 px-4 backdrop-blur-md lg:px-8 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label={t('nav.openMenu')}
          className="rounded-control p-1.5 text-muted hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <nav aria-label={t('topbar.breadcrumb')} className="min-w-0">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            {crumbs.map((c, i) => (
              <li key={c.to} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="font-semibold text-ink">
                    {t(c.label)}
                  </span>
                ) : (
                  <Link to={c.to} className="hover:text-ink hover:underline">
                    {t(c.label)}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 shadow-sm" title={user.email}>
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight">{user.name}</span>
            <span className="block text-sm leading-tight text-muted">{labels.role(user.role)}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
