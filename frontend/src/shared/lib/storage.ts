/**
 * Thin wrapper over Web Storage. Everything that persists on the client goes through here,
 * so it can be swapped (cookies, secure storage, ...) without touching features.
 */
interface KeyValueStore {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

function createStore(getBackend: () => Storage): KeyValueStore {
  return {
    get<T>(key: string): T | null {
      try {
        const raw = getBackend().getItem(key);
        return raw === null ? null : (JSON.parse(raw) as T);
      } catch {
        return null;
      }
    },
    set<T>(key: string, value: T): void {
      try {
        getBackend().setItem(key, JSON.stringify(value));
      } catch {
        /* storage full or unavailable: ignore */
      }
    },
    remove(key: string): void {
      try {
        getBackend().removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const sessionStore = createStore(() => window.sessionStorage);
export const localStore = createStore(() => window.localStorage);
