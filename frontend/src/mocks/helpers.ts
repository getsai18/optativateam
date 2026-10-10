import { ApiError } from '../shared/lib/errors';
import { newId } from '../shared/lib/id';
import type { TokenClaims } from '../shared/lib/token';
import type { Invoice, Role } from '../shared/types';
import type { Db } from './seed';

/** Record an audit entry for the acting user. */
export function writeAudit(db: Db, claims: TokenClaims, action: string, entityType: string, entityId: string): void {
  db.audit.push({
    id: newId('aud'),
    userId: claims.sub,
    action,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
  });
}

/** Authorizer: throws FORBIDDEN unless the caller has one of `roles`. */
export function requireRole(claims: TokenClaims, ...roles: Role[]): void {
  if (!roles.includes(claims.role)) {
    throw new ApiError('FORBIDDEN', 'You do not have permission to perform this action');
  }
}

/**
 * Row-level access for invoices: customers only reach their own, non-draft invoices.
 * A hidden invoice is reported as NOT_FOUND so ids cannot be probed.
 */
export function assertInvoiceAccess(claims: TokenClaims, invoice: Invoice | undefined): Invoice {
  if (!invoice) throw new ApiError('NOT_FOUND', 'Invoice not found');
  if (claims.role === 'CUSTOMER') {
    if (invoice.customerId !== claims.customerId || invoice.status === 'DRAFT') {
      throw new ApiError('NOT_FOUND', 'Invoice not found');
    }
  }
  return invoice;
}
