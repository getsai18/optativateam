import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Textarea } from '../../../shared/components/ui';
import { useI18n, type TFn } from '../../../shared/i18n';
import type { Customer } from '../../../shared/types';

const TAX_ID = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export function makeCustomerSchema(t: TFn) {
  return z.object({
    name: z.string().trim().min(2, t('customers.error.name.min')).max(120, t('customers.error.name.max')),
    taxId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(TAX_ID, t('customers.error.taxId')),
    email: z
      .string()
      .trim()
      .min(1, t('customers.error.email.required'))
      .email(t('customers.error.email.invalid')),
    phone: z
      .string()
      .trim()
      .max(25, t('customers.error.phone.max'))
      .regex(/^[+\d\s()-]*$/, t('customers.error.phone.format'))
      .optional(),
    address: z
      .string()
      .trim()
      .min(5, t('customers.error.address.min'))
      .max(250, t('customers.error.address.max')),
    active: z.boolean(),
  });
}

export type CustomerFormValues = z.infer<ReturnType<typeof makeCustomerSchema>>;

interface CustomerFormProps {
  customer?: Customer | undefined;
  readOnly?: boolean;
  /** Show the active toggle (administrators editing an existing customer). */
  canToggleActive?: boolean;
  submitting: boolean;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
}

export function CustomerForm({ customer, readOnly, canToggleActive, submitting, onSubmit, onCancel }: CustomerFormProps) {
  const { t } = useI18n();
  const schema = useMemo(() => makeCustomerSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      name: customer?.name ?? '',
      taxId: customer?.taxId ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      active: customer?.active ?? true,
    },
  });

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <Input label={t('customers.form.label.name')} required error={errors.name?.message} {...register('name')} />
        <Input
          label={t('customers.form.label.taxId')}
          required
          hint={t('customers.form.hint.taxId')}
          error={errors.taxId?.message}
          className="font-mono uppercase"
          {...register('taxId')}
        />
        <Input label={t('customers.form.label.email')} type="email" required error={errors.email?.message} {...register('email')} />
        <Input label={t('customers.form.label.phone')} type="tel" error={errors.phone?.message} {...register('phone')} />
        <Textarea label={t('customers.form.label.address')} required error={errors.address?.message} {...register('address')} />
        {canToggleActive ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" {...register('active')} />
            {t('customers.form.activeLabel')}
          </label>
        ) : null}
      </fieldset>
      {readOnly ? (
        <div className="flex justify-end pt-2">
          <Button onClick={onCancel}>{t('actions.close')}</Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onCancel}>{t('actions.cancel')}</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {customer ? t('actions.saveChanges') : t('customers.form.create')}
          </Button>
        </div>
      )}
    </form>
  );
}
