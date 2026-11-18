import type { Customer } from '../../shared/types';

export type CustomerInput = Omit<Customer, 'id' | 'active'> & { active?: boolean };
