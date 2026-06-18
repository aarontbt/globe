import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-06-19; Jun 18 close carried — US markets closed Juneteenth; MOU formally signed Burgenstock Jun 19; Phase 2 nuclear talks begin)
// Brent $79.34 (TradingEconomics Jun 18, -0.27%); WTI $76.43 (Jun 18, -0.47%); Gold $4,218.09 (TradingEconomics Jun 18, -0.97%)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 79.34,   change: -0.21,  changePct: -0.27, currency: "USD", unit: "/barrel", lastUpdated: "2026-06-19T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 76.43,   change: -0.36,  changePct: -0.47, currency: "USD", unit: "/barrel", lastUpdated: "2026-06-19T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4218.09, change: -40.92, changePct: -0.97, currency: "USD", unit: "/oz",     lastUpdated: "2026-06-19T00:00:00Z" },
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
