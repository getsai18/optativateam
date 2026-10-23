let locale = 'es-MX';

const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol' });
const number = new Intl.NumberFormat(locale);
const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' });
// Date-only values (YYYY-MM-DD) are calendar days, not instants: format them in UTC so they never shift.
const dateOnly = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat(locale, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

let fmt = { money, number, date, dateOnly, dateTime };

/** Rebuild the Intl formatters when the user switches language. */
export function configureLocale(lang: 'es' | 'en'): void {
  locale = lang === 'es' ? 'es-MX' : 'en-MX';
  fmt = {
    money: new Intl.NumberFormat(locale, { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol' }),
    number: new Intl.NumberFormat(locale),
    date: new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
    dateOnly: new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    dateTime: new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function formatMoney(value: number): string {
  return fmt.money.format(value);
}

export function formatNumber(value: number): string {
  return fmt.number.format(value);
}

/** 0.16 -> "16%" */
export function formatPercent(rate: number): string {
  const pct = Math.round(rate * 10000) / 100;
  return `${pct}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? fmt.dateOnly.format(d) : fmt.date.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmt.dateTime.format(d);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** YYYY-MM-DD for a Date or ISO string (UTC based, matches stored ISO strings). */
export function toDateKey(value: Date | string): string {
  const iso = typeof value === 'string' ? value : value.toISOString();
  return iso.slice(0, 10);
}
