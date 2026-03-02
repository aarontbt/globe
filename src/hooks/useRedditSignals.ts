import { useState, useEffect } from "react";
import type { GlobeEvent } from "../types";
import { fetchRedditSignals } from "../services/redditService";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min — Reddit allows 100 req/min free tier

interface Result {
  events: GlobeEvent[];
  loading: boolean;
  error: string | null;
}

export function useRedditSignals(): Result {
  const [events, setEvents] = useState<GlobeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await fetchRedditSignals();
        if (cancelled) return;
        setEvents(data);
        setError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return { events, loading, error };
}
