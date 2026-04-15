import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-15 morning)
// Blockade-enforced, fresh-talks signal: Brent ~$93 (Apr 14 $94.79 CNBC, Apr 15 WTI $90.92 TradingEconomics), Gold ~$4,720 (safe-haven easing).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 93.00,  change: -1.79, changePct: -1.89, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-15T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 90.92,  change: -0.37, changePct: -0.40, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-15T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4720.00, change: -25.00, changePct: -0.53, currency: "USD", unit: "/oz",    lastUpdated: "2026-04-15T00:00:00Z" },
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
