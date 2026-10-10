import { useState } from 'react';
import { INVOICE_STATUSES, STATUS_LABEL } from '../../../shared/constants/labels';
import { formatMoney } from '../../../shared/lib/format';
import type { DashboardData } from '../services/dashboardService';

const STATUS_COLOR = {
  DRAFT: 'rgb(var(--status-draft))',
  ISSUED: 'rgb(var(--status-issued))',
  PAID: 'rgb(var(--status-paid))',
  CANCELLED: 'rgb(var(--status-cancelled))',
} as const;

/** Invoices by status: donut with the total in the centre, plus direct-labelled bars. */
export function StatusBars({ data }: { data: DashboardData['byStatus'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const ordered = INVOICE_STATUSES.map((s) => data.find((d) => d.status === s)).filter((d): d is DashboardData['byStatus'][number] => Boolean(d));
  const total = ordered.reduce((n, d) => n + d.count, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div>
      <div className="mb-6 flex justify-center">
        <svg viewBox="0 0 140 140" className="h-36 w-36" role="img" aria-label={`${total} invoices in total`}>
          <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-paper" />
          {total > 0
            ? ordered.map((d) => {
                const len = (d.count / total) * C;
                const gap = d.count > 0 && ordered.filter((x) => x.count > 0).length > 1 ? 3 : 0;
                const el = (
                  <circle
                    key={d.status}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    style={{ stroke: STATUS_COLOR[d.status] }}
                    strokeWidth="16"
                    strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)"
                  />
                );
                offset += len;
                return el;
              })
            : null}
          <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="600" className="fill-ink">
            {total}
          </text>
          <text x="70" y="86" textAnchor="middle" fontSize="11" className="fill-muted">
            invoices
          </text>
        </svg>
      </div>
      <ul className="flex flex-col gap-4" aria-label="Invoices by status">
        {ordered.map((d) => (
          <li key={d.status} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.status] }} />
              {STATUS_LABEL[d.status]}
            </span>
            <span className="h-2 rounded-full bg-paper">
              <span
                className="block h-2 rounded-full"
                style={{ width: `${(d.count / max) * 100}%`, backgroundColor: STATUS_COLOR[d.status], minWidth: d.count > 0 ? 4 : 0 }}
              />
            </span>
            <span className="text-right font-mono font-medium tabular-nums">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const W = 560;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${+(v / 1000).toFixed(0)}k`;
  return String(v);
}

/** Monthly invoiced vs collected, grouped bars. Hover or focus a month to read exact values. */
export function RevenueChart({ data }: { data: DashboardData['monthly'] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.flatMap((d) => [d.invoiced, d.collected])));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(22, band / 3);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const activeItem = active !== null ? data[active] : undefined;

  return (
    <figure>
      <div className="mb-4 flex gap-5 text-xs font-medium text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLOR.ISSUED }} /> Invoiced
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLOR.PAID }} /> Collected
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Monthly invoiced and collected amounts, last six months">
          <defs>
            <linearGradient id="bar-invoiced" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: STATUS_COLOR.ISSUED }} />
              <stop offset="100%" style={{ stopColor: STATUS_COLOR.ISSUED, stopOpacity: 0.72 }} />
            </linearGradient>
            <linearGradient id="bar-collected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: STATUS_COLOR.PAID }} />
              <stop offset="100%" style={{ stopColor: STATUS_COLOR.PAID, stopOpacity: 0.72 }} />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-muted">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            return (
              <g key={d.key}>
                <rect
                  x={cx - barW - 1}
                  y={y(d.invoiced)}
                  width={barW}
                  height={Math.max(0, PAD.top + plotH - y(d.invoiced))}
                  rx={6}
                  fill="url(#bar-invoiced)"
                />
                <rect
                  x={cx + 1}
                  y={y(d.collected)}
                  width={barW}
                  height={Math.max(0, PAD.top + plotH - y(d.collected))}
                  rx={6}
                  fill="url(#bar-collected)"
                />
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} className="fill-muted">
                  {d.label}
                </text>
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: invoiced ${formatMoney(d.invoiced)}, collected ${formatMoney(d.collected)}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus-visible:stroke-primary"
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </svg>
        {activeItem ? (
          <div className="pointer-events-none absolute right-2 top-0 rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-pop">
            <p className="mb-1 font-semibold">{activeItem.label}</p>
            <p className="tabular-nums">Invoiced {formatMoney(activeItem.invoiced)}</p>
            <p className="tabular-nums">Collected {formatMoney(activeItem.collected)}</p>
          </div>
        ) : null}
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d.label}: invoiced ${formatMoney(d.invoiced)}, collected ${formatMoney(d.collected)}.`).join(' ')}
      </figcaption>
    </figure>
  );
}
