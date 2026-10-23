import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/errors';

export const UNAUTHORIZED_EVENT = 'billing:unauthorized';

interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Minimal data-loading hook for the promise-based `services/` functions.
 * Re-runs when `deps` change; ignores stale responses.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: readonly unknown[]): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e instanceof Error ? e : new Error('Unexpected error');
        if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
          window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
        }
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
