import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects intel report baseline (2026-03-06)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 85.49,  change: 4.09,  changePct: 5.02, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-06T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 81.01,  change: 6.00,  changePct: 8.0,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-06T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5081.63, change: -2.57, changePct: -0.05, currency: "USD", unit: "/oz",   lastUpdated: "2026-03-06T00:00:00Z" },
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
