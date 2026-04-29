import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-29 morning; last confirmed Apr 28)
// Brent confirmed $111.16 Apr 28 (TradingEconomics, +2.71%); TTF confirmed €44.31 Apr 28 (-0.84%); WTI ~$99.50 est. Apr 28; May 1 War Powers deadline; GCC summit Jeddah (Apr 28); tail risk 45%.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 111.16, change: 2.95,   changePct: 2.73,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-29T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 99.50,  change: 3.00,   changePct: 3.11,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-29T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5190.00, change: 40.00,  changePct: 0.78,  currency: "USD", unit: "/oz",     lastUpdated: "2026-04-29T00:00:00Z" },
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
