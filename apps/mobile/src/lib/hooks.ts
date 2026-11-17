import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { flushQueue, flushObservations } from './queue';
import { messageOf } from './api';

export function useApiResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await loaderRef.current();
        if (active) {
          setData(result);
          setError(null);
        }
      } catch (cause) {
        if (active) setError(messageOf(cause, 'This could not be loaded.'));
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
  }, []);

  return { data, setData, loading, refreshing, error, reload, refresh };
}

export function useAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (...args: Args) => {
      setBusy(true);
      setError(null);
      try {
        await action(...args);
        return true;
      } catch (cause) {
        setError(messageOf(cause, 'That action did not complete.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [action],
  );
  return { busy, error, setError, run };
}

/** Flushes the encrypted offline queue whenever the app returns to the foreground. */
export function useOfflineFlush(enabled: boolean) {
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (!enabled || flushing.current) return;
    flushing.current = true;
    try {
      await flushQueue();
      await flushObservations();
    } finally {
      flushing.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    void flush();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flush();
    });
    return () => subscription.remove();
  }, [flush]);

  return flush;
}
