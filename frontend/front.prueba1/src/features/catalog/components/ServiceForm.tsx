import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { Button, Input, Select, Textarea } from '../../../shared/components/ui';
import { useI18n, type TFn } from '../../../shared/i18n';
import { SERVICE_CATEGORIES, useLabels } from '../../../shared/constants/labels';
import { formatPercent } from '../../../shared/lib/format';
import type { Feature, Service, ServiceCategory, Tax } from '../../../shared/types';

const categoryEnum = z.enum(SERVICE_CATEGORIES as [ServiceCategory, ...ServiceCategory[]]);

export function makeServiceSchema(t: TFn) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(2, t('catalog.form.error.codeRequired'))
      .max(20, t('catalog.form.error.codeTooLong'))
      .regex(/^[A-Za-z0-9-]+$/, t('catalog.form.error.codeFormat')),
    name: z.string().trim().min(3, t('catalog.form.error.nameRequired')).max(100, t('catalog.form.error.nameTooLong')),
    description: z.string().trim().min(5, t('catalog.form.error.descRequired')).max(500, t('catalog.form.error.descTooLong')),
    basePrice: z.coerce
      .number({ invalid_type_error: t('catalog.form.error.priceRequired') })
      .min(0.01, t('catalog.form.error.priceMin'))
      .max(1_000_000, t('catalog.form.error.priceMax')),
    category: categoryEnum,
    taxIds: z.array(z.string()).min(1, t('catalog.form.error.taxRequired')).max(2, t('catalog.form.error.taxMax')),
    features: z
      .array(
        z.object({
          featureId: z.string().min(1, t('catalog.form.error.featureRequired')),
          value: z.string().trim().min(1, t('catalog.form.error.valueRequired')).max(60, t('catalog.form.error.valueTooLong')),
        }),
      )
      .max(10, t('catalog.form.error.featuresMax'))
      .refine((rows) => new Set(rows.map((r) => r.featureId)).size === rows.length, t('catalog.form.error.featureOnce')),
    active: z.boolean(),
  });
}

export type ServiceFormValues = z.infer<ReturnType<typeof makeServiceSchema>>;
type ServiceFormInput = z.input<ReturnType<typeof makeServiceSchema>>;

interface ServiceFormProps {
  service?: Service | undefined;
  taxes: Tax[];
  features: Feature[];
  submitting: boolean;
  onSubmit: (values: ServiceFormValues) => void;
  onCancel: () => void;
}

export function ServiceForm({ service, taxes, features, submitting, onSubmit, onCancel }: ServiceFormProps) {
  const { t } = useI18n();
  const labels = useLabels();
  const serviceSchema = makeServiceSchema(t);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    mode: 'onChange',
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
    const next = selectedTaxIds.includes(id) ? selectedTaxIds.filter((x) => x !== id) : [...selectedTaxIds, id];
    setValue('taxIds', next, { shouldValidate: true, shouldDirty: true });
  };

  const featuresError = errors.features?.root?.message ?? errors.features?.message;

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <Input label={t('catalog.form.code')} required error={errors.code?.message} className="font-mono uppercase" {...register('code')} />
        <Input label={t('catalog.form.basePrice')} type="number" step="0.01" min="0" required error={errors.basePrice?.message} {...register('basePrice')} />
      </div>
      <Input label={t('catalog.form.name')} required error={errors.name?.message} {...register('name')} />
      <Select label={t('catalog.form.category')} required error={errors.category?.message} {...register('category')}>
        {SERVICE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {labels.serviceCategory(c)}
          </option>
        ))}
      </Select>
      <Textarea label={t('catalog.form.description')} required error={errors.description?.message} {...register('description')} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('catalog.form.legendTaxes')}</legend>
        {taxes.map((tax) => (
          <label key={tax.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedTaxIds.includes(tax.id)} onChange={() => toggleTax(tax.id)} />
            {tax.name} {formatPercent(tax.currentRate)} <span className="font-mono text-xs text-muted">{tax.code}</span>
          </label>
        ))}
        {errors.taxIds ? <p role="alert" className="text-sm text-status-cancelled">{errors.taxIds.message}</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">{t('catalog.form.legendFeatures')}</legend>
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => append({ featureId: '', value: '' })}>
            {t('catalog.form.addFeature')}
          </Button>
        </div>
        {fields.length === 0 ? <p className="text-sm text-muted">{t('catalog.form.emptyFeatures')}</p> : null}
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
            <Select
              label={index === 0 ? t('catalog.form.feature') : t('catalog.form.featureRow', { n: index + 1 })}
              wrapperClassName={index === 0 ? undefined : '[&>label]:sr-only'}
              error={errors.features?.[index]?.featureId?.message}
              {...register(`features.${index}.featureId`)}
            >
              <option value="">{t('catalog.form.selectFeature')}</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Input
              label={index === 0 ? t('catalog.form.value') : t('catalog.form.valueRow', { n: index + 1 })}
              wrapperClassName={index === 0 ? undefined : '[&>label]:sr-only'}
              error={errors.features?.[index]?.value?.message}
              {...register(`features.${index}.value`)}
            />
            <Button variant="ghost" aria-label={t('catalog.form.removeRow', { n: index + 1 })} onClick={() => remove(index)} icon={<Trash2 size={16} aria-hidden="true" />} className="mb-0" />
          </div>
        ))}
        {featuresError ? <p role="alert" className="text-sm text-status-cancelled">{featuresError}</p> : null}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-primary" {...register('active')} />
        {t('catalog.form.active')}
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>{t('actions.cancel')}</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {service ? t('actions.saveChanges') : t('catalog.form.create')}
        </Button>
      </div>
    </form>
  );
}
