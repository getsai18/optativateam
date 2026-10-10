import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const CONTROL_CLASS =
  'w-full rounded-control border bg-surface px-3.5 text-sm text-ink shadow-sm transition-shadow placeholder:text-muted/70 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-light/20 focus-visible:border-primary-light ' +
  'disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted';

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error wrapper, shared by Input, Select and Textarea. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-msg`;
  const hasMessage = Boolean(error ?? hint);
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-status-cancelled" aria-hidden="true">*</span> : null}
      </label>
      {children({ id, describedBy: hasMessage ? messageId : undefined, invalid: Boolean(error) })}
      {hasMessage ? (
        <p id={messageId} role={error ? 'alert' : undefined} className={cn('text-xs', error ? 'text-status-cancelled' : 'text-muted')}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
