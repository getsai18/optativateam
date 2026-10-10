import { create } from 'zustand';
import { localStore } from '../../../shared/lib/storage';
import type { BuilderLine } from '../types';

const KEY = 'billing.invoiceBuilder.v1';

interface BuilderData {
  /** set when editing an existing draft */
  invoiceId: string | null;
  customerId: string | null;
  lines: BuilderLine[];
  step: number;
}

interface BuilderState extends BuilderData {
  setCustomer: (customerId: string) => void;
  addService: (serviceId: string) => void;
  setQuantity: (serviceId: string, quantity: number) => void;
  removeService: (serviceId: string) => void;
  setStep: (step: number) => void;
  loadDraft: (data: { invoiceId: string; customerId: string; lines: BuilderLine[] }) => void;
  reset: () => void;
}

const EMPTY: BuilderData = { invoiceId: null, customerId: null, lines: [], step: 0 };

function initial(): BuilderData {
  const stored = localStore.get<BuilderData>(KEY);
  if (!stored || !Array.isArray(stored.lines)) return EMPTY;
  return {
    invoiceId: stored.invoiceId ?? null,
    customerId: stored.customerId ?? null,
    lines: stored.lines,
    step: Math.min(Math.max(stored.step ?? 0, 0), 3),
  };
}

/** The "cart": kept in memory and mirrored to localStorage until saved or discarded. */
export const useBuilderStore = create<BuilderState>((set) => ({
  ...initial(),
  setCustomer: (customerId) => set({ customerId }),
  addService: (serviceId) =>
    set((s) => (s.lines.some((l) => l.serviceId === serviceId) ? s : { lines: [...s.lines, { serviceId, quantity: 1 }] })),
  setQuantity: (serviceId, quantity) =>
    set((s) => ({ lines: s.lines.map((l) => (l.serviceId === serviceId ? { ...l, quantity } : l)) })),
  removeService: (serviceId) => set((s) => ({ lines: s.lines.filter((l) => l.serviceId !== serviceId) })),
  setStep: (step) => set({ step }),
  loadDraft: ({ invoiceId, customerId, lines }) => set({ invoiceId, customerId, lines, step: 0 }),
  reset: () => set({ ...EMPTY }),
}));

useBuilderStore.subscribe((s) => {
  const { invoiceId, customerId, lines, step } = s;
  if (!invoiceId && !customerId && lines.length === 0 && step === 0) localStore.remove(KEY);
  else localStore.set<BuilderData>(KEY, { invoiceId, customerId, lines, step });
});
