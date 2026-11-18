import { useMemo } from 'react';
import { formatPercent } from '../../../shared/lib/format';
import type { Customer, Service } from '../../../shared/types';
import { useServices } from '../../catalog';
import { useCustomers } from '../../customers';
import { useTaxHistory, useTaxes } from '../../taxes';
import { calculateTotals, type TotalsResult } from '../lib/calculateTotals';
import { useBuilderStore } from '../store/builderStore';

export interface BuilderView {
  ready: boolean;
  customer: Customer | undefined;
  services: Service[];
  customers: Customer[];
  serviceById: Map<string, Service>;
  taxNames: Map<string, string>;
  /** id -> "VAT 16%" using the current rate */
  taxLabels: Map<string, string>;
  totals: TotalsResult;
}

const EMPTY_TOTALS: TotalsResult = { lines: [], subtotal: 0, taxTotal: 0, total: 0, breakdown: [] };

/** Live totals for the invoice builder, computed with the same pure function the backend would use. */
export function useBuilderView(): BuilderView {
  const lines = useBuilderStore((s) => s.lines);
  const customerId = useBuilderStore((s) => s.customerId);
  const services = useServices();
  const customers = useCustomers();
  const taxes = useTaxes();
  const history = useTaxHistory();

  const ready = Boolean(services.data && customers.data && taxes.data && history.data);

  return useMemo<BuilderView>(() => {
    const serviceList = services.data ?? [];
    const serviceById = new Map(serviceList.map((s) => [s.id, s]));
    const customerList = customers.data ?? [];
    const taxNames = new Map((taxes.data ?? []).map((t) => [t.id, t.name]));
    const taxLabels = new Map((taxes.data ?? []).map((t) => [t.id, `${t.name} ${formatPercent(t.currentRate)}`]));
    const inputs = lines.flatMap((l) => {
      const s = serviceById.get(l.serviceId);
      return s
        ? [{ serviceId: s.id, serviceName: s.name, quantity: l.quantity, unitPrice: s.basePrice, taxIds: s.taxIds }]
        : [];
    });
    const totals = ready ? calculateTotals(inputs, taxes.data ?? [], history.data ?? [], new Date()) : EMPTY_TOTALS;
    return {
      ready,
      customer: customerList.find((c) => c.id === customerId),
      services: serviceList,
      customers: customerList,
      serviceById,
      taxNames,
      taxLabels,
      totals,
    };
  }, [services.data, customers.data, taxes.data, history.data, lines, customerId, ready]);
}
