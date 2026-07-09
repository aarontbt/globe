import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback - generated from src/data/daily-state.json (2026-07-09; D129)
// Brent Crude 76.03 (Yahoo Finance 2026-07-09, confirmed); WTI Crude 71.77 (Yahoo Finance 2026-07-09, confirmed); Gold 4132.5 (Yahoo Finance 2026-07-09, confirmed)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 76.03, change: 4.04, changePct: 5.61, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-09T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude", price: 71.77, change: 3.22, changePct: 4.7, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-09T00:00:00Z" },
  { symbol: "GC=F", name: "Gold", price: 4132.5, change: -22.6, changePct: -0.54, currency: "USD", unit: "/oz", lastUpdated: "2026-07-09T00:00:00Z" },
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
