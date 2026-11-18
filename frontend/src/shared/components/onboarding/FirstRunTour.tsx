import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FilePlus2, Languages, LayoutDashboard, Menu, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';
import { Button } from '../ui';
import { Modal } from '../ui/Modal';
import { markTourSeen, tourSeen, useTourStore } from './tourStore';

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

interface FirstRunTourProps {
  role: 'ADMIN' | 'BILLER' | 'CUSTOMER';
}

/** Short first-use guide: explains the menu and the billing flow. Auto-runs at the start of every session. */
export function FirstRunTour({ role }: FirstRunTourProps) {
  const { t } = useI18n();
  const { open, start, close } = useTourStore();
  const [index, setIndex] = useState(0);

  const staff = role !== 'CUSTOMER';
  const steps = useMemo<Step[]>(() => {
    if (staff) {
      return [
        { icon: Menu, title: t('tour.staff.1.title'), body: t('tour.staff.1.body') },
        { icon: FilePlus2, title: t('tour.staff.2.title'), body: t('tour.staff.2.body') },
        { icon: Languages, title: t('tour.staff.3.title'), body: t('tour.staff.3.body') },
      ];
    }
    return [
      { icon: LayoutDashboard, title: t('tour.customer.1.title'), body: t('tour.customer.1.body') },
      { icon: BookOpen, title: t('tour.customer.2.title'), body: t('tour.customer.2.body') },
      { icon: Languages, title: t('tour.customer.3.title'), body: t('tour.customer.3.body') },
    ];
  }, [staff, t]);

  useEffect(() => {
    if (!tourSeen()) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    markTourSeen();
    setIndex(0);
    close();
  };

  if (!open) return null;

  const step = steps[Math.min(index, steps.length - 1)]!;
  const Icon = step.icon;
  const last = index === steps.length - 1;

  return (
    <Modal
      open={open}
      onClose={finish}
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={18} aria-hidden="true" className="text-accent" />
          {staff ? t('tour.staff.1.title') : t('tour.customer.1.title')}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={finish}>
            {t('tour.skip')}
          </Button>
          <div className="flex items-center gap-2">
            {index > 0 ? <Button onClick={() => setIndex(index - 1)}>{t('tour.back')}</Button> : null}
            <Button variant="primary" onClick={() => (last ? finish() : setIndex(index + 1))}>
              {last ? t('tour.finish') : t('tour.next')}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={cn('h-1.5 w-8 rounded-full transition-colors', i === index ? 'bg-primary' : 'bg-line')} />
            ))}
          </div>
          <p className="text-sm text-muted tabular-nums">{t('tour.progress', { current: index + 1, total: steps.length })}</p>
        </div>
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
            <Icon size={22} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
