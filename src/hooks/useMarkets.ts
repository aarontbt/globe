import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback - generated from src/data/daily-state.json (2026-08-11; D160)
// Brent Crude 89.11 (Yahoo Finance BZ=F 2026-08-12, confirmed); WTI Crude 83.47 (Yahoo Finance CL=F 2026-08-12, confirmed)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 89.11, change: 5.56, changePct: 6.65, currency: "USD", unit: "/barrel", lastUpdated: "2026-08-12T09:06:40.000Z" },
  { symbol: "CL=F", name: "WTI Crude", price: 83.47, change: 5.29, changePct: 6.77, currency: "USD", unit: "/barrel", lastUpdated: "2026-08-12T09:07:00.000Z" },
];

interface UseMarketsResult {
  quotes: MarketQuote[];
  loading: boolean;
  lastUpdated: Date | null;
}

export function useMarkets(): UseMarketsResult {
  const [quotes, setQuotes] = useState<MarketQuote[]>(FALLBACK_QUOTES);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const stopped = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (stopped.current) return;
    try {
      const data = await fetchAllQuotes();
      if (data.length > 0) {
        setQuotes(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        stopped.current = true; // rate-limited — stop permanently
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 60_000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return { quotes, loading, lastUpdated };
}
