import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  TableToolbar,
  Textarea,
  Truncate,
  toast,
  type Column,
} from '../../../shared/components/ui';
import { useI18n, type TFn } from '../../../shared/i18n';
import { useTableState } from '../../../shared/hooks/useTableState';
import { errorMessage } from '../../../shared/lib/errors';
import type { Feature } from '../../../shared/types';
import { useFeatures, useServices } from '../hooks/useCatalog';
import { createFeature, deleteFeature, updateFeature } from '../services/catalogService';

const PAGE_SIZE = 12;

function makeFeatureSchema(t: TFn) {
  return z.object({
    name: z.string().trim().min(2, t('catalog.features.form.error.nameRequired')).max(60, t('catalog.features.form.error.nameTooLong')),
    description: z.string().trim().min(5, t('catalog.features.form.error.descRequired')).max(200, t('catalog.features.form.error.descTooLong')),
    unit: z.string().trim().max(20, t('catalog.features.form.error.unitTooLong')).optional(),
  });
}

type FeatureValues = z.infer<ReturnType<typeof makeFeatureSchema>>;

function FeatureForm({ feature, submitting, onSubmit, onCancel }: { feature?: Feature | undefined; submitting: boolean; onSubmit: (v: FeatureValues) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const featureSchema = makeFeatureSchema(t);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FeatureValues>({
    mode: 'onChange',
    resolver: zodResolver(featureSchema),
    defaultValues: { name: feature?.name ?? '', description: feature?.description ?? '', unit: feature?.unit ?? '' },
  });
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Input label={t('catalog.features.form.name')} required error={errors.name?.message} {...register('name')} />
      <Textarea label={t('catalog.features.form.description')} required error={errors.description?.message} {...register('description')} />
      <Input label={t('catalog.features.form.unit')} hint={t('catalog.features.form.unitHint')} error={errors.unit?.message} {...register('unit')} />
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>{t('actions.cancel')}</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {feature ? t('actions.saveChanges') : t('catalog.features.form.create')}
        </Button>
      </div>
    </form>
  );
}

export function FeaturesPage() {
  const { t, tn } = useI18n();
  const features = useFeatures();
  const services = useServices();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Feature | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Feature | null>(null);
  const [saving, setSaving] = useState(false);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    (services.data ?? []).forEach((s) => s.features.forEach((f) => counts.set(f.featureId, (counts.get(f.featureId) ?? 0) + 1)));
    return counts;
  }, [services.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (features.data ?? []).filter((f) => !q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
  }, [features.data, search]);

  const table = useTableState<Feature>(
    filtered,
    { name: (f) => f.name.toLowerCase(), usage: (f) => usage.get(f.id) ?? 0 },
    PAGE_SIZE,
    search,
    { key: 'name', dir: 'asc' },
  );

  const columns: Column<Feature>[] = [
    { key: 'name', header: t('catalog.features.col.name'), sortable: true, cell: (f) => <span className="font-medium">{f.name}</span> },
    { key: 'unit', header: t('catalog.features.col.unit'), cell: (f) => <span className="font-mono text-sm text-muted">{f.unit ?? '—'}</span> },
    { key: 'description', header: t('catalog.features.col.description'), hideBelow: 'lg', cell: (f) => <Truncate className="max-w-[48ch]">{f.description}</Truncate> },
    {
      key: 'usage',
      header: t('catalog.features.col.services'),
      align: 'right',
      sortable: true,
      cell: (f) => <span className="font-mono tabular-nums">{usage.get(f.id) ?? 0}</span>,
    },
    {
      key: 'actions',
      header: t('catalog.features.col.actions'),
      align: 'right',
      cell: (f) => (
        <span className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('catalog.features.editLabel', { name: f.name })}
            icon={<Pencil size={14} aria-hidden="true" />}
            onClick={() => setEditing(f)}
          />
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('catalog.features.deleteLabel', { name: f.name })}
            icon={<Trash2 size={14} aria-hidden="true" />}
            onClick={() => setDeleting(f)}
          />
        </span>
      ),
    },
  ];

  const save = async (values: FeatureValues) => {
    setSaving(true);
    try {
      const input = { name: values.name, description: values.description, ...(values.unit ? { unit: values.unit } : {}) };
      if (editing && editing !== 'new') {
        await updateFeature(editing.id, input);
        toast.success(t('catalog.features.toast.updated'));
      } else {
        await createFeature(input);
        toast.success(t('catalog.features.toast.created'));
      }
      setEditing(null);
      features.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteFeature(deleting.id);
      toast.success(t('catalog.features.toast.deleted'));
      features.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('catalog.features.title')}
        description={t('catalog.features.description')}
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
            {t('catalog.features.new')}
          </Button>
        }
      />
      <Panel>
        <TableToolbar count={tn('plural.features', table.total)}>
          <SearchInput value={search} onChange={setSearch} label={t('catalog.features.searchLabel')} placeholder={t('catalog.features.searchPlaceholder')} className="w-full max-w-sm" />
        </TableToolbar>
        <DataTable
          caption={t('catalog.features.caption')}
          columns={columns}
          rows={table.pageRows}
          rowKey={(f) => f.id}
          loading={features.loading && !features.data}
          sort={table.sort}
          onSortChange={table.setSort}
          empty={
            <EmptyState
              icon={ListChecks}
              title={t('catalog.features.empty.title')}
              description={t('catalog.features.empty.desc')}
            />
          }
        />
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('catalog.features.new') : t('catalog.features.edit')}>
        {editing !== null ? (
          <FeatureForm key={editing === 'new' ? 'new' : editing.id} feature={editing === 'new' ? undefined : editing} submitting={saving} onSubmit={save} onCancel={() => setEditing(null)} />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title={t('catalog.features.delete.title')}
        destructive
        confirmLabel={t('actions.delete')}
        loading={saving}
        description={deleting ? t('catalog.features.delete.warning', { name: deleting.name }) : ''}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
