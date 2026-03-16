import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-16 Asia morning)
// Brent: Euronews/Al Jazeera confirmed Mar 16 intraday. WTI: fxdailyreport.com Mar 16 (est.). Gold: IndiaTV News confirmed Mar 16.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 104.73, change: 3.89,   changePct: 3.86,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-16T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 98.82,  change: 4.28,   changePct: 4.53,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-16T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5005.54, change: -147.02, changePct: -2.85, currency: "USD", unit: "/oz",   lastUpdated: "2026-03-16T00:00:00Z" },
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
