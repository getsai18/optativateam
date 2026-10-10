import { mutate, query } from '../../../mocks/db';
import { requireRole, writeAudit } from '../../../mocks/helpers';
import { latency } from '../../../mocks/latency';
import { ApiError } from '../../../shared/lib/errors';
import { newId } from '../../../shared/lib/id';
import { requireClaims } from '../../../shared/lib/session';
import type { Role, User } from '../../../shared/types';

export interface UserInput {
  email: string;
  fullName: string;
  role: Role;
  customerId?: string | undefined;
  active: boolean;
}

function assertCustomerLink(role: Role, customerId: string | undefined): void {
  if (role === 'CUSTOMER' && !customerId) {
    throw new ApiError('VALIDATION', 'Customer users must be linked to a customer');
  }
}

// TODO: replace with API Gateway call (GET /users)
export async function listUsers(): Promise<User[]> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  return query((db) => db.users);
}

// TODO: replace with API Gateway call (POST /users)
export async function createUser(input: UserInput): Promise<User> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  assertCustomerLink(input.role, input.customerId);
  return mutate((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new ApiError('CONFLICT', 'A user with this email already exists');
    }
    const user: User = {
      id: newId('usr'),
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      active: input.active,
      ...(input.role === 'CUSTOMER' && input.customerId ? { customerId: input.customerId } : {}),
    };
    db.users.push(user);
    writeAudit(db, claims, 'user.create', 'user', user.id);
    return user;
  });
}

// TODO: replace with API Gateway call (PUT /users/{id})
export async function updateUser(id: string, input: UserInput): Promise<User> {
  await latency();
  const claims = requireClaims();
  requireRole(claims, 'ADMIN');
  assertCustomerLink(input.role, input.customerId);
  if (id === claims.sub && (input.role !== 'ADMIN' || !input.active)) {
    throw new ApiError('VALIDATION', 'You cannot remove your own administrator access');
  }
  return mutate((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new ApiError('NOT_FOUND', 'User not found');
    if (db.users.some((u) => u.id !== id && u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new ApiError('CONFLICT', 'A user with this email already exists');
    }
    user.email = input.email;
    user.fullName = input.fullName;
    user.role = input.role;
    user.active = input.active;
    if (input.role === 'CUSTOMER' && input.customerId) user.customerId = input.customerId;
    else delete user.customerId;
    writeAudit(db, claims, 'user.update', 'user', id);
    return user;
  });
}
