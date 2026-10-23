import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Modal } from '../../../shared/components/ui';
import { useI18n, type TFn } from '../../../shared/i18n';
import { toDateKey } from '../../../shared/lib/format';
import type { Tax } from '../../../shared/types';

function makeRateSchema(t: TFn) {
  return z.object({
    ratePct: z.coerce
      .number({ invalid_type_error: t('taxes.modal.error.rateRequired') })
      .min(0, t('taxes.modal.error.rateNegative'))
      .max(100, t('taxes.modal.error.rateMax')),
    validFrom: z
      .string()
      .min(1, t('taxes.modal.error.dateRequired'))
      .refine((v) => v >= toDateKey(new Date()), t('taxes.modal.error.datePast')),
  });
}

type Values = z.input<ReturnType<typeof makeRateSchema>>;

interface ChangeRateModalProps {
  tax: Tax | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (rate: number, validFrom: string) => void;
}

export function ChangeRateModal({ tax, submitting, onClose, onSubmit }: ChangeRateModalProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={tax !== null}
      onClose={onClose}
      title={tax ? t('taxes.modal.title', { name: tax.name, code: tax.code }) : t('taxes.modal.titleFallback')}
      description={t('taxes.modal.description')}
    >
      {tax ? <RateForm key={tax.id} tax={tax} submitting={submitting} onClose={onClose} onSubmit={onSubmit} /> : null}
    </Modal>
  );
}

function RateForm({ tax, submitting, onClose, onSubmit }: Omit<ChangeRateModalProps, 'tax'> & { tax: Tax }) {
  const { t } = useI18n();
  const rateSchema = makeRateSchema(t);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof rateSchema>>({
    mode: 'onChange',
    resolver: zodResolver(rateSchema),
    defaultValues: { ratePct: Math.round(tax.currentRate * 10000) / 100, validFrom: toDateKey(new Date()) },
  });

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => onSubmit(v.ratePct / 100, v.validFrom))}>
      <Input label={t('taxes.modal.rate')} type="number" step="0.01" required error={errors.ratePct?.message} {...register('ratePct')} />
      <Input label={t('taxes.modal.validFrom')} type="date" min={toDateKey(new Date())} required error={errors.validFrom?.message} {...register('validFrom')} />
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onClose}>{t('actions.cancel')}</Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {t('taxes.modal.save')}
        </Button>
      </div>
    </form>
  );
}
