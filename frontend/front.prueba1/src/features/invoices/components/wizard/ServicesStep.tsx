import { useMemo, useState } from 'react';
import { Eye, Package, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Money,
  Pagination,
  SearchInput,
  Select,
} from '../../../../shared/components/ui';
import { SERVICE_CATEGORIES, useLabels } from '../../../../shared/constants/labels';
import { useI18n } from '../../../../shared/i18n';
import { useTableState } from '../../../../shared/hooks/useTableState';
import { cn } from '../../../../shared/lib/cn';
import { formatMoney } from '../../../../shared/lib/format';
import type { Feature, Service, ServiceCategory } from '../../../../shared/types';
import { CategoryChip, ServiceFeatureList } from '../../../catalog';
import { useBuilderStore } from '../../store/builderStore';

const PAGE_SIZE = 8;

interface ServicesStepProps {
  services: Service[];
  features: Feature[];
  taxNames: Map<string, string>;
}

export function ServicesStep({ services, features, taxNames }: ServicesStepProps) {
  const { t } = useI18n();
  const labels = useLabels();
  const lines = useBuilderStore((s) => s.lines);
  const addService = useBuilderStore((s) => s.addService);
  const setQuantity = useBuilderStore((s) => s.setQuantity);
  const removeService = useBuilderStore((s) => s.removeService);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ServiceCategory | ''>('');
  const [preview, setPreview] = useState<Service | null>(null);

  const quantityById = useMemo(() => new Map(lines.map((l) => [l.serviceId, l.quantity])), [lines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter(
      (s) => s.active && (!category || s.category === category) && (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)),
    );
  }, [services, search, category]);

  const table = useTableState<Service>(filtered, {}, PAGE_SIZE, `${search}|${category}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          label={t('invoices.services.searchLabel')}
          placeholder={t('invoices.services.searchPlaceholder')}
          className="w-full max-w-xs"
        />
        <Select
          label={t('invoices.services.category')}
          wrapperClassName="[&>label]:sr-only"
          value={category}
          onChange={(e) => setCategory(e.target.value as ServiceCategory | '')}
        >
          <option value="">{t('invoices.services.allCategories')}</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {labels.serviceCategory(c)}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-panel border border-line/70">
        {table.pageRows.length === 0 ? (
          <EmptyState icon={Package} title={t('invoices.services.empty.title')} description={t('invoices.services.empty.description')} />
        ) : (
          <ul className="divide-y divide-line">
            {table.pageRows.map((s) => {
              const qty = quantityById.get(s.id);
              return (
                <li key={s.id} className={cn('flex flex-wrap items-center gap-3 px-5 py-4 transition-colors', qty !== undefined && 'bg-primary-soft/50')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={s.name}>
                      {s.name}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-mono">{s.code}</span>
                      <CategoryChip category={s.category} />
                      {s.taxIds.map((id) => (
                        <Badge key={id}>{taxNames.get(id) ?? id}</Badge>
                      ))}
                    </p>
                  </div>
                  <Money className="text-sm">{formatMoney(s.basePrice)}</Money>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('invoices.services.previewLabel', { name: s.name })}
                    icon={<Eye size={14} aria-hidden="true" />}
                    onClick={() => setPreview(s)}
                  />
                  {qty === undefined ? (
                    <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => addService(s.id)}>
                      {t('invoices.services.add')}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <label className="sr-only" htmlFor={`qty-${s.id}`}>
                        {t('invoices.services.qtyLabel', { name: s.name })}
                      </label>
                      <input
                        id={`qty-${s.id}`}
                        type="number"
                        min={1}
                        max={9999}
                        step={1}
                        value={qty}
                        onChange={(e) => {
                          const n = Math.floor(Number(e.target.value));
                          if (Number.isFinite(n) && n >= 1) setQuantity(s.id, Math.min(n, 9999));
                        }}
                        className="h-8 w-20 rounded-control border border-line px-2 text-right font-mono text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('invoices.services.removeLabel', { name: s.name })}
                        icon={<Trash2 size={14} aria-hidden="true" />}
                        onClick={() => removeService(s.id)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </div>

      <Drawer
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.name ?? ''}
        description={preview ? `${preview.code} · ${labels.serviceCategory(preview.category)}` : undefined}
      >
        {preview ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{preview.description}</p>
            <p className="text-xl tabular-nums">{formatMoney(preview.basePrice)}</p>
            <ServiceFeatureList service={preview} features={features} />
            <Button
              variant="primary"
              onClick={() => {
                addService(preview.id);
                setPreview(null);
              }}
              disabled={quantityById.has(preview.id)}
            >
              {quantityById.has(preview.id) ? t('invoices.services.alreadyAdded') : t('invoices.services.addToInvoice')}
            </Button>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
