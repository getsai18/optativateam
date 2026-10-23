import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** 1 … 4 5 6 … 12 — always shows the first, last and the neighbours of the current page. */
function pageList(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push('gap');
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pages - 1) out.push('gap');
  out.push(pages);
  return out;
}

const STEP =
  'inline-flex h-8 items-center gap-1 rounded-control px-2.5 text-xs font-medium text-muted transition-colors hover:bg-paper hover:text-ink ' +
  'disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light';

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label={t('pagination.label')} className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-5 py-3">
      <p className="text-sm text-muted" aria-live="polite">
        {t('pagination.showing', { from, to, total })}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <button type="button" className={STEP} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label={t('pagination.prev')}>
            <ChevronLeft size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t('pagination.prev')}</span>
          </button>
          {pageList(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-xs text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={t('pagination.page', { n: p })}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-8 rounded-control px-2 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
                  p === page ? 'bg-primary-soft font-semibold text-primary' : 'text-muted hover:bg-paper hover:text-ink',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className={STEP} onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label={t('pagination.next')}>
            <span className="hidden sm:inline">{t('pagination.next')}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
