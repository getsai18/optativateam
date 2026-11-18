import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {Icon ? (
        <span className="relative mb-2 flex h-16 w-16 items-center justify-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border border-dashed border-primary-light/40" />
          <span aria-hidden="true" className="absolute inset-2 rounded-full bg-primary-soft" />
          <Icon size={22} aria-hidden="true" className="relative text-primary" />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
