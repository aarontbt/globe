import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-13 morning)
// Blockade escalation state: Brent ~$102 (+7% on Trump naval blockade of Hormuz), WTI ~$104, Gold ~$4,835 (safe-haven surge).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 102.00, change: 6.80,   changePct: 7.14,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-13T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 104.00, change: 8.19,   changePct: 8.55,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-13T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4835.00, change: 83.32, changePct: 1.75,  currency: "USD", unit: "/oz",     lastUpdated: "2026-04-13T00:00:00Z" },
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
