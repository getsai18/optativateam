import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FilePlus2, Save, Stamp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, ConfirmDialog, Panel, SkeletonBlock, Stepper, toast } from '../../../../shared/components/ui';
import { useI18n } from '../../../../shared/i18n';
import { errorMessage } from '../../../../shared/lib/errors';
import { formatMoney } from '../../../../shared/lib/format';
import { useFeatures } from '../../../catalog';
import { useBuilderView } from '../../hooks/useBuilderTotals';
import { getCart } from '../../services/cartService';
import { saveAndIssue, saveDraft } from '../../services/invoiceService';
import { useBuilderStore } from '../../store/builderStore';
import { CustomerStep } from './CustomerStep';
import { LiveTotalsPanel } from './LiveTotalsPanel';
import { ReviewStep } from './ReviewStep';
import { ServicesStep } from './ServicesStep';

export function InvoiceWizard() {
  const { t } = useI18n();
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
  const hydrate = useBuilderStore((s) => s.hydrate);

  // Restore the cart saved in AWS (other device/session) when the local one is empty.
  useEffect(() => {
    const local = useBuilderStore.getState();
    if (local.invoiceId || local.customerId || local.lines.length > 0) return;
    getCart()
      .then((cart) => {
        const now = useBuilderStore.getState();
        if (now.invoiceId || now.customerId || now.lines.length > 0) return;
        if (cart.customerId || cart.invoiceId || cart.lines.length > 0) hydrate(cart);
      })
      .catch(() => undefined);
  }, [hydrate]);

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
      toast.success(issue ? t('invoices.wizard.toast.issued', { folio: invoice.folio ?? '' }) : t('invoices.wizard.toast.draft'));
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

  const steps = [
    t('invoices.wizard.step.customer'),
    t('invoices.wizard.step.services'),
    t('invoices.wizard.step.review'),
    t('invoices.wizard.step.confirm'),
  ];
  const headings = [
    t('invoices.wizard.heading.customer'),
    t('invoices.wizard.heading.services'),
    t('invoices.wizard.heading.review'),
    t('invoices.wizard.heading.confirm'),
  ];
  const descriptions = [
    t('invoices.wizard.desc.customer'),
    t('invoices.wizard.desc.services'),
    t('invoices.wizard.desc.review'),
    t('invoices.wizard.desc.confirm'),
  ];

  return (
    <div className="flex flex-col gap-6">
      <Panel className="px-6 py-5">
        <Stepper steps={steps} current={step} onStepClick={setStep} />
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <Panel className="p-7">
          {!view.ready ? (
            <SkeletonBlock lines={6} />
          ) : (
            <>
              <h2 className="mb-1 text-xl font-semibold">{headings[step]}</h2>
              <p className={step === 0 ? 'mb-1 text-sm text-muted' : 'mb-4 text-sm text-muted'}>{descriptions[step]}</p>
              {step === 0 && (
                <p className="mb-4 text-sm text-muted">
                  {t('invoices.wizard.customerHint.before')}
                  <Link
                    to="/customers"
                    className="mx-1 font-medium text-primary underline underline-offset-2 hover:text-primary-light"
                  >
                    {t('invoices.wizard.customerHint.link')}
                  </Link>
                  {t('invoices.wizard.customerHint.after')}
                </p>
              )}
              {step === 0 && <CustomerStep customers={view.customers} selectedId={customerId} onSelect={setCustomer} />}
              {step === 1 && <ServicesStep services={view.services} features={features.data ?? []} taxNames={view.taxLabels} />}
              {step === 2 && <ReviewStep view={view} />}
              {step === 3 && (
                <div className="flex flex-col gap-4 text-sm">
                  <p className="text-muted">{t('invoices.wizard.confirm.lead')}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-control bg-paper p-4">
                    <dt className="text-muted">{t('invoices.wizard.confirm.customer')}</dt>
                    <dd className="font-medium">{view.customer?.name ?? '—'}</dd>
                    <dt className="text-muted">{t('invoices.wizard.confirm.lines')}</dt>
                    <dd>{view.totals.lines.length}</dd>
                    <dt className="text-muted">{t('invoices.wizard.confirm.total')}</dt>
                    <dd className="font-semibold tabular-nums">{formatMoney(view.totals.total)}</dd>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button icon={<Save size={16} aria-hidden="true" />} onClick={() => finish(false)} loading={busy === 'draft'} disabled={busy !== null}>
                      {t('invoices.wizard.saveDraft')}
                    </Button>
                    <Button variant="primary" icon={<Stamp size={16} aria-hidden="true" />} onClick={() => setConfirmIssue(true)} disabled={busy !== null || lines.length === 0}>
                      {t('invoices.wizard.issue.title')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-line pt-4">
            <div className="flex gap-2">
              <Button icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => setStep(step - 1)} disabled={step === 0}>
                {t('actions.back')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
                {t('invoices.wizard.discard')}
              </Button>
            </div>
            {step < 3 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)} disabled={!canNext} icon={<ArrowRight size={16} aria-hidden="true" />}>
                {t('actions.next')}
              </Button>
            ) : null}
          </div>
        </Panel>

        <LiveTotalsPanel view={view} />
      </div>

      <ConfirmDialog
        open={confirmIssue}
        title={t('invoices.wizard.issue.title')}
        confirmLabel={t('invoices.wizard.issue.title')}
        loading={busy === 'issue'}
        description={
          <>
            <FilePlus2 size={16} aria-hidden="true" className="mb-2" />
            <p className="font-medium text-ink">{t('invoices.wizard.issue.lead')}</p>
            <ul className="my-2 list-disc space-y-1 pl-5">
              <li>{t('invoices.wizard.issue.point1')}</li>
              <li>{t('invoices.wizard.issue.point2')}</li>
              <li>{t('invoices.wizard.issue.point3')}</li>
              <li>{t('invoices.wizard.issue.point4')}</li>
            </ul>
            <p>
              {t('invoices.wizard.issue.totalLabel')}{' '}
              <span className="tabular-nums font-semibold text-ink">{formatMoney(view.totals.total)}</span>
            </p>
          </>
        }
        onConfirm={() => finish(true)}
        onCancel={() => setConfirmIssue(false)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title={t('invoices.wizard.discard.title')}
        destructive
        confirmLabel={t('invoices.wizard.discard')}
        description={t('invoices.wizard.discard.description')}
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
