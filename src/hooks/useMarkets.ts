import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback - generated from src/data/daily-state.json (2026-07-14; D132)
// Brent Crude 84.70 (Yahoo Finance 2026-07-14, confirmed); WTI Crude 79.83 (Yahoo Finance 2026-07-14, confirmed); Gold 4023.20 (Yahoo Finance 2026-07-14, confirmed)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 84.7, change: 6.68, changePct: 8.56, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-14T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude", price: 79.83, change: 6.31, changePct: 8.58, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-14T00:00:00Z" },
  { symbol: "GC=F", name: "Gold", price: 4023.2, change: -47.48, changePct: -1.17, currency: "USD", unit: "/oz", lastUpdated: "2026-07-14T00:00:00Z" },
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
