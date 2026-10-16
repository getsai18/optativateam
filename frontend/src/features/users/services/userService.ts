import { api } from '../../../shared/lib/http';
import type { Role, User } from '../../../shared/types';

export interface UserInput {
  email: string;
  fullName: string;
  role: Role;
  customerId?: string | undefined;
  active: boolean;
  /** only sent when creating a user */
  password?: string | undefined;
}

export async function listUsers(): Promise<User[]> {
  return api<User[]>('/users');
}

export async function createUser(input: UserInput): Promise<User> {
  return api<User>('/users', { method: 'POST', body: input });
}

export async function updateUser(id: string, input: UserInput): Promise<User> {
  return api<User>(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}
