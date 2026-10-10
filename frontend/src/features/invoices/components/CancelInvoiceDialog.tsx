import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Modal, Textarea } from '../../../shared/components/ui';

const schema = z.object({
  reason: z.string().trim().min(5, 'Enter a reason (at least 5 characters)').max(200, 'Reason is too long (200 characters max)'),
});
type Values = z.infer<typeof schema>;

interface CancelInvoiceDialogProps {
  open: boolean;
  folio: string | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelInvoiceDialog({ open, folio, submitting, onClose, onConfirm }: CancelInvoiceDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Cancel invoice" description={folio ? `Invoice ${folio} will be cancelled. This cannot be undone.` : 'This draft will be cancelled. This cannot be undone.'}>
      {open ? <CancelForm submitting={submitting} onClose={onClose} onConfirm={onConfirm} /> : null}
    </Modal>
  );
}

function CancelForm({ submitting, onClose, onConfirm }: Omit<CancelInvoiceDialogProps, 'open' | 'folio'>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => onConfirm(v.reason))}>
      <Textarea label="Cancellation reason" required error={errors.reason?.message} {...register('reason')} />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>
          Keep invoice
        </Button>
        <Button type="submit" variant="danger" loading={submitting}>
          Cancel invoice
        </Button>
      </div>
    </form>
  );
}
