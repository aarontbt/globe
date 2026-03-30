import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-30 Mon open)
// Brent: $115.93 confirmed (Al Jazeera/oilpriceapi Mar 30 00:00 GMT, +2.98%). WTI: $102.60 est. (+3.0% from $99.64 Day 27 close). Gold: $4,493 confirmed (Mar 30, +1.4%).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 115.93, change: 3.36,  changePct: 2.98,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-30T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 102.60, change: 2.96,  changePct: 2.97,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-30T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4493.00, change: 63.00, changePct: 1.42,  currency: "USD", unit: "/oz",    lastUpdated: "2026-03-30T00:00:00Z" },
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
