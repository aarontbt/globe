import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-04-07 morning)
// Brent: ~$110.00 est. (CNBC TV18 Apr 7 early Asia, "near four-year highs"; WTI surpassing Brent as overseas buyers rush US crude). WTI: ~$113.00 confirmed (CNBC TV18 Apr 7; tested $115 on Apr 6). Gold: ~$4,685 confirmed (Sunday Guardian Live Apr 7, +1.1%).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 110.00, change: -0.50,  changePct: -0.45,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-07T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 113.00, change: 1.19,   changePct: 1.06,   currency: "USD", unit: "/barrel", lastUpdated: "2026-04-07T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4685.00, change: 50.00, changePct: 1.08,   currency: "USD", unit: "/oz",    lastUpdated: "2026-04-07T00:00:00Z" },
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
