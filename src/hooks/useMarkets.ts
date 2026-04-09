import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-09 morning)
// Post-ceasefire state: Brent ~$96.84 (-18% from pre-ceasefire), WTI ~$97.33, Gold ~$4,730 (resilient safe-haven).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 96.84,  change: 0.45,  changePct: 0.47,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-09T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 97.33,  change: 2.92,  changePct: 3.09,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-09T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4730.45, change: -46.75, changePct: -0.98, currency: "USD", unit: "/oz",    lastUpdated: "2026-04-09T00:00:00Z" },
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
