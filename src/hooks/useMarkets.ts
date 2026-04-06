import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-04-06 morning)
// Brent: ~$110.50 est. (CNBC Apr 5-6, +1.4% deadline anxiety; WTI surpassing Brent per Rigzone Apr 3). WTI: $111.81 confirmed (OilPriceAPI NYMEX live Apr 6). Gold: ~$4,635 est. (150currency.com Apr 5).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 110.50, change: 1.47,   changePct: 1.35,   currency: "USD", unit: "/barrel", lastUpdated: "2026-04-06T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 111.81, change: 0.81,   changePct: 0.73,   currency: "USD", unit: "/barrel", lastUpdated: "2026-04-06T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4635.00, change: -40.00, changePct: -0.86,  currency: "USD", unit: "/oz",    lastUpdated: "2026-04-06T00:00:00Z" },
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
