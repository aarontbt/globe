import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback - generated from src/data/daily-state.json (2026-07-18; D136)
// Brent Crude 88.09 (Yahoo Finance 2026-07-18, confirmed); WTI Crude 81.77 (Yahoo Finance 2026-07-18, confirmed); Gold 4023 (Yahoo Finance 2026-07-18, confirmed)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 88.09, change: 4.77, changePct: 5.75, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-18T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude", price: 81.77, change: 3.63, changePct: 4.65, currency: "USD", unit: "/barrel", lastUpdated: "2026-07-18T00:00:00Z" },
  { symbol: "GC=F", name: "Gold", price: 4023, change: 26, changePct: 0.65, currency: "USD", unit: "/oz", lastUpdated: "2026-07-18T00:00:00Z" },
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
