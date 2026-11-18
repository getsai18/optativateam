import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: string | undefined;
  side?: 'center' | 'right';
  widthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Accessible dialog base: portal, scrim, ESC to close, focus trap and focus restore. */
export function Overlay({ open, onClose, title, description, side = 'center', widthClass, children, footer }: OverlayProps) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea') ?? panel;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0] as HTMLElement;
      const lastItem = items[items.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  const isDrawer = side === 'right';
  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex', isDrawer ? 'justify-end' : 'items-center justify-center p-4')}>
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-full flex-col bg-surface shadow-pop focus:outline-none',
          isDrawer
            ? cn('h-full w-full animate-slide-in rounded-l-xl border-l border-line', widthClass ?? 'max-w-lg')
            : cn('w-full animate-fade-in rounded-xl border border-line', widthClass ?? 'max-w-md'),
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('actions.closeDialog')}
            className="rounded-control p-1 text-muted hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer ? <footer className="flex justify-end gap-2 border-t border-line bg-paper/60 px-6 py-4">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
