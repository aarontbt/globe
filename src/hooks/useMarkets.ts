import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-27 Fri close)
// Brent: $112.57 confirmed (techi.com/CNBC Mar 27 — "highest since July 2022"). WTI: $99.64 confirmed (FX Leaders/CNBC Mar 27; intraday high $100.04). Gold: $4,430 confirmed (Sunday Guardian Live Mar 28 +1.2%).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 112.57, change: 4.56,  changePct: 4.22,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-27T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 99.64,  change: 5.15,  changePct: 5.46,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-27T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4430.00, change: 52.60, changePct: 1.20,  currency: "USD", unit: "/oz",    lastUpdated: "2026-03-27T00:00:00Z" },
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
