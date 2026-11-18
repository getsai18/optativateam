import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  width?: string;
  /** Hide on narrow (tablet) widths. */
  hideBelow?: 'lg';
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  empty?: ReactNode;
  caption: string;
}

const SKELETON_WIDTHS = ['w-24', 'w-40', 'w-28', 'w-20', 'w-32'];

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  skeletonRows = 6,
  sort,
  onSortChange,
  onRowClick,
  rowLabel,
  empty,
  caption,
}: DataTableProps<T>) {
  const { t } = useI18n();

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, dir: 'asc' });
    else if (sort.dir === 'asc') onSortChange({ key, dir: 'desc' });
    else onSortChange(null);
  };

  const hideClass = (c: Column<T>) => (c.hideBelow ? 'hidden lg:table-cell' : '');
  const [titleColumn, ...restColumns] = columns;

  if (loading) {
    return (
      <div className="min-h-40 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    'h-11 whitespace-nowrap border-y border-line/70 bg-paper/70 px-5 text-xs font-semibold text-muted',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    hideClass(c),
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={i} className="h-16 border-b border-line/60">
                {columns.map((c, ci) => (
                  <td key={c.key} className={cn('px-5', hideClass(c))}>
                    <Skeleton className={cn('h-3.5', SKELETON_WIDTHS[(ci + i) % SKELETON_WIDTHS.length], c.align === 'right' && 'ml-auto')} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="min-h-40">{empty}</div>;
  }

  return (
    <>
      {/* Desktop / tablet: classic table. */}
      <div className="hidden min-h-40 overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={ariaSort}
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      'group/th h-11 whitespace-nowrap border-y border-line/70 bg-paper/70 px-5 text-xs font-semibold text-muted',
                      c.align === 'right' ? 'text-right' : 'text-left',
                      hideClass(c),
                    )}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        aria-label={active ? (sort.dir === 'asc' ? t('table.sortAsc') : t('table.sortDesc')) : c.header}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
                          c.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort.dir === 'asc' ? (
                            <ArrowUp size={12} aria-hidden="true" className="text-primary" />
                          ) : (
                            <ArrowDown size={12} aria-hidden="true" className="text-primary" />
                          )
                        ) : (
                          <ChevronsUpDown size={12} aria-hidden="true" className="opacity-0 transition-opacity group-hover/th:opacity-60" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {onRowClick ? (
                <th scope="col" className="w-10 border-y border-line/70 bg-paper/70">
                  <span className="sr-only">{t('actions.open')}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'group h-16 border-b border-line/60 transition-colors last:border-0 hover:bg-paper/80 focus-within:bg-paper/80',
                  onRowClick && 'cursor-pointer',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c, i) => (
                  <td key={c.key} className={cn('px-5 align-middle', c.align === 'right' && 'text-right', hideClass(c))}>
                    {i === 0 && onRowClick ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(row);
                        }}
                        aria-label={rowLabel?.(row)}
                        className="block max-w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
                      >
                        {c.cell(row)}
                      </button>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
                {onRowClick ? (
                  <td className="w-10 pr-4 text-right">
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className="ml-auto -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: stacked cards, one per row, no horizontal scrolling needed. */}
      <ul className="divide-y divide-line/60 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick ? rowLabel?.(row) : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                'flex flex-col gap-2.5 px-4 py-4',
                onRowClick && 'cursor-pointer transition-colors hover:bg-paper/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-inset',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">{titleColumn?.cell(row)}</div>
                {onRowClick ? <ChevronRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-muted" /> : null}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                {restColumns.map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-xs font-medium text-muted">{c.header}</dt>
                    <dd className={cn('min-w-0 text-sm text-ink', c.align === 'right' && 'text-right')}>{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Single-line text, truncated with a native tooltip carrying the full value. */
export function Truncate({ children, className }: { children: string; className?: string }) {
  return (
    <span title={children} className={cn('block max-w-[28ch] truncate', className)}>
      {children}
    </span>
  );
}

/** Right-aligned monospace tabular amount. */
export function Money({ children, className }: { children: string; className?: string }) {
  return <span className={cn('font-medium tabular-nums', className)}>{children}</span>;
}
