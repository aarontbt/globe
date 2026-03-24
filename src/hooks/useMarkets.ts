import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-23 close)
// Brent: Bloomberg/Fortune Mar 23 (Trump 5-day pause on Iran power plant strikes; Brent -17%). WTI: CNBC Mar 23. Gold: confirmed Mar 24 (Natural Resource Stocks).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 100.84, change: -20.56, changePct: -16.93, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-23T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 88.90,  change: -14.70, changePct: -14.19, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-23T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4427.09, change: -601.31, changePct: -11.96, currency: "USD", unit: "/oz",    lastUpdated: "2026-03-24T00:00:00Z" },
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
