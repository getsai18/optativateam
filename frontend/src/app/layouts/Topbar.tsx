import { ChevronRight, Menu, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../../shared/components/ui';
import { ROLE_LABEL } from '../../shared/constants/labels';
import type { TokenClaims } from '../../shared/lib/token';
import { breadcrumbsFor } from './navigation';

interface TopbarProps {
  user: TokenClaims;
  onMenu: () => void;
  onSearch: () => void;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Topbar({ user, onMenu, onSearch }: TopbarProps) {
  const { pathname } = useLocation();
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
          aria-label="Open navigation"
          className="rounded-control p-1.5 text-muted hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1 text-sm text-muted">
            {crumbs.map((c, i) => (
              <li key={c.to} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="font-medium text-ink">
                    {c.label}
                  </span>
                ) : (
                  <Link to={c.to} className="hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search and jump to"
          aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
          className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-2.5 text-sm text-muted shadow-sm transition-colors hover:border-primary-light/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light md:w-64"
        >
          <Search size={16} aria-hidden="true" />
          <span className="hidden flex-1 text-left md:inline">Search or jump to…</span>
          <kbd className="hidden rounded-sm border border-line bg-paper px-1.5 font-mono text-[11px] md:inline">{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 shadow-sm" title={user.email}>
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight">{user.name}</span>
            <span className="block text-xs leading-tight text-muted">{ROLE_LABEL[user.role]}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
