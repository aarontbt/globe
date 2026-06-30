import { useEffect, useState } from "react";

const cache = new Map<string, unknown>();

interface StaticJsonState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

export function useStaticJson<T>(path: string, fallback: T): StaticJsonState<T> {
  const [state, setState] = useState<StaticJsonState<T>>(() => {
    if (cache.has(path)) {
      return { data: cache.get(path) as T, loading: false, error: null };
    }
    return { data: fallback, loading: true, error: null };
  });

  useEffect(() => {
    let cancelled = false;

    if (cache.has(path)) {
      setState({ data: cache.get(path) as T, loading: false, error: null });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        return response.json() as Promise<T>;
      })
      .then((data) => {
        cache.set(path, data);
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: fallback, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
  }, [path, fallback]);

  return state;
}
