import { create } from 'zustand';
import { useAuthStore } from '../../auth/store/authStore';
import { readToken } from '../../../shared/lib/session';
import { localStore } from '../../../shared/lib/storage';
import { clearCart, saveCart } from '../services/cartService';
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
  hydrate: (data: BuilderData) => void;
  reset: () => void;
}

const EMPTY: BuilderData = { invoiceId: null, customerId: null, lines: [], step: 0 };

const ID = /^[a-z]+_\d+$/;
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

/** localStorage es editable por el usuario: se reconstruye el carrito campo por campo, nunca se confía en su forma. */
function initial(): BuilderData {
  const stored = localStore.get<Partial<BuilderData>>(KEY);
  if (!stored || typeof stored !== 'object' || !Array.isArray(stored.lines)) return EMPTY;
  const seen = new Set<string>();
  const lines: BuilderLine[] = [];
  for (const raw of stored.lines.slice(0, 200)) {
    const line = raw as Partial<BuilderLine> | null;
    if (!line || !isId(line.serviceId) || seen.has(line.serviceId)) continue;
    const qty = line.quantity;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 9999) continue;
    seen.add(line.serviceId);
    lines.push({ serviceId: line.serviceId, quantity: qty });
  }
  const step = typeof stored.step === 'number' && Number.isFinite(stored.step) ? stored.step : 0;
  return {
    invoiceId: isId(stored.invoiceId) ? stored.invoiceId : null,
    customerId: isId(stored.customerId) ? stored.customerId : null,
    lines,
    step: Math.min(Math.max(Math.trunc(step), 0), 3),
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
  hydrate: (data) => set({ ...data, step: Math.min(Math.max(data.step, 0), 3) }),
  reset: () => set({ ...EMPTY }),
}));

let syncTimer: ReturnType<typeof setTimeout> | undefined;

/** Mirrors the cart to the AWS `cart` Lambda (debounced). Failures are ignored: localStorage stays the fallback. */
function syncRemote(data: BuilderData, empty: boolean) {
  if (!readToken()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const request = empty ? clearCart() : saveCart(data);
    request.catch(() => undefined);
  }, 600);
}

useBuilderStore.subscribe((s) => {
  const { invoiceId, customerId, lines, step } = s;
  const empty = !invoiceId && !customerId && lines.length === 0 && step === 0;
  if (empty) localStore.remove(KEY);
  else localStore.set<BuilderData>(KEY, { invoiceId, customerId, lines, step });
  syncRemote({ invoiceId, customerId, lines, step }, empty);
});

// Al cerrar sesión (o expirar) el carrito no debe quedar para el siguiente usuario del mismo navegador.
useAuthStore.subscribe((state, prev) => {
  if (prev.claims && !state.claims) useBuilderStore.getState().reset();
});
