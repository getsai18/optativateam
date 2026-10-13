import { api } from '../../../shared/lib/http';
import type { Invoice } from '../../../shared/types';
import type { SaveDraftInput } from '../types';

function draftBody(input: SaveDraftInput) {
  return { customerId: input.customerId, lines: input.lines };
}

export async function listInvoices(): Promise<Invoice[]> {
  return api<Invoice[]>('/invoices');
}

export async function getInvoice(id: string): Promise<Invoice> {
  return api<Invoice>(`/invoices/${encodeURIComponent(id)}`);
}

export async function saveDraft(input: SaveDraftInput): Promise<Invoice> {
  if (input.id) {
    return api<Invoice>(`/invoices/${encodeURIComponent(input.id)}`, { method: 'PUT', body: draftBody(input) });
  }
  return api<Invoice>('/invoices', { method: 'POST', body: draftBody(input) });
}

export async function issueInvoice(id: string): Promise<Invoice> {
  return api<Invoice>(`/invoices/${encodeURIComponent(id)}/issue`, { method: 'POST' });
}

/** Wizard step 4: save the builder as a draft and issue it in one call. */
export async function saveAndIssue(input: SaveDraftInput): Promise<Invoice> {
  const body = input.id ? { id: input.id, ...draftBody(input) } : draftBody(input);
  return api<Invoice>('/invoices', { method: 'POST', query: { issue: 'true' }, body });
}

export async function cancelInvoice(id: string, reason: string): Promise<Invoice> {
  return api<Invoice>(`/invoices/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
}

export async function deleteDraft(id: string): Promise<void> {
  await api<unknown>(`/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
