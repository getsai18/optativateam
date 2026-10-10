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
import { useTableState } from '../../../shared/hooks/useTableState';
import { errorMessage } from '../../../shared/lib/errors';
import type { Feature } from '../../../shared/types';
import { useFeatures, useServices } from '../hooks/useCatalog';
import { createFeature, deleteFeature, updateFeature } from '../services/catalogService';

const PAGE_SIZE = 12;

const featureSchema = z.object({
  name: z.string().trim().min(2, 'Enter the feature name').max(60, 'Name is too long'),
  description: z.string().trim().min(5, 'Enter a short description').max(200, 'Description is too long'),
  unit: z.string().trim().max(20, 'Unit is too long').optional(),
});
type FeatureValues = z.infer<typeof featureSchema>;

function FeatureForm({ feature, submitting, onSubmit, onCancel }: { feature?: Feature | undefined; submitting: boolean; onSubmit: (v: FeatureValues) => void; onCancel: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FeatureValues>({
    resolver: zodResolver(featureSchema),
    defaultValues: { name: feature?.name ?? '', description: feature?.description ?? '', unit: feature?.unit ?? '' },
  });
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Input label="Name" required error={errors.name?.message} {...register('name')} />
      <Textarea label="Description" required error={errors.description?.message} {...register('description')} />
      <Input label="Unit" hint="Optional, e.g. GB, days, hours" error={errors.unit?.message} {...register('unit')} />
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {feature ? 'Save changes' : 'Create feature'}
        </Button>
      </div>
    </form>
  );
}

export function FeaturesPage() {
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
    { key: 'name', header: 'Feature', sortable: true, cell: (f) => <span className="font-medium">{f.name}</span> },
    { key: 'unit', header: 'Unit', cell: (f) => <span className="font-mono text-xs text-muted">{f.unit ?? '—'}</span> },
    { key: 'description', header: 'Description', hideBelow: 'lg', cell: (f) => <Truncate className="max-w-[48ch]">{f.description}</Truncate> },
    { key: 'usage', header: 'Services', align: 'right', sortable: true, cell: (f) => <span className="font-mono tabular-nums">{usage.get(f.id) ?? 0}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (f) => (
        <span className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button size="sm" variant="ghost" aria-label={`Edit ${f.name}`} icon={<Pencil size={14} aria-hidden="true" />} onClick={() => setEditing(f)} />
          <Button size="sm" variant="ghost" aria-label={`Delete ${f.name}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => setDeleting(f)} />
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
        toast.success('Feature updated');
      } else {
        await createFeature(input);
        toast.success('Feature created');
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
      toast.success('Feature deleted');
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
        title="Features"
        description="Attributes that can be assigned to services, each with a value per service."
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
            New feature
          </Button>
        }
      />
      <Panel>
        <TableToolbar count={`${table.total} feature${table.total === 1 ? '' : 's'}`}>
          <SearchInput value={search} onChange={setSearch} label="Search features" placeholder="Search features" className="w-full max-w-sm" />
        </TableToolbar>
        <DataTable
          caption="Features"
          columns={columns}
          rows={table.pageRows}
          rowKey={(f) => f.id}
          loading={features.loading && !features.data}
          sort={table.sort}
          onSortChange={table.setSort}
          empty={<EmptyState icon={ListChecks} title="No features found" description="Create a feature to assign it to services." />}
        />
        <Pagination page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </Panel>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New feature' : 'Edit feature'}>
        {editing !== null ? (
          <FeatureForm key={editing === 'new' ? 'new' : editing.id} feature={editing === 'new' ? undefined : editing} submitting={saving} onSubmit={save} onCancel={() => setEditing(null)} />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete feature"
        destructive
        confirmLabel="Delete"
        loading={saving}
        description={deleting ? `Delete “${deleting.name}”? Features assigned to services cannot be deleted.` : ''}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
