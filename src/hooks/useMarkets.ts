import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-24 Asia session)
// Brent: Goodreturns.in Mar 24 (day range $96.18–$100.43; Asia session ~$96.50). WTI: estimated proportional to Brent (-4.7%). Gold: Sunday Guardian Live Mar 24 ($4,418 stabilised after sharp decline).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 96.50,  change: -4.34, changePct: -4.30, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-24T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 84.70,  change: -4.20, changePct: -4.72, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-24T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4418.00, change: -9.09, changePct: -0.21, currency: "USD", unit: "/oz",     lastUpdated: "2026-03-24T00:00:00Z" },
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
