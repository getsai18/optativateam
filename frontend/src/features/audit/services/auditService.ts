import { api } from '../../../shared/lib/http';
import type { AuditEntry } from '../../../shared/types';

export interface AuditRow extends AuditEntry {
  userName: string;
  /** Human reference for the entity (invoice folio, customer name...), when known. */
  entityLabel: string;
}

export async function listAudit(): Promise<AuditRow[]> {
  return api<AuditRow[]>('/audit');
}
