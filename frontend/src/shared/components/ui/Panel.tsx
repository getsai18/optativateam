import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('animate-rise rounded-panel border border-line/70 bg-surface shadow-card', className)}>{children}</section>;
}

export function PanelHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 pb-1 pt-5">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** shown next to the title, e.g. a status badge */
  badge?: ReactNode;
}

export function PageHeader({ title, description, actions, badge }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display font-semibold tracking-tight text-ink">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Segmented pill tabs. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-control bg-paper p-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
              active ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className={cn('rounded-full px-1.5 py-0.5 font-mono text-xs tabular-nums', active ? 'bg-primary-soft text-primary' : 'bg-line/60 text-muted')}>
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
