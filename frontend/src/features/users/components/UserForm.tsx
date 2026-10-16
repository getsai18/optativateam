import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Select } from '../../../shared/components/ui';
import { ROLES, ROLE_LABEL } from '../../../shared/constants/labels';
import type { Customer, User } from '../../../shared/types';

const PASSWORD_HINT = 'At least 8 characters, with letters and numbers.';

const makeSchema = (isNew: boolean) =>
  z
  .object({
    fullName: z.string().trim().min(2, 'Enter the full name').max(80, 'Name is too long'),
    email: z.string().trim().min(1, 'Enter an email').email('Enter a valid email address'),
    role: z.enum(['ADMIN', 'BILLER', 'CUSTOMER']),
    customerId: z.string().optional(),
    active: z.boolean(),
    password: z.string().max(72, 'Password is too long').optional(),
  })
  .refine((v) => v.role !== 'CUSTOMER' || Boolean(v.customerId), {
    path: ['customerId'],
    message: 'Choose the customer this user belongs to',
  })
  .refine((v) => !isNew || (v.password ?? '').length >= 8, { path: ['password'], message: PASSWORD_HINT })
  .refine((v) => !v.password || (/[A-Za-z]/.test(v.password) && /\d/.test(v.password)), {
    path: ['password'],
    message: PASSWORD_HINT,
  });

export type UserFormValues = z.infer<ReturnType<typeof makeSchema>>;

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
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(makeSchema(!user)),
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'BILLER',
      customerId: user?.customerId ?? '',
      active: user?.active ?? true,
      password: '',
    },
  });
  const role = watch('role');

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Input label="Full name" required error={errors.fullName?.message} {...register('fullName')} />
      <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
      <Select label="Role" required disabled={isSelf} hint={isSelf ? 'You cannot change your own role.' : undefined} error={errors.role?.message} {...register('role')}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
      {user ? null : (
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint={PASSWORD_HINT}
          error={errors.password?.message}
          {...register('password')}
        />
      )}
      {role === 'CUSTOMER' ? (
        <Select label="Customer" required error={errors.customerId?.message} {...register('customerId')}>
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={isSelf} className="h-4 w-4 accent-primary" {...register('active')} />
        Active (can sign in)
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {user ? 'Save changes' : 'Create user'}
        </Button>
      </div>
    </form>
  );
}
