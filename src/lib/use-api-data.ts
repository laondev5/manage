'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';

/**
 * Client-side read of an authenticated API path. Re-runs when the path, active
 * organization, or the current account changes; `reload` forces a refresh.
 */
export function useApiData<T>(path: string | null) {
  const { request, me } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path || !me) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    request<T>(path, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause);
        setLoading(false);
      });
    return () => controller.abort();
  }, [path, request, me, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return { data, error, loading, reload, setData };
}
