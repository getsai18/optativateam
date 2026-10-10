import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Textarea } from '../../../shared/components/ui';
import type { Customer } from '../../../shared/types';

const TAX_ID = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name').max(120, 'Name is too long'),
  taxId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(TAX_ID, 'Tax ID must look like ABC010101XY1 (12 or 13 characters)'),
  email: z.string().trim().min(1, 'Enter an email').email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .max(25, 'Phone is too long')
    .regex(/^[+\d\s()-]*$/, 'Use digits, spaces, + ( ) and - only')
    .optional(),
  address: z.string().trim().min(5, 'Enter the fiscal address').max(250, 'Address is too long'),
  active: z.boolean(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
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
        <Input label="Name" required error={errors.name?.message} {...register('name')} />
        <Input label="Tax ID" required hint="Fiscal identifier of the customer" error={errors.taxId?.message} className="font-mono uppercase" {...register('taxId')} />
        <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
        <Input label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
        <Textarea label="Address" required error={errors.address?.message} {...register('address')} />
        {canToggleActive ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" {...register('active')} />
            Active (can be selected on new invoices)
          </label>
        ) : null}
      </fieldset>
      {readOnly ? (
        <div className="flex justify-end pt-2">
          <Button onClick={onCancel}>Close</Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      )}
    </form>
  );
}
