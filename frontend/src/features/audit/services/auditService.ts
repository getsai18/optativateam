import { query } from '../../../mocks/db';
import { requireRole } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { requireClaims } from '../../../shared/lib/session';
import type { AuditEntry } from '../../../shared/types';

export interface AuditRow extends AuditEntry {
  userName: string;
  /** Human reference for the entity (invoice folio, customer name...), when known. */
  entityLabel: string;
}

// TODO: replace with API Gateway call (GET /audit) — DynamoDB-backed in production
export async function listAudit(): Promise<AuditRow[]> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return query((db) => {
    const users = new Map(db.users.map((u) => [u.id, u.fullName]));
    const labels = new Map<string, string>();
    db.invoices.forEach((i) => labels.set(i.id, i.folio ?? 'Draft invoice'));
    db.customers.forEach((c) => labels.set(c.id, c.name));
    db.services.forEach((s) => labels.set(s.id, s.name));
    db.features.forEach((f) => labels.set(f.id, f.name));
    db.users.forEach((u) => labels.set(u.id, u.fullName));
    db.taxes.forEach((t) => labels.set(t.id, t.code));
    return [...db.audit]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((e) => ({
        ...e,
        userName: users.get(e.userId) ?? e.userId,
        entityLabel: labels.get(e.entityId) ?? e.entityId,
      }));
  });
}
