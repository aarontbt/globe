import { useState, useEffect, useRef } from "react";
import type { GlobeEvent } from "../types";
import { fetchAseanEvents } from "../services/polymarket";

const POLL_INTERVAL_MS = 90_000; // 90 seconds

interface Result {
  events: GlobeEvent[];
  /** Events whose IDs weren't seen on the previous fetch — empty on first load. */
  newEvents: GlobeEvent[];
  loading: boolean;
  error: string | null;
}

export function usePolymarketEvents(): Result {
  const [events, setEvents] = useState<GlobeEvent[]>([]);
  const [newEvents, setNewEvents] = useState<GlobeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await fetchAseanEvents();
        if (cancelled) return;

        if (isFirstRef.current) {
          // First load — accept everything silently, no asteroid animation
          isFirstRef.current = false;
          data.forEach(e => knownIdsRef.current.add(e.id));
          setEvents(data);
          setNewEvents([]);
          setLoading(false);
        } else {
          // Subsequent polls — detect genuinely new market IDs
          const fresh = data.filter(e => !knownIdsRef.current.has(e.id));
          data.forEach(e => knownIdsRef.current.add(e.id));
          setEvents(data);
          setNewEvents(fresh); // may be [] — that's fine, impacts hook checks length
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setLoading(false);
        }
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

  return { events, newEvents, loading, error };
}
