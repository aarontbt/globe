import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback - generated from src/data/daily-state.json (2026-07-27; D145)
// Brent Crude 91.91 (Yahoo Finance 2026-07-27, confirmed); WTI Crude 84.60 (Yahoo Finance 2026-07-27, confirmed); Gold 4101.30 (Yahoo Finance 2026-07-27, confirmed)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 91.91, change: 0.9, changePct: 0.99, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-27T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude", price: 84.6, change: -0.31, changePct: -0.37, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-27T00:00:00Z" },
  { symbol: "GC=F", name: "Gold", price: 4101.3, change: 30.1, changePct: 0.74, currency: "USD", unit: "/oz", lastUpdated: "2026-07-27T00:00:00Z" },
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
