import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { Button, Input, Select, Textarea } from '../../../shared/components/ui';
import { SERVICE_CATEGORIES } from '../../../shared/constants/labels';
import { formatPercent } from '../../../shared/lib/format';
import type { Feature, Service, ServiceCategory, Tax } from '../../../shared/types';

const categoryEnum = z.enum(SERVICE_CATEGORIES as [ServiceCategory, ...ServiceCategory[]]);

export const serviceSchema = z.object({
  code: z.string().trim().min(2, 'Enter a code').max(20, 'Code is too long').regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only'),
  name: z.string().trim().min(3, 'Enter the service name').max(100, 'Name is too long'),
  description: z.string().trim().min(5, 'Enter a short description').max(500, 'Description is too long'),
  basePrice: z.coerce.number({ invalid_type_error: 'Enter a price' }).min(0.01, 'Price must be greater than zero').max(1_000_000, 'Price is too high'),
  category: categoryEnum,
  taxIds: z.array(z.string()).min(1, 'Assign at least one tax').max(2, 'At most two taxes per service'),
  features: z
    .array(z.object({ featureId: z.string().min(1, 'Choose a feature'), value: z.string().trim().min(1, 'Enter a value').max(60, 'Value is too long') }))
    .max(10, 'At most 10 features')
    .refine((rows) => new Set(rows.map((r) => r.featureId)).size === rows.length, 'A feature can only be added once'),
  active: z.boolean(),
});

export type ServiceFormValues = z.output<typeof serviceSchema>;
type ServiceFormInput = z.input<typeof serviceSchema>;

interface ServiceFormProps {
  service?: Service | undefined;
  taxes: Tax[];
  features: Feature[];
  submitting: boolean;
  onSubmit: (values: ServiceFormValues) => void;
  onCancel: () => void;
}

export function ServiceForm({ service, taxes, features, submitting, onSubmit, onCancel }: ServiceFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      code: service?.code ?? '',
      name: service?.name ?? '',
      description: service?.description ?? '',
      basePrice: service?.basePrice ?? 0,
      category: service?.category ?? 'Consulting',
      taxIds: service?.taxIds ?? [],
      features: service?.features ?? [],
      active: service?.active ?? true,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'features' });
  const selectedTaxIds = watch('taxIds');

  const toggleTax = (id: string) => {
    const next = selectedTaxIds.includes(id) ? selectedTaxIds.filter((t) => t !== id) : [...selectedTaxIds, id];
    setValue('taxIds', next, { shouldValidate: true, shouldDirty: true });
  };

  const featuresError = errors.features?.root?.message ?? errors.features?.message;

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Code" required error={errors.code?.message} className="font-mono uppercase" {...register('code')} />
        <Input label="Base price (MXN)" type="number" step="0.01" min="0" required error={errors.basePrice?.message} {...register('basePrice')} />
      </div>
      <Input label="Name" required error={errors.name?.message} {...register('name')} />
      <Select label="Category" required error={errors.category?.message} {...register('category')}>
        {SERVICE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Textarea label="Description" required error={errors.description?.message} {...register('description')} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium">Taxes</legend>
        {taxes.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedTaxIds.includes(t.id)} onChange={() => toggleTax(t.id)} />
            {t.name} {formatPercent(t.currentRate)} <span className="font-mono text-xs text-muted">{t.code}</span>
          </label>
        ))}
        {errors.taxIds ? <p role="alert" className="text-xs text-status-cancelled">{errors.taxIds.message}</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-medium">Features</legend>
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => append({ featureId: '', value: '' })}>
            Add feature
          </Button>
        </div>
        {fields.length === 0 ? <p className="text-sm text-muted">No features assigned.</p> : null}
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
            <Select
              label={index === 0 ? 'Feature' : `Feature (row ${index + 1})`}
              wrapperClassName={index === 0 ? undefined : '[&>label]:sr-only'}
              error={errors.features?.[index]?.featureId?.message}
              {...register(`features.${index}.featureId`)}
            >
              <option value="">Select…</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Input
              label={index === 0 ? 'Value' : `Value (row ${index + 1})`}
              wrapperClassName={index === 0 ? undefined : '[&>label]:sr-only'}
              error={errors.features?.[index]?.value?.message}
              {...register(`features.${index}.value`)}
            />
            <Button variant="ghost" aria-label={`Remove feature row ${index + 1}`} onClick={() => remove(index)} icon={<Trash2 size={16} aria-hidden="true" />} className="mb-0" />
          </div>
        ))}
        {featuresError ? <p role="alert" className="text-xs text-status-cancelled">{featuresError}</p> : null}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-primary" {...register('active')} />
        Active (available on new invoices)
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {service ? 'Save changes' : 'Create service'}
        </Button>
      </div>
    </form>
  );
}
