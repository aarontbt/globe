import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback - generated from src/data/daily-state.json (2026-07-12; D130)
// Brent Crude 76.01 (Yahoo Finance 2026-07-10 Friday close, confirmed); WTI Crude 71.41 (Yahoo Finance 2026-07-10 Friday close, confirmed); Gold 4113.7 (Yahoo Finance 2026-07-10 Friday close, confirmed)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 76.01, change: -0.02, changePct: -0.03, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-12T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude", price: 71.41, change: -0.36, changePct: -0.5, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-12T00:00:00Z" },
  { symbol: "GC=F", name: "Gold", price: 4113.7, change: -18.8, changePct: -0.76, currency: "USD", unit: "/oz", lastUpdated: "2026-07-12T00:00:00Z" },
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
