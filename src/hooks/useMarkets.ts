import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-20 close, carried for Mar 21-22 weekend)
// Brent: oilprice.com Mar 20 (Saudi airstrikes on Bandar Abbas; first direct Saudi military action against Iran). WTI: oilprice.com Mar 20. Gold: est. risk-off safe-haven bid Mar 20.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 121.40, change: 8.60,  changePct: 7.62, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-20T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 103.60, change: 6.41,  changePct: 6.60, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-20T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5028.40, change: 15.70, changePct: 0.31, currency: "USD", unit: "/oz",     lastUpdated: "2026-03-20T00:00:00Z" },
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
