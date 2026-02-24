import { useState, useEffect } from "react";
import type { GlobeEvent } from "../types";
import { fetchAseanEvents } from "../services/polymarket";

interface Result {
  events: GlobeEvent[];
  loading: boolean;
  error: string | null;
}

export function usePolymarketEvents(): Result {
  const [events, setEvents] = useState<GlobeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAseanEvents()
      .then(data => {
        if (!cancelled) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(String(err.message ?? err));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []); // fires exactly once on mount

  return { events, loading, error };
}
