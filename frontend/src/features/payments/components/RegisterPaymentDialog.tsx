import { useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Button, Modal, toast } from '../../../shared/components/ui';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '../../../shared/constants/labels';
import { cn } from '../../../shared/lib/cn';
import { errorMessage } from '../../../shared/lib/errors';
import { formatMoney } from '../../../shared/lib/format';
import type { Payment, PaymentMethod } from '../../../shared/types';
import { registerPayment } from '../services/paymentService';

interface RegisterPaymentDialogProps {
  open: boolean;
  invoiceId: string;
  folio: string | null;
  amount: number;
  onClose: () => void;
  onPaid: (payment: Payment) => void;
}

export function RegisterPaymentDialog({ open, invoiceId, folio, amount, onClose, onPaid }: RegisterPaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Payment | null>(null);

  const close = () => {
    if (busy) return;
    const payment = done;
    setDone(null);
    setMethod('CARD');
    onClose();
    if (payment) onPaid(payment);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const payment = await registerPayment(invoiceId, method);
      setDone(payment);
      toast.success('Payment registered');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={done ? 'Payment registered' : 'Register payment'}
      description={folio ? `Invoice ${folio}` : undefined}
      footer={
        done ? (
          <Button variant="primary" onClick={close} data-autofocus>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirm} loading={busy}>
              Confirm payment of {formatMoney(amount)}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 size={32} aria-hidden="true" className="text-status-paid" />
          <p className="text-sm text-muted">Reference</p>
          <p className="font-mono text-xl">{done.reference}</p>
          <p className="text-sm tabular-nums">{formatMoney(done.amount)}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-xs font-medium">Payment method</legend>
            <div className="flex flex-col gap-2">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-primary',
                    method === m ? 'border-primary bg-primary-soft' : 'border-line hover:bg-paper',
                  )}
                >
                  <input type="radio" name="payment-method" className="accent-primary" checked={method === m} onChange={() => setMethod(m)} />
                  {PAYMENT_METHOD_LABEL[m]}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="flex items-start gap-2 rounded-control bg-paper p-3 text-xs text-muted">
            <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            Simulated payment. No card details are collected; a reference such as SIM-8F3K2A is generated and the invoice is marked as paid.
          </p>
        </div>
      )}
    </Modal>
  );
}
