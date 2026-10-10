import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Select } from '../../../shared/components/ui';
import { ROLES, ROLE_LABEL } from '../../../shared/constants/labels';
import type { Customer, User } from '../../../shared/types';

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the full name').max(80, 'Name is too long'),
    email: z.string().trim().min(1, 'Enter an email').email('Enter a valid email address'),
    role: z.enum(['ADMIN', 'BILLER', 'CUSTOMER']),
    customerId: z.string().optional(),
    active: z.boolean(),
  })
  .refine((v) => v.role !== 'CUSTOMER' || Boolean(v.customerId), {
    path: ['customerId'],
    message: 'Choose the customer this user belongs to',
  });

export type UserFormValues = z.infer<typeof schema>;

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
    resolver: zodResolver(schema),
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
      <Input label="Full name" required error={errors.fullName?.message} {...register('fullName')} />
      <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
      <Select label="Role" required disabled={isSelf} hint={isSelf ? 'You cannot change your own role.' : undefined} error={errors.role?.message} {...register('role')}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
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
