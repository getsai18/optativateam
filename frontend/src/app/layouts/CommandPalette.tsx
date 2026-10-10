import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CornerDownLeft, FilePlus2, FileText, Search, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../features/invoices';
import { StatusBadge } from '../../shared/components/ui';
import { cn } from '../../shared/lib/cn';
import { formatMoney } from '../../shared/lib/format';
import type { InvoiceStatus, Role } from '../../shared/types';
import { NAVIGATION } from './navigation';

interface Item {
  id: string;
  group: 'Actions' | 'Pages' | 'Invoices';
  label: string;
  sub?: string;
  icon: LucideIcon;
  to: string;
  status?: InvoiceStatus;
}

const MAX_INVOICES = 6;

/** ⌘K / Ctrl+K quick switcher: pages, actions and invoices the user can see. Mounted only while open. */
export function CommandPalette({ role, onClose }: { role: Role; onClose: () => void }) {
  const navigate = useNavigate();
  const invoices = useInvoices();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (...values: string[]) => !q || values.some((v) => v.toLowerCase().includes(q));
    const staff = role !== 'CUSTOMER';

    const actions: Item[] = staff && match('new invoice create') ? [{ id: 'new', group: 'Actions', label: 'Create new invoice', icon: FilePlus2, to: '/invoices/new' }] : [];
    const pages: Item[] = NAVIGATION[role]
      .flatMap((s) => s.items)
      .filter((n) => n.to !== '/invoices/new' && match(n.label))
      .map((n) => ({ id: n.to, group: 'Pages' as const, label: n.label, icon: n.icon, to: n.to }));
    const found: Item[] = (invoices.data ?? [])
      .filter((i) => q && match(i.folio ?? '', i.receiver.name, i.uuid ?? ''))
      .slice(0, MAX_INVOICES)
      .map((i) => ({
        id: i.id,
        group: 'Invoices' as const,
        label: i.folio ?? (i.status === 'DRAFT' ? 'Draft invoice' : 'Not issued'),
        sub: `${i.receiver.name} · ${formatMoney(i.total)}`,
        icon: FileText,
        to: `/invoices/${i.id}`,
        status: i.status,
      }));
    return [...actions, ...pages, ...found];
  }, [query, role, invoices.data]);

  const safeActive = Math.min(active, Math.max(0, items.length - 1));

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((safeActive + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((safeActive - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[safeActive]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Search and jump to" className="relative w-full max-w-xl animate-rise overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} aria-hidden="true" className="text-muted" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[safeActive] ? `${listId}-${items[safeActive].id}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, or an invoice by folio or customer…"
            className="h-14 flex-1 bg-transparent text-base text-ink placeholder:text-muted/70 focus:outline-none"
          />
          <kbd className="rounded-sm border border-line bg-paper px-1.5 py-0.5 font-mono text-xs text-muted">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted">No results for “{query}”.</li>
          ) : (
            items.map((item, index) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const selected = index === safeActive;
              return (
                <li key={item.id} role="presentation">
                  {header ? <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted first:pt-1">{header}</p> : null}
                  <div
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5', selected ? 'bg-primary-soft' : 'hover:bg-paper')}
                  >
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-control', selected ? 'bg-surface text-primary shadow-sm' : 'bg-paper text-muted')}>
                      <item.icon size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', item.group === 'Invoices' ? 'font-mono font-medium' : 'font-medium')}>{item.label}</span>
                      {item.sub ? <span className="block truncate text-xs text-muted">{item.sub}</span> : null}
                    </span>
                    {item.status ? <StatusBadge status={item.status} /> : null}
                    {selected ? <ArrowRight size={16} aria-hidden="true" className="text-primary" /> : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex items-center gap-4 border-t border-line bg-paper/60 px-4 py-2 text-xs text-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded-sm border border-line bg-surface px-1 font-mono">↑</kbd>
            <kbd className="rounded-sm border border-line bg-surface px-1 font-mono">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft size={12} aria-hidden="true" /> open
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
