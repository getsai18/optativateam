import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';

/** Icon button that flips between light and dark (leaves "system" once used). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const { t } = useI18n();
  const next = resolved === 'dark' ? 'light' : 'dark';
  const Icon = resolved === 'dark' ? Sun : Moon;
  const label = next === 'dark' ? t('topbar.theme.dark') : t('topbar.theme.light');
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-muted shadow-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
        className,
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
