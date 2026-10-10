import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from 'lucide-react';
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
  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, dir: 'asc' });
    else if (sort.dir === 'asc') onSortChange({ key, dir: 'desc' });
    else onSortChange(null);
  };

  const hideClass = (c: Column<T>) => (c.hideBelow ? 'hidden lg:table-cell' : '');

  return (
    <div className="min-h-40 overflow-x-auto">
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
                    'group/th h-10 whitespace-nowrap border-y border-line/70 bg-paper/70 px-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    hideClass(c),
                  )}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-sm uppercase tracking-[0.06em] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
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
                <span className="sr-only">Open</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} className="h-14 border-b border-line/60">
                  {columns.map((c, ci) => (
                    <td key={c.key} className={cn('px-5', hideClass(c))}>
                      <Skeleton className={cn('h-3.5', SKELETON_WIDTHS[(ci + i) % SKELETON_WIDTHS.length], c.align === 'right' && 'ml-auto')} />
                    </td>
                  ))}
                  {onRowClick ? <td /> : null}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'group h-14 border-b border-line/60 transition-colors last:border-0 hover:bg-paper/80 focus-within:bg-paper/80',
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
      {!loading && rows.length === 0 ? empty : null}
    </div>
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
