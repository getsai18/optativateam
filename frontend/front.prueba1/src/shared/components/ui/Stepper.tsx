import { Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';

interface StepperProps {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('a11y.progress')}>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done && onStepClick;
          const body = (
            <>
              <span className={cn('block h-1.5 w-full rounded-full', done || active ? 'bg-brand-soft' : 'bg-line')} aria-hidden="true" />
              <span className="mt-3 flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    done && 'bg-primary text-white',
                    active && 'bg-primary-soft text-primary ring-2 ring-primary-light/40',
                    !done && !active && 'bg-paper text-muted',
                  )}
                >
                  {done ? <Check size={14} aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn('text-left text-sm leading-tight', active ? 'font-semibold text-ink' : 'text-muted')}>{label}</span>
              </span>
            </>
          );
          return (
            <li key={label} className="pr-3 last:pr-0" aria-current={active ? 'step' : undefined}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(i)}
                  className="block w-full rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
                >
                  {body}
                </button>
              ) : (
                <span className="block">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
