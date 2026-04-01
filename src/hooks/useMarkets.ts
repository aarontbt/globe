import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-04-01 morning)
// Brent: $100.64 confirmed (Reuters Apr 1 0641 GMT, -13.2% on Trump 'leaving in 2-3 weeks'). WTI: $98.04 confirmed (Reuters Apr 1). Gold: $4,654.50 confirmed (Sunday Guardian Apr 1, +2.8%).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 100.64, change: -15.29, changePct: -13.19, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-01T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 98.04,  change: -4.56,  changePct: -4.44,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-01T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4654.50, change: 161.50, changePct: 2.80,  currency: "USD", unit: "/oz",    lastUpdated: "2026-04-01T00:00:00Z" },
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
