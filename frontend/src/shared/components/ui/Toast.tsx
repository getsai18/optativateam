import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '../../lib/cn';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (kind, message) => {
    const id = ++counter;
    set((s) => ({ items: [...s.items, { id, kind, message }] }));
    window.setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 4000);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const TONES: Record<ToastKind, string> = {
  success: 'text-status-paid',
  error: 'text-status-cancelled',
  info: 'text-status-issued',
};

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2 print:hidden">
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-panel border border-line bg-surface p-4 shadow-pop"
          >
            <Icon size={18} aria-hidden="true" className={cn('mt-0.5 shrink-0', TONES[t.kind])} />
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-control p-0.5 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
