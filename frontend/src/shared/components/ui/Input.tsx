import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { CONTROL_CLASS, Field } from './Field';

interface BaseProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  wrapperClassName?: string | undefined;
}

export type InputProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, wrapperClassName, className, required, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(CONTROL_CLASS, 'h-10', invalid ? 'border-status-cancelled' : 'border-line', className)}
          {...rest}
        />
      )}
    </Field>
  );
});

export type TextareaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, wrapperClassName, className, required, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={3}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(CONTROL_CLASS, 'py-2', invalid ? 'border-status-cancelled' : 'border-line', className)}
          {...rest}
        />
      )}
    </Field>
  );
});

export type SelectProps = BaseProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { children: ReactNode };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, wrapperClassName, className, required, children, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            className={cn(CONTROL_CLASS, 'h-10 cursor-pointer appearance-none pr-9', invalid ? 'border-status-cancelled' : 'border-line', className)}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
      )}
    </Field>
  );
});
