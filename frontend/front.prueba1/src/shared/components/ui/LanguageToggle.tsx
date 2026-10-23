import { Languages } from 'lucide-react';
import { useI18n, type Lang } from '../../i18n';
import { cn } from '../../lib/cn';

const NEXT: Record<Lang, Lang> = { es: 'en', en: 'es' };

/** Compact ES/EN switcher; the tooltip names the language you switch to. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const next = NEXT[lang];
  const label = next === 'en' ? t('topbar.langToEn') : t('topbar.langTo');
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 items-center justify-center gap-1.5 rounded-control border border-line bg-surface px-2 text-xs font-semibold uppercase text-muted shadow-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
        className,
      )}
    >
      <Languages size={15} aria-hidden="true" />
      {lang}
    </button>
  );
}
