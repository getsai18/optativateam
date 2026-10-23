import { Search, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';
import { CONTROL_CLASS } from './Field';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder, label, className }: SearchInputProps) {
  const { t } = useI18n();
  return (
    <div className={cn('relative', className)}>
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        aria-label={label ?? t('actions.search')}
        value={value}
        placeholder={placeholder ?? t('actions.search')}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            onChange('');
          }
        }}
        className={cn(CONTROL_CLASS, 'h-10 border-line pl-9 pr-9')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('actions.clearSearch')}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
