import { useState } from 'react';
import { ArrowLeft, ArrowRight, FilePlus2, Save, Stamp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfirmDialog, Panel, SkeletonBlock, Stepper, toast } from '../../../../shared/components/ui';
import { errorMessage } from '../../../../shared/lib/errors';
import { formatMoney } from '../../../../shared/lib/format';
import { useFeatures } from '../../../catalog';
import { useBuilderView } from '../../hooks/useBuilderTotals';
import { saveAndIssue, saveDraft } from '../../services/invoiceService';
import { useBuilderStore } from '../../store/builderStore';
import { CustomerStep } from './CustomerStep';
import { LiveTotalsPanel } from './LiveTotalsPanel';
import { ReviewStep } from './ReviewStep';
import { ServicesStep } from './ServicesStep';

const STEPS = ['Customer', 'Services', 'Review', 'Confirm'];

export function InvoiceWizard() {
  const navigate = useNavigate();
  const view = useBuilderView();
  const features = useFeatures();

  const step = useBuilderStore((s) => s.step);
  const setStep = useBuilderStore((s) => s.setStep);
  const customerId = useBuilderStore((s) => s.customerId);
  const setCustomer = useBuilderStore((s) => s.setCustomer);
  const lines = useBuilderStore((s) => s.lines);
  const invoiceId = useBuilderStore((s) => s.invoiceId);
  const reset = useBuilderStore((s) => s.reset);

  const [busy, setBusy] = useState<'draft' | 'issue' | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const canNext = (step === 0 && customerId !== null) || (step === 1 && lines.length > 0) || step === 2;

  const input = { id: invoiceId ?? undefined, customerId: customerId ?? '', lines };

  const finish = async (issue: boolean) => {
    setBusy(issue ? 'issue' : 'draft');
    try {
      const invoice = issue ? await saveAndIssue(input) : await saveDraft(input);
      reset();
      toast.success(issue ? `Invoice ${invoice.folio ?? ''} issued` : 'Draft saved');
      navigate(`/invoices/${invoice.id}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
      setConfirmIssue(false);
    }
  };

  const discard = () => {
    reset();
    setConfirmDiscard(false);
    navigate('/invoices');
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel className="px-6 py-5">
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <Panel className="p-7">
          {!view.ready ? (
            <SkeletonBlock lines={6} />
          ) : (
            <>
              <h2 className="mb-4 text-xl font-semibold">
                {step === 0 && 'Select the customer'}
                {step === 1 && 'Select services'}
                {step === 2 && 'Review lines and totals'}
                {step === 3 && 'Confirm and issue'}
              </h2>
              {step === 0 && <CustomerStep customers={view.customers} selectedId={customerId} onSelect={setCustomer} />}
              {step === 1 && <ServicesStep services={view.services} features={features.data ?? []} taxNames={view.taxLabels} />}
              {step === 2 && <ReviewStep view={view} />}
              {step === 3 && (
                <div className="flex flex-col gap-4 text-sm">
                  <p className="text-muted">
                    Save as a draft to keep editing later, or issue the invoice now. Issuing assigns a folio and UUID, fixes the tax
                    amounts and locks the invoice.
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-control bg-paper p-4">
                    <dt className="text-muted">Customer</dt>
                    <dd className="font-medium">{view.customer?.name ?? '—'}</dd>
                    <dt className="text-muted">Lines</dt>
                    <dd>{view.totals.lines.length}</dd>
                    <dt className="text-muted">Total</dt>
                    <dd className="font-semibold tabular-nums">{formatMoney(view.totals.total)}</dd>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button icon={<Save size={16} aria-hidden="true" />} onClick={() => finish(false)} loading={busy === 'draft'} disabled={busy !== null}>
                      Save as draft
                    </Button>
                    <Button variant="primary" icon={<Stamp size={16} aria-hidden="true" />} onClick={() => setConfirmIssue(true)} disabled={busy !== null || lines.length === 0}>
                      Issue invoice
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-line pt-4">
            <div className="flex gap-2">
              <Button icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => setStep(step - 1)} disabled={step === 0}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
                Discard
              </Button>
            </div>
            {step < 3 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)} disabled={!canNext} icon={<ArrowRight size={16} aria-hidden="true" />}>
                Next
              </Button>
            ) : null}
          </div>
        </Panel>

        <LiveTotalsPanel view={view} />
      </div>

      <ConfirmDialog
        open={confirmIssue}
        title="Issue invoice"
        confirmLabel="Issue invoice"
        loading={busy === 'issue'}
        description={
          <>
            <FilePlus2 size={16} aria-hidden="true" className="mb-2" />
            Issuing assigns the folio and UUID and locks the invoice. Total: <span className="tabular-nums font-semibold text-ink">{formatMoney(view.totals.total)}</span>.
          </>
        }
        onConfirm={() => finish(true)}
        onCancel={() => setConfirmIssue(false)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard invoice in progress"
        destructive
        confirmLabel="Discard"
        description="The customer and services selected so far will be removed."
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
