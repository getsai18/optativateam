import { useId, type ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';

/** Filter row above a table, with the live result count on the right. */
export function TableToolbar({ children, count }: { children: ReactNode; count: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-5 py-4">
      {children}
      <p aria-live="polite" className="ml-auto whitespace-nowrap text-xs text-muted tabular-nums">
        {count}
      </p>
    </div>
  );
}

interface DateRangeInputProps {
  label?: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

/** One control for a from/to date range (two native date inputs inside a single field). */
export function DateRangeInput({ label = 'Date range', from, to, onFromChange, onToChange }: DateRangeInputProps) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm shadow-sm transition-shadow focus-within:border-primary-light focus-within:ring-4 focus-within:ring-primary-light/20"
    >
      <span id={id} className="sr-only">
        {label}
      </span>
      <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-muted" />
      <input
        type="date"
        aria-label="From date"
        value={from}
        max={to || undefined}
        onChange={(e) => onFromChange(e.target.value)}
        className="w-[8.5rem] bg-transparent text-ink focus:outline-none"
      />
      <span aria-hidden="true" className="text-muted">
        →
      </span>
      <input
        type="date"
        aria-label="To date"
        value={to}
        min={from || undefined}
        onChange={(e) => onToChange(e.target.value)}
        className="w-[8.5rem] bg-transparent text-ink focus:outline-none"
      />
    </div>
  );
}
