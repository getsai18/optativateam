import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { InvoiceStatus } from '../../types';
import { STATUS_LABEL } from '../../constants/labels';

type Tone = 'neutral' | 'primary' | 'accent' | 'draft' | 'issued' | 'paid' | 'cancelled';

const TONES: Record<Tone, string> = {
  neutral: 'bg-paper text-muted border-line',
  primary: 'bg-primary-soft text-primary border-primary/20',
  accent: 'bg-accent-soft text-accent border-accent/30',
  draft: 'bg-status-draft-bg text-status-draft border-status-draft/25',
  issued: 'bg-status-issued-bg text-status-issued border-status-issued/25',
  paid: 'bg-status-paid-bg text-status-paid border-status-paid/25',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled border-status-cancelled/25',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<InvoiceStatus, Tone> = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

/** Status is always shown with a text label and a dot, never color alone. */
export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
