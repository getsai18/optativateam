import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Modal } from '../../../shared/components/ui';
import { toDateKey } from '../../../shared/lib/format';
import type { Tax } from '../../../shared/types';

const schema = z.object({
  ratePct: z.coerce
    .number({ invalid_type_error: 'Enter a rate' })
    .min(0, 'Rate cannot be negative')
    .max(100, 'Rate cannot exceed 100%'),
  validFrom: z
    .string()
    .min(1, 'Choose a start date')
    .refine((v) => v >= toDateKey(new Date()), 'The date cannot be in the past'),
});

type Values = z.input<typeof schema>;

interface ChangeRateModalProps {
  tax: Tax | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (rate: number, validFrom: string) => void;
}

export function ChangeRateModal({ tax, submitting, onClose, onSubmit }: ChangeRateModalProps) {
  return (
    <Modal open={tax !== null} onClose={onClose} title={tax ? `Change rate: ${tax.name} (${tax.code})` : 'Change rate'} description="The previous rate is closed on the start date. Issued invoices keep their own amounts.">
      {tax ? <RateForm key={tax.id} tax={tax} submitting={submitting} onClose={onClose} onSubmit={onSubmit} /> : null}
    </Modal>
  );
}

function RateForm({ tax, submitting, onClose, onSubmit }: Omit<ChangeRateModalProps, 'tax'> & { tax: Tax }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { ratePct: Math.round(tax.currentRate * 10000) / 100, validFrom: toDateKey(new Date()) },
  });

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => onSubmit(v.ratePct / 100, v.validFrom))}>
      <Input label="New rate (%)" type="number" step="0.01" required error={errors.ratePct?.message} {...register('ratePct')} />
      <Input label="Valid from" type="date" min={toDateKey(new Date())} required error={errors.validFrom?.message} {...register('validFrom')} />
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          Save new rate
        </Button>
      </div>
    </form>
  );
}
