import { useEffect, useMemo, useState } from 'react';
import type { SortState } from '../components/ui/DataTable';

type SortValue = string | number;

interface TableState<T> {
  sort: SortState | null;
  setSort: (s: SortState | null) => void;
  page: number;
  setPage: (p: number) => void;
  pageRows: T[];
  total: number;
}

/** Client-side sorting + pagination. `resetKey` sends the table back to page 1 when filters change. */
export function useTableState<T>(
  rows: T[],
  sorters: Record<string, (row: T) => SortValue>,
  pageSize: number,
  resetKey = '',
  initialSort: SortState | null = null,
): TableState<T> {
  const [sort, setSort] = useState<SortState | null>(initialSort);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, sort]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = sorters[sort.key];
    if (!get) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    // sorters are declared inline by callers; sort + rows are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  return { sort, setSort, page: safePage, setPage, pageRows, total: sorted.length };
}
