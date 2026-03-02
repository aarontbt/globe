import { useState, useEffect, useRef } from "react";
import type { GlobeEvent } from "../types";
import { fetchGdeltEvents } from "../services/gdeltService";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 min — matches GDELT update cadence

interface Result {
  events: GlobeEvent[];
  loading: boolean;
  error: string | null;
}

export function useGdeltEvents(): Result {
  const [events, setEvents] = useState<GlobeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await fetchGdeltEvents();
        if (cancelled) return;
        data.forEach(e => knownIdsRef.current.add(e.id));
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
