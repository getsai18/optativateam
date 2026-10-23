import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Select } from '../../../shared/components/ui';
import { ROLES, useLabels } from '../../../shared/constants/labels';
import { useI18n, type TFn } from '../../../shared/i18n';
import type { Customer, User } from '../../../shared/types';

export function makeUserSchema(t: TFn) {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, t('users.error.fullName.min'))
        .max(80, t('users.error.fullName.max')),
      email: z
        .string()
        .trim()
        .min(1, t('users.error.email.required'))
        .email(t('users.error.email.invalid')),
      role: z.enum(['ADMIN', 'BILLER', 'CUSTOMER']),
      customerId: z.string().optional(),
      active: z.boolean(),
    })
    .refine((v) => v.role !== 'CUSTOMER' || Boolean(v.customerId), {
      path: ['customerId'],
      message: t('users.error.customerId'),
    });
}

export type UserFormValues = z.infer<ReturnType<typeof makeUserSchema>>;

interface UserFormProps {
  user?: User | undefined;
  customers: Customer[];
  /** The signed-in admin cannot change their own role or deactivate themselves. */
  isSelf: boolean;
  submitting: boolean;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}

export function UserForm({ user, customers, isSelf, submitting, onSubmit, onCancel }: UserFormProps) {
  const { t } = useI18n();
  const labels = useLabels();
  const schema = useMemo(() => makeUserSchema(t), [t]);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'BILLER',
      customerId: user?.customerId ?? '',
      active: user?.active ?? true,
    },
  });
  const role = watch('role');

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Input label={t('users.form.label.fullName')} required error={errors.fullName?.message} {...register('fullName')} />
      <Input label={t('users.form.label.email')} type="email" required error={errors.email?.message} {...register('email')} />
      <Select
        label={t('users.form.label.role')}
        required
        disabled={isSelf}
        hint={isSelf ? t('users.form.selfRoleHint') : undefined}
        error={errors.role?.message}
        {...register('role')}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {labels.role(r)}
          </option>
        ))}
      </Select>
      {role === 'CUSTOMER' ? (
        <Select label={t('users.form.label.customer')} required error={errors.customerId?.message} {...register('customerId')}>
          <option value="">{t('users.form.customerPlaceholder')}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={isSelf} className="h-4 w-4 accent-primary" {...register('active')} />
        {t('users.form.activeLabel')}
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>{t('actions.cancel')}</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {user ? t('actions.saveChanges') : t('users.form.create')}
        </Button>
      </div>
    </form>
  );
}
