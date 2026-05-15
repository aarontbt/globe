import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-05-15 morning; Brent est. TradingEconomics May 15; WTI est. May 15; Gold confirmed May 14 Fortune)
// Brent ~$106.10 May 15 est. (May 14 close $105.87 CNBC confirmed); WTI ~$101.20 est.; Gold $4,651.93 May 14 (-0.74%, Fortune confirmed); Iran MOU stalled; blockade 70+ tankers; tail 40%
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 106.10, change: +0.23,  changePct: +0.22, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-15T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 101.20, change: +0.20,  changePct: +0.20, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-15T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4651.93, change: -34.70, changePct: -0.74, currency: "USD", unit: "/oz",     lastUpdated: "2026-05-14T00:00:00Z" },
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
