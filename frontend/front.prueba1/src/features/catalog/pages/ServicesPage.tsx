import { useMemo, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Money,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  TableToolbar,
  Select,
  Truncate,
  toast,
  type Column,
} from '../../../shared/components/ui';
import { useI18n } from '../../../shared/i18n';
import { SERVICE_CATEGORIES, useLabels } from '../../../shared/constants/labels';
import { useTableState } from '../../../shared/hooks/useTableState';
import { errorMessage } from '../../../shared/lib/errors';
import { formatMoney } from '../../../shared/lib/format';
import type { Service, ServiceCategory } from '../../../shared/types';
import { useAuth } from '../../auth';
import { useTaxes } from '../../taxes';
import { CategoryChip } from '../components/CategoryChip';
import { ServiceFeatureList } from '../components/ServiceFeatureList';
import { ServiceForm, type ServiceFormValues } from '../components/ServiceForm';
import { useFeatures, useServices } from '../hooks/useCatalog';
import { createService, updateService } from '../services/catalogService';

const PAGE_SIZE = 10;

export function ServicesPage() {
  const { t, tn } = useI18n();
  const labels = useLabels();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const services = useServices();
  const features = useFeatures();
  const taxes = useTaxes();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ServiceCategory | ''>('');
  const [selected, setSelected] = useState<Service | 'new' | null>(null);
  const [saving, setSaving] = useState(false);

  const taxById = useMemo(() => new Map((taxes.data ?? []).map((tx) => [tx.id, tx])), [taxes.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (services.data ?? []).filter(
      (s) => (!category || s.category === category) && (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)),
    );
  }, [services.data, search, category]);

  const table = useTableState<Service>(
    filtered,
    { code: (s) => s.code, name: (s) => s.name.toLowerCase(), category: (s) => s.category, price: (s) => s.basePrice },
    PAGE_SIZE,
    `${search}|${category}`,
    { key: 'code', dir: 'asc' },
  );

  const columns: Column<Service>[] = [
    { key: 'code', header: t('catalog.services.col.code'), sortable: true, width: '96px', cell: (s) => <span className="font-mono text-xs">{s.code}</span> },
    { key: 'name', header: t('catalog.services.col.name'), sortable: true, cell: (s) => <Truncate className="font-medium">{s.name}</Truncate> },
    { key: 'category', header: t('catalog.services.col.category'), sortable: true, hideBelow: 'lg', cell: (s) => <CategoryChip category={s.category} /> },
    {
      key: 'taxes',
      header: t('catalog.services.col.taxes'),
      hideBelow: 'lg',
      cell: (s) => (
        <span className="flex gap-1">
          {s.taxIds.map((id) => (
            <Badge key={id}>{taxById.get(id)?.code ?? id}</Badge>
          ))}
        </span>
      ),
    },
    { key: 'features', header: t('catalog.services.col.features'), align: 'right', cell: (s) => <span className="font-mono tabular-nums">{s.features.length}</span> },
    { key: 'price', header: t('catalog.services.col.price'), align: 'right', sortable: true, cell: (s) => <Money>{formatMoney(s.basePrice)}</Money> },
    {
      key: 'status',
      header: t('catalog.services.col.status'),
      cell: (s) => <Badge tone={s.active ? 'paid' : 'draft'}>{s.active ? t('catalog.services.active') : t('catalog.services.inactive')}</Badge>,
    },
  ];

  const handleSubmit = async (values: ServiceFormValues) => {
    setSaving(true);
    try {
      const input = { ...values, code: values.code.toUpperCase() };
      if (selected && selected !== 'new') {
        await updateService(selected.id, input);
        toast.success(t('catalog.services.toast.updated'));
      } else {
        await createService(input);
        toast.success(t('catalog.services.toast.created'));
      }
      setSelected(null);
      services.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const editing = selected && selected !== 'new' ? selected : undefined;
  const ready = Boolean(taxes.data && features.data);
  const hasFilters = Boolean(search.trim() || category);
  const noServices = (services.data ?? []).length === 0;

  return (
    <>
      <PageHeader
        title={t('catalog.services.title')}
        description={isAdmin ? t('catalog.services.descAdmin') : t('catalog.services.descReadOnly')}
        actions={
          isAdmin ? (
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setSelected('new')} disabled={!ready}>
              {t('catalog.services.new')}
            </Button>
          ) : null
        }
      />
      <Panel>
        <TableToolbar count={tn('plural.services', table.total)}>
          <SearchInput
            value={search}
            onChange={setSearch}
            label={t('catalog.services.searchLabel')}
            placeholder={t('catalog.services.searchPlaceholder')}
            className="w-full max-w-xs"
          />
          <Select
            label={t('catalog.services.filterCategory')}
            aria-label={t('catalog.services.filterCategory')}
            wrapperClassName="w-56 [&>label]:sr-only"
            value={category}
            onChange={(e) => setCategory(e.target.value as ServiceCategory | '')}
          >
            <option value="">{t('catalog.services.allCategories')}</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labels.serviceCategory(c)}
              </option>
            ))}
          </Select>
        </TableToolbar>
        {services.error ? (
          <EmptyState
            title={t('catalog.services.loadError.title')}
            description={services.error.message}
            action={<Button onClick={services.reload}>{t('actions.retry')}</Button>}
          />
        ) : (
          <DataTable
            caption={t('catalog.services.caption')}
            columns={columns}
            rows={table.pageRows}
            rowKey={(s) => s.id}
            loading={services.loading && !services.data}
            sort={table.sort}
            onSortChange={table.setSort}
            onRowClick={setSelected}
            rowLabel={(s) => t('catalog.services.rowLabel', { name: s.name })}
            empty={
              !hasFilters && noServices ? (
                <EmptyState
                  icon={Package}
                  title={t('catalog.services.empty.title')}
                  description={isAdmin ? t('catalog.services.empty.descAdmin') : t('catalog.services.empty.descReadOnly')}
                />
              ) : (
                <EmptyState
                  icon={Package}
                  title={t('catalog.services.emptyFiltered.title')}
                  description={t('catalog.services.emptyFiltered.desc')}
                  action={
                    <Button
                      onClick={() => {
                        setSearch('');
                        setCategory('');
                      }}
                    >
                      {t('actions.clearFilters')}
                    </Button>
                  }
                />
              )
            }
          />
        )}
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected === 'new' ? t('catalog.services.new') : editing ? (isAdmin ? t('catalog.services.edit') : editing.name) : ''}
        description={editing && !isAdmin ? `${editing.code} · ${labels.serviceCategory(editing.category)}` : undefined}
        widthClass="max-w-xl"
      >
        {selected !== null && ready ? (
          isAdmin ? (
            <ServiceForm
              key={editing?.id ?? 'new'}
              service={editing}
              taxes={taxes.data ?? []}
              features={features.data ?? []}
              submitting={saving}
              onSubmit={handleSubmit}
              onCancel={() => setSelected(null)}
            />
          ) : editing ? (
            <div className="flex flex-col gap-5">
              <div className="rounded-panel bg-paper p-5">
                <p className="text-sm font-medium text-muted">{t('catalog.services.col.price')}</p>
                <p className="text-[30px] font-semibold leading-tight tracking-tight tabular-nums">{formatMoney(editing.basePrice)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CategoryChip category={editing.category} />
                  {editing.taxIds.map((id) => (
                    <Badge key={id}>{taxById.get(id)?.code ?? id}</Badge>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted">{editing.description}</p>
              <h3 className="-mb-2 text-sm font-medium text-muted">{t('catalog.services.col.features')}</h3>
              <ServiceFeatureList service={editing} features={features.data ?? []} />
            </div>
          ) : null
        ) : null}
      </Drawer>
    </>
  );
}
