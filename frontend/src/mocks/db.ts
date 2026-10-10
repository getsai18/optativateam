import { localStore } from '../shared/lib/storage';
import { buildSeed, type Db } from './seed';

export type { Db } from './seed';

const DB_KEY = 'billing.db.v1';

let current: Db | null = null;

function ensure(): Db {
  if (current) return current;
  const stored = localStore.get<Db>(DB_KEY);
  if (stored && Array.isArray(stored.invoices) && Array.isArray(stored.services)) {
    current = stored;
  } else {
    current = buildSeed();
    localStore.set(DB_KEY, current);
  }
  return current;
}

function persist(): void {
  if (current) localStore.set(DB_KEY, current);
}

/** Read from the in-memory DB. The result is a deep copy, safe to hand to the UI. */
export function query<T>(read: (db: Db) => T): T {
  return structuredClone(read(ensure()));
}

/** Mutate the in-memory DB and persist it to localStorage. Returns a deep copy of the result. */
export function mutate<T>(write: (db: Db) => T): T {
  const result = write(ensure());
  persist();
  return structuredClone(result);
}

export function resetDb(): void {
  current = buildSeed();
  persist();
}
