import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-shimmer rounded-control bg-line/70', className)} />;
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t('a11y.loading')} className="flex flex-col gap-3">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
