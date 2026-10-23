import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Modal, Textarea } from '../../../shared/components/ui';
import { useI18n, type TFn } from '../../../shared/i18n';

export function makeCancelSchema(t: TFn) {
  return z.object({
    reason: z.string().trim().min(5, t('invoices.cancel.error.min')).max(200, t('invoices.cancel.error.max')),
  });
}

export type CancelInvoiceValues = z.infer<ReturnType<typeof makeCancelSchema>>;

interface CancelInvoiceDialogProps {
  open: boolean;
  folio: string | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelInvoiceDialog({ open, folio, submitting, onClose, onConfirm }: CancelInvoiceDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('invoices.cancel.title')}
      description={folio ? t('invoices.cancel.desc.folio', { folio }) : t('invoices.cancel.desc.draft')}
    >
      {open ? <CancelForm submitting={submitting} onClose={onClose} onConfirm={onConfirm} /> : null}
    </Modal>
  );
}

function CancelForm({ submitting, onClose, onConfirm }: Omit<CancelInvoiceDialogProps, 'open' | 'folio'>) {
  const { t } = useI18n();
  const schema = useMemo(() => makeCancelSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelInvoiceValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' }, mode: 'onChange' });
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => onConfirm(v.reason))}>
      <Textarea label={t('invoices.cancel.reasonLabel')} required error={errors.reason?.message} {...register('reason')} />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>
          {t('invoices.cancel.keep')}
        </Button>
        <Button type="submit" variant="danger" loading={submitting}>
          {t('invoices.cancel.submit')}
        </Button>
      </div>
    </form>
  );
}
