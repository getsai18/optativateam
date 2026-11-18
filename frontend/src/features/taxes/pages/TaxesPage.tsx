import { useState } from 'react';
import { Percent } from 'lucide-react';
import { Badge, Button, EmptyState, PageHeader, Panel, SkeletonBlock, toast } from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
import { errorMessage } from '../../../shared/lib/errors';
import { formatPercent } from '../../../shared/lib/format';
import type { Tax } from '../../../shared/types';
import { ChangeRateModal } from '../components/ChangeRateModal';
import { RateTimeline } from '../components/RateTimeline';
import { useTaxHistory, useTaxes } from '../hooks/useTaxes';
import { changeTaxRate } from '../services/taxService';

export function TaxesPage() {
  const { t } = useI18n();
  const taxes = useTaxes();
  const history = useTaxHistory();
  const [editing, setEditing] = useState<Tax | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (rate: number, validFrom: string) => {
    if (!editing) return;
    setSaving(true);
    try {
      await changeTaxRate({ taxId: editing.id, rate, validFrom });
      toast.success(t('taxes.toast.updated', { code: editing.code }));
      setEditing(null);
      taxes.reload();
      history.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const loading = taxes.loading || history.loading;
  return (
    <>
      <PageHeader title={t('taxes.title')} description={t('taxes.description')} />
      {loading && !taxes.data ? (
        <Panel className="p-4">
          <SkeletonBlock lines={5} />
        </Panel>
      ) : (taxes.data ?? []).length === 0 ? (
        <Panel>
          <EmptyState icon={Percent} title={t('taxes.empty.title')} />
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {(taxes.data ?? []).map((tax) => (
            <Panel key={tax.id}>
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-soft text-primary">
                    <Percent size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold leading-tight">{tax.name}</h2>
                    <Badge className="mt-1 font-mono">{tax.code}</Badge>
                  </div>
                </div>
                <Button size="sm" onClick={() => setEditing(tax)}>
                  {t('taxes.card.changeRate')}
                </Button>
              </div>
              <div className="mx-5 rounded-panel bg-paper px-5 py-4">
                <p className="text-sm font-medium text-muted">{t('taxes.card.currentRate')}</p>
                <p className="text-[34px] font-semibold leading-tight tracking-tight tabular-nums">{formatPercent(tax.currentRate)}</p>
              </div>
              <div className="p-5">
                <h3 className="mb-4 text-sm font-medium text-muted">{t('taxes.card.history')}</h3>
                <RateTimeline entries={(history.data ?? []).filter((h) => h.taxId === tax.id)} />
              </div>
            </Panel>
          ))}
        </div>
      )}
      <ChangeRateModal tax={editing} submitting={saving} onClose={() => setEditing(null)} onSubmit={handleSubmit} />
    </>
  );
}
